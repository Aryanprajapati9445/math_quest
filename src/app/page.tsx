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
import { Loader2, BrainCircuit, CheckCircle, XCircle, Sigma, Calculator, Shapes, Pi } from 'lucide-react'; // Replaced SquareRoot with Pi

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

export default function MathQuestPage() {
  const [currentQuestion, setCurrentQuestion] =
    React.useState<GenerateMathQuestionOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
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
    answerForm.reset();
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
    if (!currentQuestion) return;

    // Basic comparison, might need refinement for mathematical equivalence
    const isCorrect =
      data.userAnswer.trim().toLowerCase() ===
      currentQuestion.answer.trim().toLowerCase();

    setFeedback(isCorrect ? 'correct' : 'incorrect');
    toast({
      title: isCorrect ? 'Correct!' : 'Incorrect!',
      description: isCorrect
        ? 'Great job!'
        : `The correct answer is: ${currentQuestion.answer}`,
      variant: isCorrect ? 'default' : 'destructive', // 'default' uses accent color (green)
      className: isCorrect ? 'bg-accent text-accent-foreground' : '',
    });
  };

  const getIconForType = (type: GenerateMathQuestionInput['type']) => {
    switch (type) {
      case 'algebra': return <Sigma className="h-5 w-5 mr-2" />;
      case 'calculus': return <Calculator className="h-5 w-5 mr-2" />;
      case 'geometry': return <Shapes className="h-5 w-5 mr-2" />;
      case 'trigonometry': return <Pi className="h-5 w-5 mr-2" />; // Replaced SquareRoot with Pi
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
                      disabled={isLoading}
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
                      disabled={isLoading}
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
                          <div className="flex items-center"> <Pi className="h-4 w-4 mr-2"/> Trigonometry </div> {/* Replaced SquareRoot with Pi */}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
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
              <p className="text-xl font-medium pl-7">
                 {currentQuestion.question}
              </p>

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
                           disabled={feedback === 'correct'}
                           className={`
                              ${feedback === 'correct' ? 'border-accent ring-accent focus-visible:ring-accent' : ''}
                              ${feedback === 'incorrect' ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                            `}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={feedback === 'correct'} className="w-full sm:w-auto">
                    Check Answer
                  </Button>
                </form>
              </Form>

              {/* Feedback Area */}
              {feedback === 'correct' && (
                 <div className="flex items-center p-3 rounded-md bg-accent/10 text-accent-foreground border border-accent">
                   <CheckCircle className="h-5 w-5 mr-2 text-accent" />
                   <span className="font-medium text-accent">Correct! Well done.</span>
                 </div>
               )}
               {feedback === 'incorrect' && (
                 <div className="flex items-center p-3 rounded-md bg-destructive/10 text-destructive-foreground border border-destructive">
                   <XCircle className="h-5 w-5 mr-2 text-destructive" />
                   <span className="font-medium text-destructive">Incorrect. The correct answer is: {currentQuestion.answer}</span>
                 </div>
               )}

            </div>
          )}
        </CardContent>
         <CardFooter className="justify-center text-xs text-muted-foreground pt-4">
             Powered by GenAI
         </CardFooter>
      </Card>
    </div>
  );
}
