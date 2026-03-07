// Judge0 API Integration Service
// All code execution goes through the server-side proxy (/api/judge0/*)
// The server handles AWS self-hosted instance (primary) + RapidAPI fallback.
// NO API keys are exposed to the browser.

import { SECURITY_CONFIG } from '@/config/apiKeys';
import { getAuthToken } from '@/lib/api';
import { ProgrammingLanguage } from '@/types/coding';

// Judge0 Language IDs
// Reference: https://ce.judge0.com/#statuses-and-languages-language-get
export const LANGUAGE_IDS: Record<ProgrammingLanguage, number> = {
  javascript: 63, // Node.js
  python: 71,     // Python 3
  java: 62,       // Java (OpenJDK 13.0.1)
  cpp: 54,        // C++ (GCC 9.2.0)
};

interface Judge0Response {
  token: string;
  provider?: string;
  status?: {
    id: number;
    description: string;
  };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  memory?: number;
  statusDescription?: string;
}

// --- Helpers ---

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/**
 * Sanitize code input to prevent malicious code execution
 */
const sanitizeCode = (
  code: string,
  language: ProgrammingLanguage
): { sanitized: string; warnings: string[] } => {
  const warnings: string[] = [];
  let sanitized = code;

  if (!SECURITY_CONFIG.ENABLE_CODE_SANITIZATION) {
    return { sanitized, warnings };
  }

  if (code.length > SECURITY_CONFIG.MAX_CODE_LENGTH) {
    throw new Error(
      `Code exceeds maximum length of ${SECURITY_CONFIG.MAX_CODE_LENGTH} characters`
    );
  }

  const dangerousPatterns: Record<ProgrammingLanguage, RegExp[]> = {
    javascript: [
      /require\s*\(\s*['"]child_process['"]\s*\)/gi,
      /require\s*\(\s*['"]fs['"]\s*\)/gi,
    ],
    python: [/import\s+subprocess/gi, /__import__\s*\(/gi],
    java: [/Runtime\.getRuntime\(\)/gi, /ProcessBuilder/gi],
    cpp: [/system\s*\(/gi, /popen\s*\(/gi],
  };

  const patterns = dangerousPatterns[language] || [];
  for (const pattern of patterns) {
    if (pattern.test(code)) {
      warnings.push(`Potentially dangerous pattern detected: ${pattern.source}`);
    }
  }

  // eslint-disable-next-line no-control-regex
  sanitized = sanitized
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  return { sanitized, warnings };
};

// --- Core: executeCode via server-side Judge0 proxy ---

/**
 * Sends source code to the server-side Judge0 proxy which forwards to
 * self-hosted AWS (primary) or RapidAPI (fallback).
 * Polls /api/judge0/result/:token every 2 s until the judge finishes.
 */
export const executeCode = async (
  sourceCode: string,
  languageId: number,
  stdin: string = ''
): Promise<ExecutionResult> => {
  const overallStart = performance.now();

  // 1. POST the submission via our server proxy
  const submission = {
    source_code: btoa(unescape(encodeURIComponent(sourceCode))),
    language_id: languageId,
    stdin: stdin ? btoa(unescape(encodeURIComponent(stdin))) : undefined,
    cpu_time_limit: SECURITY_CONFIG.MAX_EXECUTION_TIME / 1000,
    memory_limit: 256000,
  };

  const postRes = await fetch('/api/judge0/submit', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(submission),
  });

  if (!postRes.ok) {
    const errData = await postRes
      .json()
      .catch(() => ({ error: `HTTP ${postRes.status}` }));
    throw new Error(
      errData.error || `Judge0 submission failed (${postRes.status})`
    );
  }

  const { token, provider } = (await postRes.json()) as {
    token: string;
    provider: string;
  };
  if (!token) throw new Error('Judge0 did not return a submission token');

  // 2. Poll every 2 seconds, up to 30 s
  const POLL_INTERVAL = 2000;
  const MAX_POLLS = 15;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    const getRes = await fetch(
      `/api/judge0/result/${token}?provider=${provider}`,
      { method: 'GET', headers: authHeaders() }
    );

    if (!getRes.ok) {
      throw new Error(`Judge0 poll failed (${getRes.status})`);
    }

    const result: Judge0Response = await getRes.json();
    const statusId = result.status?.id ?? 0;

    // 1 = In Queue, 2 = Processing -> keep polling
    if (statusId <= 2) continue;

    // Decode base-64 fields
    const stdout = result.stdout
      ? decodeURIComponent(escape(atob(result.stdout)))
      : '';
    const stderr = result.stderr
      ? decodeURIComponent(escape(atob(result.stderr)))
      : '';
    const compileOutput = result.compile_output
      ? decodeURIComponent(escape(atob(result.compile_output)))
      : '';
    const statusDescription = result.status?.description || 'Unknown';
    const execTimeMs = parseFloat(result.time || '0') * 1000;

    // 3 = Accepted
    if (statusId === 3) {
      return {
        success: true,
        output: stdout.trim(),
        executionTime: execTimeMs,
        memory: result.memory ?? undefined,
        statusDescription,
      };
    }

    // 6 = Compilation Error
    if (statusId === 6) {
      return {
        success: false,
        output: '',
        error: compileOutput || 'Compilation Error',
        executionTime: execTimeMs,
        statusDescription: 'Compilation Error',
      };
    }

    // 5 = Time Limit Exceeded
    if (statusId === 5) {
      return {
        success: false,
        output: stdout.trim(),
        error: 'Time Limit Exceeded - your code took too long to execute.',
        executionTime: execTimeMs,
        statusDescription: 'Time Limit Exceeded',
      };
    }

    // 7-12 = Runtime errors (SIGSEGV, SIGFPE, etc.)
    if (statusId >= 7 && statusId <= 12) {
      return {
        success: false,
        output: stdout.trim(),
        error: stderr || result.message || 'Runtime Error',
        executionTime: execTimeMs,
        statusDescription: statusDescription,
      };
    }

    // 4 = Wrong Answer, 13 = Internal Error, etc.
    return {
      success: false,
      output: stdout.trim(),
      error:
        stderr ||
        compileOutput ||
        result.message ||
        `Execution finished with status: ${statusDescription}`,
      executionTime: execTimeMs,
      statusDescription,
    };
  }

  // Timed out waiting for Judge0
  return {
    success: false,
    output: '',
    error:
      'Execution timed out - Judge0 did not return a result in 30 seconds.',
    executionTime: performance.now() - overallStart,
    statusDescription: 'Timeout',
  };
};

// --- Convenience wrapper keeping old signature ---

/**
 * Submit code using ProgrammingLanguage string (resolves to Judge0 language ID).
 * Kept for backward-compatibility with codeExecutionService.ts.
 */
export const submitCodeExecution = async (
  code: string,
  language: ProgrammingLanguage,
  input: string = ''
): Promise<ExecutionResult> => {
  const { sanitized, warnings } = sanitizeCode(code, language);
  if (warnings.length > 0) console.warn('Code sanitization warnings:', warnings);

  const languageId = LANGUAGE_IDS[language];
  if (!languageId) throw new Error(`Unsupported language: ${language}`);

  return executeCode(sanitized, languageId, input);
};

/**
 * Test Judge0 API connection
 */
export const testJudge0Connection = async (): Promise<boolean> => {
  try {
    const result = await submitCodeExecution(
      'console.log("Hello, Judge0!");',
      'javascript',
      ''
    );
    return result.success;
  } catch {
    return false;
  }
};

export default {
  executeCode,
  submitCodeExecution,
  testJudge0Connection,
  LANGUAGE_IDS,
};
