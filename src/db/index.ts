import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

let db: Database.Database | null = null;

/**
 * Initialize SQLite database connection
 * Creates database file and directory if they don't exist
 * 
 * @param dbPath - Path to SQLite database file
 */
export function initializeDatabase(dbPath: string): void {
  if (db) {
    throw new Error('Database already initialized');
  }

  // Ensure the directory exists before creating the database
  const dbDir = dirname(dbPath);
  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
    if (error instanceof Error && !error.message.includes('EEXIST')) {
      throw error;
    }
  }

  // Create database connection
  // WAL mode for better concurrency
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  console.log(`Database initialized at: ${dbPath}`);
}

/**
 * Get the database instance
 * Throws error if database hasn't been initialized
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Reset database by clearing all tables
 * Useful for test cleanup
 * WARNING: This deletes all data from all tables
 */
export function resetDatabase(): void {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }

  // Disable foreign keys temporarily for faster deletion
  db.pragma('foreign_keys = OFF');

  // Delete all data from tables (in reverse order of dependencies)
  db.exec(`
    DELETE FROM analyses;
    DELETE FROM scans;
    DELETE FROM issues;
  `);

  // Re-enable foreign keys
  db.pragma('foreign_keys = ON');
}

/**
 * Close database connection
 * Should be called on application shutdown
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}
