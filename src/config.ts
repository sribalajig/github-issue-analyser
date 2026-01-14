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
  maxAnalysisIssues: number;
  maxBodyChars: number;
  maxTotalChars: number;
  maxScanIssues?: number;
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
  const maxAnalysisIssues = parseInt(process.env.MAX_ANALYSIS_ISSUES || '50', 10);
  const maxBodyChars = parseInt(process.env.MAX_BODY_CHARS || '1000', 10);
  const maxTotalChars = parseInt(process.env.MAX_TOTAL_CHARS || '30000', 10);
  const maxScanIssues = process.env.MAX_SCAN_ISSUES
    ? parseInt(process.env.MAX_SCAN_ISSUES, 10)
    : undefined;

  if (isNaN(port)) {
    throw new Error('PORT must be a valid number');
  }

  if (isNaN(maxAnalysisIssues) || maxAnalysisIssues < 1) {
    throw new Error('MAX_ANALYSIS_ISSUES must be a positive number');
  }

  if (isNaN(maxBodyChars) || maxBodyChars < 1) {
    throw new Error('MAX_BODY_CHARS must be a positive number');
  }

  if (isNaN(maxTotalChars) || maxTotalChars < 1) {
    throw new Error('MAX_TOTAL_CHARS must be a positive number');
  }

  if (maxScanIssues !== undefined && (isNaN(maxScanIssues) || maxScanIssues < 1)) {
    throw new Error('MAX_SCAN_ISSUES must be a positive number if provided');
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
    maxBodyChars,
    maxTotalChars,
    maxScanIssues,
  };
}
