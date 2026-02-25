/**
 * Centralized API Keys Configuration
 * 
 * API keys are now loaded from environment variables for better security.
 * Make sure to set these in your .env file:
 * - VITE_GEMINI_API_KEY (main Gemini API key)
 * - VITE_GEMINI_CHATBOT_API_KEY (chatbot service)
 * - VITE_GEMINI_FRIEDE_API_KEY (FRIEDE bot interview)
 * - VITE_JUDGE0_API_KEY (Judge0 code execution)
 */

// Get API keys from environment variables without fallbacks for security
const getEnvVar = (key: string, required: boolean = true): string => {
  const value = import.meta.env[key];
  if (!value && required) {
    console.error(`❌ ${key} not found in environment variables. Please add it to your .env file.`);
    return '';
  }
  return value || '';
};

export const API_KEYS = {
  // Main Gemini API Key - used for general interview functionality
  GEMINI_MAIN: getEnvVar('VITE_GEMINI_API_KEY'),
  
  // Chatbot service API key
  GEMINI_CHATBOT: getEnvVar('VITE_GEMINI_CHATBOT_API_KEY'),
  
  // FRIEDE bot interview API key
  GEMINI_FRIEDE: getEnvVar('VITE_GEMINI_FRIEDE_API_KEY'),
  
  // Judge0 API Configuration
  JUDGE0_API_KEY: getEnvVar('VITE_JUDGE0_API_KEY'),
  JUDGE0_API_HOST: getEnvVar('VITE_JUDGE0_API_HOST'),
  JUDGE0_BASE_URL: getEnvVar('VITE_JUDGE0_BASE_URL'),
} as const;

// Rate limiting configuration shared across all services
export const RATE_LIMIT = {
  MIN_API_CALL_INTERVAL: 4000, // 4 seconds (15 requests per minute)
} as const;

// Security configuration
export const SECURITY_CONFIG = {
  MAX_CODE_LENGTH: parseInt(getEnvVar('VITE_MAX_CODE_LENGTH', false) || '50000'),
  MAX_EXECUTION_TIME: parseInt(getEnvVar('VITE_MAX_EXECUTION_TIME', false) || '10000'),
  ENABLE_CODE_SANITIZATION: getEnvVar('VITE_ENABLE_CODE_SANITIZATION', false) !== 'false',
} as const;
