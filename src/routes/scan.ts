import { Router, Request, Response } from 'express';
import { scanRepository } from '../services/github';
import { getIssuesByRepo, getIssueCount } from '../db/issues';
import { getConfig } from '../config';

const router = Router();

/**
 * GET /scan?repo=owner/repo-name
 * Retrieves cached issues for a repository
 * 
 * Query parameters:
 *   repo - Repository in format "owner/repo-name"
 * 
 * Response:
 * {
 *   "repo": "owner/repo-name",
 *   "count": number,
 *   "issues": [...]
 * }
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { repo } = req.query;

    if (!repo || typeof repo !== 'string' || repo.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'repo query parameter is required and must be a non-empty string in format "owner/repo-name"',
      });
    }

    // Validate repo format (must contain at least one slash)
    if (!repo.includes('/')) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'repo must be in format "owner/repo-name"',
      });
    }

    // Get cached issues from database
    const issues = getIssuesByRepo(repo);
    const count = getIssueCount(repo);

    return res.status(200).json({
      repo,
      count,
      issues,
    });
  } catch (error) {
    console.error('Error in GET /scan endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /scan
 * Fetches all open issues from a GitHub repository and stores them in the database
 * 
 * Request body:
 * {
 *   "repo": "owner/repo-name"
 * }
 * 
 * Response:
 * {
 *   "repo": "owner/repo-name",
 *   "issues_fetched": number,
 *   "cached_successfully": true
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { repo } = req.body;

    if (!repo || typeof repo !== 'string' || repo.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'repo is required and must be a non-empty string in format "owner/repo-name"',
      });
    }

    // Validate repo format (must contain at least one slash)
    if (!repo.includes('/')) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'repo must be in format "owner/repo-name"',
      });
    }

    // Get maxScanIssues from config (optional limit on issues to fetch)
    const config = getConfig();
    
    // Call service layer to scan repository
    const result = await scanRepository(repo, config.maxScanIssues);

    // Return success response
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in /scan endpoint:', error);
    
    // Return appropriate error response
    if (error instanceof Error) {
      // Repository not found - return 404
      if (error.message.includes('Repository not found')) {
        return res.status(404).json({
          error: 'Repository not found',
          message: error.message,
        });
      }
      
      // Other GitHub API errors (rate limit, etc.) - return 500
      if (error.message.includes('GitHub API error')) {
        return res.status(500).json({
          error: 'Failed to fetch issues from GitHub',
          message: error.message,
        });
      }
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
