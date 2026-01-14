import { createApp } from './app';
import { getConfig } from './config';
import { initializeDatabase } from './db';
import { runMigrations } from './db/migrations';
import { initializeLLM } from './services/llm';

/**
 * Main server startup function
 * Initializes database, runs migrations, and starts Express server
 */
async function startServer(): Promise<void> {
  try {
    const config = getConfig();

    // Initialize database connection
    console.log('Initializing database...');
    initializeDatabase(config.dbPath);

    // Run migrations to ensure schema is up to date
    console.log('Running database migrations...');
    runMigrations();

    // Initialize LLM service
    console.log('Initializing LLM service...');
    initializeLLM();

    // Create Express app
    const app = createApp();

    // Start server
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
