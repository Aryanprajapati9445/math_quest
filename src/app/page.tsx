"use client";

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  generateMathQuestion,
  type GenerateMathQuestionInput,
  type GenerateMathQuestionOutput,
} from '@/ai/flows/generate-math-question';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BrainCircuit, CheckCircle, XCircle, Sigma, Calculator, Shapes, Pi } from 'lucide-react';

const QuestionSettingsSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']),
  type: z.enum(['algebra', 'calculus', 'geometry', 'trigonometry']),
});

type QuestionSettings = z.infer<typeof QuestionSettingsSchema>;

const AnswerSchema = z.object({
  userAnswer: z.string().min(1, 'Please enter an answer.'),
});

type AnswerFormData = z.infer<typeof AnswerSchema>;

type FeedbackState = 'idle' | 'correct' | 'incorrect';

// Helper function for comparing answers, handling potential floating point issues and basic formatting
const compareAnswers = (userAnswerStr: string, correctAnswerStr: string): boolean => {
  const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ''); // Remove all whitespace and convert to lowercase

  const normUserAnswer = normalize(userAnswerStr);
  const normCorrectAnswer = normalize(correctAnswerStr);

  if (normUserAnswer === normCorrectAnswer) {
    return true;
  }

  // Attempt numerical comparison for cases where it might apply
  const userNum = parseFloat(normUserAnswer);
  const correctNum = parseFloat(normCorrectAnswer);

  // Check if both are valid numbers and are approximately equal (tolerance for floating point)
  if (!isNaN(userNum) && !isNaN(correctNum)) {
    // Define a small tolerance for floating point comparison
    const tolerance = 1e-6;
    if (Math.abs(userNum - correctNum) < tolerance) {
      return true;
    }
  }

  // Add more sophisticated comparison logic here if needed (e.g., symbolic math library)

  return false; // Default to false if no match
};


