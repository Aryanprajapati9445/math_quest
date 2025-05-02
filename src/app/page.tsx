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
} from '@/ai/flows/analyze-user-performance'; // Import only the function
import type {
    AnalyzePerformanceInput,
    AnalyzePerformanceOutput,
    UserActivityRecord // Import UserActivityRecord type
} from '@/ai/schemas/performance-analysis'; // Import types from the schema file
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
// Removed Input import as it's replaced by Select for these fields
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
  studentClass: z.string().optional(), // Keep as string for flexibility, options are UI suggestions
  examType: z.string().optional(), // Keep as string for flexibility, options are UI suggestions
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

// Use a non-empty value for the "None" option
const NONE_VALUE = "none_value";

const DEFAULT_SETTINGS: QuestionSettings = {
    difficulty: 'easy',
    type: 'algebra',
    studentClass: NONE_VALUE, // Default to NONE_VALUE
    examType: NONE_VALUE,     // Default to NONE_VALUE
};

// Define options for the Select components
const classOptions = [
  { value: NONE_VALUE, label: "None" },
  { value: "Middle School", label: "Middle School" },
  { value: "High School Freshman", label: "High School Freshman" },
  { value: "High School Sophomore", label: "High School Sophomore" },
  { value: "High School Junior", label: "High School Junior" },
  { value: "High School Senior", label: "High School Senior" },
  { value: "College Freshman", label: "College Freshman" },
  { value: "College Sophomore", label: "College Sophomore" },
  { value: "College Junior", label: "College Junior" },
  { value: "College Senior", label: "College Senior" },
  { value: "Graduate Student", label: "Graduate Student" },
];

const examOptions = [
  { value: NONE_VALUE, label: "None" },
  { value: "Homework", label: "Homework" },
  { value: "Quiz", label: "Quiz" },
  { value: "Midterm Exam", label: "Midterm Exam" },
  { value: "Final Exam", label: "Final Exam" },
  { value: "Standardized Test Prep (SAT/ACT)", label: "Standardized Test Prep (SAT/ACT)" },
  { value: "Competitive Exam Prep", label: "Competitive Exam Prep" },
  { value: "Professional Certification", label: "Professional Certification" },
];

