/**
 * @fileOverview Zod schemas and TypeScript types for the math question generation flow.
 */
import { z } from 'genkit';

export const GenerateMathQuestionInputSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the question.'),
  type: z.enum(['algebra', 'calculus', 'geometry', 'trigonometry']).describe('The type of math question.'),
  studentClass: z.string().optional().describe('The grade level or class of the student (e.g., "8th Grade", "High School", "College Freshman").'),
  examType: z.string().optional().describe('The type of exam context (e.g., "Standard Test", "Competitive Exam Prep", "Homework").')
});
export type GenerateMathQuestionInput = z.infer<typeof GenerateMathQuestionInputSchema>;


export const GenerateMathQuestionOutputSchema = z.object({
  question: z.string().describe('The math question.'),
  answer: z.string().describe("The correct answer to the math question. Should be the numerical value or simplified expression ONLY (e.g., '5', 'x=2', 'sin(pi/4)')."),
  options: z.array(z.string()).length(4).describe("An array of 4 multiple-choice options. One of these options MUST be the correct 'answer'. The options should be plausible distractors."),
  explanation: z.string().describe("A step-by-step explanation of how to arrive at the correct answer.")
});
export type GenerateMathQuestionOutput = z.infer<typeof GenerateMathQuestionOutputSchema>;