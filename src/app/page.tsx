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
    Lightbulb, Menu, ArrowLeft, ArrowRight, BarChart, Goal, Sparkles, Power, UserCheck,
    Flame, Target // Added icons for profile stats
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert
import { format, isToday, isYesterday, startOfDay } from 'date-fns'; // For date comparison

// Define structure for a single question attempt
interface QuestionAttempt {
    questionData: GenerateMathQuestionOutput;
    userAnswer?: string;
    isCorrect?: boolean;
    timestamp: string; // ISO timestamp string
    settings: QuestionSettings; // Store settings used for this question
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

// Helper to compare settings objects
const compareSettings = (s1?: QuestionSettings, s2?: QuestionSettings): boolean => {
    if (!s1 || !s2) return false;
    return s1.difficulty === s2.difficulty &&
           s1.type === s2.type &&
           (s1.studentClass ?? NONE_VALUE) === (s2.studentClass ?? NONE_VALUE) &&
           (s1.examType ?? NONE_VALUE) === (s2.examType ?? NONE_VALUE);
};

// User Profile State
interface UserProfile {
    lastActiveDate: string | null; // ISO date string (YYYY-MM-DD)
    streak: number;
    questionsAnswered: number;
}

const initialUserProfile: UserProfile = {
    lastActiveDate: null,
    streak: 0,
    questionsAnswered: 0,
};

// localStorage keys
const PROFILE_STORAGE_KEY = 'mathQuestUserProfile';
const HISTORY_STORAGE_KEY = 'mathQuestHistory'; // Persist history too

export default function MathQuestPage() {
    const [history, setHistory] = React.useState<QuestionAttempt[]>([]);
    const [currentHistoryIndex, setCurrentHistoryIndex] = React.useState<number>(-1);
    const [isLoading, setIsLoading] = React.useState(false); // Indicates user-initiated loading
    const [isCheckingAnswer, setIsCheckingAnswer] = React.useState(false);
    const [feedback, setFeedback] = React.useState<FeedbackState>('idle');
    const [shuffledOptions, setShuffledOptions] = React.useState<string[]>([]);
    const [performanceAnalysis, setPerformanceAnalysis] = React.useState<AnalyzePerformanceOutput | null>(null);
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false); // State for Sheet visibility
    const [preloadedAttempt, setPreloadedAttempt] = React.useState<QuestionAttempt | null>(null);
    const isPreloadingRef = React.useRef(false); // Ref to track background preloading
    const [userProfile, setUserProfile] = React.useState<UserProfile>(initialUserProfile);
    const [isHydrated, setIsHydrated] = React.useState(false); // Track hydration state

    const { toast } = useToast();

    const currentAttempt = history[currentHistoryIndex];
    const currentQuestion = currentAttempt?.questionData;

    // Define isViewingHistory based on current state, using useMemo
    const isViewingHistory = React.useMemo(() => {
        return currentHistoryIndex >= 0 && currentHistoryIndex < history.length - 1;
    }, [currentHistoryIndex, history.length]);

    // --- LocalStorage Hydration ---
    React.useEffect(() => {
        try {
            // Load User Profile
            const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
            if (storedProfile) {
                const parsedProfile = JSON.parse(storedProfile) as UserProfile;
                // Basic validation
                if (parsedProfile && typeof parsedProfile.streak === 'number' && typeof parsedProfile.questionsAnswered === 'number') {
                    // Check streak based on last active date
                    const todayStr = format(new Date(), 'yyyy-MM-dd');
                    let updatedStreak = parsedProfile.streak;
                    if (parsedProfile.lastActiveDate) {
                        const lastDate = new Date(parsedProfile.lastActiveDate);
                        if (!isToday(lastDate) && !isYesterday(lastDate)) {
                            updatedStreak = 0; // Reset streak if missed more than a day
                        }
                    }
                    setUserProfile({ ...parsedProfile, streak: updatedStreak });
                } else {
                    console.warn("Invalid profile data found in localStorage.");
                }
            }

            // Load History
            const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (storedHistory) {
                const parsedHistory = JSON.parse(storedHistory) as QuestionAttempt[];
                 // Basic validation
                if (Array.isArray(parsedHistory)) {
                    setHistory(parsedHistory);
                    if (parsedHistory.length > 0) {
                        setCurrentHistoryIndex(parsedHistory.length - 1); // Start at the last question
                    }
                } else {
                     console.warn("Invalid history data found in localStorage.");
                }
            }
        } catch (error) {
            console.error("Failed to load data from localStorage:", error);
            toast({
                title: "Load Error",
                description: "Could not load previous session data.",
                variant: "destructive",
            });
        } finally {
            setIsHydrated(true); // Mark as hydrated
        }
    }, [toast]); // toast is stable

