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

  if (isNaN(port)) {
    throw new Error('PORT must be a valid number');
  }

  if (!openaiApiKey && nodeEnv === 'production') {
    throw new Error('OPENAI_API_KEY is required in production');
  }

  return {
    port,
    nodeEnv,
    dbPath,
    openaiApiKey,
  };
}
