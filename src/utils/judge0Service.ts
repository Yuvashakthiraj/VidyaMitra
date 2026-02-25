// Judge0 API Integration Service
// Provides real code execution for multiple programming languages via Judge0 (RapidAPI)
// Uses async submission + polling for reliable results

import { API_KEYS, SECURITY_CONFIG } from '@/config/apiKeys';
import { ProgrammingLanguage } from '@/types/coding';

// Judge0 Language IDs
// Reference: https://ce.judge0.com/#statuses-and-languages-language-get
export const LANGUAGE_IDS: Record<ProgrammingLanguage, number> = {
  javascript: 63,  // Node.js
  python: 71,      // Python 3
  java: 62,        // Java (OpenJDK 13.0.1)
  cpp: 54,         // C++ (GCC 9.2.0)
};

interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
}

interface Judge0Response {
  token: string;
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

// ─── Helpers ────────────────────────────────────────────────────────────────

const headers = () => ({
  'Content-Type': 'application/json',
  'x-rapidapi-key': API_KEYS.JUDGE0_API_KEY,
  'x-rapidapi-host': API_KEYS.JUDGE0_API_HOST,
});

/**
 * Sanitize code input to prevent malicious code execution
 */
const sanitizeCode = (code: string, language: ProgrammingLanguage): { sanitized: string; warnings: string[] } => {
  const warnings: string[] = [];
  let sanitized = code;

  if (!SECURITY_CONFIG.ENABLE_CODE_SANITIZATION) {
    return { sanitized, warnings };
  }

  if (code.length > SECURITY_CONFIG.MAX_CODE_LENGTH) {
    throw new Error(`Code exceeds maximum length of ${SECURITY_CONFIG.MAX_CODE_LENGTH} characters`);
  }

  const dangerousPatterns: Record<ProgrammingLanguage, RegExp[]> = {
    javascript: [
      /require\s*\(\s*['"]child_process['"]\s*\)/gi,
      /require\s*\(\s*['"]fs['"]\s*\)/gi,
    ],
    python: [
      /import\s+subprocess/gi,
      /__import__\s*\(/gi,
    ],
    java: [
      /Runtime\.getRuntime\(\)/gi,
      /ProcessBuilder/gi,
    ],
    cpp: [
      /system\s*\(/gi,
      /popen\s*\(/gi,
    ],
  };

  const patterns = dangerousPatterns[language] || [];
  for (const pattern of patterns) {
    if (pattern.test(code)) {
      warnings.push(`Potentially dangerous pattern detected: ${pattern.source}`);
    }
  }

  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/\0/g, '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  return { sanitized, warnings };
};

// ─── Core: executeCode via Judge0 ──────────────────────────────────────────

/**
 * Helper that sends source code + languageId to Judge0 POST /submissions,
 * then polls GET /submissions/:token every 2 s until the judge finishes.
 * Returns stdout on success, or stderr / compile_output on failure.
 */
export const executeCode = async (
  sourceCode: string,
  languageId: number,
  stdin: string = ''
): Promise<ExecutionResult> => {
  const overallStart = performance.now();

  // Validate API config
  if (!API_KEYS.JUDGE0_API_KEY || !API_KEYS.JUDGE0_BASE_URL) {
    throw new Error('Judge0 API credentials not configured. Please add VITE_JUDGE0_API_KEY and VITE_JUDGE0_BASE_URL to your .env file.');
  }

  // 1. POST the submission (no wait – we poll ourselves)
  const submission: Judge0Submission = {
    source_code: btoa(unescape(encodeURIComponent(sourceCode))), // safe base64 for unicode
    language_id: languageId,
    stdin: stdin ? btoa(unescape(encodeURIComponent(stdin))) : undefined,
    cpu_time_limit: SECURITY_CONFIG.MAX_EXECUTION_TIME / 1000,
    memory_limit: 256000,
  };

  const postRes = await fetch(
    `${API_KEYS.JUDGE0_BASE_URL}/submissions?base64_encoded=true&wait=false`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(submission),
    }
  );

  if (!postRes.ok) {
    const errText = await postRes.text();
    throw new Error(`Judge0 submission failed (${postRes.status}): ${errText}`);
  }

  const { token } = (await postRes.json()) as Judge0Response;
  if (!token) throw new Error('Judge0 did not return a submission token');

  // 2. Poll every 2 seconds, up to 30 s
  const POLL_INTERVAL = 2000;
  const MAX_POLLS = 15;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    const getRes = await fetch(
      `${API_KEYS.JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=true&fields=*`,
      { method: 'GET', headers: headers() }
    );

    if (!getRes.ok) {
      throw new Error(`Judge0 poll failed (${getRes.status})`);
    }

    const result: Judge0Response = await getRes.json();
    const statusId = result.status?.id ?? 0;

    // 1 = In Queue, 2 = Processing → keep polling
    if (statusId <= 2) continue;

    // Decode base-64 fields
    const stdout = result.stdout ? decodeURIComponent(escape(atob(result.stdout))) : '';
    const stderr = result.stderr ? decodeURIComponent(escape(atob(result.stderr))) : '';
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
        error: 'Time Limit Exceeded – your code took too long to execute.',
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
      error: stderr || compileOutput || result.message || `Execution finished with status: ${statusDescription}`,
      executionTime: execTimeMs,
      statusDescription,
    };
  }

  // Timed out waiting for Judge0
  return {
    success: false,
    output: '',
    error: 'Execution timed out – Judge0 did not return a result in 30 seconds.',
    executionTime: performance.now() - overallStart,
    statusDescription: 'Timeout',
  };
};

// ─── Convenience wrapper keeping old signature ─────────────────────────────

/**
 * Submit code using ProgrammingLanguage string (resolves to Judge0 language ID).
 * Kept for backward-compatibility with codeExecutionService.ts.
 */
export const submitCodeExecution = async (
  code: string,
  language: ProgrammingLanguage,
  input: string = ''
): Promise<ExecutionResult> => {
  // Sanitize
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
    const result = await submitCodeExecution('console.log("Hello, Judge0!");', 'javascript', '');
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