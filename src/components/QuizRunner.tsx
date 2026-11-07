'use client';

import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion, animate, useMotionValue, useTransform } from "framer-motion";
import { CheckCircle, XCircle, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { markQuizDone } from "@/lib/progress";

// Draw-in checkmark / shaking X used for the per-question feedback panel.
function FeedbackIcon({ correct }: { correct: boolean }) {
    return (
        <motion.div
            className={correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
            animate={!correct ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : undefined}
            transition={!correct ? { duration: 0.45, delay: 0.15 } : undefined}
        >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <motion.circle
                    cx="12" cy="12" r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ transformOrigin: '50% 50%' }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                />
                {correct ? (
                    <motion.path
                        d="M7 12.5l3 3 7-7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.35, delay: 0.25, ease: 'easeOut' }}
                    />
                ) : (
                    <>
                        <motion.path
                            d="M8 8l8 8"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.2, delay: 0.25 }}
                        />
                        <motion.path
                            d="M16 8l-8 8"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.2, delay: 0.4 }}
                        />
                    </>
                )}
            </svg>
        </motion.div>
    );
}

// Counts up from 0 to `score` when it mounts (the results screen reveal).
function AnimatedScore({ score, total }: { score: number; total: number }) {
    const count = useMotionValue(0);
    const rounded = useTransform(count, (latest) => Math.round(latest));
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        const controls = animate(count, score, { duration: 1.1, ease: 'easeOut' });
        const unsubscribe = rounded.on('change', setDisplay);
        return () => {
            controls.stop();
            unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [score]);

    return <>{display} / {total}</>;
}

// A small one-shot confetti burst for high-scoring results.
function ConfettiBurst() {
    const pieces = useMemo(() => {
        const colors = ['bg-saffron-400', 'bg-saffron-500', 'bg-emerald-400', 'bg-saffron-300', 'bg-charcoal-300'];
        return Array.from({ length: 24 }, (_, i) => {
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 90;
            return {
                id: i,
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance - 30,
                rotate: Math.random() * 360,
                color: colors[i % colors.length],
                delay: Math.random() * 0.15,
                width: 5 + Math.random() * 5,
                height: 3 + Math.random() * 5,
            };
        });
    }, []);

    return (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
            {pieces.map((p) => (
                <motion.span
                    key={p.id}
                    className={`absolute rounded-sm ${p.color}`}
                    style={{ width: p.width, height: p.height }}
                    initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
                    animate={{ x: p.x, y: p.y + 110, opacity: 0, rotate: p.rotate, scale: 1 }}
                    transition={{ duration: 1.1, delay: p.delay, ease: 'easeOut' }}
                />
            ))}
        </div>
    );
}

type Question = {
    id: string;
    type: string;
    question_text: string;
    options: string[];
    correct_answer: string;
    explanation: string;
    source_reference: string;
};

type QuizData = {
    quiz_title: string;
    questions: Question[];
};

type QuizRunnerProps = {
    classId: string;
    type: 'class_quiz' | 'mini_review';
    title: string;
    nextClassPath?: string;
};

