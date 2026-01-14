import request from 'supertest';
import { createApp } from '../../src/app';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../helpers/db';
import { upsertIssues } from '../../src/db/issues';
import { GitHubIssue } from '../../src/services/github';

// Mock the LLM service
jest.mock('../../src/services/llm', () => ({
  analyzeIssues: jest.fn(),
  initializeLLM: jest.fn(),
}));

import { analyzeIssues } from '../../src/services/llm';

const mockAnalyzeIssues = analyzeIssues as jest.MockedFunction<typeof analyzeIssues>;

describe('POST /analyze', () => {
  let app: ReturnType<typeof createApp>;
  const testRepo = 'test-owner/test-repo';
  const testPrompt = 'What are the main themes in these issues?';

  /**
   * Helper function to seed test issues directly into the database
   */
  function seedTestIssues(repo: string, count: number): void {
    const issues: GitHubIssue[] = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      number: i + 1,
      title: `Test Issue ${i + 1}`,
      body: `Body of issue ${i + 1}`.repeat(10), // Make body longer for truncation tests
      state: 'open',
      html_url: `https://github.com/${repo}/issues/${i + 1}`,
      created_at: new Date(2024, 0, i + 1).toISOString(),
    }));
    upsertIssues(repo, issues);
  }

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
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Close database connection after all tests
    teardownTestDatabase();
  });

  describe('Happy Path', () => {
    it('should analyze issues successfully', async () => {
      // Seed 3 issues for test repo
      seedTestIssues(testRepo, 3);

      // Mock LLM service to return a fixed analysis string
      const mockAnalysis = 'Mocked analysis result';
      mockAnalyzeIssues.mockResolvedValue(mockAnalysis);

      // POST /analyze with valid repo and prompt
      const response = await request(app)
        .post('/analyze')
        .send({ repo: testRepo, prompt: testPrompt })
        .expect(200);

      // Assert response contains mocked analysis
      expect(response.body).toEqual({ analysis: mockAnalysis });

      // Assert LLM service was called once with correct arguments
      expect(mockAnalyzeIssues).toHaveBeenCalledTimes(1);
      expect(mockAnalyzeIssues).toHaveBeenCalledWith(
        testRepo,
        testPrompt,
        expect.stringContaining('Issue #1')
      );
    });
  });

  describe('Repo Not Scanned', () => {
    it('should return 400 when no issues found for repository', async () => {
      // Do NOT seed any issues
      // Mock is not needed since we won't reach LLM call

      // POST /analyze with valid repo and prompt
      const response = await request(app)
        .post('/analyze')
        .send({ repo: testRepo, prompt: testPrompt })
        .expect(400);

      // Assert error message includes "No issues found"
      expect(response.body).toHaveProperty('error', 'No issues found');
      expect(response.body.message).toContain('No issues found');

      // Assert LLM service was not called
      expect(mockAnalyzeIssues).not.toHaveBeenCalled();
    });
  });

  describe('Input Validation', () => {
    it('should return 400 when repo is missing', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({ prompt: testPrompt })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request');
      expect(response.body.message).toContain('repo is required');
    });

    it('should return 400 when prompt is missing', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({ repo: testRepo })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request');
      expect(response.body.message).toContain('prompt is required');
    });

    it('should return 400 when repo format is invalid (no slash)', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({ repo: 'invalid', prompt: testPrompt })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request');
      expect(response.body.message).toContain('format "owner/repo-name"');
    });

    it('should return 400 when repo is empty string', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({ repo: '', prompt: testPrompt })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request');
    });

    it('should return 400 when prompt is empty string', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({ repo: testRepo, prompt: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request');
    });
  });

  describe('Enforces Issue Limit', () => {
    it('should limit issues to MAX_ISSUES when more issues exist', async () => {
      // Set MAX_ISSUES to a known value for this test
      const originalMaxIssues = process.env.MAX_ISSUES;
      process.env.MAX_ISSUES = '50';

      try {
        // Seed 60 issues (more than MAX_ISSUES=50)
        seedTestIssues(testRepo, 60);

        // Mock LLM service and capture call arguments
        const mockAnalysis = 'Analysis result';
        mockAnalyzeIssues.mockResolvedValue(mockAnalysis);

        // POST /analyze
        const response = await request(app)
          .post('/analyze')
          .send({ repo: testRepo, prompt: testPrompt })
          .expect(200);

        expect(response.body).toEqual({ analysis: mockAnalysis });

        // Assert LLM service was called once
        expect(mockAnalyzeIssues).toHaveBeenCalledTimes(1);

        // Get the formattedIssues argument passed to analyzeIssues
        const callArgs = mockAnalyzeIssues.mock.calls[0];
        const formattedIssues = callArgs[2] as string;

        // Count occurrences of "Issue #" to verify number of issues included
        const issueCount = (formattedIssues.match(/Issue #/g) || []).length;

        // Verify it contains at most 50 issues (MAX_ISSUES)
        // Note: It might be less if MAX_TOTAL_CHARS limit is hit first
        expect(issueCount).toBeLessThanOrEqual(50);
        expect(issueCount).toBeGreaterThan(0);
        // Verify it's less than what we seeded (60), proving the limit is applied
        expect(issueCount).toBeLessThan(60);
      } finally {
        // Restore original value
        if (originalMaxIssues !== undefined) {
          process.env.MAX_ISSUES = originalMaxIssues;
        } else {
          delete process.env.MAX_ISSUES;
        }
      }
    });
  });

  describe('LLM Failure', () => {
    it('should return 500 when LLM service fails', async () => {
      // Seed 3 issues
      seedTestIssues(testRepo, 3);

      // Mock LLM service to throw an error
      const llmError = new Error('LLM analysis failed: API error');
      mockAnalyzeIssues.mockRejectedValue(llmError);

      // POST /analyze
      const response = await request(app)
        .post('/analyze')
        .send({ repo: testRepo, prompt: testPrompt })
        .expect(500);

      // Assert error response contains appropriate message
      expect(response.body).toHaveProperty('error', 'Analysis failed');
      expect(response.body.message).toContain('Failed to generate analysis');

      // Assert LLM service was called
      expect(mockAnalyzeIssues).toHaveBeenCalledTimes(1);
    });

    it('should return 500 for generic LLM errors', async () => {
      // Seed 3 issues
      seedTestIssues(testRepo, 3);

      // Mock LLM service to throw a generic error
      const llmError = new Error('LLM not initialized');
      mockAnalyzeIssues.mockRejectedValue(llmError);

      // POST /analyze
      const response = await request(app)
        .post('/analyze')
        .send({ repo: testRepo, prompt: testPrompt })
        .expect(500);

      // Assert error response
      expect(response.body).toHaveProperty('error', 'Analysis failed');
    });
  });
});
