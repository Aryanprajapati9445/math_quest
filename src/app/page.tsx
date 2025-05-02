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
import {
  analyzeUserPerformance,
  type AnalyzePerformanceInput,
  type AnalyzePerformanceOutput,
} from '@/ai/flows/analyze-user-performance'; // Import performance analysis flow
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
import { Input } from '@/components/ui/input'; // Import Input for class/exam
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose, // Import SheetClose
  SheetFooter, // Import SheetFooter
} from "@/components/ui/sheet"; // Import Sheet components
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
    Loader2, BrainCircuit, CheckCircle, XCircle, Sigma, Calculator, Shapes, Pi,
    Lightbulb, Menu, ArrowLeft, ArrowRight, BarChart, Goal, Sparkles, Power, UserCheck // Added icons
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert

// Define structure for a single question attempt
interface QuestionAttempt {
    questionData: GenerateMathQuestionOutput;
    userAnswer?: string;
    isCorrect?: boolean;
    timestamp: string; // ISO timestamp string
    settings: GenerateMathQuestionInput; // Store settings used for this question
}

const QuestionSettingsSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']),
  type: z.enum(['algebra', 'calculus', 'geometry', 'trigonometry']),
  studentClass: z.string().optional(), // Added class/grade
  examType: z.string().optional(), // Added exam type
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

const DEFAULT_SETTINGS: QuestionSettings = {
    difficulty: 'easy',
    type: 'algebra',
    studentClass: '',
    examType: '',
};

