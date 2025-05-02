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
  // Updated description for clarity on expected format
  answer: z.string().describe("The answer to the math question. Should be the numerical value or simplified expression ONLY (e.g., '5', 'x=2', 'sin(pi/4)')."),
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
      // Updated description for clarity on expected format
      answer: z.string().describe("The answer to the math question. Should be the numerical value or simplified expression ONLY (e.g., '5', 'x=2', 'sin(pi/4)')."),
    }),
  },
  // Refined prompt instructions for better answer formatting
  prompt: `You are a math question generator. Generate a math question of type {{{type}}} with difficulty {{{difficulty}}}.

Provide the answer to the question.

**Important:** For the 'answer' field, return ONLY the final numerical value (e.g., "5", "-1.2", "3/4") or the most simplified symbolic expression (e.g., "2x+5", "sin(x)", "x=3"). Do NOT include any extra text like "The answer is:", units, or explanations in the 'answer' field. Ensure the 'question' field contains only the question itself.`,
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
  // Added a fallback in case the output is unexpectedly null/undefined
  if (!output) {
    throw new Error("AI failed to generate a response.");
  }
  // Attempt to clean up the answer string slightly, removing potential leading/trailing non-alphanumeric chars often added by models
  const cleanedAnswer = output.answer.trim().replace(/^[^a-zA-Z0-9(-]+|[^a-zA-Z0-9)]+$/g, '');

  return {
      question: output.question.trim(),
      answer: cleanedAnswer,
  };
});
