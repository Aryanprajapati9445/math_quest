"use client";

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  generateMathQuestion,
  type GenerateMathQuestionInput,
  type GenerateMathQuestionOutput, // Type now includes explanation
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BrainCircuit, CheckCircle, XCircle, Sigma, Calculator, Shapes, Pi, Lightbulb } from 'lucide-react'; // Added Lightbulb icon
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator'; // Import Separator

const QuestionSettingsSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']),
  type: z.enum(['algebra', 'calculus', 'geometry', 'trigonometry']),
});

type QuestionSettings = z.infer<typeof QuestionSettingsSchema>;

const AnswerSchema = z.object({
  userAnswer: z.string({
    required_error: "Please select an answer.",
  }),
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

  // Attempt numerical comparison
  try {
    const userNum = parseFloat(normUserAnswer);
    const correctNum = parseFloat(normCorrectAnswer);

    // Check if both are valid numbers and are approximately equal (tolerance for floating point)
    if (!isNaN(userNum) && !isNaN(correctNum)) {
      const tolerance = 1e-6;
      if (Math.abs(userNum - correctNum) < tolerance) {
        return true;
      }
    }
  } catch(e) {
    // Ignore parsing errors if they are not numbers
  }

    // Basic expression comparison (very naive, could be improved)
  // Check if normalized strings are equal after removing extra parentheses or spaces
  const simplifyExpr = (str: string) => str.replace(/\(|\)/g, '').replace(/\s/g, '');
  if (simplifyExpr(normUserAnswer) === simplifyExpr(normCorrectAnswer)) {
      return true;
  }


  return false; // Default to false if no match
};


export default function MathQuestPage() {
  const [currentQuestion, setCurrentQuestion] =
    React.useState<GenerateMathQuestionOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCheckingAnswer, setIsCheckingAnswer] = React.useState(false);
  const [feedback, setFeedback] = React.useState<FeedbackState>('idle');
  const [shuffledOptions, setShuffledOptions] = React.useState<string[]>([]);
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

  // Function to shuffle array (Fisher-Yates algorithm) - client side only
  const shuffleArray = (array: string[]) => {
    let currentIndex = array.length, randomIndex;
    const newArray = [...array];
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [newArray[currentIndex], newArray[randomIndex]] = [
        newArray[randomIndex], newArray[currentIndex]];
    }
    return newArray;
  };

  // useEffect to shuffle options when currentQuestion changes and is available
  React.useEffect(() => {
    if (currentQuestion?.options) {
      setShuffledOptions(shuffleArray(currentQuestion.options));
    } else {
      setShuffledOptions([]);
    }
  }, [currentQuestion?.options]); // Dependency array includes options specifically


  const handleGenerateQuestion = async (data: QuestionSettings) => {
    setIsLoading(true);
    setFeedback('idle');
    setCurrentQuestion(null);
    setShuffledOptions([]);
    answerForm.reset();
    answerForm.clearErrors();
    setIsCheckingAnswer(false); // Reset checking state
    try {
      const result = await generateMathQuestion(data);
      setCurrentQuestion(result);
      // Options will be shuffled by the useEffect hook
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
      title: isCorrect ? 'Correct!' : 'Incorrect',
      description: isCorrect
        ? 'Excellent work!'
        : `The correct answer is marked above. See explanation below.`, // Updated message for incorrect
      variant: isCorrect ? 'default' : 'destructive',
      className: isCorrect ? 'bg-accent text-accent-foreground border-accent' : '',
    });

    // Keep isCheckingAnswer true until a new question is generated or reset
    // This prevents re-submitting the same answer.
    // The "New Question" button becomes the primary action after checking.
    // We no longer set it back to false here.
    // setIsCheckingAnswer(false); // Removed this line
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
                          <div className="flex items-center"> <Pi className="h-4 w-4 mr-2"/> Trigonometry </div>
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
              {/* Use prose for potentially complex math rendering later */}
              <div className="text-xl font-medium pl-7 prose prose-sm max-w-none break-words"> {/* Added break-words */}
                 {currentQuestion.question}
              </div>

              {/* Answer Form using RadioGroup */}
              <Form {...answerForm}>
                 <form
                   onSubmit={answerForm.handleSubmit(handleCheckAnswer)}
                   className="space-y-4"
                 >
                   <FormField
                     control={answerForm.control}
                     name="userAnswer"
                     render={({ field }) => (
                       <FormItem className="space-y-3">
                         <FormLabel>Select your answer:</FormLabel>
                         <FormControl>
                           <RadioGroup
                             onValueChange={field.onChange}
                             defaultValue={field.value}
                             // Disable if feedback is given (correct or incorrect) or while checking
                             disabled={feedback !== 'idle' || isCheckingAnswer}
                             className="flex flex-col space-y-2"
                           >
                             {shuffledOptions.map((option, index) => {
                               const isSelected = field.value === option;
                               const isCorrectOption = compareAnswers(option, currentQuestion.answer);
                               const showFeedback = feedback !== 'idle'; // Determine if feedback should be shown
                               return (
                                <FormItem key={index} className="flex items-center space-x-3 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem
                                            value={option}
                                            id={`option-${index}`}
                                            className={cn(
                                              'transition-colors duration-200',
                                              // Apply styles based on feedback state ONLY after check
                                              showFeedback && isCorrectOption && 'border-accent ring-accent text-accent', // Correct option highlight
                                              showFeedback && isSelected && !isCorrectOption && 'border-destructive ring-destructive text-destructive' // Incorrect selected option highlight
                                            )}
                                        />
                                    </FormControl>
                                    <FormLabel
                                        htmlFor={`option-${index}`}
                                        className={cn(
                                          "font-normal cursor-pointer flex-1",
                                           // Apply styles based on feedback state ONLY after check
                                          showFeedback && isCorrectOption && 'text-accent font-medium', // Correct option text
                                          showFeedback && isSelected && !isCorrectOption && 'text-destructive line-through' // Incorrect selected option text
                                        )}
                                    >
                                      {option}
                                      {/* Show icons next to the option based on feedback */}
                                      {showFeedback && isCorrectOption && <CheckCircle className="inline h-4 w-4 ml-2 text-accent" />}
                                      {showFeedback && isSelected && !isCorrectOption && <XCircle className="inline h-4 w-4 ml-2 text-destructive" />}
                                    </FormLabel>
                                </FormItem>
                               );
                              })}
                           </RadioGroup>
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                  {/* Disable Check Answer button if loading new question, feedback is given, or actively checking */}
                  <Button type="submit" disabled={isLoading || feedback !== 'idle' || isCheckingAnswer} className="w-full sm:w-auto">
                     {isCheckingAnswer && feedback === 'idle' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {/* Show loader only when actively checking */}
                    Check Answer
                  </Button>
                </form>
              </Form>

              {/* Explanation Area - Conditionally displayed after checking answer */}
               {feedback !== 'idle' && currentQuestion.explanation && (
                 <>
                   <Separator className="my-4" />
                   <div className="space-y-2">
                       <div className="flex items-center text-lg font-semibold text-primary">
                           <Lightbulb className="h-5 w-5 mr-2" />
                           Explanation:
                       </div>
                       <div className="text-sm text-muted-foreground prose prose-sm max-w-none pl-7 break-words"> {/* Added break-words */}
                           {/* Render explanation - could enhance with markdown rendering later */}
                           {currentQuestion.explanation.split('\n').map((line, index) => (
                            <React.Fragment key={index}>
                                {line}
                                <br />
                            </React.Fragment>
                           ))}
                       </div>
                   </div>
                 </>
               )}

            </div>
          )}
        </CardContent>
         <CardFooter className="justify-center text-xs text-muted-foreground pt-4 border-t">
             Powered by Generative AI
         </CardFooter>
      </Card>
    </div>
  );
}
