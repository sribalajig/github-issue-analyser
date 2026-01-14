import { initializeDatabase, closeDatabase, resetDatabase } from '../../src/db';
import { runMigrations } from '../../src/db/migrations';

const TEST_DB_PATH = './data/test.db';

/**
 * Test database utilities
 * Handles setup and teardown of test database
 */

/**
 * Initialize test database
 * Creates database file and runs migrations
 */
export function setupTestDatabase(): void {
  initializeDatabase(TEST_DB_PATH);
  runMigrations();
}

/**
 * Clear all data from test database
 * Keeps schema intact for faster test execution
 */
export function clearTestDatabase(): void {
  resetDatabase();
}

/**
 * Close test database connection
 */
export function teardownTestDatabase(): void {
  closeDatabase();
}
