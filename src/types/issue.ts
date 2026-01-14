/**
 * Type definitions for issue-related data structures
 * Used throughout the application for type safety
 */

/**
 * Represents a GitHub issue
 */
export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  url: string;
  repositoryUrl: string;
}

/**
 * Represents a scan result
 */
export interface ScanResult {
  scanId: number;
  repositoryUrl: string;
  status: 'pending' | 'completed' | 'failed';
  issues: Issue[];
  issuesCount: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

/**
 * Represents an analysis result
 */
export interface AnalysisResult {
  analysisId: number;
  scanId: number;
  status: 'pending' | 'completed' | 'failed';
  result?: {
    summary: string;
    categories: string[];
    recommendations: string[];
  };
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

/**
 * Request body for POST /scan endpoint
 */
export interface ScanRequest {
  repositoryUrl: string;
}

/**
 * Request body for POST /analyze endpoint
 */
export interface AnalyzeRequest {
  scanId: number;
}