// Utility function to shuffle array (Fisher-Yates algorithm)
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

    // Define isViewingHistory based on current state, using useMemo
    const isViewingHistory = React.useMemo(() => {
        return currentHistoryIndex >= 0 && currentHistoryIndex < history.length - 1;
    }, [currentHistoryIndex, history.length]);

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

    // Update answer form and feedback when navigating history
    React.useEffect(() => {
        if (currentAttempt) {
            answerForm.reset({ userAnswer: currentAttempt.userAnswer || '' });
            const attemptFeedback = currentAttempt.isCorrect === true ? 'correct' : currentAttempt.isCorrect === false ? 'incorrect' : 'idle';
            setFeedback(attemptFeedback);
            // Set check state based on whether an answer was submitted in history
            setIsCheckingAnswer(currentAttempt.userAnswer !== undefined);
            // Ensure shuffledOptions are set for the current question
            if (currentAttempt.questionData?.options) {
                 setShuffledOptions(currentAttempt.questionData.options); // Use the stored options
            } else {
                 setShuffledOptions([]);
            }
        } else {
            // Reset form and state if there's no current attempt (e.g., initial load)
            answerForm.reset({ userAnswer: '' });
            setFeedback('idle');
            setIsCheckingAnswer(false);
            setShuffledOptions([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- answerForm should not be a dependency
    }, [currentHistoryIndex, history, currentAttempt]); // Added currentAttempt for clarity


  // Shuffle options when a new question is loaded, not viewing history, and not answered yet
  React.useEffect(() => {
      if (currentQuestion?.options && feedback === 'idle' && !isViewingHistory) {
          setShuffledOptions(shuffleArray(currentQuestion.options));
      } else if (currentQuestion?.options) {
          // For history or answered questions, just set the options as they were
          setShuffledOptions(currentQuestion.options);
      } else {
          setShuffledOptions([]); // Clear if no options
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only needs to run when question, feedback, or view mode changes
  }, [currentQuestion, feedback, isViewingHistory]); // Add feedback and isViewingHistory


  // --- Event Handlers ---

  const handleGenerateQuestion = async (data: QuestionSettings) => {
    setIsLoading(true);
    setFeedback('idle');
    setShuffledOptions([]);
    answerForm.reset();
    answerForm.clearErrors();
    setIsCheckingAnswer(false);
    setPerformanceAnalysis(null); // Clear old analysis

    // Prepare input, ensuring optional fields are passed correctly (undefined if "none_value")
    const inputData: GenerateMathQuestionInput = {
        ...data,
        studentClass: data.studentClass === NONE_VALUE ? undefined : data.studentClass,
        examType: data.examType === NONE_VALUE ? undefined : data.examType,
    };

    try {
      const result = await generateMathQuestion(inputData);
      const newAttempt: QuestionAttempt = {
        questionData: result,
        timestamp: new Date().toISOString(),
        // Store the user-selected settings (which might include NONE_VALUE)
        // Pass the original data (which might contain NONE_VALUE) to the attempt history
        settings: {
            difficulty: data.difficulty,
            type: data.type,
            studentClass: data.studentClass, // Store the potentially NONE_VALUE
            examType: data.examType, // Store the potentially NONE_VALUE
        },
      };
      // Add to history and move index to the new question
      const newHistory = [...history, newAttempt];
      setHistory(newHistory);
      setCurrentHistoryIndex(newHistory.length - 1); // Go to the latest index
      setFeedback('idle'); // Ensure feedback is reset for the new question
      setIsCheckingAnswer(false); // Ensure checking state is reset
      // Ensure result.options exists before shuffling
      if(result.options) {
         setShuffledOptions(shuffleArray(result.options)); // Shuffle options for the new question
      } else {
         setShuffledOptions([]);
      }
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
    // Guard conditions
    if (!currentQuestion || isCheckingAnswer || currentHistoryIndex < 0 || isViewingHistory || feedback !== 'idle') return;

    setIsCheckingAnswer(true); // Indicate checking process starts

    const isCorrect = compareAnswers(data.userAnswer, currentQuestion.answer);
    const currentFeedback = isCorrect ? 'correct' : 'incorrect';
    setFeedback(currentFeedback); // Update feedback state immediately

     // Update the current attempt in history
     setHistory(prev => {
        const newHistory = [...prev];
        const attemptIndex = currentHistoryIndex; // Use index captured at the start
        if (newHistory[attemptIndex]) {
            newHistory[attemptIndex] = {
                ...newHistory[attemptIndex],
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

    // Important: Keep isCheckingAnswer true after checking to prevent re-submission
    // It will be reset only when navigating or generating a new question.
    // This logic was moved here as per previous request
  };

    const handleGoToPrevious = () => {
        if (currentHistoryIndex > 0) {
            setCurrentHistoryIndex(prev => prev - 1);
            setPerformanceAnalysis(null); // Clear analysis when navigating
        }
    };

    const handleGoToNext = () => {
        if (currentHistoryIndex < history.length - 1) {
            setCurrentHistoryIndex(prev => prev + 1);
            setPerformanceAnalysis(null); // Clear analysis when navigating
        }
    };

    const handleEndQuest = async () => {
        if (history.length === 0) {
             toast({
                title: "No History",
                description: "Answer some questions first to get an analysis.",
                variant: "destructive",
            });
            return;
        }

        setIsAnalyzing(true);
        setPerformanceAnalysis(null); // Clear previous analysis

        // Prepare data for analysis flow
        const activityHistoryForAnalysis: UserActivityRecord[] = history
            .map(attempt => ({
                question: attempt.questionData.question,
                // Use settings from the attempt (convert NONE_VALUE back if needed, though schema handles enums)
                difficulty: attempt.settings.difficulty,
                type: attempt.settings.type,
                userAnswer: attempt.userAnswer,
                correctAnswer: attempt.questionData.answer,
                // Ensure isCorrect is boolean, default to false if undefined (e.g., skipped)
                isCorrect: attempt.isCorrect === undefined ? false : attempt.isCorrect,
                timestamp: attempt.timestamp,
            }))
             // Filter out attempts where userAnswer is undefined AND isCorrect is undefined (i.e., truly skipped/unanswered)
            .filter(attempt => attempt.userAnswer !== undefined || attempt.isCorrect !== undefined);


        // Get current settings, handling NONE_VALUE
        const currentSettings = settingsForm.getValues();
        const desiredFocusType = currentSettings.type !== NONE_VALUE ? currentSettings.type : undefined;
        const desiredFocusDifficulty = currentSettings.difficulty; // Difficulty always has a value

        const analysisInput: AnalyzePerformanceInput = {
            activityHistory: activityHistoryForAnalysis,
            // Use the non-NONE_VALUE type or difficulty as focus, or undefined
            desiredFocus: desiredFocusType || desiredFocusDifficulty || undefined,
        };

        // Don't analyze if there are no *answered* or *attempted* questions
        if (analysisInput.activityHistory.length === 0) {
            toast({
                title: "No Answers",
                description: "You need to answer at least one question for analysis.",
                variant: "destructive",
            });
            setIsAnalyzing(false);
            return;
        }


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
                description: `Could not analyze performance. ${error instanceof Error ? error.message : 'Please try again later.'}`,
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

  const getIconForType = (type: GenerateMathQuestionInput['type'] | undefined) => { // Allow undefined
    switch (type) {
      case 'algebra': return <Sigma className="h-5 w-5 mr-2" />;
      case 'calculus': return <Calculator className="h-5 w-5 mr-2" />;
      case 'geometry': return <Shapes className="h-5 w-5 mr-2" />;
      case 'trigonometry': return <Pi className="h-5 w-5 mr-2" />;
      default: return <BrainCircuit className="h-5 w-5 mr-2" />; // Default icon
    }
  };

  // --- Render Logic ---
    // Can generate new if not loading AND not currently viewing older history
    const canGenerateNew = !isLoading && !isViewingHistory;
    // Can check answer if: not loading, not checking, question exists, feedback is idle (not yet answered), AND not viewing history
    const canCheckAnswer = !isLoading && !isCheckingAnswer && currentQuestion && feedback === 'idle' && !isViewingHistory;


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
                              value={field.value} // Ensure controlled component
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
                              value={field.value} // Ensure controlled component
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
                                 <Select
                                     onValueChange={field.onChange}
                                     value={field.value ?? NONE_VALUE} // Use NONE_VALUE for 'None'
                                 >
                                     <FormControl>
                                         <SelectTrigger>
                                             <SelectValue placeholder="Select class/grade level" />
                                         </SelectTrigger>
                                     </FormControl>
                                     <SelectContent>
                                         {classOptions.map(option => (
                                             <SelectItem key={option.value} value={option.value}>
                                                 {option.label}
                                             </SelectItem>
                                         ))}
                                     </SelectContent>
                                 </Select>
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
                                <Select
                                     onValueChange={field.onChange}
                                     value={field.value ?? NONE_VALUE} // Use NONE_VALUE for 'None'
                                 >
                                     <FormControl>
                                         <SelectTrigger>
                                             <SelectValue placeholder="Select exam context" />
                                         </SelectTrigger>
                                     </FormControl>
                                     <SelectContent>
                                         {examOptions.map(option => (
                                             <SelectItem key={option.value} value={option.value}>
                                                 {option.label}
                                             </SelectItem>
                                         ))}
                                     </SelectContent>
                                 </Select>
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

          {/* Question Display & Interaction Area */}
          <div className="min-h-[300px] flex flex-col"> {/* Ensure minimum height */}
             {isLoading && history.length === 0 && ( // Show initial loading state
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p>Generating your first question...</p>
                  <p className="text-sm">Tip: Use the menu (<Menu className="inline h-4 w-4"/>) to set your preferred difficulty and topic!</p>
                </div>
             )}

             {isLoading && history.length > 0 && currentHistoryIndex === history.length -1 && ( // Show loading new question when at the end
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p>Generating next question...</p>
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

            {/* Only render question area if not loading initial OR not loading next */}
            {(!isLoading || history.length > 0) && currentQuestion && (
                <div className="flex-grow p-6 border rounded-lg bg-card shadow-inner space-y-4">
                    {/* Question Header */}
                    <div className="flex items-center justify-between text-muted-foreground text-sm flex-wrap gap-x-2"> {/* Added flex-wrap and gap */}
                       <span>{`Question ${currentHistoryIndex + 1} of ${history.length}`}</span>
                       <div className="flex items-center space-x-1 flex-wrap"> {/* Added flex-wrap */}
                         {getIconForType(currentAttempt?.settings?.type)}
                         <span className="truncate">{currentAttempt?.settings?.type || 'N/A'} | {currentAttempt?.settings?.difficulty || 'N/A'}</span>
                         {/* Display class/exam only if not NONE_VALUE */}
                         {currentAttempt?.settings?.studentClass && currentAttempt.settings.studentClass !== NONE_VALUE && <span className="hidden sm:inline truncate"> | {currentAttempt.settings.studentClass}</span>}
                         {currentAttempt?.settings?.examType && currentAttempt.settings.examType !== NONE_VALUE && <span className="hidden sm:inline truncate"> | {currentAttempt.settings.examType}</span>}
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
                                 // Disable if feedback is given OR if loading new q OR already checking
                                 disabled={feedback !== 'idle' || isLoading || isCheckingAnswer}
                                 className="grid grid-cols-1 sm:grid-cols-2 gap-3" // Responsive grid
                               >
                                 {(shuffledOptions || []).map((option, index) => { // Add fallback for shuffledOptions
                                   const isSelected = field.value === option;
                                   const isCorrectOption = compareAnswers(option, currentQuestion.answer);
                                   // Determine feedback state based on current attempt or current feedback state
                                    const attemptFeedbackState = currentAttempt?.isCorrect !== undefined
                                        ? (currentAttempt.isCorrect ? 'correct' : 'incorrect')
                                        : 'idle';
                                    // Prioritize attempt feedback if viewing history, otherwise use current feedback
                                    // Also consider if we are currently checking (isCheckingAnswer)
                                    const finalFeedbackState = (isViewingHistory && attemptFeedbackState !== 'idle')
                                        ? attemptFeedbackState
                                        : (isCheckingAnswer ? (isCorrectOption ? 'correct' : 'incorrect') : feedback);


                                   return (
                                    <FormItem
                                      key={`${currentHistoryIndex}-${option}-${index}`} // More robust key
                                      className={cn(
                                      "flex items-center space-x-3 space-y-0 rounded-md border p-3 transition-all",
                                       // Base styles when interactive
                                      finalFeedbackState === 'idle' && !isLoading && !isCheckingAnswer && "hover:bg-muted/50 cursor-pointer",
                                      // Styles when an answer is selected (before checking)
                                      isSelected && finalFeedbackState === 'idle' && "bg-primary/10 border-primary",
                                      // Feedback styles after checking or when viewing history
                                      finalFeedbackState !== 'idle' && isCorrectOption && "bg-accent/10 border-accent text-accent-foreground", // Correct answer always highlighted green
                                      finalFeedbackState !== 'idle' && isSelected && !isCorrectOption && "bg-destructive/10 border-destructive text-destructive-foreground line-through", // Incorrect selection highlighted red
                                      finalFeedbackState !== 'idle' && !isSelected && !isCorrectOption && "opacity-60", // Fade out incorrect, unselected options
                                      // Disabled styles
                                      (finalFeedbackState !== 'idle' || isLoading || isCheckingAnswer) && "cursor-not-allowed" // General disabled cursor
                                    )}>
                                        <FormControl>
                                            <RadioGroupItem
                                                value={option}
                                                id={`option-${currentHistoryIndex}-${index}`}
                                                className={cn(
                                                    // Specific styling for the radio button itself based on feedback
                                                    finalFeedbackState !== 'idle' && isCorrectOption && 'border-accent ring-accent text-accent',
                                                    finalFeedbackState !== 'idle' && isSelected && !isCorrectOption && 'border-destructive ring-destructive text-destructive'
                                                )}
                                                // Disable individual items based on feedback state or loading/checking
                                                disabled={finalFeedbackState !== 'idle' || isLoading || isCheckingAnswer}
                                            />
                                        </FormControl>
                                        <FormLabel
                                            htmlFor={`option-${currentHistoryIndex}-${index}`}
                                            className={cn(
                                                "font-normal flex-1",
                                                // Make label clickable only when interactive
                                                (finalFeedbackState === 'idle' && !isLoading && !isCheckingAnswer) ? "cursor-pointer" : "cursor-default"
                                            )}
                                        >
                                            {option}
                                             {/* Icons shown after checking or when viewing history */}
                                             {finalFeedbackState !== 'idle' && isCorrectOption && <CheckCircle className="inline h-4 w-4 ml-2 text-accent flex-shrink-0" />}
                                             {finalFeedbackState !== 'idle' && isSelected && !isCorrectOption && <XCircle className="inline h-4 w-4 ml-2 text-destructive flex-shrink-0" />}
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
                      {/* Show Check Answer button only if interaction is possible */}
                      {canCheckAnswer && (
                        <Button type="submit" disabled={!answerForm.formState.isValid} className="w-full sm:w-auto">
                           Check Answer
                        </Button>
                      )}
                    </form>
                  </Form>

                  {/* Explanation Area */}
                   {/* Show explanation if feedback is given OR if viewing history with an answer */}
                   {(feedback !== 'idle' || (isViewingHistory && currentAttempt?.userAnswer)) && currentQuestion.explanation && (
                     <>
                       <Separator className="my-4" />
                       <div className="space-y-2 animate-in fade-in duration-500">
                           <div className="flex items-center text-lg font-semibold text-primary">
                               <Lightbulb className="h-5 w-5 mr-2" />
                               Explanation:
                           </div>
                           <div className="text-sm text-muted-foreground prose prose-sm max-w-none pl-7 break-words">
                               {/* Render explanation text safely */}
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
                         {performanceAnalysis.strengths?.length > 0 && ( // Check existence
                             <p><strong>Strengths:</strong> {performanceAnalysis.strengths.join(', ')}</p>
                         )}
                         {performanceAnalysis.weaknesses?.length > 0 && ( // Check existence
                             <p><strong>Weaknesses:</strong> {performanceAnalysis.weaknesses.join(', ')}</p>
                         )}
                         <p><strong>Suggestions:</strong></p>
                         <ul className="list-disc pl-5 space-y-1">
                             {performanceAnalysis.suggestions?.map((suggestion, index) => ( // Check existence
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
                           disabled={currentHistoryIndex <= 0 || isLoading} // Only disable if at start or loading
                           aria-label="Previous Question"
                         >
                           <ArrowLeft className="h-4 w-4 mr-1" /> Previous
                         </Button>
                         <Button
                           variant="outline"
                           onClick={handleGoToNext}
                           disabled={currentHistoryIndex >= history.length - 1 || isLoading} // Only disable if at end or loading
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
                             disabled={isLoading} // Disable only if loading
                          >
                              <UserCheck className="mr-2 h-4 w-4"/> Go to Latest
                         </Button>
                       ) : (
                         <Button
                           onClick={() => handleGenerateQuestion(performanceAnalysis?.suggestedNextDifficulty || performanceAnalysis?.suggestedNextQuestionType ? {
                               ...settingsForm.getValues(), // Keep existing settings
                               difficulty: performanceAnalysis.suggestedNextDifficulty || settingsForm.getValues('difficulty'),
                               type: performanceAnalysis.suggestedNextQuestionType || settingsForm.getValues('type'),
                               // Carry over class/exam settings if they exist and are not "None"
                               studentClass: settingsForm.getValues('studentClass') !== NONE_VALUE ? settingsForm.getValues('studentClass') : undefined,
                               examType: settingsForm.getValues('examType') !== NONE_VALUE ? settingsForm.getValues('examType') : undefined,
                           } : settingsForm.getValues() )} // Use suggestion or current settings
                           disabled={!canGenerateNew} // Use derived state
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
                            disabled={isAnalyzing || history.length === 0 || isLoading} // Disable if analyzing, no history, or loading
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
             Powered by Generative AI ✨ Math Quest v1.4
         </CardFooter>
      </Card>
    </div>
  );
}
