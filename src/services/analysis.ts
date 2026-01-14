import { getIssuesByRepo, IssueRecord } from '../db/issues';
import { analyzeIssues } from './llm';

/**
 * Analysis service layer
 * Handles issue loading, limit application, formatting, and LLM orchestration
 */

// Constants for cost and context size control
const MAX_ISSUES = 50;
const MAX_BODY_CHARS = 1000;
const MAX_TOTAL_CHARS = 30000;

/**
 * Truncate a string to a maximum length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '...';
}

/**
 * Format a single issue for LLM consumption
 */
function formatIssue(issue: IssueRecord): string {
  const body = issue.body && issue.body.trim() 
    ? truncate(issue.body, MAX_BODY_CHARS)
    : '(no body)';

  return `Issue #${issue.id}: ${issue.title}
Created: ${issue.created_at}
URL: ${issue.html_url}
Body: ${body}
`;
}

/**
 * Apply limits to issues and format them for LLM
 * 
 * @param issues - Array of issue records (already ordered DESC by created_at)
 * @returns Formatted string of issues within limits
 */
function formatIssuesWithLimits(issues: IssueRecord[]): string {
  if (issues.length === 0) {
    return '';
  }

  const limitedIssues = issues.slice(0, MAX_ISSUES);
  const formattedParts: string[] = [];
  let totalChars = 0;

  for (const issue of limitedIssues) {
    const formatted = formatIssue(issue);
    const formattedLength = formatted.length;

    // Stop if adding this issue would exceed MAX_TOTAL_CHARS
    if (totalChars + formattedLength > MAX_TOTAL_CHARS) {
      break;
    }

    formattedParts.push(formatted);
    totalChars += formattedLength;
  }

  return formattedParts.join('\n---\n\n');
}

/**
 * Analyze a repository's issues using LLM
 * 
 * @param repo - Repository identifier (owner/repo-name)
 * @param prompt - User's natural language prompt
 * @returns Analysis text from LLM
 * @throws Error if no issues found or LLM call fails
 */
export async function analyzeRepository(
  repo: string,
  prompt: string
): Promise<string> {
  // Load issues from database
  const issues = getIssuesByRepo(repo);

  if (issues.length === 0) {
    throw new Error('No issues found for repository. Please scan the repository first using POST /scan');
  }

  // Apply limits and format issues
  const formattedIssues = formatIssuesWithLimits(issues);

  // Call LLM service
  const analysis = await analyzeIssues(repo, prompt, formattedIssues);

  return analysis;
}
