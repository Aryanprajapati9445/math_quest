'use server';
/**
 * @fileOverview Generates math questions of varying difficulty and types.
 *
 * - generateMathQuestion - A function that generates math questions.
 * - GenerateMathQuestionInput - The input type for the generateMathQuestion function.
 * - GenerateMathQuestionOutput - The return type for the generateMathQuestion function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateMathQuestionInputSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the question.'),
  type: z.enum(['algebra', 'calculus', 'geometry', 'trigonometry']).describe('The type of math question.'),
});
export type GenerateMathQuestionInput = z.infer<typeof GenerateMathQuestionInputSchema>;

const GenerateMathQuestionOutputSchema = z.object({
  question: z.string().describe('The math question.'),
  answer: z.string().describe('The answer to the math question.'),
});
export type GenerateMathQuestionOutput = z.infer<typeof GenerateMathQuestionOutputSchema>;

export async function generateMathQuestion(input: GenerateMathQuestionInput): Promise<GenerateMathQuestionOutput> {
  return generateMathQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMathQuestionPrompt',
  input: {
    schema: z.object({
      difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the question.'),
      type: z.enum(['algebra', 'calculus', 'geometry', 'trigonometry']).describe('The type of math question.'),
    }),
  },
  output: {
    schema: z.object({
      question: z.string().describe('The math question.'),
      answer: z.string().describe('The answer to the math question.'),
    }),
  },
  prompt: `You are a math question generator. Generate a math question of type {{{type}}} with difficulty {{{difficulty}}}. Also provide the answer to the question. Return the question and answer as strings.

Question:
Answer:`,
});

const generateMathQuestionFlow = ai.defineFlow<
  typeof GenerateMathQuestionInputSchema,
  typeof GenerateMathQuestionOutputSchema
>({
  name: 'generateMathQuestionFlow',
  inputSchema: GenerateMathQuestionInputSchema,
  outputSchema: GenerateMathQuestionOutputSchema,
}, async input => {
  const {output} = await prompt(input);
  return output!;
});
