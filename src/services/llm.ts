import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { HumanMessage } from '@langchain/core/messages';
import { getConfig } from '../config';

/**
 * LLM service using LangChain
 * Provides OpenAI integration for analyzing GitHub issues
 */

let llm: ChatOpenAI | null = null;

/**
 * Token usage statistics
 */
export interface TokenUsage {
  total: number;
  input: number;
  output: number;
  chunks: number;
  synthesis: number;
  cost?: number;
  timeMs?: number;
}

/**
 * Analysis result with token usage
 */
export interface AnalysisResult {
  analysis: string;
  tokens: TokenUsage;
}

/**
 * Initialize LLM client
 * Sets up the LangChain ChatOpenAI connection with API key from config
 */
export function initializeLLM(): void {
  const config = getConfig();
  
  if (!config.openaiApiKey) {
    console.warn('OPENAI_API_KEY not set. LLM features will not work.');
    return;
  }

  llm = new ChatOpenAI({
    modelName: 'gpt-4o',
    openAIApiKey: config.openaiApiKey,
    temperature: 0.7,
  });

  console.log('LLM service initialized with gpt-4o');
}

/**
 * Get the LLM instance
 * Throws error if not initialized
 */
function getLLM(): ChatOpenAI {
  if (!llm) {
    throw new Error('LLM not initialized. Call initializeLLM() first.');
  }
  return llm;
}

/**
 * Calculate cost based on token usage
 * 
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Estimated cost in USD
 */
function calculateCost(inputTokens: number, outputTokens: number): number {
  const config = getConfig();
  const inputCost = (inputTokens / 1000) * config.costPerInputToken1K;
  const outputCost = (outputTokens / 1000) * config.costPerOutputToken1K;
  return inputCost + outputCost;
}

/**
 * Extract token usage from LLM response
 * 
 * @param response - LLM response object
 * @returns Token usage object
 */
function extractTokenUsage(response: any): { input: number; output: number } {
  // LangChain responses may have usage metadata
  if (response.response_metadata?.token_usage) {
    const usage = response.response_metadata.token_usage;
    return {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
    };
  }
  
  // Fallback: estimate from content
  const inputText = typeof response.content === 'string' ? response.content : String(response.content);
  return {
    input: Math.ceil(inputText.length / 4), // Rough estimate
    output: Math.ceil(inputText.length / 4),
  };
}

/**
 * Analyze a single chunk of issues (map phase)
 * 
 * @param repo - Repository identifier
 * @param userPrompt - User's natural language prompt
 * @param chunkIssues - Formatted string of issues in this chunk
 * @param chunkIndex - Index of this chunk (for context)
 * @param totalChunks - Total number of chunks
 * @returns Analysis text and token usage for this chunk
 */
