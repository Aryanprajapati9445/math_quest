'use server';
/**
 * @fileOverview Analyzes user performance in the Math Quest app and provides suggestions.
 *
 * - analyzeUserPerformance - A function that takes user activity data and returns analysis.
 */

import { ai } from '@/ai/ai-instance';
import {
    AnalyzePerformanceInputSchema,
    AnalyzePerformanceOutputSchema,
    type AnalyzePerformanceInput, // Import types as well
    type AnalyzePerformanceOutput,
} from '@/ai/schemas/performance-analysis'; // Import from the new schema file

// Only export the async function
export async function analyzeUserPerformance(input: AnalyzePerformanceInput): Promise<AnalyzePerformanceOutput> {
  return analyzePerformanceFlow(input);
}

const prompt = ai.definePrompt({
    name: 'analyzeUserPerformancePrompt',
    input: { schema: AnalyzePerformanceInputSchema }, // Use imported schema
    output: { schema: AnalyzePerformanceOutputSchema }, // Use imported schema
    prompt: `You are an AI performance analyst for a math quiz application called Math Quest. Analyze the provided user activity history to identify strengths, weaknesses, and provide actionable suggestions for improvement.

User Activity History:
{{#each activityHistory}}
- Question: {{this.question}}
  Difficulty: {{this.difficulty}}
  Type: {{this.type}}
  User Answer: {{this.userAnswer}}
  Correct Answer: {{this.correctAnswer}}
  Correct: {{this.isCorrect}}
  Timestamp: {{this.timestamp}}
{{/each}}
{{#if desiredFocus}}
The user wants to focus on: {{{desiredFocus}}}
{{/if}}

Based on this history:
1.  **Summarize** the user's overall performance trends (e.g., accuracy by type, difficulty).
2.  Identify specific **strengths** (e.g., "Strong in Easy Algebra", "Good accuracy in Geometry").
3.  Identify specific **weaknesses** (e.g., "Struggles with Hard Calculus", "Low accuracy in Trigonometry").
4.  Provide concrete, actionable **suggestions** for improvement. Consider the identified weaknesses{{#if desiredFocus}} and the user's desired focus area{{/if}}. Suggestions could include practicing specific types/difficulties, reviewing concepts, or trying different strategies. Keep suggestions concise (1-2 sentences each).
5.  Based on the analysis and potentially the user's focus, suggest a **type** and **difficulty** for the next question that would be most beneficial for learning or reinforcing concepts. If the user has a clear weakness, suggest practicing that area at an appropriate difficulty. If they are performing well, suggest a slightly harder question or a different type.
`,
});

// Define the flow internally, do not export it directly
const analyzePerformanceFlow = ai.defineFlow<
  typeof AnalyzePerformanceInputSchema,
  typeof AnalyzePerformanceOutputSchema
>(
  {
    name: 'analyzePerformanceFlow',
    inputSchema: AnalyzePerformanceInputSchema, // Use imported schema
    outputSchema: AnalyzePerformanceOutputSchema, // Use imported schema
  },
  async (input) => {
    // Basic validation: Ensure there's some history to analyze
    if (!input.activityHistory || input.activityHistory.length === 0) {
        return {
            summary: "Not enough activity history to provide an analysis.",
            strengths: [],
            weaknesses: [],
            suggestions: ["Try answering a few questions first!"],
            // Ensure optional fields are explicitly undefined or omitted if not applicable
            suggestedNextQuestionType: undefined,
            suggestedNextDifficulty: undefined,
        };
    }

    const { output } = await prompt(input);

    if (!output) {
        throw new Error("AI failed to generate a performance analysis.");
    }

    // Ensure suggestions are reasonable length (optional refinement)
    const conciseSuggestions = output.suggestions.map(s => s.length > 150 ? s.substring(0, 147) + '...' : s);


    return {
        ...output,
        suggestions: conciseSuggestions, // Return potentially shortened suggestions
        // Ensure optional fields are present even if undefined, matching the schema
        suggestedNextQuestionType: output.suggestedNextQuestionType,
        suggestedNextDifficulty: output.suggestedNextDifficulty,
    };
  }
);