    // --- Persist to LocalStorage ---
    React.useEffect(() => {
        if (!isHydrated) return; // Only save after initial hydration
        try {
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(userProfile));
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
        } catch (error) {
            console.error("Failed to save data to localStorage:", error);
            // Optionally show a non-critical toast
        }
    }, [userProfile, history, isHydrated]);


    // --- Forms ---
    const settingsForm = useForm<QuestionSettings>({
        resolver: zodResolver(QuestionSettingsSchema),
        defaultValues: DEFAULT_SETTINGS,
    });

    const answerForm = useForm<AnswerFormData>({
        resolver: zodResolver(AnswerSchema),
        defaultValues: { userAnswer: '' },
    });

    // --- Helper Functions ---

    // Preloads the next question based on given settings
    const preloadNextQuestion = React.useCallback(async (settings: QuestionSettings) => {
        if (isPreloadingRef.current) return; // Prevent concurrent preloading
        isPreloadingRef.current = true;
        console.log("Preloading next question with settings:", settings);

        const inputData: GenerateMathQuestionInput = {
            ...settings,
            studentClass: settings.studentClass === NONE_VALUE ? undefined : settings.studentClass,
            examType: settings.examType === NONE_VALUE ? undefined : settings.examType,
        };

        try {
            const result = await generateMathQuestion(inputData);
            const nextAttempt: QuestionAttempt = {
                questionData: result,
                timestamp: new Date().toISOString(), // Placeholder timestamp
                settings: settings, // Store the settings used for preloading
            };
            setPreloadedAttempt(nextAttempt);
            console.log("Preloading successful.");
        } catch (error) {
            console.error('Error preloading question:', error);
            setPreloadedAttempt(null); // Clear preload on error
            // Optionally show a non-blocking toast
            // toast({ title: 'Background Error', description: 'Could not preload next question.', variant: 'destructive' });
        } finally {
            isPreloadingRef.current = false;
        }
    }, [/* No dependencies needed for useCallback based on its content */]); // eslint-disable-line react-hooks/exhaustive-deps

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
                 // Don't re-shuffle when viewing history
                 setShuffledOptions(currentAttempt.questionData.options);
            } else {
                 setShuffledOptions([]);
            }
        } else {
            // Reset form and state if there's no current attempt (e.g., initial load or empty history)
            answerForm.reset({ userAnswer: '' });
            setFeedback('idle');
            setIsCheckingAnswer(false);
            setShuffledOptions([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- answerForm should not be a dependency
    }, [currentHistoryIndex, history]); // Removed currentAttempt, derived from history/index


  // Shuffle options when a new question is loaded, not viewing history, and not answered yet
  React.useEffect(() => {
      if (currentQuestion?.options && feedback === 'idle' && !isViewingHistory) {
          // Shuffle only for new, unanswered questions
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

  const handleGenerateQuestion = async (settings: QuestionSettings) => {
    setIsLoading(true); // Indicate user is waiting
    setFeedback('idle');
    setShuffledOptions([]);
    answerForm.reset();
    answerForm.clearErrors();
    setIsCheckingAnswer(false);
    setPerformanceAnalysis(null); // Clear old analysis

    let newAttempt: QuestionAttempt | null = null;

    // Check if preloaded question matches current settings
    if (preloadedAttempt && compareSettings(preloadedAttempt.settings, settings)) {
        console.log("Using preloaded question.");
        newAttempt = {
            ...preloadedAttempt,
            timestamp: new Date().toISOString(), // Update timestamp to actual display time
        };
        setPreloadedAttempt(null); // Consume the preloaded attempt
    } else {
        console.log("Generating question on demand.");
        // If preload doesn't match or doesn't exist, generate on the spot
        const inputData: GenerateMathQuestionInput = {
            ...settings,
            studentClass: settings.studentClass === NONE_VALUE ? undefined : settings.studentClass,
            examType: settings.examType === NONE_VALUE ? undefined : settings.examType,
        };
        try {
            const result = await generateMathQuestion(inputData);
            newAttempt = {
                questionData: result,
                timestamp: new Date().toISOString(),
                settings: settings, // Use the requested settings
            };
        } catch (error) {
            console.error('Error generating question:', error);
            toast({
                title: 'Error',
                description: 'Failed to generate a new question. Please try again.',
                variant: 'destructive',
            });
            setIsLoading(false); // Stop loading indicator on error
            return; // Exit early
        }
    }

    // Add the new attempt to history and update state
    if (newAttempt) {
        const newHistory = [...history, newAttempt];
        setHistory(newHistory);
        const newIndex = newHistory.length - 1;
        setCurrentHistoryIndex(newIndex); // Go to the latest index
        setFeedback('idle');
        setIsCheckingAnswer(false);

        // Preload the *next* question immediately after displaying the current one
        // Use the same settings for the next preload unless analysis suggests otherwise later
        preloadNextQuestion(settings);
    }

    setIsLoading(false); // Stop loading indicator
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

    // Update user profile stats (streak, questions answered)
    setUserProfile(prevProfile => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        let newStreak = prevProfile.streak;
        let newLastActiveDate = prevProfile.lastActiveDate;

        if (prevProfile.lastActiveDate === todayStr) {
            // Already active today, no change to streak unless resetting (handled on load)
        } else if (prevProfile.lastActiveDate && isYesterday(new Date(prevProfile.lastActiveDate))) {
            // Active yesterday, increment streak
            newStreak += 1;
            newLastActiveDate = todayStr;
        } else {
            // Missed a day or first time, reset streak to 1
            newStreak = 1;
            newLastActiveDate = todayStr;
        }

        return {
            ...prevProfile,
            streak: newStreak,
            questionsAnswered: prevProfile.questionsAnswered + 1,
            lastActiveDate: newLastActiveDate,
        };
    });


    toast({
      title: isCorrect ? 'Correct!' : 'Incorrect',
      description: isCorrect
        ? 'Excellent work! Ready for the next challenge?'
        : `Not quite. The correct answer is marked. Check the explanation!`,
      variant: isCorrect ? 'default' : 'destructive',
      className: isCorrect ? 'bg-accent text-accent-foreground border-accent' : '',
    });

    // Preload the next question after checking the answer
    // Use the current settings for preloading
    const currentSettings = settingsForm.getValues();
    preloadNextQuestion(currentSettings);

    // Keep isCheckingAnswer true to prevent re-submission
  };

    const handleGoToPrevious = () => {
        if (currentHistoryIndex > 0) {
            setCurrentHistoryIndex(prev => prev - 1);
            setPerformanceAnalysis(null); // Clear analysis when navigating
            // No preloading needed when going back
        }
    };

    const handleGoToNext = () => {
        if (currentHistoryIndex < history.length - 1) {
            setCurrentHistoryIndex(prev => prev + 1);
            setPerformanceAnalysis(null); // Clear analysis when navigating
            // Preload if moving to the *latest* question (which might use preload)
             if (currentHistoryIndex + 1 === history.length - 1) {
                const currentSettings = settingsForm.getValues();
                preloadNextQuestion(currentSettings);
            }
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
        // Focus can be just difficulty, just type, or both implicitly via history
        const desiredFocus = [currentSettings.difficulty, desiredFocusType].filter(Boolean).join(' ') || undefined;


        const analysisInput: AnalyzePerformanceInput = {
            activityHistory: activityHistoryForAnalysis,
            desiredFocus: desiredFocus,
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
            // After analysis, potentially preload based on suggestion
            if(result.suggestedNextDifficulty || result.suggestedNextQuestionType) {
                const suggestedSettings : QuestionSettings = {
                    difficulty: result.suggestedNextDifficulty || currentSettings.difficulty,
                    type: result.suggestedNextQuestionType || currentSettings.type,
                    studentClass: currentSettings.studentClass, // Keep current class/exam
                    examType: currentSettings.examType,
                };
                // Invalidate previous preload if settings changed
                if (!compareSettings(preloadedAttempt?.settings, suggestedSettings)) {
                    setPreloadedAttempt(null);
                }
                preloadNextQuestion(suggestedSettings);
            }

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

    // Handles applying settings from the sheet and triggering generation
    const handleApplySettingsAndGenerate = (data: QuestionSettings) => {
        const currentSettings = settingsForm.getValues();

        // Check if settings actually changed
        if (!compareSettings(currentSettings, data)) {
            settingsForm.reset(data); // Update the main form's state
            setPreloadedAttempt(null); // Invalidate preload if settings change
            console.log("Settings changed, invalidating preload.");
        } else {
            console.log("Settings unchanged.");
        }

        setIsSheetOpen(false); // Close the sheet
        handleGenerateQuestion(data); // Generate question with potentially new settings
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
    // Can generate new if not user-initiated loading AND not currently viewing older history
    const canGenerateNew = !isLoading && !isViewingHistory;
    // Can check answer if: not loading, not checking, question exists, feedback is idle (not yet answered), AND not viewing history
    const canCheckAnswer = !isLoading && !isCheckingAnswer && currentQuestion && feedback === 'idle' && !isViewingHistory;

    // Determine if a loading indicator should be shown for the main question area
    const showMainLoading = isLoading && (!currentQuestion || (currentHistoryIndex === history.length -1 && !preloadedAttempt));
    // Determine if initial loading state should be shown
    const showInitialLoading = isLoading && history.length === 0;
    // Determine if welcome state should be shown
    const showWelcome = !isLoading && history.length === 0 && isHydrated; // Only show welcome after hydration


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
                      // Use onSubmit on the form, button type="submit" will trigger it
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
                              onValueChange={(value) => {
                                field.onChange(value);
                                // Optionally clear preload if difficulty changes here, though handleApplySettingsAndGenerate covers it
                              }}
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
                              onValueChange={(value) => {
                                field.onChange(value);
                                // Optionally clear preload if type changes here
                              }}
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
                                     onValueChange={(value) => {
                                        field.onChange(value === NONE_VALUE ? undefined : value); // Store undefined if "None"
                                        // Optionally clear preload if class changes here
                                    }}
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
                                     onValueChange={(value) => {
                                        field.onChange(value === NONE_VALUE ? undefined : value); // Store undefined if "None"
                                        // Optionally clear preload if exam type changes here
                                    }}
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
                            {/* Removed SheetClose here, rely on form submission to close */}
                            <Button type="submit">Apply & Start New</Button>
                       </SheetFooter>
                    </form>
                  </Form>
                </SheetContent>
              </Sheet>

            <div className="flex items-center justify-center flex-grow">
                 <BrainCircuit className="h-8 w-8 mr-2" />
                 <CardTitle className="text-3xl font-bold">Math Quest AI</CardTitle>
             </div>
              {/* User Profile Stats */}
              {isHydrated && (
                <div className="flex items-center space-x-3 text-sm mr-4">
                    <div className="flex items-center" title="Daily Streak">
                        <Flame className="h-5 w-5 mr-1 text-orange-400" />
                        <span>{userProfile.streak}</span>
                    </div>
                    <div className="flex items-center" title="Total Questions Answered">
                        <Target className="h-5 w-5 mr-1 text-green-500" />
                        <span>{userProfile.questionsAnswered}</span>
                    </div>
                </div>
              )}
             {/* Ensure the hamburger menu is not pushed too far left */}
             <div className="w-10 sm:w-auto"></div> {/* Adjust width for hamburger alignment */}
          </div>
          <CardDescription className="text-lg text-blue-100">
            Sharpen your mind with AI-powered math challenges!
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6 bg-background text-foreground">

          {/* Question Display & Interaction Area */}
          <div className="min-h-[300px] flex flex-col"> {/* Ensure minimum height */}
             {!isHydrated && ( // Show hydration loading state
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p>Loading your session...</p>
                </div>
             )}

             {isHydrated && showInitialLoading && ( // Show initial generation loading state
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p>Generating your first question...</p>
                  <p className="text-sm">Tip: Use the menu (<Menu className="inline h-4 w-4"/>) to set your preferred difficulty and topic!</p>
                </div>
             )}

             {isHydrated && showMainLoading && !showInitialLoading && ( // Show loading new question *only if* actually waiting
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p>Generating next question...</p>
                </div>
             )}


             {showWelcome && ( // Show welcome/start state only after hydration
                 <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                    <Sparkles className="h-12 w-12 text-primary mb-4" />
                    <p className="text-lg font-medium mb-2">Welcome to Math Quest AI!</p>
                    <p>Click the menu (<Menu className="inline h-4 w-4"/>) to set your preferences,</p>
                    <p>or hit "Start Quest" for a random challenge.</p>
                     <Button onClick={() => handleGenerateQuestion(settingsForm.getValues())} className="mt-6" disabled={isLoading}>
                         {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" /> }
                          Start Quest
                     </Button>
                 </div>
             )}

            {/* Only render question area if not actively loading for the user OR if showing historical question AND hydrated */}
            {isHydrated && (!showMainLoading || isViewingHistory) && currentQuestion && (
                <div className="flex-grow p-6 border rounded-lg bg-card shadow-inner space-y-4 animate-in fade-in duration-300"> {/* Added fade-in */}
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
                                 // Disable if feedback is given OR if actively loading user request OR already checking
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
                                    // Use feedback from history if viewing history AND it's not 'idle'
                                    // Otherwise, use the current feedback state ('idle', 'correct', 'incorrect')
                                    const displayFeedbackState = (isViewingHistory && attemptFeedbackState !== 'idle') ? attemptFeedbackState : feedback;


                                   return (
                                    <FormItem
                                      key={`${currentHistoryIndex}-${option}-${index}`} // More robust key
                                      className={cn(
                                      "flex items-center space-x-3 space-y-0 rounded-md border p-3 transition-all",
                                       // Base styles when interactive (feedback is idle and not loading/checking)
                                      displayFeedbackState === 'idle' && !isLoading && !isCheckingAnswer && "hover:bg-muted/50 cursor-pointer",
                                      // Styles when an answer is selected (before checking)
                                      isSelected && displayFeedbackState === 'idle' && "bg-primary/10 border-primary",
                                      // Feedback styles after checking or when viewing history
                                      displayFeedbackState !== 'idle' && isCorrectOption && "bg-accent/10 border-accent text-accent-foreground", // Correct answer always highlighted green
                                      displayFeedbackState !== 'idle' && isSelected && !isCorrectOption && "bg-destructive/10 border-destructive text-destructive-foreground line-through", // Incorrect selection highlighted red
                                      displayFeedbackState !== 'idle' && !isSelected && !isCorrectOption && "opacity-60", // Fade out incorrect, unselected options
                                      // Disabled styles (when feedback given or loading/checking)
                                      (displayFeedbackState !== 'idle' || isLoading || isCheckingAnswer) && "cursor-not-allowed"
                                    )}>
                                        <FormControl>
                                            <RadioGroupItem
                                                value={option}
                                                id={`option-${currentHistoryIndex}-${index}`}
                                                className={cn(
                                                    // Specific styling for the radio button itself based on feedback
                                                    displayFeedbackState !== 'idle' && isCorrectOption && 'border-accent ring-accent text-accent',
                                                    displayFeedbackState !== 'idle' && isSelected && !isCorrectOption && 'border-destructive ring-destructive text-destructive'
                                                )}
                                                // Disable individual items based on feedback state or loading/checking
                                                disabled={displayFeedbackState !== 'idle' || isLoading || isCheckingAnswer}
                                            />
                                        </FormControl>
                                        <FormLabel
                                            htmlFor={`option-${currentHistoryIndex}-${index}`}
                                            className={cn(
                                                "font-normal flex-1",
                                                // Make label clickable only when interactive
                                                (displayFeedbackState === 'idle' && !isLoading && !isCheckingAnswer) ? "cursor-pointer" : "cursor-default"
                                            )}
                                        >
                                            {option}
                                             {/* Icons shown after checking or when viewing history */}
                                             {displayFeedbackState !== 'idle' && isCorrectOption && <CheckCircle className="inline h-4 w-4 ml-2 text-accent flex-shrink-0" />}
                                             {displayFeedbackState !== 'idle' && isSelected && !isCorrectOption && <XCircle className="inline h-4 w-4 ml-2 text-destructive flex-shrink-0" />}
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
                        <Button type="submit" disabled={!answerForm.formState.isValid || isCheckingAnswer} className="w-full sm:w-auto">
                           {isCheckingAnswer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
            {isHydrated && history.length > 0 && ( // Only show buttons after hydration and if history exists
                <div className="mt-6 p-4 border-t bg-muted/30 flex flex-col sm:flex-row justify-between items-center gap-3">
                    {/* History Navigation */}
                    <div className="flex gap-2">
                         <Button
                           variant="outline"
                           onClick={handleGoToPrevious}
                           disabled={currentHistoryIndex <= 0 || isLoading} // Disable if at start or user loading
                           aria-label="Previous Question"
                         >
                           <ArrowLeft className="h-4 w-4 mr-1" /> Previous
                         </Button>
                         <Button
                           variant="outline"
                           onClick={handleGoToNext}
                           disabled={currentHistoryIndex >= history.length - 1 || isLoading} // Disable if at end or user loading
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
                                 const latestIndex = history.length - 1;
                                 setCurrentHistoryIndex(latestIndex); // Jump to latest
                                 setPerformanceAnalysis(null); // Clear analysis if jumping back
                                 // Preload if jumping to the latest unattempted question
                                 if (!history[latestIndex]?.userAnswer) {
                                     const currentSettings = settingsForm.getValues();
                                     preloadNextQuestion(currentSettings);
                                 }
                             }}
                             className="bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                             disabled={isLoading} // Disable only if user loading
                          >
                              <UserCheck className="mr-2 h-4 w-4"/> Go to Latest
                         </Button>
                       ) : (
                         <Button
                           onClick={() => {
                               const settingsToUse = performanceAnalysis?.suggestedNextDifficulty || performanceAnalysis?.suggestedNextQuestionType ? {
                                   ...settingsForm.getValues(), // Keep existing settings
                                   difficulty: performanceAnalysis.suggestedNextDifficulty || settingsForm.getValues('difficulty'),
                                   type: performanceAnalysis.suggestedNextQuestionType || settingsForm.getValues('type'),
                                   // Use current class/exam, handling NONE_VALUE
                                   studentClass: settingsForm.getValues('studentClass') === NONE_VALUE ? undefined : settingsForm.getValues('studentClass'),
                                   examType: settingsForm.getValues('examType') === NONE_VALUE ? undefined : settingsForm.getValues('examType'),
                               } : settingsForm.getValues(); // Use suggestion or current settings

                               // Pass the non-NONE_VALUE versions to handleGenerateQuestion
                               const cleanSettings = {
                                   ...settingsToUse,
                                   studentClass: settingsToUse.studentClass === NONE_VALUE ? undefined : settingsToUse.studentClass,
                                   examType: settingsToUse.examType === NONE_VALUE ? undefined : settingsToUse.examType,
                               }
                               handleGenerateQuestion(settingsToUse); // Pass original settings with potential NONE_VALUE
                           }}
                           disabled={!canGenerateNew} // Use derived state (checks isLoading and isViewingHistory)
                           className="min-w-[140px]" // Ensure consistent width
                           aria-live="polite" // Announce loading state change
                         >
                           {isLoading ? ( // Show spinner only if user is waiting
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
                            disabled={isAnalyzing || history.length === 0 || isLoading} // Disable if analyzing, no history, or user loading
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
             Powered by Generative AI ✨ Math Quest v1.6
         </CardFooter>
      </Card>
    </div>
  );
}
