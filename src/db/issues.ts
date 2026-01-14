import { getDatabase } from './index';
import { GitHubIssue } from '../services/github';

/**
 * Persistence layer for GitHub issues
 * Handles all database operations related to issues
 */

export interface IssueRecord {
  id: number;
  repo: string;
  title: string;
  body: string;
  html_url: string;
  created_at: string;
}

/**
 * Upsert issues into the database
 * Uses INSERT OR REPLACE to prevent duplicates based on (id, repo) composite key
 * 
 * @param repo - Repository identifier (owner/repo-name)
 * @param issues - Array of GitHub issues to store
 * @returns Number of issues stored
 */
export function upsertIssues(repo: string, issues: GitHubIssue[]): number {
  const db = getDatabase();
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO issues (id, repo, title, body, html_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((issuesToInsert: GitHubIssue[]) => {
    for (const issue of issuesToInsert) {
      insertStmt.run(
        issue.id,
        repo,
        issue.title,
        issue.body || '',
        issue.html_url,
        issue.created_at
      );
    }
    return issuesToInsert.length;
  });

  return insertMany(issues);
}

/**
 * Get all issues for a repository
 * 
 * @param repo - Repository identifier (owner/repo-name)
 * @returns Array of issue records
 */
export function getIssuesByRepo(repo: string): IssueRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, repo, title, body, html_url, created_at
    FROM issues
    WHERE repo = ?
    ORDER BY created_at DESC
  `);

  return stmt.all(repo) as IssueRecord[];
}

/**
 * Get issue count for a repository
 * 
 * @param repo - Repository identifier (owner/repo-name)
 * @returns Number of issues
 */
export function getIssueCount(repo: string): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM issues
    WHERE repo = ?
  `);

  const result = stmt.get(repo) as { count: number };
  return result.count;
}
