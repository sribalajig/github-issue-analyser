import { GitHubIssue } from '../../../src/services/github';

/**
 * Mock implementation of GitHub service
 * Allows tests to control behavior without making real API calls
 */

export const fetchOpenIssues = jest.fn<Promise<GitHubIssue[]>, [string]>();
export const scanRepository = jest.fn<
  Promise<{
    repo: string;
    issues_fetched: number;
    cached_successfully: boolean;
  }>,
  [string]
>();
