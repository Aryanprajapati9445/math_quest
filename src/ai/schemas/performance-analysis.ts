/**
 * @fileOverview Zod schemas and TypeScript types for the performance analysis flow.
 */
import { z } from 'zod';

// Define the structure for a single activity record
export const UserActivityRecordSchema = z.object({
  question: z.string().describe('The math question text.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty of the question.'),
  type: z.enum(['algebra', 'calculus', 'geometry', 'trigonometry']).describe('The type of the question.'),
  userAnswer: z.string().optional().describe('The answer the user selected.'),
  correctAnswer: z.string().describe('The correct answer to the question.'),
  isCorrect: z.boolean().describe('Whether the user answered correctly.'),
  timestamp: z.string().datetime().describe('When the user attempted the question.'), // Using string for simplicity, could use Date
});
export type UserActivityRecord = z.infer<typeof UserActivityRecordSchema>;


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