// Helper to shuffle array
function shuffleArray<T>(array: T[]): T[] {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

export function QuizRunner({ classId, type, title, nextClassPath }: QuizRunnerProps) {
    const [loading, setLoading] = useState(false);
    // quizData holds the ACTIVE set of questions for the current run
    const [quizData, setQuizData] = useState<QuizData | null>(null);
    // fullPool holds ALL available questions from the static file
    const [fullPool, setFullPool] = useState<QuizData | null>(null);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});

    // New State for "Immediate Feedback" mode
    const [submittedQuestionIds, setSubmittedQuestionIds] = useState<Set<string>>(new Set());

    const [showResults, setShowResults] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // State to track incorrect IDs from previous runs in this session for adaptive re-test
    const [incorrectHistory, setIncorrectHistory] = useState<Set<string>>(new Set());

    // Initial fetch on mount
    useEffect(() => {
        fetchQuizPool();
    }, [classId, type]);

    const fetchQuizPool = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ classId, type }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to load quiz");
            }

            const data = await res.json();
            setFullPool(data);
            startNewRun(data, new Set()); // First run, no priority constraints
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const startNewRun = (poolData: QuizData, priorityIds: Set<string>) => {
        // Selection Logic
        const LIMIT = type === 'mini_review' ? 10 : 5;
        const allQuestions = poolData.questions;

        let selectedQuestions: Question[] = [];

        // 1. Prioritize Incorrect
        const priorityQuestions = allQuestions.filter(q => priorityIds.has(q.id));

        // 2. Remove priority from pool to pick potential new/other ones
        const remainingPool = allQuestions.filter(q => !priorityIds.has(q.id));

        // 3. Shuffle remaining
        const shuffledRemaining = shuffleArray(remainingPool);

        // 4. Fill slots
        const slotsNeeded = Math.max(0, LIMIT - priorityQuestions.length);
        const fillers = shuffledRemaining.slice(0, slotsNeeded);

        // 5. Combine and Shuffle Final Set
        const finalSelection = shuffleArray([...priorityQuestions, ...fillers]);

        // 6. Shuffle Options for each question (Rules: shuffle_option_order: true)
        const questionsWithOptionsShuffled = finalSelection.map(q => ({
            ...q,
            options: shuffleArray(q.options)
        }));

        // If total < LIMIT (e.g. small pool), we just take what we have

        setQuizData({
            ...poolData,
            questions: questionsWithOptionsShuffled
        });

        setCurrentQuestionIndex(0);
        setUserAnswers({});
        setSubmittedQuestionIds(new Set());
        setShowResults(false);
    };

    const handleTakeAgain = () => {
        if (!fullPool || !quizData) return;

        // Identify incorrect answers from THIS run
        const currentIncorrectIds = quizData.questions
            .filter(q => userAnswers[q.id] !== q.correct_answer)
            .map(q => q.id);

        // Start new run treating these as priority
        const newPriority = new Set(currentIncorrectIds);
        startNewRun(fullPool, newPriority);
    };

    const handleOptionSelect = (option: string) => {
        if (showResults || !quizData) return;

        const currentQ = quizData.questions[currentQuestionIndex];
        // Prevent changing answer after submission
        if (submittedQuestionIds.has(currentQ.id)) return;

        setUserAnswers((prev) => ({
            ...prev,
            [currentQ.id]: option,
        }));
    };

    const handleSubmitAnswer = () => {
        if (!quizData) return;
        const currentQ = quizData.questions[currentQuestionIndex];

        if (!userAnswers[currentQ.id]) return; // Cannot submit empty

        setSubmittedQuestionIds(prev => new Set(prev).add(currentQ.id));
    };

    const handleNext = () => {
        if (!quizData) return;
        if (currentQuestionIndex < quizData.questions.length - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
        } else {
            setShowResults(true);
            if (type === 'class_quiz') {
                markQuizDone(classId);
            }
        }
    };

    const calculateScore = () => {
        if (!quizData) return 0;
        let score = 0;
        quizData.questions.forEach((q) => {
            if (userAnswers[q.id] === q.correct_answer) {
                score++;
            }
        });
        return score;
    };

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto p-4 sm:p-6 min-h-[60vh] flex flex-col justify-center">
                <div className="mb-6 flex justify-between items-center">
                    <div className="h-6 w-24 rounded-full bg-shimmer" />
                    <div className="h-4 w-28 rounded bg-shimmer" />
                </div>

                <div className="w-full bg-charcoal-100 rounded-full h-2 mb-8 overflow-hidden">
                    <div className="h-2 w-1/4 rounded-full bg-shimmer" />
                </div>

                <div className="bg-card p-6 sm:p-8 rounded-3xl shadow-xl border border-charcoal-100 mb-8">
                    <div className="h-6 w-3/4 rounded bg-shimmer mb-3" />
                    <div className="h-6 w-1/2 rounded bg-shimmer mb-8" />

                    <div className="space-y-3">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-14 rounded-xl bg-shimmer" />
                        ))}
                    </div>
                </div>

                <div className="flex justify-end">
                    <div className="h-14 w-40 rounded-full bg-shimmer" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-6 text-center">
                <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300 px-4 py-8 rounded-2xl relative mb-6">
                    <AlertCircle size={48} className="mx-auto mb-4 text-red-600" />
                    <h3 className="text-lg font-bold">Failed to load quiz</h3>
                    <p className="mt-2">{error}</p>
                </div>
                <button onClick={fetchQuizPool} className="px-6 py-2 bg-saffron-500 hover:bg-saffron-600 hover:scale-105 hover:shadow-lg text-white rounded-full font-semibold transition-all">Try Again</button>
            </div>
        );
    }

    if (showResults && quizData) {
        const score = calculateScore();
        const percentage = Math.round((score / quizData.questions.length) * 100);
        const incorrectQuestions = quizData.questions.filter(q => userAnswers[q.id] !== q.correct_answer);

        return (
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-3xl mx-auto p-4 sm:p-6"
            >
                <div className="bg-card rounded-3xl shadow-xl border border-charcoal-100 overflow-hidden mb-8">
                    <div className="relative p-8 text-center border-b border-charcoal-100 bg-gradient-to-b from-saffron-50/60 to-card overflow-hidden">
                        {percentage >= 80 && <ConfettiBurst />}
                        <h2 className="text-3xl font-display font-bold mb-2 text-charcoal-900">Quiz Completed!</h2>
                        <div className="text-6xl font-display font-extrabold text-saffron-600 mb-2">
                            <AnimatedScore score={score} total={quizData.questions.length} />
                        </div>
                        <p className="text-charcoal-500">{percentage}% Accuracy</p>
                    </div>

                    <div className="p-6 sm:p-8 space-y-6">
                        <h3 className="text-xl font-display font-bold border-b border-charcoal-100 pb-3 text-charcoal-800">Incorrect Answers Review</h3>
                        {incorrectQuestions.length === 0 ? (
                            <div className="text-center text-emerald-600 py-4">
                                <CheckCircle size={48} className="mx-auto mb-2" />
                                <p className="font-bold">Perfect Score! No incorrect answers.</p>
                            </div>
                        ) : (
                            incorrectQuestions.map((q) => (
                                <div key={q.id} className="p-4 rounded-2xl border border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30">
                                    <div className="flex gap-3 mb-2">
                                        <h3 className="font-medium text-lg text-charcoal-800">{q.question_text}</h3>
                                    </div>
                                    <div className="ml-0 text-sm space-y-2 mt-3">
                                        <div className="flex items-center gap-2">
                                            <XCircle size={16} className="text-red-600 shrink-0" />
                                            <span className="font-semibold text-charcoal-600">You selected:</span>
                                            <span className="text-red-700 dark:text-red-300 font-medium">{userAnswers[q.id] || "Skipped"}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                                            <span className="font-semibold text-charcoal-600">Correct:</span>
                                            <span className="text-emerald-700 dark:text-emerald-300 font-medium">{q.correct_answer}</span>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-red-200/50 dark:border-red-900/60">
                                            <p className="text-charcoal-700 text-sm">
                                                <span className="font-bold">Reason:</span> {q.explanation}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-6 bg-charcoal-50 flex flex-col sm:flex-row justify-center gap-4">
                        <button
                            onClick={handleTakeAgain}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-card border border-charcoal-200 text-charcoal-700 rounded-full font-bold hover:bg-charcoal-50 hover:border-charcoal-300 hover:scale-105 hover:shadow-md transition-all"
                        >
                            <RefreshCw size={18} /> Take Another Quiz
                        </button>

                        {nextClassPath && (
                            <a
                                href={nextClassPath}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-saffron-500 text-white rounded-full font-bold hover:bg-saffron-600 hover:scale-105 transition-all shadow-md hover:shadow-lg shadow-saffron-900/15"
                            >
                                Next Class <ArrowRight size={18} />
                            </a>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    }

    if (quizData) {
        const question = quizData.questions[currentQuestionIndex];
        const isSubmitted = submittedQuestionIds.has(question.id);
        const isCorrect = userAnswers[question.id] === question.correct_answer;

        return (
            <div className="max-w-2xl mx-auto p-4 sm:p-6 min-h-[60vh] flex flex-col justify-center">
                <div className="mb-6 flex justify-between items-center text-sm font-medium text-charcoal-500">
                    <span className="bg-charcoal-100 text-charcoal-700 px-3 py-1 rounded-full font-semibold">{title}</span>
                    <span>Question {currentQuestionIndex + 1} of {quizData.questions.length}</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-charcoal-100 rounded-full h-2 mb-8 overflow-hidden">
                    <motion.div
                        className="bg-gradient-to-r from-saffron-400 to-saffron-600 h-2 rounded-full"
                        animate={{ width: `${((currentQuestionIndex + 1) / quizData.questions.length) * 100}%` }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={question.id}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -24 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="relative overflow-hidden bg-card p-6 sm:p-8 rounded-3xl shadow-xl border border-charcoal-100 mb-8"
                    >
                        {/* Quick color flash on submit */}
                        <AnimatePresence>
                            {isSubmitted && (
                                <motion.div
                                    key="flash"
                                    className={`absolute inset-0 z-20 pointer-events-none ${isCorrect ? 'bg-emerald-400' : 'bg-red-400'}`}
                                    initial={{ opacity: 0.35 }}
                                    animate={{ opacity: 0 }}
                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                />
                            )}
                        </AnimatePresence>

                        <h2 className="text-xl md:text-2xl font-display font-bold mb-8 leading-relaxed text-charcoal-900">
                            {question.question_text}
                        </h2>

                        <div className="space-y-3">
                            {question.options.map((opt, i) => {
                                let optionClass = `flex items-center p-4 rounded-xl border-2 transition-all `;

                                const isWrongSelected = isSubmitted && userAnswers[question.id] === opt && opt !== question.correct_answer;
                                const isCorrectReveal = isSubmitted && opt === question.correct_answer;

                                if (isSubmitted) {
                                    if (opt === question.correct_answer) {
                                        optionClass += 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ';
                                    } else if (isWrongSelected) {
                                        optionClass += 'border-red-500 bg-red-50 dark:bg-red-950/40 ';
                                    } else {
                                        optionClass += 'border-charcoal-100 opacity-50 ';
                                    }
                                } else {
                                    if (userAnswers[question.id] === opt) {
                                        optionClass += 'border-saffron-500 bg-saffron-50 cursor-pointer ';
                                    } else {
                                        optionClass += 'border-charcoal-200 hover:border-saffron-300 hover:bg-saffron-50/40 cursor-pointer ';
                                    }
                                }

                                return (
                                    <motion.label
                                        key={i}
                                        whileTap={{ scale: 0.99 }}
                                        animate={
                                            isWrongSelected
                                                ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
                                                : isCorrectReveal
                                                    ? { scale: [1, 1.03, 1] }
                                                    : { x: 0, scale: 1 }
                                        }
                                        transition={{ duration: 0.5 }}
                                        className={optionClass}
                                    >
                                        <input
                                            type="radio"
                                            name={`question-${question.id}`}
                                            value={opt}
                                            checked={userAnswers[question.id] === opt}
                                            onChange={() => handleOptionSelect(opt)}
                                            disabled={isSubmitted}
                                            className="w-5 h-5 accent-saffron-600 border-charcoal-300 disabled:opacity-50"
                                        />
                                        <span className="ml-3 text-lg text-charcoal-700">{opt}</span>
                                    </motion.label>
                                );
                            })}
                        </div>

                        {/* Immediate Feedback Section */}
                        <AnimatePresence>
                            {isSubmitted && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="overflow-hidden"
                                >
                                    <div className={`mt-6 p-4 rounded-xl border ${isCorrect ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <FeedbackIcon correct={isCorrect} />
                                            {isCorrect ? (
                                                <h3 className="font-bold text-emerald-800 dark:text-emerald-300">Correct!</h3>
                                            ) : (
                                                <h3 className="font-bold text-red-800 dark:text-red-300">Incorrect</h3>
                                            )}
                                        </div>
                                        <p className="text-charcoal-700">
                                            {question.explanation}
                                        </p>
                                        {!isCorrect && (
                                            <p className="mt-2 text-sm text-charcoal-500">
                                                Correct Answer: <span className="font-semibold">{question.correct_answer}</span>
                                            </p>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </AnimatePresence>

                <div className="flex justify-end">
                    {!isSubmitted ? (
                        <button
                            onClick={handleSubmitAnswer}
                            disabled={!userAnswers[question.id]}
                            className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg transition-all ${!userAnswers[question.id]
                                ? 'bg-charcoal-200 text-charcoal-400 cursor-not-allowed'
                                : 'bg-charcoal-900 text-background hover:bg-charcoal-800 shadow-lg shadow-black/20 hover:scale-105'
                                }`}
                        >
                            Submit Answer
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg transition-all bg-saffron-500 text-white hover:bg-saffron-600 shadow-lg shadow-saffron-900/25 hover:scale-105"
                        >
                            {currentQuestionIndex === quizData.questions.length - 1 ? 'View Results' : 'Next Question'}
                            <ArrowRight size={20} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
