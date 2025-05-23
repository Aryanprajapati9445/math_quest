'use server';
/**
 * @fileOverview Generates math questions of varying difficulty and types, including multiple-choice options and explanations.
 *
 * - generateMathQuestion - A function that generates math questions with options and an explanation.
 */

import {ai} from '@/ai/ai-instance';
import {
    GenerateMathQuestionInputSchema,
    GenerateMathQuestionOutputSchema,
    type GenerateMathQuestionInput, // Import types as well
    type GenerateMathQuestionOutput
} from '@/ai/schemas/math-question'; // Import from the new schema file

// Re-export types needed elsewhere (like in page.tsx or analysis flow)
// This is allowed in 'use server' files as long as they are just type exports
export type { GenerateMathQuestionInput, GenerateMathQuestionOutput };


// Only export the async function
export async function generateMathQuestion(input: GenerateMathQuestionInput): Promise<GenerateMathQuestionOutput> {
  return generateMathQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMathQuestionPrompt',
  input: {
    schema: GenerateMathQuestionInputSchema, // Use the updated input schema
  },
  output: {
    schema: GenerateMathQuestionOutputSchema, // Use the updated output schema with explanation
  },
  // Updated prompt to request multiple-choice options and explanation, and consider class/exam type
  prompt: `You are a math question generator. Generate a math question of type {{{type}}} with difficulty {{{difficulty}}}{{#if studentClass}} tailored for a student in {{{studentClass}}}{{/if}}{{#if examType}} within the context of preparing for a {{{examType}}}{{/if}}.

Provide the correct answer to the question, exactly 4 multiple-choice options, and a clear, step-by-step explanation of how to solve the question.

**Important:**
1.  For the 'answer' field, return ONLY the final numerical value (e.g., "5", "-1.2", "3/4") or the most simplified symbolic expression (e.g., "2x+5", "sin(x)", "x=3"). Do NOT include any extra text like "The answer is:", units, or explanations in the 'answer' field itself.
2.  Ensure the 'question' field contains only the question itself.
3.  Generate exactly 4 multiple-choice 'options' as an array of strings.
4.  One of the generated 'options' MUST exactly match the correct 'answer'.
5.  The other 3 options should be plausible incorrect answers (distractors) relevant to the question type, difficulty{{#if studentClass}}, and class level ({{{studentClass}}}){{/if}}.
6.  Ensure options maintain a similar format (e.g., all numbers, all expressions).
7.  Provide a clear, concise, step-by-step 'explanation' for solving the question in the 'explanation' field. This should guide someone through the process of reaching the correct answer.`,
});

// Define the flow internally, do not export it directly
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
     // Find a random index to replace, except if it happens to be the correct answer already (unlikely but possible)
     let replaceIndex = Math.floor(Math.random() * cleanedOptions.length);
     // Avoid replacing if the randomly selected option *is* somehow the correct answer after cleaning
     if(compareAnswers(cleanedOptions[replaceIndex], cleanedAnswer)) {
         replaceIndex = (replaceIndex + 1) % cleanedOptions.length; // Try the next index
     }
     cleanedOptions[replaceIndex] = cleanedAnswer;

     // Optionally shuffle the options again to hide the replaced position
     cleanedOptions.sort(() => Math.random() - 0.5);
  }

  return {
      question: output.question.trim(),
      answer: cleanedAnswer,
      options: cleanedOptions,
      explanation: output.explanation.trim(), // Return the trimmed explanation
  };
});


// Helper function for comparing answers (copied from page.tsx for consistency)
// Keep this internal or move to a shared utils file if needed elsewhere
const compareAnswers = (userAnswerStr: string | undefined, correctAnswerStr: string): boolean => {
  if (userAnswerStr === undefined) return false; // Handle undefined user answer

  const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ''); // Remove all whitespace and convert to lowercase

  const normUserAnswer = normalize(userAnswerStr);
  const normCorrectAnswer = normalize(correctAnswerStr);

  if (normUserAnswer === normCorrectAnswer) {
    return true;
  }

  // Attempt numerical comparison
  try {
    const userNum = parseFloat(normUserAnswer);
    const correctNum = parseFloat(normCorrectAnswer);

    // Check if both are valid numbers and are approximately equal
    if (!isNaN(userNum) && !isNaN(correctNum)) {
      const tolerance = 1e-6;
      if (Math.abs(userNum - correctNum) < tolerance) {
        return true;
      }
    }
  } catch (e) {
    // Ignore errors during parsing, means they aren't numbers
  }


  // Basic expression comparison (very naive, could be improved)
  // Check if normalized strings are equal after removing extra parentheses or spaces
  const simplifyExpr = (str: string) => str.replace(/\(|\)/g, '').replace(/\s/g, '');
  if (simplifyExpr(normUserAnswer) === simplifyExpr(normCorrectAnswer)) {
      return true;
  }


  return false;
};