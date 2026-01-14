import request from 'supertest';
import { createApp } from '../../src/app';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../helpers/db';
import { getIssueCount } from '../../src/db/issues';
import { GitHubIssue } from '../../src/services/github';

// Mock the GitHub service
jest.mock('../../src/services/github', () => ({
  ...jest.requireActual('../../src/services/github'),
  fetchOpenIssues: jest.fn(),
  scanRepository: jest.fn(),
}));

import { scanRepository } from '../../src/services/github';

const mockScanRepository = scanRepository as jest.MockedFunction<typeof scanRepository>;

describe('POST /scan', () => {
  let app: ReturnType<typeof createApp>;
  const testRepo = 'test-owner/test-repo';

  // Sample issues for testing
  const mockIssues: GitHubIssue[] = [
    {
      id: 1,
      number: 1,
      title: 'Test Issue 1',
      body: 'Body of issue 1',
      state: 'open',
      html_url: 'https://github.com/test-owner/test-repo/issues/1',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      number: 2,
      title: 'Test Issue 2',
      body: 'Body of issue 2',
      state: 'open',
      html_url: 'https://github.com/test-owner/test-repo/issues/2',
      created_at: '2024-01-02T00:00:00Z',
    },
  ];

  beforeAll(() => {
    // Initialize test database
    setupTestDatabase();
    
    // Create app (console is already mocked globally in setup.ts)
    app = createApp();
  });

  beforeEach(() => {
    // Clear database and reset mocks before each test
    clearTestDatabase();
    
    // Clear mock call history but keep implementations
    // Note: clearAllMocks clears call history but preserves implementations
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Close database connection after all tests
    teardownTestDatabase();
  });

  describe('Happy Path', () => {
    it('should fetch and cache issues successfully', async () => {
      // Mock scanRepository to return 2 issues
      mockScanRepository.mockResolvedValue({
        repo: testRepo,
        issues_fetched: 2,
        cached_successfully: true,
      });

      const response = await request(app)
        .post('/scan')
        .send({ repo: testRepo })
        .expect(200);

      // Assert response structure
      expect(response.body).toEqual({
        repo: testRepo,
        issues_fetched: 2,
        cached_successfully: true,
      });

      // Verify service was called with correct repo
      expect(mockScanRepository).toHaveBeenCalledWith(testRepo);
      expect(mockScanRepository).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input Validation', () => {
    it('should return 400 when repo is missing', async () => {
      const response = await request(app)
        .post('/scan')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request');
      expect(response.body.message).toContain('repo is required');
      expect(mockScanRepository).not.toHaveBeenCalled();
    });

    it('should return 400 when repo is empty string', async () => {
      const response = await request(app)
        .post('/scan')
        .send({ repo: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request');
      expect(response.body.message).toContain('repo is required');
      expect(mockScanRepository).not.toHaveBeenCalled();
    });

    it('should return 400 when repo format is invalid (no slash)', async () => {
      const response = await request(app)
        .post('/scan')
        .send({ repo: 'invalid-repo-format' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request');
      expect(response.body.message).toContain('owner/repo-name');
      expect(mockScanRepository).not.toHaveBeenCalled();
    });
  });

  describe('Idempotency', () => {
    it('should handle multiple scans of the same repo without duplicates', async () => {
      // For idempotency test, we need actual database interaction
      // Mock the HTTP utility to prevent real API calls
      const httpModule = require('../../src/utils/http');
      const httpGetSpy = jest.spyOn(httpModule, 'httpGet');
      
      // Mock httpGet to return our test issues (simulating pagination - first page only)
      // Create a simple mock Headers object
      const mockHeaders = {
        get: () => null,
        has: () => false,
        set: () => {},
        append: () => {},
        delete: () => {},
        forEach: () => {},
        entries: () => [][Symbol.iterator](),
        keys: () => [][Symbol.iterator](),
        values: () => [][Symbol.iterator](),
        [Symbol.iterator]: () => [][Symbol.iterator](),
      } as unknown as Headers;
      
      httpGetSpy.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        data: mockIssues,
        headers: mockHeaders,
      });

      // Get the actual module after mocking HTTP
      const actualGithubModule = jest.requireActual('../../src/services/github');
      const actualScanRepository = actualGithubModule.scanRepository;

      // First scan - use actual service to populate database
      const result1 = await actualScanRepository(testRepo);
      expect(result1.issues_fetched).toBe(2);
      expect(result1.cached_successfully).toBe(true);

      // Verify issues were stored in database
      let count = getIssueCount(testRepo);
      expect(count).toBe(2);

      // Second scan of the same repo
      const result2 = await actualScanRepository(testRepo);
      expect(result2.issues_fetched).toBe(2);
      expect(result2.cached_successfully).toBe(true);

      // Verify database contains exactly 2 rows (not 4) due to UPSERT
      count = getIssueCount(testRepo);
      expect(count).toBe(2);
      
      // Clean up spy
      httpGetSpy.mockRestore();
    });
  });

  describe('GitHub API Failure', () => {
    it('should return 404 when repository is not found', async () => {
      // Mock scanRepository to throw repository not found error
      const errorMessage = 'Repository not found: test-owner/test-repo';
      mockScanRepository.mockRejectedValue(new Error(errorMessage));

      const response = await request(app)
        .post('/scan')
        .send({ repo: testRepo })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Repository not found');
      expect(response.body.message).toBe(errorMessage);
      expect(mockScanRepository).toHaveBeenCalledWith(testRepo);
    });

    it('should return 500 for other GitHub API errors', async () => {
      // Mock scanRepository to throw a generic GitHub API error
      const errorMessage = 'GitHub API error: 403 Forbidden';
      mockScanRepository.mockRejectedValue(new Error(errorMessage));

      const response = await request(app)
        .post('/scan')
        .send({ repo: testRepo })
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Failed to fetch issues from GitHub');
      expect(response.body.message).toBe(errorMessage);
    });

    it('should return 500 for generic GitHub API errors', async () => {
      // Mock scanRepository to throw a GitHub API error
      const errorMessage = 'GitHub API error: 403 Forbidden';
      mockScanRepository.mockRejectedValue(new Error(errorMessage));

      const response = await request(app)
        .post('/scan')
        .send({ repo: testRepo })
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Failed to fetch issues from GitHub');
      expect(response.body.message).toBe(errorMessage);
    });

    it('should return 500 for unexpected errors', async () => {
      // Mock scanRepository to throw a generic error
      mockScanRepository.mockRejectedValue(new Error('Unexpected database error'));

      const response = await request(app)
        .post('/scan')
        .send({ repo: testRepo })
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
      expect(response.body.message).toBe('Unexpected database error');
    });
  });
});
