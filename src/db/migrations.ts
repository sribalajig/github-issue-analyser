import { getDatabase } from './index';

/**
 * Run database migrations to create/update schema
 * Creates tables if they don't exist
 */
export function runMigrations(): void {
  const db = getDatabase();

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create scans table
  // Stores scan requests and their results
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repository_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      error_message TEXT,
      issues_count INTEGER DEFAULT 0
    )
  `);

  // Create analyses table
  // Stores analysis requests and their results
  db.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      error_message TEXT,
      analysis_result TEXT,
      FOREIGN KEY (scan_id) REFERENCES scans(id)
    )
  `);

  // Create indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
    CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at);
    CREATE INDEX IF NOT EXISTS idx_analyses_scan_id ON analyses(scan_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
  `);

  console.log('Database migrations completed');
}
