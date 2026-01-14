/**
 * Global test setup
 * Runs before all tests to configure the test environment
 */

// Suppress all console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
} as unknown as Console;