export default function MathQuestPage() {
    const [history, setHistory] = React.useState<QuestionAttempt[]>([]);
    const [currentHistoryIndex, setCurrentHistoryIndex] = React.useState<number>(-1);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isCheckingAnswer, setIsCheckingAnswer] = React.useState(false);
    const [feedback, setFeedback] = React.useState<FeedbackState>('idle');
    const [shuffledOptions, setShuffledOptions] = React.useState<string[]>([]);
    const [performanceAnalysis, setPerformanceAnalysis] = React.useState<AnalyzePerformanceOutput | null>(null);
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false); // State for Sheet visibility
    const { toast } = useToast();

    const currentAttempt = history[currentHistoryIndex];
    const currentQuestion = currentAttempt?.questionData;

    // --- Forms ---
    const settingsForm = useForm<QuestionSettings>({
        resolver: zodResolver(QuestionSettingsSchema),
        defaultValues: DEFAULT_SETTINGS,
    });

    const answerForm = useForm<AnswerFormData>({
        resolver: zodResolver(AnswerSchema),
        defaultValues: { userAnswer: '' },
    });

    // --- Effects ---

    // Update answer form when navigating history
    React.useEffect(() => {
        if (currentAttempt) {
            answerForm.reset({ userAnswer: currentAttempt.userAnswer || '' });
            setFeedback(currentAttempt.isCorrect === true ? 'correct' : currentAttempt.isCorrect === false ? 'incorrect' : 'idle');
            setIsCheckingAnswer(currentAttempt.userAnswer !== undefined); // If an answer exists, it has been checked
            if (currentAttempt.questionData.options) {
                 // Shuffle or just set based on your preference for viewing history
                 // For consistency, let's just set them as they were generated
                 setShuffledOptions(currentAttempt.questionData.options);
                 // If you want to reshuffle every time:
                 // setShuffledOptions(shuffleArray(currentAttempt.questionData.options));
            } else {
                 setShuffledOptions([]);
            }
        } else {
            answerForm.reset({ userAnswer: '' });
            setFeedback('idle');
            setIsCheckingAnswer(false);
            setShuffledOptions([]);
        }
        // Update settings form as well when navigating history if desired
        // if (currentAttempt?.settings) {
        //     settingsForm.reset(currentAttempt.settings);
        // }

    }, [currentHistoryIndex, history, answerForm]); // Removed settingsForm from deps to avoid loop


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

  // --- Event Handlers ---

  const handleGenerateQuestion = async (data: QuestionSettings) => {
    setIsLoading(true);
    setFeedback('idle');
    // setCurrentQuestion(null); // Replaced by history logic
    setShuffledOptions([]);
    answerForm.reset();
    answerForm.clearErrors();
    setIsCheckingAnswer(false);
    setPerformanceAnalysis(null); // Clear old analysis

    try {
      const result = await generateMathQuestion(data);
      const newAttempt: QuestionAttempt = {
        questionData: result,
        timestamp: new Date().toISOString(),
        settings: data, // Store the settings used
      };
      // Add to history and move to the new question
      setHistory(prev => [...prev, newAttempt]);
      setCurrentHistoryIndex(prev => prev + 1);
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
    if (!currentQuestion || isCheckingAnswer || currentHistoryIndex < 0) return;

    setIsCheckingAnswer(true);

    const isCorrect = compareAnswers(data.userAnswer, currentQuestion.answer);
    const currentFeedback = isCorrect ? 'correct' : 'incorrect';
    setFeedback(currentFeedback);

     // Update the current attempt in history
     setHistory(prev => {
        const newHistory = [...prev];
        if (newHistory[currentHistoryIndex]) {
            newHistory[currentHistoryIndex] = {
                ...newHistory[currentHistoryIndex],
                userAnswer: data.userAnswer,
                isCorrect: isCorrect,
            };
        }
        return newHistory;
     });


    toast({
      title: isCorrect ? 'Correct!' : 'Incorrect',
      description: isCorrect
        ? 'Excellent work! Ready for the next challenge?'
        : `Not quite. The correct answer is marked. Check the explanation!`,
      variant: isCorrect ? 'default' : 'destructive',
      className: isCorrect ? 'bg-accent text-accent-foreground border-accent' : '',
    });

    // Don't automatically set isCheckingAnswer back to false
    // Let the user decide to get a new question or review
  };

    const handleGoToPrevious = () => {
        if (currentHistoryIndex > 0) {
            setCurrentHistoryIndex(prev => prev - 1);
            setFeedback('idle'); // Reset feedback when navigating
            setIsCheckingAnswer(false); // Reset check state
            setPerformanceAnalysis(null); // Clear analysis when navigating
        }
    };

    const handleGoToNext = () => {
        if (currentHistoryIndex < history.length - 1) {
            setCurrentHistoryIndex(prev => prev + 1);
            setFeedback('idle'); // Reset feedback when navigating
            setIsCheckingAnswer(false); // Reset check state
            setPerformanceAnalysis(null); // Clear analysis when navigating
        }
        // Optionally, if at the latest question and trying to go next, generate a new one
        // else if (currentHistoryIndex === history.length - 1) {
        //     handleGenerateQuestion(settingsForm.getValues());
        // }
    };

    const handleEndQuest = async () => {
        setIsAnalyzing(true);
        setPerformanceAnalysis(null); // Clear previous analysis

        // Prepare data for analysis flow
        const analysisInput: AnalyzePerformanceInput = {
            activityHistory: history.map(attempt => ({
                question: attempt.questionData.question,
                difficulty: attempt.settings.difficulty, // Use settings from the attempt
                type: attempt.settings.type,           // Use settings from the attempt
                userAnswer: attempt.userAnswer,
                correctAnswer: attempt.questionData.answer,
                isCorrect: !!attempt.isCorrect, // Ensure boolean
                timestamp: attempt.timestamp,
            })),
            // Optional: Add desired focus from settings if applicable
             desiredFocus: settingsForm.getValues().type || settingsForm.getValues().difficulty,
        };


        try {
            const result = await analyzeUserPerformance(analysisInput);
            setPerformanceAnalysis(result);
            toast({
                title: "Quest Analysis Complete",
                description: "Check the performance summary below.",
            });
        } catch (error) {
            console.error("Error analyzing performance:", error);
            toast({
                title: "Analysis Error",
                description: "Could not analyze performance. Please try again later.",
                variant: "destructive",
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleApplySettingsAndGenerate = (data: QuestionSettings) => {
        settingsForm.reset(data); // Update the main form's state
        setIsSheetOpen(false); // Close the sheet
        handleGenerateQuestion(data); // Generate question with new settings
    };

    // --- Helper Functions ---

  const getIconForType = (type: GenerateMathQuestionInput['type']) => {
    switch (type) {
      case 'algebra': return <Sigma className="h-5 w-5 mr-2" />;
      case 'calculus': return <Calculator className="h-5 w-5 mr-2" />;
      case 'geometry': return <Shapes className="h-5 w-5 mr-2" />;
      case 'trigonometry': return <Pi className="h-5 w-5 mr-2" />;
      default: return <BrainCircuit className="h-5 w-5 mr-2" />;
    }
  };

  // --- Render Logic ---
    const isViewingHistory = currentHistoryIndex < history.length - 1;
    const canGenerateNew = !isLoading && !isViewingHistory;
    const canCheckAnswer = !isCheckingAnswer && !isLoading && currentQuestion && feedback === 'idle' && !isViewingHistory;


  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-black dark:to-gray-800">
      <Card className="w-full max-w-2xl shadow-2xl rounded-xl overflow-hidden border-primary/20">
        <CardHeader className="text-center bg-gradient-to-r from-primary to-blue-600 dark:from-primary dark:to-blue-700 text-primary-foreground p-6">
          <div className="flex items-center justify-between mb-2">
             <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/20">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Open Settings</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>Quest Settings</SheetTitle>
                    <SheetDescription>
                      Customize your math challenge. Select difficulty, type, class, and exam context.
                    </SheetDescription>
                  </SheetHeader>
                  <Form {...settingsForm}>
                     {/* Use a separate form instance or manage state differently if needed, */}
                     {/* Here, using the main settingsForm and applying on submit */}
                    <form
                      onSubmit={settingsForm.handleSubmit(handleApplySettingsAndGenerate)}
                      className="space-y-4 py-4"
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
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="algebra">Algebra</SelectItem>
                                <SelectItem value="calculus">Calculus</SelectItem>
                                <SelectItem value="geometry">Geometry</SelectItem>
                                <SelectItem value="trigonometry">Trigonometry</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                            control={settingsForm.control}
                            name="studentClass"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Class/Grade (Optional)</FormLabel>
                                <FormControl>
                                <Input placeholder="e.g., 9th Grade, College" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={settingsForm.control}
                            name="examType"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Exam Context (Optional)</FormLabel>
                                <FormControl>
                                <Input placeholder="e.g., SAT Prep, Final Exam" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <SheetFooter>
                            <SheetClose asChild>
                                <Button type="submit">Apply & Start New</Button>
                            </SheetClose>
                       </SheetFooter>
                    </form>
                  </Form>
                </SheetContent>
              </Sheet>

            <div className="flex items-center justify-center flex-grow">
                 <BrainCircuit className="h-8 w-8 mr-2" />
                 <CardTitle className="text-3xl font-bold">Math Quest AI</CardTitle>
             </div>
             {/* Placeholder for potential right-side icon/button */}
             <div className="w-10"></div>
          </div>
          <CardDescription className="text-lg text-blue-100">
            Sharpen your mind with AI-powered math challenges!
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6 bg-background text-foreground">
           {/* Removed the inline settings form, now in Sheet */}

          {/* Question Display & Interaction Area */}
          <div className="min-h-[300px] flex flex-col"> {/* Ensure minimum height */}
             {isLoading && history.length === 0 && ( // Show initial loading state
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p>Generating your first question...</p>
                  <p className="text-sm">Tip: Use the menu (<Menu className="inline h-4 w-4"/>) to set your preferred difficulty and topic!</p>
                </div>
             )}

             {!isLoading && history.length === 0 && ( // Show welcome/start state
                 <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                    <Sparkles className="h-12 w-12 text-primary mb-4" />
                    <p className="text-lg font-medium mb-2">Welcome to Math Quest AI!</p>
                    <p>Click the menu (<Menu className="inline h-4 w-4"/>) to set your preferences,</p>
                    <p>or hit "Start Quest" for a random challenge.</p>
                     <Button onClick={() => handleGenerateQuestion(settingsForm.getValues())} className="mt-6">
                         <Sparkles className="mr-2 h-4 w-4" /> Start Quest
                     </Button>
                 </div>
             )}

            {currentQuestion && (
                <div className="flex-grow p-6 border rounded-lg bg-card shadow-inner space-y-4">
                    {/* Question Header */}
                    <div className="flex items-center justify-between text-muted-foreground text-sm">
                       <span>{`Question ${currentHistoryIndex + 1} of ${history.length}`}</span>
                       <div className="flex items-center space-x-1">
                         {getIconForType(currentAttempt?.settings?.type || 'algebra')}
                         <span>{currentAttempt?.settings?.type || 'N/A'} | {currentAttempt?.settings?.difficulty || 'N/A'}</span>
                         {currentAttempt?.settings?.studentClass && <span className="hidden sm:inline"> | {currentAttempt.settings.studentClass}</span>}
                         {currentAttempt?.settings?.examType && <span className="hidden sm:inline"> | {currentAttempt.settings.examType}</span>}
                       </div>
                    </div>
                     <Separator/>

                    {/* Question Text */}
                     <div className="text-xl font-medium prose prose-sm max-w-none break-words">
                         {currentQuestion.question}
                     </div>

                {/* Answer Form */}
                 <Form {...answerForm}>
                     <form
                       onSubmit={answerForm.handleSubmit(handleCheckAnswer)}
                       className="space-y-4"
                       aria-live="polite" // Announce changes for screen readers
                     >
                       <FormField
                         control={answerForm.control}
                         name="userAnswer"
                         render={({ field }) => (
                           <FormItem className="space-y-3">
                             <FormLabel className="font-semibold">Select your answer:</FormLabel>
                             <FormControl>
                               <RadioGroup
                                 onValueChange={field.onChange}
                                 value={field.value} // Controlled component
                                 // Disable if feedback is given OR if viewing history and an answer was submitted
                                 disabled={feedback !== 'idle' || (isViewingHistory && currentAttempt?.userAnswer !== undefined) || isLoading || isCheckingAnswer}
                                 className="grid grid-cols-1 sm:grid-cols-2 gap-3" // Responsive grid
                               >
                                 {shuffledOptions.map((option, index) => {
                                   const isSelected = field.value === option;
                                   const isCorrectOption = compareAnswers(option, currentQuestion.answer);
                                   // Show feedback only AFTER checking OR if viewing history where answer exists
                                   const showFeedback = feedback !== 'idle' || (isViewingHistory && currentAttempt?.userAnswer !== undefined);
                                   const feedbackToShow = currentAttempt?.isCorrect === true ? 'correct' : currentAttempt?.isCorrect === false ? 'incorrect' : feedback;


                                   return (
                                    <FormItem key={`${currentHistoryIndex}-${index}`} className={cn( // Use index combined with history index for key
                                      "flex items-center space-x-3 space-y-0 rounded-md border p-3 transition-all",
                                       // Base styles
                                      !showFeedback && "hover:bg-muted/50 cursor-pointer",
                                      // Styles when an answer is selected (before checking)
                                      isSelected && !showFeedback && "bg-primary/10 border-primary",
                                      // Feedback styles after checking or when viewing history
                                      showFeedback && isCorrectOption && "bg-accent/10 border-accent text-accent-foreground",
                                      showFeedback && isSelected && !isCorrectOption && "bg-destructive/10 border-destructive text-destructive-foreground line-through",
                                      // Disabled styles
                                      (feedback !== 'idle' || (isViewingHistory && currentAttempt?.userAnswer !== undefined) || isLoading || isCheckingAnswer) && "cursor-not-allowed opacity-70"
                                    )}>
                                        <FormControl>
                                            <RadioGroupItem
                                                value={option}
                                                id={`option-${currentHistoryIndex}-${index}`}
                                                className={cn(
                                                    // More specific styling if needed, handled mostly by parent FormItem now
                                                    showFeedback && isCorrectOption && 'border-accent ring-accent text-accent',
                                                    showFeedback && isSelected && !isCorrectOption && 'border-destructive ring-destructive text-destructive'
                                                )}
                                            />
                                        </FormControl>
                                        <FormLabel
                                            htmlFor={`option-${currentHistoryIndex}-${index}`}
                                            className="font-normal flex-1 cursor-pointer"
                                            // Text styling moved to parent FormItem
                                        >
                                            {option}
                                             {/* Icons shown after feedback or on history view */}
                                             {showFeedback && isCorrectOption && <CheckCircle className="inline h-4 w-4 ml-2 text-accent flex-shrink-0" />}
                                             {showFeedback && isSelected && !isCorrectOption && <XCircle className="inline h-4 w-4 ml-2 text-destructive flex-shrink-0" />}
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
                      {/* Show Check Answer only if not viewing history and answer not yet checked */}
                      {!isViewingHistory && feedback === 'idle' && (
                        <Button type="submit" disabled={!canCheckAnswer || !answerForm.formState.isValid} className="w-full sm:w-auto">
                           {isCheckingAnswer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Check Answer
                        </Button>
                      )}
                    </form>
                  </Form>

                  {/* Explanation Area */}
                   {(feedback !== 'idle' || (isViewingHistory && currentAttempt?.userAnswer !== undefined)) && currentQuestion.explanation && ( // Show if feedback given OR viewing history with answer
                     <>
                       <Separator className="my-4" />
                       <div className="space-y-2 animate-in fade-in duration-500">
                           <div className="flex items-center text-lg font-semibold text-primary">
                               <Lightbulb className="h-5 w-5 mr-2" />
                               Explanation:
                           </div>
                           <div className="text-sm text-muted-foreground prose prose-sm max-w-none pl-7 break-words">
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

            {/* Performance Analysis Display */}
            {isAnalyzing && (
                <div className="text-center p-4">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-muted-foreground">Analyzing your performance...</p>
                </div>
            )}
            {performanceAnalysis && (
                 <Alert className="mt-6 animate-in fade-in duration-500 border-primary/30">
                     <BarChart className="h-5 w-5 text-primary" />
                     <AlertTitle className="text-primary font-semibold">Performance Analysis</AlertTitle>
                     <AlertDescription className="space-y-2 text-foreground">
                         <p><strong>Summary:</strong> {performanceAnalysis.summary}</p>
                         {performanceAnalysis.strengths.length > 0 && (
                             <p><strong>Strengths:</strong> {performanceAnalysis.strengths.join(', ')}</p>
                         )}
                         {performanceAnalysis.weaknesses.length > 0 && (
                             <p><strong>Weaknesses:</strong> {performanceAnalysis.weaknesses.join(', ')}</p>
                         )}
                         <p><strong>Suggestions:</strong></p>
                         <ul className="list-disc pl-5 space-y-1">
                             {performanceAnalysis.suggestions.map((suggestion, index) => (
                                 <li key={index}>{suggestion}</li>
                             ))}
                         </ul>
                         {(performanceAnalysis.suggestedNextDifficulty || performanceAnalysis.suggestedNextQuestionType) && (
                            <p className="pt-2">
                                <Goal className="inline h-4 w-4 mr-1" />
                                <strong>Recommendation:</strong> Try a{' '}
                                {performanceAnalysis.suggestedNextDifficulty || settingsForm.getValues('difficulty')}{' '}
                                {performanceAnalysis.suggestedNextQuestionType || settingsForm.getValues('type')} question next.
                            </p>
                         )}
                     </AlertDescription>
                 </Alert>
            )}
            </div>


            {/* Navigation and Action Buttons */}
            {history.length > 0 && (
                <div className="mt-6 p-4 border-t bg-muted/30 flex flex-col sm:flex-row justify-between items-center gap-3">
                    {/* History Navigation */}
                    <div className="flex gap-2">
                         <Button
                           variant="outline"
                           onClick={handleGoToPrevious}
                           disabled={currentHistoryIndex <= 0 || isLoading || isCheckingAnswer}
                           aria-label="Previous Question"
                         >
                           <ArrowLeft className="h-4 w-4 mr-1" /> Previous
                         </Button>
                         <Button
                           variant="outline"
                           onClick={handleGoToNext}
                           disabled={currentHistoryIndex >= history.length - 1 || isLoading || isCheckingAnswer}
                           aria-label="Next Question"
                         >
                           Next <ArrowRight className="h-4 w-4 ml-1" />
                         </Button>
                    </div>

                     {/* Primary Action Button: New Question or Finish */}
                    <div className="flex gap-2">
                       {isViewingHistory ? (
                         <Button
                             onClick={() => {
                                 setCurrentHistoryIndex(history.length - 1); // Jump to latest
                                 setPerformanceAnalysis(null); // Clear analysis if jumping back
                             }}
                             className="bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                             disabled={isLoading}
                          >
                              <UserCheck className="mr-2 h-4 w-4"/> Go to Latest
                         </Button>
                       ) : (
                         <Button
                           onClick={() => handleGenerateQuestion(performanceAnalysis?.suggestedNextDifficulty || performanceAnalysis?.suggestedNextQuestionType ? {
                               ...settingsForm.getValues(), // Keep existing settings
                               difficulty: performanceAnalysis.suggestedNextDifficulty || settingsForm.getValues('difficulty'),
                               type: performanceAnalysis.suggestedNextQuestionType || settingsForm.getValues('type'),
                           } : settingsForm.getValues() )} // Use suggestion or current settings
                           disabled={!canGenerateNew}
                           className="min-w-[140px]" // Ensure consistent width
                           aria-live="polite" // Announce loading state change
                         >
                           {isLoading ? (
                             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                           ) : performanceAnalysis ? (
                             <> <Sparkles className="mr-2 h-4 w-4"/> Recommended Next </>
                             ): (
                             <> <Sparkles className="mr-2 h-4 w-4"/> New Question </>
                           )}
                         </Button>
                       )}
                         <Button
                            variant="destructive"
                            onClick={handleEndQuest}
                            disabled={isAnalyzing || history.length === 0 || isLoading}
                            className="min-w-[140px]" // Consistent width
                         >
                           {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
                           {performanceAnalysis ? 'Analyze Again' : 'End & Analyze'}
                         </Button>
                     </div>

                </div>
            )}


        </CardContent>
         <CardFooter className="justify-center text-xs text-muted-foreground pt-4 border-t bg-gradient-to-r from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800">
             Powered by Generative AI ✨ Math Quest v1.1
         </CardFooter>
      </Card>
    </div>
  );
}