async function analyzeChunk(
  repo: string,
  userPrompt: string,
  chunkIssues: string,
  chunkIndex: number,
  totalChunks: number
): Promise<{ analysis: string; tokens: { input: number; output: number } }> {
  const model = getLLM();

  const promptTemplate = PromptTemplate.fromTemplate(`
You are analyzing GitHub issues for repository: {repo}

User's request:
{userPrompt}

Important context:
- This is chunk {chunkIndex} of {totalChunks} chunks.
- You are analyzing a subset of issues. Focus on this chunk's issues.
- You MUST follow the user's request above. If the request asks for a specific angle (e.g., bugs vs features, security, performance, prioritization, release planning), adapt the analysis accordingly.

Issues in this chunk:
{chunkIssues}

---

Analyze these issues and provide insights. Keep your response focused and concise. Structure your response as:

## Key Findings
List the main themes, patterns, or issues you identified in this chunk.

## Evidence
Cite specific issue titles or IDs from the provided list.

## Implications
Why these findings matter in the context of the user's request.
`);

  try {
    const formattedPrompt = await promptTemplate.format({
      repo,
      userPrompt,
      chunkIndex: (chunkIndex + 1).toString(),
      totalChunks: totalChunks.toString(),
      chunkIssues,
    });

    const message = new HumanMessage(formattedPrompt);
    const response = await model.invoke([message]);

    const analysis = typeof response.content === 'string' 
      ? response.content 
      : String(response.content);

    const tokens = extractTokenUsage(response);

    return { analysis, tokens };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Chunk analysis failed: ${error.message}`);
    }
    throw new Error('Chunk analysis failed: Unknown error');
  }
}

/**
 * Synthesize multiple chunk analyses into final result (reduce phase)
 * 
 * @param repo - Repository identifier
 * @param userPrompt - User's original prompt
 * @param chunkAnalyses - Array of analyses from map phase
 * @returns Final synthesized analysis and token usage
 */
async function synthesizeAnalyses(
  repo: string,
  userPrompt: string,
  chunkAnalyses: string[]
): Promise<{ analysis: string; tokens: { input: number; output: number } }> {
  const model = getLLM();

  // Combine all chunk analyses
  const combinedAnalyses = chunkAnalyses
    .map((analysis, index) => `## Chunk ${index + 1} Analysis\n\n${analysis}`)
    .join('\n\n---\n\n');

  const promptTemplate = PromptTemplate.fromTemplate(`
You are synthesizing multiple analyses of GitHub issues for repository: {repo}

User's original request:
{userPrompt}

You have received analyses from {numChunks} different chunks of issues. Your task is to synthesize these into a unified, coherent analysis that addresses the user's request.

Chunk analyses:
{combinedAnalyses}

---

Synthesize these analyses into a single, comprehensive response. Respond in **Markdown** using the structure below:

## Overview
2–3 sentence summary that directly addresses the user's request, synthesizing insights from all chunks.

## Findings (aligned to the user's request)
Provide the most relevant themes, patterns, or clusters *based on what the user asked for*, combining insights from all chunks.
Use a numbered list. For each item include:
- **Summary**
- **Evidence**: cite issue titles or IDs from the chunk analyses
- **Why it matters**

## Recommended Priorities
Give a short ordered list of what to do next, with 1–2 sentences of rationale each.
If the user requested prioritization criteria (impact, frequency, severity), use those criteria.

## Caveats
Briefly state limitations due to the chunked analysis approach and any missing context.
`);

  try {
    const formattedPrompt = await promptTemplate.format({
      repo,
      userPrompt,
      numChunks: chunkAnalyses.length.toString(),
      combinedAnalyses,
    });

    const message = new HumanMessage(formattedPrompt);
    const response = await model.invoke([message]);

    const analysis = typeof response.content === 'string' 
      ? response.content 
      : String(response.content);

    const tokens = extractTokenUsage(response);

    return { analysis, tokens };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Synthesis failed: ${error.message}`);
    }
    throw new Error('Synthesis failed: Unknown error');
  }
}

/**
 * Analyze issues using LLM with map-reduce pattern
 * 
 * @param repo - Repository identifier (owner/repo-name)
 * @param userPrompt - User's natural language prompt
 * @param issueChunks - Array of formatted issue chunks to analyze
 * @returns Analysis result with text and token usage
 */
export async function analyzeIssues(
  repo: string,
  userPrompt: string,
  issueChunks: string[]
): Promise<AnalysisResult> {
  if (issueChunks.length === 0) {
    throw new Error('No issue chunks provided for analysis');
  }

  // If only one chunk, use simple analysis (no synthesis needed)
  if (issueChunks.length === 1) {
    const result = await analyzeChunk(repo, userPrompt, issueChunks[0], 0, 1);
    const cost = calculateCost(result.tokens.input, result.tokens.output);
    return {
      analysis: result.analysis,
      tokens: {
        total: result.tokens.input + result.tokens.output,
        input: result.tokens.input,
        output: result.tokens.output,
        chunks: 1,
        synthesis: 0,
        cost,
      },
    };
  }

  // Map phase: Analyze each chunk in parallel
  const chunkPromises = issueChunks.map((chunk, index) =>
    analyzeChunk(repo, userPrompt, chunk, index, issueChunks.length)
  );

  let chunkResults: Array<{ analysis: string; tokens: { input: number; output: number } }>;
  try {
    chunkResults = await Promise.all(chunkPromises);
  } catch (error) {
    // If some chunks fail, continue with successful ones
    const results = await Promise.allSettled(chunkPromises);
    chunkResults = results
      .filter((r): r is PromiseFulfilledResult<typeof chunkResults[0]> => r.status === 'fulfilled')
      .map(r => r.value);
    
    if (chunkResults.length === 0) {
      throw new Error('All chunk analyses failed');
    }
  }

  // Reduce phase: Synthesize all chunk analyses
  const chunkAnalyses = chunkResults.map(r => r.analysis);
  const synthesisResult = await synthesizeAnalyses(repo, userPrompt, chunkAnalyses);

  // Calculate total token usage
  const chunkTokens = chunkResults.reduce(
    (acc, r) => ({
      input: acc.input + r.tokens.input,
      output: acc.output + r.tokens.output,
    }),
    { input: 0, output: 0 }
  );

  const totalInput = chunkTokens.input + synthesisResult.tokens.input;
  const totalOutput = chunkTokens.output + synthesisResult.tokens.output;
  const estimatedCost = calculateCost(totalInput, totalOutput);

  // Add token usage summary to analysis (time will be added by route handler)
  const tokenSummary = `\n\n## Token Usage\n\n- **Total tokens**: ${totalInput + totalOutput} (input: ${totalInput}, output: ${totalOutput})\n- **Chunks processed**: ${chunkResults.length}\n- **Synthesis tokens**: ${synthesisResult.tokens.input + synthesisResult.tokens.output}\n- **Estimated cost**: $${estimatedCost.toFixed(4)}`;
  
  const finalAnalysis = synthesisResult.analysis + tokenSummary;

  return {
    analysis: finalAnalysis,
    tokens: {
      total: totalInput + totalOutput,
      input: totalInput,
      output: totalOutput,
      chunks: chunkResults.length,
      synthesis: synthesisResult.tokens.input + synthesisResult.tokens.output,
      cost: estimatedCost,
    },
  };
}
