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
 * Analyze issues using LLM
 * 
 * @param repo - Repository identifier (owner/repo-name)
 * @param userPrompt - User's natural language prompt
 * @param formattedIssues - Formatted string of issues to analyze
 * @returns Analysis text from LLM
 */
export async function analyzeIssues(
  repo: string,
  userPrompt: string,
  formattedIssues: string
): Promise<string> {
  const model = getLLM();

  // Create prompt template
  const promptTemplate = PromptTemplate.fromTemplate(`
You are analyzing GitHub issues for repository: {repo}

User's request:
{userPrompt}

Important context:
- This analysis is based on a capped subset of the most recent issues.
- Not all issues may be included due to context size limits.
- You MUST follow the user's request above. If the request asks for a specific angle (e.g., bugs vs features, security, performance, prioritization, release planning), adapt the analysis accordingly.

Issues (title/body/metadata; bodies may be truncated):
{formattedIssues}

---

Respond in **Markdown** using the structure below. Keep it concise but useful.

## Overview
2–3 sentence summary that directly addresses the user's request.

## Findings (aligned to the user's request)
Provide the most relevant themes, patterns, or clusters *based on what the user asked for*.
Use a numbered list. For each item include:
- **Summary**
- **Evidence**: cite a few issue titles or IDs from the provided list (no need to be exhaustive)
- **Why it matters**

## Recommended Priorities
Give a short ordered list of what to do next, with 1–2 sentences of rationale each.
If the user requested prioritization criteria (impact, frequency, severity), use those criteria.

## Caveats
Briefly state limitations due to the capped subset and any missing context.
`);

  try {
    // Format the prompt with variables
    const formattedPrompt = await promptTemplate.format({
      repo,
      userPrompt,
      formattedIssues,
    });

    // Create a HumanMessage for the chat model
    const message = new HumanMessage(formattedPrompt);

    // Make single LLM call (no streaming, no agents, no tools)
    const response = await model.invoke([message]);

    // Extract text content from the response
    const analysis = typeof response.content === 'string' 
      ? response.content 
      : String(response.content);

    return analysis;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`LLM analysis failed: ${error.message}`);
    }
    throw new Error('LLM analysis failed: Unknown error');
  }
}
