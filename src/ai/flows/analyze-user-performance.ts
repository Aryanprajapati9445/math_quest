'use server';
/**
 * @fileOverview Analyzes user performance in the Math Quest app and provides suggestions.
 *
 * - analyzeUserPerformance - A function that takes user activity data and returns analysis.
 * - AnalyzePerformanceInput - The input type for the analyzeUserPerformance function.
 * - AnalyzePerformanceOutput - The return type for the analyzeUserPerformance function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

// Define the structure for a single activity record
const UserActivityRecordSchema = z.object({
  question: z.string().describe('The math question text.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty of the question.'),
  type: z.enum(['algebra', 'calculus', 'geometry', 'trigonometry']).describe('The type of the question.'),
  userAnswer: z.string().optional().describe('The answer the user selected.'),
  correctAnswer: z.string().describe('The correct answer to the question.'),
  isCorrect: z.boolean().describe('Whether the user answered correctly.'),
  timestamp: z.string().datetime().describe('When the user attempted the question.'), // Using string for simplicity, could use Date
});

export const AnalyzePerformanceInputSchema = z.object({
  activityHistory: z.array(UserActivityRecordSchema).describe('An array of user activity records.'),
  desiredFocus: z.string().optional().describe('Optional area the user wants to focus on (e.g., "Calculus", "Hard Geometry").'),
});
export type AnalyzePerformanceInput = z.infer<typeof AnalyzePerformanceInputSchema>;

export const AnalyzePerformanceOutputSchema = z.object({
  summary: z.string().describe('A brief summary of the user\'s overall performance.'),
  strengths: z.array(z.string()).describe('Areas (types/difficulties) where the user performs well.'),
  weaknesses: z.array(z.string()).describe('Areas (types/difficulties) where the user struggles.'),
  suggestions: z.array(z.string()).describe('Actionable suggestions for improvement or next steps.'),
  suggestedNextQuestionType: z.enum(['algebra', 'calculus', 'geometry', 'trigonometry']).optional().describe('Suggested type for the next question based on performance.'),
  suggestedNextDifficulty: z.enum(['easy', 'medium', 'hard']).optional().describe('Suggested difficulty for the next question based on performance.'),
});
export type AnalyzePerformanceOutput = z.infer<typeof AnalyzePerformanceOutputSchema>;

export async function analyzeUserPerformance(input: AnalyzePerformanceInput): Promise<AnalyzePerformanceOutput> {
  return analyzePerformanceFlow(input);
}

const prompt = ai.definePrompt({
    name: 'analyzeUserPerformancePrompt',
    input: { schema: AnalyzePerformanceInputSchema },
    output: { schema: AnalyzePerformanceOutputSchema },
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

const analyzePerformanceFlow = ai.defineFlow<
  typeof AnalyzePerformanceInputSchema,
  typeof AnalyzePerformanceOutputSchema
>(
  {
    name: 'analyzePerformanceFlow',
    inputSchema: AnalyzePerformanceInputSchema,
    outputSchema: AnalyzePerformanceOutputSchema,
  },
  async (input) => {
    // Basic validation: Ensure there's some history to analyze
    if (!input.activityHistory || input.activityHistory.length === 0) {
        return {
            summary: "Not enough activity history to provide an analysis.",
            strengths: [],
            weaknesses: [],
            suggestions: ["Try answering a few questions first!"],
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
    };
  }
);
