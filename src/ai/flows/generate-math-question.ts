'use server';
/**
 * @fileOverview Generates math questions of varying difficulty and types, including multiple-choice options.
 *
 * - generateMathQuestion - A function that generates math questions with options.
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
  answer: z.string().describe("The correct answer to the math question. Should be the numerical value or simplified expression ONLY (e.g., '5', 'x=2', 'sin(pi/4)')."),
  options: z.array(z.string()).length(4).describe("An array of 4 multiple-choice options. One of these options MUST be the correct 'answer'. The options should be plausible distractors.")
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
    schema: GenerateMathQuestionOutputSchema, // Use the updated schema
  },
  // Updated prompt to request multiple-choice options
  prompt: `You are a math question generator. Generate a math question of type {{{type}}} with difficulty {{{difficulty}}}.

Provide the correct answer to the question and exactly 4 multiple-choice options.

**Important:**
1.  For the 'answer' field, return ONLY the final numerical value (e.g., "5", "-1.2", "3/4") or the most simplified symbolic expression (e.g., "2x+5", "sin(x)", "x=3"). Do NOT include any extra text like "The answer is:", units, or explanations in the 'answer' field. Ensure the 'question' field contains only the question itself.
2.  Generate exactly 4 multiple-choice 'options' as an array of strings.
3.  One of the generated 'options' MUST exactly match the correct 'answer'.
4.  The other 3 options should be plausible incorrect answers (distractors) relevant to the question type and difficulty.
5.  Ensure options maintain a similar format (e.g., all numbers, all expressions).`,
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
  if (!output) {
    throw new Error("AI failed to generate a response.");
  }

  // Clean up the answer string
  const cleanedAnswer = output.answer.trim().replace(/^[^a-zA-Z0-9(-]+|[^a-zA-Z0-9)]+$/g, '');

  // Clean up options and ensure the correct answer is present (as a fallback)
  const cleanedOptions = output.options.map(opt => opt.trim());
  if (!cleanedOptions.some(opt => compareAnswers(opt, cleanedAnswer))) {
     // If the correct answer isn't in the options, replace the last option
     // This is a fallback, the prompt should ideally enforce this.
     console.warn("Correct answer not found in options, replacing one option.");
     cleanedOptions[cleanedOptions.length - 1] = cleanedAnswer;
     // Optionally shuffle the options again
     cleanedOptions.sort(() => Math.random() - 0.5);
  }

  return {
      question: output.question.trim(),
      answer: cleanedAnswer,
      options: cleanedOptions,
  };
});


// Helper function for comparing answers (copied from page.tsx for consistency)
const compareAnswers = (userAnswerStr: string, correctAnswerStr: string): boolean => {
  const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ''); // Remove all whitespace and convert to lowercase

  const normUserAnswer = normalize(userAnswerStr);
  const normCorrectAnswer = normalize(correctAnswerStr);

  if (normUserAnswer === normCorrectAnswer) {
    return true;
  }

  // Attempt numerical comparison
  const userNum = parseFloat(normUserAnswer);
  const correctNum = parseFloat(normCorrectAnswer);

  // Check if both are valid numbers and are approximately equal
  if (!isNaN(userNum) && !isNaN(correctNum)) {
    const tolerance = 1e-6;
    if (Math.abs(userNum - correctNum) < tolerance) {
      return true;
    }
  }

  return false;
};
