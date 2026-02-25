/**
 * AI Provider Service — Unified abstraction layer
 * 
 * Routes AI calls to either Gemini (direct frontend) or OpenAI (backend proxy)
 * based on the current provider selection.
 * 
 * Provider preference is stored in localStorage and can be toggled
 * from the Admin Dashboard.
 */

// Gemini services (direct frontend calls)
import {
  generateQuestionsWithGemini,
  evaluateAnswerWithGemini,
  evaluateBatchAnswersWithGemini,
  analyzeResumeWithGemini,
  testGeminiAPI,
} from './geminiService';
import type {
  GeneratedQuestion,
  AIEvaluationResult,
  BatchEvaluationInput,
  BatchEvaluationResult,
  AIATSAnalysis,
} from './geminiService';

// OpenAI services (via backend proxy)
import {
  generateQuestionsWithOpenAI,
  evaluateAnswerWithOpenAI,
  evaluateBatchAnswersWithOpenAI,
  analyzeResumeWithOpenAI,
  testOpenAIAPI,
} from './openaiService';

// ==================== TYPES ====================

export type AIProvider = 'gemini' | 'openai';

export interface AIProviderConfig {
  provider: AIProvider;
  displayName: string;
  description: string;
  model: string;
  isBackendProxy: boolean;
}

// ==================== PROVIDER CONFIG ====================

const PROVIDER_CONFIGS: Record<AIProvider, AIProviderConfig> = {
  gemini: {
    provider: 'gemini',
    displayName: 'Google Gemini',
    description: 'Direct frontend calls to Gemini 2.5 Flash Lite',
    model: 'gemini-2.5-flash-lite',
    isBackendProxy: false,
  },
  openai: {
    provider: 'openai',
    displayName: 'OpenAI GPT-4.1 Mini',
    description: 'Secure backend proxy to GPT-4.1-mini',
    model: 'gpt-4.1-mini',
    isBackendProxy: true,
  },
};

const STORAGE_KEY = 'mockmate_ai_provider';

// ==================== PROVIDER MANAGEMENT ====================

/**
 * Get the currently selected AI provider
 */
export function getAIProvider(): AIProvider {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'gemini' || stored === 'openai') {
      return stored;
    }
  } catch {}
  return 'gemini'; // Default to Gemini
}

/**
 * Set the AI provider
 */
export function setAIProvider(provider: AIProvider): void {
  localStorage.setItem(STORAGE_KEY, provider);
  console.log(`🔄 AI Provider switched to: ${PROVIDER_CONFIGS[provider].displayName}`);
}

/**
 * Toggle between Gemini and OpenAI
 */
export function toggleAIProvider(): AIProvider {
  const current = getAIProvider();
  const next: AIProvider = current === 'gemini' ? 'openai' : 'gemini';
  setAIProvider(next);
  return next;
}

/**
 * Get config for the current provider
 */
export function getAIProviderConfig(): AIProviderConfig {
  return PROVIDER_CONFIGS[getAIProvider()];
}

/**
 * Get config for a specific provider
 */
export function getProviderConfig(provider: AIProvider): AIProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

// ==================== UNIFIED AI FUNCTIONS ====================

/**
 * Test API connectivity for the current provider
 */
export async function testCurrentAI(): Promise<{ success: boolean; response?: string; error?: string }> {
  const provider = getAIProvider();
  console.log(`🔍 Testing ${provider} API...`);
  
  if (provider === 'openai') {
    return testOpenAIAPI();
  }
  return testGeminiAPI();
}

/**
 * Generate interview questions using the current provider
 */
export async function generateQuestions(roleTitle: string): Promise<GeneratedQuestion[]> {
  const provider = getAIProvider();
  console.log(`📤 Generating questions with ${provider} for: ${roleTitle}`);
  
  if (provider === 'openai') {
    return generateQuestionsWithOpenAI(roleTitle);
  }
  return generateQuestionsWithGemini(roleTitle);
}

/**
 * Evaluate an answer using the current provider
 */
export async function evaluateAnswer(question: string, answer: string): Promise<AIEvaluationResult> {
  const provider = getAIProvider();
  
  if (provider === 'openai') {
    return evaluateAnswerWithOpenAI(question, answer);
  }
  return evaluateAnswerWithGemini(question, answer);
}

/**
 * Batch evaluate answers using the current provider
 */
export async function evaluateBatchAnswers(
  questionsAndAnswers: BatchEvaluationInput[]
): Promise<BatchEvaluationResult> {
  const provider = getAIProvider();
  console.log(`📤 Batch evaluating with ${provider}`);
  
  if (provider === 'openai') {
    return evaluateBatchAnswersWithOpenAI(questionsAndAnswers);
  }
  return evaluateBatchAnswersWithGemini(questionsAndAnswers);
}

/**
 * Analyze resume using the current provider
 */
export async function analyzeResume(resumeText: string, targetRole: string): Promise<AIATSAnalysis> {
  const provider = getAIProvider();
  console.log(`📤 Analyzing resume with ${provider}`);
  
  if (provider === 'openai') {
    return analyzeResumeWithOpenAI(resumeText, targetRole);
  }
  return analyzeResumeWithGemini(resumeText, targetRole);
}

// Re-export types for convenience
export type { GeneratedQuestion, AIEvaluationResult, BatchEvaluationInput, BatchEvaluationResult, AIATSAnalysis };
