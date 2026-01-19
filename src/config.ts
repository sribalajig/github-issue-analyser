import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration loaded from environment variables
 * Provides type-safe access to configuration values
 */
export interface Config {
  port: number;
  nodeEnv: string;
  dbPath: string;
  openaiApiKey: string;
  maxAnalysisIssues?: number;
  maxScanIssues?: number;
  // Token-based configuration
  maxTokensPerChunk: number;
  maxTokensForSynthesis: number;
  maxTotalTokens?: number;
  modelContextWindow: number;
  // Model pricing (cost per 1K tokens)
  costPerInputToken1K: number;
  costPerOutputToken1K: number;
  // Add more config values as needed (e.g., GitHub token)
}

/**
 * Get application configuration from environment variables
 * Throws error if required values are missing
 */
export function getConfig(): Config {
  const port = parseInt(process.env.PORT || '3000', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbPath = process.env.DB_PATH || './data/scanner.db';
  const openaiApiKey = process.env.OPENAI_API_KEY || '';
  const maxAnalysisIssues = process.env.MAX_ANALYSIS_ISSUES
    ? parseInt(process.env.MAX_ANALYSIS_ISSUES, 10)
    : undefined;
  const maxScanIssues = process.env.MAX_SCAN_ISSUES
    ? parseInt(process.env.MAX_SCAN_ISSUES, 10)
    : undefined;

  // Token-based configuration
  // Default: GPT-4o has 128K context window
  const modelContextWindow = parseInt(process.env.MODEL_CONTEXT_WINDOW || '128000', 10);
  
  // Automatically calculate chunk sizes based on context window if not explicitly set
  // Reserve ~20% for output and overhead, use remaining for input
  const defaultMaxTokensPerChunk = Math.floor(modelContextWindow * 0.3); // 30% of context window per chunk
  const defaultMaxTokensForSynthesis = Math.floor(modelContextWindow * 0.4); // 40% for synthesis (needs to fit all chunk results)
  
  const maxTokensPerChunk = process.env.MAX_TOKENS_PER_CHUNK
    ? parseInt(process.env.MAX_TOKENS_PER_CHUNK, 10)
    : defaultMaxTokensPerChunk;
  const maxTokensForSynthesis = process.env.MAX_TOKENS_FOR_SYNTHESIS
    ? parseInt(process.env.MAX_TOKENS_FOR_SYNTHESIS, 10)
    : defaultMaxTokensForSynthesis;
  const maxTotalTokens = process.env.MAX_TOTAL_TOKENS
    ? parseInt(process.env.MAX_TOTAL_TOKENS, 10)
    : undefined;

  // Model pricing configuration
  // Default: GPT-4o pricing ($2.50 per 1M input tokens = $0.0025 per 1K, $10.00 per 1M output tokens = $0.01 per 1K)
  const costPerInputToken1K = parseFloat(process.env.COST_PER_INPUT_TOKEN_1K || '0.0025');
  const costPerOutputToken1K = parseFloat(process.env.COST_PER_OUTPUT_TOKEN_1K || '0.01');

  if (isNaN(port)) {
    throw new Error('PORT must be a valid number');
  }

  if (maxAnalysisIssues !== undefined && (isNaN(maxAnalysisIssues) || maxAnalysisIssues < 1)) {
    throw new Error('MAX_ANALYSIS_ISSUES must be a positive number if provided');
  }

  if (maxScanIssues !== undefined && (isNaN(maxScanIssues) || maxScanIssues < 1)) {
    throw new Error('MAX_SCAN_ISSUES must be a positive number if provided');
  }

  if (isNaN(modelContextWindow) || modelContextWindow < 1) {
    throw new Error('MODEL_CONTEXT_WINDOW must be a positive number');
  }

  if (isNaN(maxTokensPerChunk) || maxTokensPerChunk < 1) {
    throw new Error('MAX_TOKENS_PER_CHUNK must be a positive number');
  }

  if (isNaN(maxTokensForSynthesis) || maxTokensForSynthesis < 1) {
    throw new Error('MAX_TOKENS_FOR_SYNTHESIS must be a positive number');
  }

  if (maxTotalTokens !== undefined && (isNaN(maxTotalTokens) || maxTotalTokens < 1)) {
    throw new Error('MAX_TOTAL_TOKENS must be a positive number if provided');
  }

  if (isNaN(costPerInputToken1K) || costPerInputToken1K < 0) {
    throw new Error('COST_PER_INPUT_TOKEN_1K must be a non-negative number');
  }

  if (isNaN(costPerOutputToken1K) || costPerOutputToken1K < 0) {
    throw new Error('COST_PER_OUTPUT_TOKEN_1K must be a non-negative number');
  }

  if (!openaiApiKey && nodeEnv === 'production') {
    throw new Error('OPENAI_API_KEY is required in production');
  }

  return {
    port,
    nodeEnv,
    dbPath,
    openaiApiKey,
    maxAnalysisIssues,
    maxScanIssues,
    maxTokensPerChunk,
    maxTokensForSynthesis,
    maxTotalTokens,
    modelContextWindow,
    costPerInputToken1K,
    costPerOutputToken1K,
  };
}
