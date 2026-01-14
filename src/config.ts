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
  // Add more config values as needed (e.g., GitHub token, LLM API keys)
}

/**
 * Get application configuration from environment variables
 * Throws error if required values are missing
 */
export function getConfig(): Config {
  const port = parseInt(process.env.PORT || '3000', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbPath = process.env.DB_PATH || './data/scanner.db';

  if (isNaN(port)) {
    throw new Error('PORT must be a valid number');
  }

  return {
    port,
    nodeEnv,
    dbPath,
  };
}
