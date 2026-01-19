import { Router, Request, Response } from 'express';
import { analyzeRepository } from '../services/analysis';

const router = Router();

/**
 * POST /analyze
 * Analyzes cached GitHub issues using LLM with map-reduce pattern
 * 
 * Request body:
 * {
 *   "repo": "owner/repo-name",
 *   "prompt": "natural language prompt"
 * }
 * 
 * Response:
 * {
 *   "analysis": "LLM-generated text (includes token usage and timing in markdown)",
 *   "tokens": {
 *     "total": number,
 *     "input": number,
 *     "output": number,
 *     "chunks": number,
 *     "synthesis": number,
 *     "cost": number,
 *     "timeMs": number
 *   }
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { repo, prompt } = req.body;

    // Input validation
    if (!repo || typeof repo !== 'string' || repo.trim() === '' || !repo.includes('/')) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'repo is required and must be a non-empty string in format "owner/repo-name"',
      });
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'prompt is required and must be a non-empty string',
      });
    }

    // Track start time
    const startTime = Date.now();

    // Call analysis service
    const result = await analyzeRepository(repo.trim(), prompt.trim());

    // Calculate duration
    const durationMs = Date.now() - startTime;
    const durationSeconds = (durationMs / 1000).toFixed(2);

    // Add timing to analysis markdown
    const analysisWithTiming = result.analysis.replace(
      /## Token Usage\n\n/,
      `## Token Usage\n\n- **Time taken**: ${durationSeconds}s (${durationMs}ms)\n`
    );

    // Add timing to tokens
    const tokensWithTiming = {
      ...result.tokens,
      timeMs: durationMs,
    };

    // Return success response with analysis, token usage, and timing
    return res.status(200).json({
      analysis: analysisWithTiming,
      tokens: tokensWithTiming,
    });
  } catch (error) {
    console.error('Error in /analyze endpoint:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      // No issues found
      if (error.message.includes('No issues found')) {
        return res.status(400).json({
          error: 'No issues found',
          message: error.message,
        });
      }

      // LLM failures
      if (error.message.includes('LLM') || error.message.includes('LLM not initialized')) {
        return res.status(500).json({
          error: 'Analysis failed',
          message: 'Failed to generate analysis. Please check LLM configuration.',
        });
      }
    }

    // Generic error response
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
