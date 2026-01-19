import { getIssuesByRepo, IssueRecord } from '../db/issues';
import { analyzeIssues, AnalysisResult } from './llm';
import { getConfig } from '../config';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Analysis service layer
 * Handles issue loading, limit application, formatting, and LLM orchestration
 */

let tokenCounter: ChatOpenAI | null = null;

/**
 * Get or create token counter instance
 */
function getTokenCounter(): ChatOpenAI {
  if (!tokenCounter) {
    const config = getConfig();
    tokenCounter = new ChatOpenAI({
      modelName: 'gpt-4o',
      openAIApiKey: config.openaiApiKey || 'dummy', // Will fail gracefully if not set
      temperature: 0,
    });
  }
  return tokenCounter;
}

/**
 * Format a single issue for LLM consumption (no truncation)
 */
function formatIssue(issue: IssueRecord): string {
  const body = issue.body && issue.body.trim() 
    ? issue.body
    : '(no body)';

  return `Issue #${issue.id}: ${issue.title}
Created: ${issue.created_at}
URL: ${issue.html_url}
Body: ${body}
`;
}

/**
 * Estimate tokens for a formatted issue
 */
async function estimateIssueTokens(issue: IssueRecord): Promise<number> {
  const formatted = formatIssue(issue);
  try {
    const counter = getTokenCounter();
    const tokens = await counter.getNumTokens(formatted);
    return tokens;
  } catch (error) {
    // Fallback: rough estimate (1 token ≈ 4 characters)
    return Math.ceil(formatted.length / 4);
  }
}

/**
 * Chunk issues by token count
 * 
 * @param issues - Array of issue records (already ordered DESC by created_at)
 * @returns Array of formatted issue chunks
 */
async function chunkIssuesByTokens(issues: IssueRecord[]): Promise<string[]> {
  if (issues.length === 0) {
    return [];
  }

  const config = getConfig();
  
  // Apply hard cap if configured
  const limitedIssues = config.maxAnalysisIssues
    ? issues.slice(0, config.maxAnalysisIssues)
    : issues;

  // Estimate tokens per issue
  const issueTokens: number[] = [];
  for (const issue of limitedIssues) {
    const tokens = await estimateIssueTokens(issue);
    issueTokens.push(tokens);
  }

  // Calculate chunk size
  // Reserve tokens for prompt overhead (~500) and safety margin (~10%)
  const promptOverhead = 500;
  const safetyMargin = 0.1;
  const availableTokens = Math.floor(
    config.maxTokensPerChunk * (1 - safetyMargin) - promptOverhead
  );

  // Group issues into chunks
  const chunks: string[] = [];
  let currentChunk: IssueRecord[] = [];
  let currentChunkTokens = 0;

  for (let i = 0; i < limitedIssues.length; i++) {
    const issue = limitedIssues[i];
    const tokens = issueTokens[i];

    // If adding this issue would exceed the chunk limit, start a new chunk
    if (currentChunkTokens + tokens > availableTokens && currentChunk.length > 0) {
      // Format and add current chunk
      const formattedChunk = currentChunk.map(formatIssue).join('\n---\n\n');
      chunks.push(formattedChunk);
      
      // Start new chunk
      currentChunk = [issue];
      currentChunkTokens = tokens;
    } else {
      // Add to current chunk
      currentChunk.push(issue);
      currentChunkTokens += tokens;
    }
  }

  // Add the last chunk if it has issues
  if (currentChunk.length > 0) {
    const formattedChunk = currentChunk.map(formatIssue).join('\n---\n\n');
    chunks.push(formattedChunk);
  }

  return chunks;
}

/**
 * Analyze a repository's issues using LLM with map-reduce pattern
 * 
 * @param repo - Repository identifier (owner/repo-name)
 * @param prompt - User's natural language prompt
 * @returns Analysis result with text and token usage
 * @throws Error if no issues found or LLM call fails
 */
export async function analyzeRepository(
  repo: string,
  prompt: string
): Promise<AnalysisResult> {
  // Load issues from database
  const issues = getIssuesByRepo(repo);

  if (issues.length === 0) {
    throw new Error('No issues found for repository. Please scan the repository first using POST /scan');
  }

  // Chunk issues by token count
  const issueChunks = await chunkIssuesByTokens(issues);

  if (issueChunks.length === 0) {
    throw new Error('No issues could be chunked for analysis');
  }

  // Call LLM service with map-reduce pattern
  const result = await analyzeIssues(repo, prompt, issueChunks);

  return result;
}
