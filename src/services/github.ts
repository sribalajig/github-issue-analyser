import { httpGet } from '../utils/http';
import { upsertIssues } from '../db/issues';

/**
 * GitHub service for fetching repository data
 */

/**
 * GitHub API issue response structure
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  created_at: string;
  pull_request?: {
    url: string;
    html_url: string;
    diff_url: string;
    patch_url: string;
  };
}

/**
 * Fetch all open issues from a GitHub repository
 * Handles pagination and filters out pull requests
 * 
 * @param repo - Repository in format "owner/repo-name"
 * @param maxScanIssues - Optional limit on number of issues to fetch (most recent)
 * @returns Array of open issues (excluding pull requests)
 */
export async function fetchOpenIssues(repo: string, maxScanIssues?: number): Promise<GitHubIssue[]> {
  // Validate repo format
  if (!repo || typeof repo !== 'string' || !repo.includes('/')) {
    throw new Error('Invalid repo format. Expected "owner/repo-name"');
  }

  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    throw new Error('Invalid repo format. Expected "owner/repo-name"');
  }

  const allIssues: GitHubIssue[] = [];
  let page = 1;
  const perPage = 100;

  try {
    while (true) {
      const url = `https://api.github.com/repos/${owner}/${repoName}/issues?state=open&per_page=${perPage}&page=${page}`;
      
      const response = await httpGet<GitHubIssue[]>(url, {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'github-scanner',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Repository not found: ${repo}`);
        }
        if (response.status === 403) {
          throw new Error('GitHub API rate limit exceeded or repository is private');
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const issues = response.data;

      // If no more issues, break pagination loop
      if (issues.length === 0) {
        break;
      }

      // Filter out pull requests (issues with pull_request field)
      const actualIssues = issues.filter((issue) => !issue.pull_request);
      allIssues.push(...actualIssues);

      // Check if we've reached the scan limit (if configured)
      // This cap prevents excessive API calls and storage for large repositories
      if (maxScanIssues !== undefined && allIssues.length >= maxScanIssues) {
        // Take only the first maxScanIssues (most recent, since API returns DESC order)
        allIssues.splice(maxScanIssues);
        break; // Stop pagination early
      }

      // If we got fewer than perPage results, we've reached the last page
      if (issues.length < perPage) {
        break;
      }

      page++;
    }

    return allIssues;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch issues from GitHub API');
  }
}

/**
 * Scan a repository: fetch open issues from GitHub and store them in the database
 * 
 * @param repo - Repository in format "owner/repo-name"
 * @param maxScanIssues - Optional limit on number of issues to fetch (most recent)
 * @returns Scan result with number of issues fetched
 */
export async function scanRepository(repo: string, maxScanIssues?: number): Promise<{
  repo: string;
  issues_fetched: number;
  cached_successfully: boolean;
}> {
  // Fetch open issues from GitHub (with optional limit)
  const issues = await fetchOpenIssues(repo, maxScanIssues);

  // Store issues in database
  upsertIssues(repo, issues);

  return {
    repo,
    issues_fetched: issues.length,
    cached_successfully: true,
  };
}