export default function MathQuestPage() {
  const [currentQuestion, setCurrentQuestion] =
    React.useState<GenerateMathQuestionOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCheckingAnswer, setIsCheckingAnswer] = React.useState(false);
  const [feedback, setFeedback] = React.useState<FeedbackState>('idle');
  const { toast } = useToast();

  const settingsForm = useForm<QuestionSettings>({
    resolver: zodResolver(QuestionSettingsSchema),
    defaultValues: {
      difficulty: 'easy',
      type: 'algebra',
    },
  });

  const answerForm = useForm<AnswerFormData>({
    resolver: zodResolver(AnswerSchema),
    defaultValues: {
      userAnswer: '',
    },
  });

  const handleGenerateQuestion = async (data: QuestionSettings) => {
    setIsLoading(true);
    setFeedback('idle');
    setCurrentQuestion(null);
    answerForm.reset(); // Clear previous answer
    answerForm.clearErrors(); // Clear previous validation errors
    try {
      const result = await generateMathQuestion(data);
      setCurrentQuestion(result);
    } catch (error) {
      console.error('Error generating question:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate a new question. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckAnswer = (data: AnswerFormData) => {
    if (!currentQuestion || isCheckingAnswer) return;

    setIsCheckingAnswer(true); // Prevent multiple submissions

    const isCorrect = compareAnswers(data.userAnswer, currentQuestion.answer);

    setFeedback(isCorrect ? 'correct' : 'incorrect');
    toast({
      title: isCorrect ? 'Correct!' : 'Incorrect', // Simplified title
      description: isCorrect
        ? 'Excellent work!'
        : `The correct answer is: ${currentQuestion.answer}`,
      variant: isCorrect ? 'default' : 'destructive',
      className: isCorrect ? 'bg-accent text-accent-foreground border-accent' : '', // Ensure border color matches accent for correct
    });

    setIsCheckingAnswer(false);
  };

  const getIconForType = (type: GenerateMathQuestionInput['type']) => {
    switch (type) {
      case 'algebra': return <Sigma className="h-5 w-5 mr-2" />;
      case 'calculus': return <Calculator className="h-5 w-5 mr-2" />;
      case 'geometry': return <Shapes className="h-5 w-5 mr-2" />;
      case 'trigonometry': return <Pi className="h-5 w-5 mr-2" />;
      default: return <BrainCircuit className="h-5 w-5 mr-2" />;
    }
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
             <BrainCircuit className="h-8 w-8 mr-2 text-primary" />
            <CardTitle className="text-3xl font-bold text-primary">Math Quest</CardTitle>
          </div>
          <CardDescription className="text-lg">
            Challenge your math skills! Select difficulty and type, then solve the problem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Settings Form */}
          <Form {...settingsForm}>
            <form
              onSubmit={settingsForm.handleSubmit(handleGenerateQuestion)}
              className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-end"
            >
              <FormField
                control={settingsForm.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading || isCheckingAnswer} // Disable during checking too
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select difficulty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={settingsForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Question Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading || isCheckingAnswer} // Disable during checking too
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="algebra">
                          <div className="flex items-center"> <Sigma className="h-4 w-4 mr-2"/> Algebra </div>
                         </SelectItem>
                        <SelectItem value="calculus">
                           <div className="flex items-center"> <Calculator className="h-4 w-4 mr-2"/> Calculus </div>
                        </SelectItem>
                        <SelectItem value="geometry">
                          <div className="flex items-center"> <Shapes className="h-4 w-4 mr-2"/> Geometry </div>
                        </SelectItem>
                        <SelectItem value="trigonometry">
                          <div className="flex items-center"> <Pi className="h-4 w-4 mr-2"/> Trigonometry </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading || isCheckingAnswer} className="w-full sm:w-auto">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {currentQuestion ? 'New Question' : 'Start Quest'}
              </Button>
            </form>
          </Form>

          {/* Question Display */}
          {isLoading && !currentQuestion && (
             <div className="text-center p-8">
               <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
               <p className="mt-2 text-muted-foreground">Generating question...</p>
             </div>
          )}
          {currentQuestion && (
            <div className="p-6 border rounded-lg bg-card space-y-4">
              <div className="flex items-center text-lg font-semibold">
                 {getIconForType(settingsForm.getValues('type'))}
                 Question:
              </div>
              {/* Use prose for potentially complex math rendering later */}
              <div className="text-xl font-medium pl-7 prose prose-sm max-w-none">
                 {currentQuestion.question}
              </div>

              {/* Answer Form */}
              <Form {...answerForm}>
                <form
                  onSubmit={answerForm.handleSubmit(handleCheckAnswer)}
                  className="flex flex-col sm:flex-row gap-4 items-start"
                >
                  <FormField
                    control={answerForm.control}
                    name="userAnswer"
                    render={({ field }) => (
                      <FormItem className="flex-grow w-full">
                        <FormLabel className="sr-only">Your Answer</FormLabel>
                        <FormControl>
                          <Input
                           placeholder="Enter your answer here" {...field}
                           disabled={feedback === 'correct' || isCheckingAnswer} // Disable if correct or currently checking
                           className={cn(
                             'transition-colors duration-200', // Add smooth transition
                             feedback === 'correct' && 'border-accent ring-accent focus-visible:ring-accent bg-accent/5', // Subtle bg on correct
                             feedback === 'incorrect' && 'border-destructive ring-destructive focus-visible:ring-destructive bg-destructive/5' // Subtle bg on incorrect
                           )}
                           aria-invalid={feedback === 'incorrect'} // Improve accessibility
                           aria-describedby={feedback !== 'idle' ? 'feedback-message' : undefined}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={feedback === 'correct' || isCheckingAnswer} className="w-full sm:w-auto">
                     {isCheckingAnswer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Check Answer
                  </Button>
                </form>
              </Form>

              {/* Feedback Area */}
               <div id="feedback-message" className="min-h-[40px]"> {/* Reserve space to prevent layout shift */}
                {feedback === 'correct' && (
                   <div className="flex items-center p-3 rounded-md bg-accent/10 text-accent border border-accent transition-opacity duration-300 ease-in-out opacity-100">
                     <CheckCircle className="h-5 w-5 mr-2" />
                     <span className="font-medium">Correct! Well done.</span>
                   </div>
                 )}
                 {feedback === 'incorrect' && (
                   <div className="flex items-center p-3 rounded-md bg-destructive/10 text-destructive border border-destructive transition-opacity duration-300 ease-in-out opacity-100">
                     <XCircle className="h-5 w-5 mr-2" />
                     <span className="font-medium">Incorrect. The correct answer is: {currentQuestion.answer}</span>
                   </div>
                 )}
              </div>

            </div>
          )}
        </CardContent>
         <CardFooter className="justify-center text-xs text-muted-foreground pt-4 border-t"> {/* Added border-t */}
             Powered by Generative AI
         </CardFooter>
      </Card>
    </div>
  );
}
