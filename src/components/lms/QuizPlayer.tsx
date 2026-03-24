'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type KeyboardEvent,
} from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  Trophy,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Send,
  RotateCcw,
  BookOpen,
  Target,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

// ── Types ────────────────────────────────────────────────────

type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'FILL_IN'
  | 'MATCHING'
  | 'ORDERING';

interface QuestionOption {
  id: string;
  text: string;
}

interface MatchingPair {
  left: string;
  right: string;
}

export interface QuizQuestionData {
  id: string;
  type: QuestionType;
  question: string;
  points: number;
  sortOrder: number;
  options: QuestionOption[];
  /** For MATCHING type */
  matchingPairs?: MatchingPair[];
  /** Bloom cognitive level 1-6 (optional) */
  bloomLevel?: number;
  /** Explanation shown after answering (feedback mode only) */
  explanation?: string;
}

export interface QuizPlayerProps {
  quizId: string;
  questions: QuizQuestionData[];
  /** Time limit in minutes. Null/undefined = unlimited. */
  timeLimit?: number | null;
  /** Minimum percentage to pass (0-100). */
  passingScore: number;
  /** Maximum number of attempts allowed. */
  maxAttempts: number;
  /** Current attempt number (1-based). */
  attemptNumber?: number;
  /** Whether to show correct/incorrect after each answer (vs exam mode). */
  immediateFeedback?: boolean;
  /** Called when the quiz is submitted and results received. */
  onComplete?: (result: QuizResult) => void;
  /** Title to display above the quiz. */
  title?: string;
  /** Description/instructions. */
  description?: string;
}

export interface QuizResult {
  attemptId: string;
  score: number;
  passed: boolean;
  totalPoints: number;
  earnedPoints: number;
}

interface QuizResultsDetail {
  quizTitle: string;
  score: number;
  passed: boolean;
  totalPoints: number;
  earnedPoints: number;
  passingScore: number;
  completedAt: string;
  timeTaken: number | null;
  questions?: Array<{
    id: string;
    question: string;
    type: string;
    points: number;
    studentAnswer: unknown;
    isCorrect: boolean;
    earnedPoints: number;
    correctAnswer?: string;
    correctOptionIds: string[];
  }>;
}

/** Translation function type matching useTranslations().t */
type TFunc = (key: string, params?: Record<string, string | number>) => string;

/** Per-question answer state. */
type AnswerValue = string | string[];

/** Matching answer: maps left-item index to right-item index. */
type MatchingAnswer = Record<number, number>;

/** Ordering answer: array of item indices in user's order. */
type OrderingAnswer = number[];

// ── Bloom Level Labels ───────────────────────────────────────

const BLOOM_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Remember', color: 'bg-emerald-100 text-emerald-700' },
  2: { label: 'Understand', color: 'bg-sky-100 text-sky-700' },
  3: { label: 'Apply', color: 'bg-violet-100 text-violet-700' },
  4: { label: 'Analyze', color: 'bg-amber-100 text-amber-700' },
  5: { label: 'Evaluate', color: 'bg-orange-100 text-orange-700' },
  6: { label: 'Create', color: 'bg-rose-100 text-rose-700' },
};

// ── Component ────────────────────────────────────────────────

export default function QuizPlayer({
  quizId,
  questions,
  timeLimit,
  passingScore,
  maxAttempts,
  attemptNumber = 1,
  // immediateFeedback reserved for future per-question feedback mode
  immediateFeedback: _immFeedback = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  onComplete,
  title,
  description,
}: QuizPlayerProps) {
  const { t } = useTranslations();

  // ── Quiz state ──
  const [phase, setPhase] = useState<'intro' | 'active' | 'submitting' | 'results'>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [matchingAnswers, setMatchingAnswers] = useState<Record<string, MatchingAnswer>>({});
  const [orderingAnswers, setOrderingAnswers] = useState<Record<string, OrderingAnswer>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Timer ──
  const [timeRemaining, setTimeRemaining] = useState<number | null>(
    timeLimit ? timeLimit * 60 : null
  );
  const [startTime] = useState<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Results ──
  const [result, setResult] = useState<QuizResult | null>(null);
  const [resultDetail, setResultDetail] = useState<QuizResultsDetail | null>(null);

  // ── Refs ──
  const questionContainerRef = useRef<HTMLDivElement>(null);

  // ── Derived ──
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];
  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + q.points, 0),
    [questions]
  );

  const answeredCount = useMemo(() => {
    let count = 0;
    for (const q of questions) {
      if (q.type === 'MATCHING') {
        const ma = matchingAnswers[q.id];
        if (ma && Object.keys(ma).length > 0) count++;
      } else if (q.type === 'ORDERING') {
        if (orderingAnswers[q.id]) count++;
      } else {
        const a = answers[q.id];
        if (a !== undefined && a !== '' && !(Array.isArray(a) && a.length === 0)) count++;
      }
    }
    return count;
  }, [answers, matchingAnswers, orderingAnswers, questions]);

  const allAnswered = answeredCount === totalQuestions;

  // ── Timer logic ──
  useEffect(() => {
    if (phase !== 'active' || timeRemaining === null) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          // Time's up -- auto-submit
          if (timerRef.current) clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Focus management ──
  useEffect(() => {
    if (phase === 'active' && questionContainerRef.current) {
      questionContainerRef.current.focus();
    }
  }, [currentIndex, phase]);

  // ── Helpers ──

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getTimerColor = useCallback((): string => {
    if (timeRemaining === null) return 'text-gray-500';
    if (timeRemaining <= 60) return 'text-red-600 animate-pulse';
    if (timeRemaining <= 300) return 'text-amber-600';
    return 'text-gray-600';
  }, [timeRemaining]);

  // ── Answer handlers ──

  const setAnswer = useCallback((questionId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const toggleMultipleChoice = useCallback(
    (questionId: string, optionId: string, isMultiple: boolean) => {
      setAnswers((prev) => {
        const current = prev[questionId];
        if (isMultiple) {
          const arr = Array.isArray(current) ? [...current] : [];
          const idx = arr.indexOf(optionId);
          if (idx >= 0) {
            arr.splice(idx, 1);
          } else {
            arr.push(optionId);
          }
          return { ...prev, [questionId]: arr };
        }
        return { ...prev, [questionId]: optionId };
      });
    },
    []
  );

  const setMatchingAnswer = useCallback(
    (questionId: string, leftIndex: number, rightIndex: number) => {
      setMatchingAnswers((prev) => {
        const current = { ...(prev[questionId] || {}) };
        // If this right value is already assigned to another left, remove it
        for (const [key, val] of Object.entries(current)) {
          if (val === rightIndex && Number(key) !== leftIndex) {
            delete current[Number(key)];
          }
        }
        current[leftIndex] = rightIndex;
        return { ...prev, [questionId]: current };
      });
    },
    []
  );

  const moveOrderItem = useCallback(
    (questionId: string, fromIdx: number, direction: 'up' | 'down') => {
      setOrderingAnswers((prev) => {
        const current = prev[questionId] ? [...prev[questionId]] : [];
        const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
        if (toIdx < 0 || toIdx >= current.length) return prev;
        [current[fromIdx], current[toIdx]] = [current[toIdx], current[fromIdx]];
        return { ...prev, [questionId]: current };
      });
    },
    []
  );

  // Initialize ordering answers when entering active phase
  useEffect(() => {
    if (phase === 'active') {
      const orderInit: Record<string, OrderingAnswer> = {};
      for (const q of questions) {
        if (q.type === 'ORDERING' && !orderingAnswers[q.id]) {
          orderInit[q.id] = q.options.map((_, i) => i);
        }
      }
      if (Object.keys(orderInit).length > 0) {
        setOrderingAnswers((prev) => ({ ...prev, ...orderInit }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Navigation ──

  const goToQuestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalQuestions) {
        setCurrentIndex(index);
      }
    },
    [totalQuestions]
  );

  const goNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, totalQuestions]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  // ── Build submission payload ──

  const buildSubmissionAnswers = useCallback(() => {
    return questions.map((q) => {
      let answer: string | string[];

      switch (q.type) {
        case 'MATCHING': {
          const ma = matchingAnswers[q.id] || {};
          // Encode as array of strings: "leftIndex:rightIndex"
          answer = Object.entries(ma).map(([l, r]) => `${l}:${r}`);
          break;
        }
        case 'ORDERING': {
          const oa = orderingAnswers[q.id] || q.options.map((_, i) => i);
          // Encode as array of option IDs in user's order
          answer = oa.map((idx) => q.options[idx]?.id || String(idx));
          break;
        }
        case 'FILL_IN': {
          const raw = answers[q.id];
          answer = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] || '' : '';
          break;
        }
        case 'TRUE_FALSE': {
          const raw = answers[q.id];
          answer = typeof raw === 'string' ? raw : '';
          break;
        }
        case 'MULTIPLE_CHOICE':
        default: {
          const raw = answers[q.id];
          if (Array.isArray(raw)) {
            answer = raw;
          } else if (typeof raw === 'string') {
            answer = raw;
          } else {
            answer = '';
          }
          break;
        }
      }

      return { questionId: q.id, answer };
    });
  }, [questions, answers, matchingAnswers, orderingAnswers]);

  // ── Submit ──

  const handleSubmit = useCallback(async () => {
    setPhase('submitting');
    setSubmitError(null);

    const submissionAnswers = buildSubmissionAnswers();

    try {
      const res = await fetch('/api/lms/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId,
          answers: submissionAnswers,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('lms.quiz.submitError'));
      }

      const data = await res.json();
      const attemptResult: QuizResult = {
        attemptId: data.attempt.id,
        score: data.attempt.score,
        passed: data.attempt.passed,
        totalPoints: data.attempt.totalPoints,
        earnedPoints: data.attempt.earnedPoints,
      };

      setResult(attemptResult);

      // Fetch detailed results
      try {
        const detailRes = await fetch(
          `/api/lms/quiz/results?quizId=${quizId}&attemptId=${attemptResult.attemptId}`
        );
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          setResultDetail(detailData.result);
        }
      } catch {
        // Non-critical -- we still have the basic result
      }

      setPhase('results');
      onComplete?.(attemptResult);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('lms.quiz.submitError'));
      setPhase('active');
    }
  }, [buildSubmissionAnswers, quizId, t, onComplete]);

  // ── Keyboard handler ──

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (phase !== 'active') return;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          if (e.target === questionContainerRef.current) {
            e.preventDefault();
            goNext();
          }
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          if (e.target === questionContainerRef.current) {
            e.preventDefault();
            goPrev();
          }
          break;
      }
    },
    [phase, goNext, goPrev]
  );

  // ── Determine if a MULTIPLE_CHOICE question has multiple correct answers ──
  const isMultipleSelect = useCallback(
    (_q: QuizQuestionData): boolean => { // eslint-disable-line @typescript-eslint/no-unused-vars
      // In exam mode we cannot know from stripped options (isCorrect is removed).
      // Default to single-select (radio). The API grades both correctly.
      // To enable multi-select, the question metadata would need a `multipleCorrect` flag.
      return false;
    },
    []
  );

  // ══════════════════════════════════════════════════════════════
  // ── RENDER: INTRO SCREEN ──────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  if (phase === 'intro') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              {title || t('lms.quiz.title')}
            </h1>
            {description && (
              <p className="text-purple-100 mt-2 text-sm max-w-md mx-auto">{description}</p>
            )}
          </div>

          {/* Quiz info */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoCard
                icon={<Target className="w-5 h-5 text-purple-600" />}
                label={t('lms.quiz.questionsCount')}
                value={String(totalQuestions)}
              />
              <InfoCard
                icon={<Trophy className="w-5 h-5 text-amber-500" />}
                label={t('lms.quiz.totalPoints')}
                value={String(totalPoints)}
              />
              <InfoCard
                icon={<Check className="w-5 h-5 text-green-600" />}
                label={t('lms.quiz.passingScore')}
                value={`${passingScore}%`}
              />
              <InfoCard
                icon={<Clock className="w-5 h-5 text-blue-600" />}
                label={t('lms.quiz.timeLimit')}
                value={
                  timeLimit
                    ? `${timeLimit} ${t('lms.quiz.minutes')}`
                    : t('lms.quiz.unlimited')
                }
              />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-500 text-center">
                {t('lms.quiz.attemptInfo', {
                  current: String(attemptNumber),
                  max: String(maxAttempts),
                })}
              </p>
            </div>

            <button
              onClick={() => setPhase('active')}
              className="w-full py-3.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 active:bg-purple-800 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              aria-label={t('lms.quiz.startQuiz')}
            >
              {t('lms.quiz.startQuiz')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // ── RENDER: SUBMITTING ────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  if (phase === 'submitting') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {t('lms.quiz.submitting')}
        </h2>
        <p className="text-gray-500">{t('lms.quiz.pleaseWait')}</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // ── RENDER: RESULTS SCREEN ────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  if (phase === 'results' && result) {
    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Score card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div
            className={`px-6 py-8 text-center ${
              result.passed
                ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                : 'bg-gradient-to-r from-red-500 to-rose-600'
            }`}
          >
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              {result.passed ? (
                <Trophy className="w-10 h-10 text-white" />
              ) : (
                <RotateCcw className="w-10 h-10 text-white" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">
              {result.passed ? t('lms.quiz.passed') : t('lms.quiz.failed')}
            </h2>
            <p className="text-white/80 text-sm">
              {result.passed
                ? t('lms.quiz.passedMessage')
                : t('lms.quiz.failedMessage')}
            </p>
          </div>

          <div className="p-6">
            {/* Score circle */}
            <div className="flex justify-center mb-6">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-gray-100"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={`${(result.score / 100) * 327} 327`}
                    strokeLinecap="round"
                    className={result.passed ? 'text-green-500' : 'text-red-500'}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-gray-900">{result.score}%</span>
                  <span className="text-xs text-gray-500">
                    {result.earnedPoints}/{result.totalPoints} {t('lms.quiz.points')}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">{t('lms.quiz.passingScore')}</p>
                <p className="text-lg font-bold text-gray-900">{passingScore}%</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">{t('lms.quiz.timeTaken')}</p>
                <p className="text-lg font-bold text-gray-900">
                  {resultDetail?.timeTaken
                    ? formatTime(resultDetail.timeTaken)
                    : formatTime(timeTaken)}
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">{t('lms.quiz.attempt')}</p>
                <p className="text-lg font-bold text-gray-900">
                  {attemptNumber}/{maxAttempts}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        {resultDetail?.questions && resultDetail.questions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('lms.quiz.questionBreakdown')}
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {resultDetail.questions.map((rq, idx) => (
                <ResultQuestionRow
                  key={rq.id}
                  index={idx + 1}
                  question={rq.question}
                  type={rq.type}
                  points={rq.points}
                  earnedPoints={rq.earnedPoints}
                  isCorrect={rq.isCorrect}
                  correctAnswer={rq.correctAnswer}
                  correctOptionIds={rq.correctOptionIds}
                  originalQuestion={questions.find((q) => q.id === rq.id)}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // ── RENDER: ACTIVE QUIZ ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  const multiSelect = currentQuestion ? isMultipleSelect(currentQuestion) : false;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Top bar: timer + progress */}
      <div className="flex items-center justify-between mb-4 gap-4">
        {/* Progress */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-700 flex-shrink-0">
            {t('lms.quiz.questionOf', {
              current: String(currentIndex + 1),
              total: String(totalQuestions),
            })}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">
            ({answeredCount}/{totalQuestions} {t('lms.quiz.answered')})
          </span>
        </div>

        {/* Timer */}
        {timeRemaining !== null && (
          <div
            className={`flex items-center gap-1.5 text-sm font-mono font-medium ${getTimerColor()}`}
            role="timer"
            aria-live="polite"
            aria-label={t('lms.quiz.timeRemaining')}
          >
            <Clock className="w-4 h-4" />
            {formatTime(timeRemaining)}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full mb-6 overflow-hidden" role="progressbar" aria-valuenow={answeredCount} aria-valuemin={0} aria-valuemax={totalQuestions}>
        <div
          className="h-full bg-purple-600 rounded-full transition-all duration-300"
          style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Question navigator dots */}
      <div className="flex flex-wrap gap-1.5 mb-6 justify-center" role="tablist" aria-label={t('lms.quiz.questionNavigation')}>
        {questions.map((q, idx) => {
          const isAnswered =
            q.type === 'MATCHING'
              ? matchingAnswers[q.id] && Object.keys(matchingAnswers[q.id]).length > 0
              : q.type === 'ORDERING'
              ? !!orderingAnswers[q.id]
              : answers[q.id] !== undefined &&
                answers[q.id] !== '' &&
                !(Array.isArray(answers[q.id]) && (answers[q.id] as string[]).length === 0);
          const isCurrent = idx === currentIndex;

          return (
            <button
              key={q.id}
              onClick={() => goToQuestion(idx)}
              role="tab"
              aria-selected={isCurrent}
              aria-label={t('lms.quiz.goToQuestion', { num: String(idx + 1) })}
              className={`
                w-8 h-8 rounded-lg text-xs font-medium transition-all
                focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1
                ${
                  isCurrent
                    ? 'bg-purple-600 text-white shadow-sm'
                    : isAnswered
                    ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }
              `}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Submit error */}
      {submitError && (
        <div
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-sm text-red-700"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Question card */}
      <div
        ref={questionContainerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-400 mb-6"
        aria-label={t('lms.quiz.questionArea')}
      >
        {/* Question header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <QuestionTypeBadge type={currentQuestion.type} t={t} />
              {currentQuestion.bloomLevel && BLOOM_LABELS[currentQuestion.bloomLevel] && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                    BLOOM_LABELS[currentQuestion.bloomLevel].color
                  }`}
                >
                  {BLOOM_LABELS[currentQuestion.bloomLevel].label}
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 leading-snug">
              {currentQuestion.question}
            </h2>
          </div>
          <span className="flex-shrink-0 text-sm font-medium text-gray-400">
            {currentQuestion.points} {currentQuestion.points === 1 ? t('lms.quiz.point') : t('lms.quiz.points')}
          </span>
        </div>

        {/* Answer area */}
        <div className="p-6">
          {currentQuestion.type === 'MULTIPLE_CHOICE' && (
            <MultipleChoiceInput
              question={currentQuestion}
              value={answers[currentQuestion.id]}
              onChange={(val) => toggleMultipleChoice(currentQuestion.id, val, multiSelect)}
              isMultiple={multiSelect}
              t={t}
            />
          )}

          {currentQuestion.type === 'TRUE_FALSE' && (
            <TrueFalseInput
              question={currentQuestion}
              value={answers[currentQuestion.id] as string | undefined}
              onChange={(val) => setAnswer(currentQuestion.id, val)}
              t={t}
            />
          )}

          {currentQuestion.type === 'FILL_IN' && (
            <FillInInput
              question={currentQuestion}
              value={(answers[currentQuestion.id] as string) || ''}
              onChange={(val) => setAnswer(currentQuestion.id, val)}
              t={t}
            />
          )}

          {currentQuestion.type === 'MATCHING' && (
            <MatchingInput
              question={currentQuestion}
              value={matchingAnswers[currentQuestion.id] || {}}
              onChange={(leftIdx, rightIdx) =>
                setMatchingAnswer(currentQuestion.id, leftIdx, rightIdx)
              }
              t={t}
            />
          )}

          {currentQuestion.type === 'ORDERING' && (
            <OrderingInput
              question={currentQuestion}
              value={orderingAnswers[currentQuestion.id] || currentQuestion.options.map((_, i) => i)}
              onMove={(fromIdx, dir) => moveOrderItem(currentQuestion.id, fromIdx, dir)}
              t={t}
            />
          )}
        </div>
      </div>

      {/* Navigation + Submit */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
          aria-label={t('lms.quiz.previousQuestion')}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{t('lms.quiz.previous')}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Submit button -- always visible but prominent when all answered */}
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={`
              inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2
              ${
                allAnswered
                  ? 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
            aria-label={t('lms.quiz.submit')}
          >
            <Send className="w-4 h-4" />
            {t('lms.quiz.submit')}
          </button>
        </div>

        <button
          onClick={goNext}
          disabled={currentIndex === totalQuestions - 1}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
          aria-label={t('lms.quiz.nextQuestion')}
        >
          <span className="hidden sm:inline">{t('lms.quiz.next')}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── SUB-COMPONENTS ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

/** Intro info card */
function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

/** Question type badge */
function QuestionTypeBadge({
  type,
  t,
}: {
  type: QuestionType;
  t: TFunc;
}) {
  const config: Record<QuestionType, { label: string; bg: string }> = {
    MULTIPLE_CHOICE: {
      label: t('lms.quiz.types.multipleChoice'),
      bg: 'bg-blue-50 text-blue-700',
    },
    TRUE_FALSE: {
      label: t('lms.quiz.types.trueFalse'),
      bg: 'bg-teal-50 text-teal-700',
    },
    FILL_IN: {
      label: t('lms.quiz.types.fillIn'),
      bg: 'bg-violet-50 text-violet-700',
    },
    MATCHING: {
      label: t('lms.quiz.types.matching'),
      bg: 'bg-amber-50 text-amber-700',
    },
    ORDERING: {
      label: t('lms.quiz.types.ordering'),
      bg: 'bg-rose-50 text-rose-700',
    },
  };

  const c = config[type];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${c.bg}`}>
      {c.label}
    </span>
  );
}

// ── MULTIPLE CHOICE ──────────────────────────────────────────

function MultipleChoiceInput({
  question,
  value,
  onChange,
  isMultiple,
  t,
}: {
  question: QuizQuestionData;
  value: AnswerValue | undefined;
  onChange: (optionId: string) => void;
  isMultiple: boolean;
  t: TFunc;
}) {
  const selectedIds = Array.isArray(value) ? value : value ? [value] : [];

  return (
    <fieldset>
      <legend className="sr-only">{question.question}</legend>
      {isMultiple && (
        <p className="text-xs text-gray-500 mb-3">{t('lms.quiz.selectMultiple')}</p>
      )}
      <div className="space-y-2" role={isMultiple ? 'group' : 'radiogroup'}>
        {question.options.map((opt) => {
          const isSelected = selectedIds.includes(opt.id);
          return (
            <label
              key={opt.id}
              className={`
                flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                focus-within:ring-2 focus-within:ring-purple-400 focus-within:ring-offset-1
                ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <input
                type={isMultiple ? 'checkbox' : 'radio'}
                name={`q-${question.id}`}
                value={opt.id}
                checked={isSelected}
                onChange={() => onChange(opt.id)}
                className="sr-only"
                aria-label={opt.text}
              />
              <span
                className={`
                  flex-shrink-0 w-5 h-5 rounded-${isMultiple ? 'md' : 'full'} border-2 flex items-center justify-center transition-colors
                  ${
                    isSelected
                      ? 'border-purple-600 bg-purple-600'
                      : 'border-gray-300 bg-white'
                  }
                `}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </span>
              <span className="text-sm text-gray-800 leading-snug">{opt.text}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ── TRUE/FALSE ───────────────────────────────────────────────

function TrueFalseInput({
  question,
  value,
  onChange,
  t,
}: {
  question: QuizQuestionData;
  value: string | undefined;
  onChange: (val: string) => void;
  t: TFunc;
}) {
  // TRUE_FALSE questions have exactly 2 options
  const trueOption = question.options.find(
    (o) => o.text.toLowerCase() === 'true' || o.text.toLowerCase() === 'vrai'
  ) || question.options[0];
  const falseOption = question.options.find(
    (o) => o.text.toLowerCase() === 'false' || o.text.toLowerCase() === 'faux'
  ) || question.options[1];

  if (!trueOption || !falseOption) return null;

  return (
    <fieldset>
      <legend className="sr-only">{question.question}</legend>
      <div className="grid grid-cols-2 gap-4" role="radiogroup">
        {[
          { option: trueOption, label: t('lms.quiz.true'), icon: <Check className="w-6 h-6" /> },
          { option: falseOption, label: t('lms.quiz.false'), icon: <X className="w-6 h-6" /> },
        ].map(({ option, label, icon }) => {
          const isSelected = value === option.id;
          return (
            <label
              key={option.id}
              className={`
                flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 cursor-pointer transition-all
                focus-within:ring-2 focus-within:ring-purple-400 focus-within:ring-offset-1
                ${
                  isSelected
                    ? option === trueOption
                      ? 'border-green-500 bg-green-50'
                      : 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                value={option.id}
                checked={isSelected}
                onChange={() => onChange(option.id)}
                className="sr-only"
                aria-label={label}
              />
              <span
                className={`transition-colors ${
                  isSelected
                    ? option === trueOption
                      ? 'text-green-600'
                      : 'text-red-600'
                    : 'text-gray-400'
                }`}
              >
                {icon}
              </span>
              <span
                className={`text-sm font-semibold ${
                  isSelected ? 'text-gray-900' : 'text-gray-600'
                }`}
              >
                {label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ── FILL IN ──────────────────────────────────────────────────

function FillInInput({
  question,
  value,
  onChange,
  t,
}: {
  question: QuizQuestionData;
  value: string;
  onChange: (val: string) => void;
  t: TFunc;
}) {
  return (
    <div>
      <label htmlFor={`fill-${question.id}`} className="sr-only">
        {question.question}
      </label>
      <input
        id={`fill-${question.id}`}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('lms.quiz.typeYourAnswer')}
        className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all placeholder:text-gray-400"
        autoComplete="off"
        aria-label={t('lms.quiz.typeYourAnswer')}
      />
      <p className="mt-2 text-xs text-gray-400">{t('lms.quiz.fillInHint')}</p>
    </div>
  );
}

// ── MATCHING ─────────────────────────────────────────────────

function MatchingInput({
  question,
  value,
  onChange,
  t,
}: {
  question: QuizQuestionData;
  value: MatchingAnswer;
  onChange: (leftIdx: number, rightIdx: number) => void;
  t: TFunc;
}) {
  const pairs = question.matchingPairs || [];
  if (pairs.length === 0) return null;

  const leftItems = pairs.map((p) => p.left);
  // Shuffled right items for display (consistent within render via useMemo)
  const rightItems = pairs.map((p) => p.right);

  // Collect which right indices are already assigned
  const assignedRight = new Set(Object.values(value));

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">{t('lms.quiz.matchingHint')}</p>
      <div className="space-y-3">
        {leftItems.map((leftText, leftIdx) => {
          const selectedRight = value[leftIdx];
          return (
            <div
              key={leftIdx}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
            >
              {/* Left item */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-900">{leftText}</span>
              </div>

              {/* Arrow */}
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />

              {/* Right item selector */}
              <div className="flex-1 min-w-0 relative">
                <select
                  value={selectedRight !== undefined ? String(selectedRight) : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== '') {
                      onChange(leftIdx, Number(val));
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white appearance-none cursor-pointer focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none pr-8"
                  aria-label={t('lms.quiz.matchFor', { item: leftText })}
                >
                  <option value="">{t('lms.quiz.selectMatch')}</option>
                  {rightItems.map((rightText, rightIdx) => {
                    const isUsed = assignedRight.has(rightIdx) && selectedRight !== rightIdx;
                    return (
                      <option key={rightIdx} value={String(rightIdx)} disabled={isUsed}>
                        {rightText}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ORDERING ─────────────────────────────────────────────────

function OrderingInput({
  question,
  value,
  onMove,
  t,
}: {
  question: QuizQuestionData;
  value: OrderingAnswer;
  onMove: (fromIdx: number, direction: 'up' | 'down') => void;
  t: TFunc;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">{t('lms.quiz.orderingHint')}</p>
      <div className="space-y-2" role="list" aria-label={t('lms.quiz.orderableList')}>
        {value.map((optionIdx, position) => {
          const option = question.options[optionIdx];
          if (!option) return null;

          return (
            <div
              key={optionIdx}
              role="listitem"
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 group hover:border-purple-300 transition-colors"
            >
              {/* Grip handle (visual only) */}
              <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />

              {/* Position number */}
              <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {position + 1}
              </span>

              {/* Item text */}
              <span className="flex-1 text-sm text-gray-800 min-w-0">{option.text}</span>

              {/* Move buttons */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => onMove(position, 'up')}
                  disabled={position === 0}
                  className="p-1 rounded hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
                  aria-label={t('lms.quiz.moveUp', { item: option.text })}
                >
                  <ArrowUp className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <button
                  onClick={() => onMove(position, 'down')}
                  disabled={position === value.length - 1}
                  className="p-1 rounded hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
                  aria-label={t('lms.quiz.moveDown', { item: option.text })}
                >
                  <ArrowDown className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RESULT QUESTION ROW ──────────────────────────────────────

function ResultQuestionRow({
  index,
  question,
  type,
  points,
  earnedPoints,
  isCorrect,
  correctAnswer,
  correctOptionIds,
  originalQuestion,
  t,
}: {
  index: number;
  question: string;
  type: string;
  points: number;
  earnedPoints: number;
  isCorrect: boolean;
  correctAnswer?: string;
  correctOptionIds: string[];
  originalQuestion?: QuizQuestionData;
  t: TFunc;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-6 py-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 text-left group focus:outline-none"
        aria-expanded={expanded}
      >
        {/* Status icon */}
        <span className="flex-shrink-0 mt-0.5">
          {isCorrect ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </span>

        {/* Question */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 font-medium leading-snug">
            <span className="text-gray-400 mr-1">Q{index}.</span>
            {question}
          </p>
        </div>

        {/* Points */}
        <span
          className={`flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-lg ${
            isCorrect
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {earnedPoints}/{points}
        </span>

        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 ml-8 pl-3 border-l-2 border-gray-100 space-y-2">
          {/* Show correct answer for FILL_IN */}
          {type === 'FILL_IN' && correctAnswer && (
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">{t('lms.quiz.correctAnswer')}:</span>{' '}
              <span className="text-green-700 font-medium">{correctAnswer}</span>
            </p>
          )}

          {/* Show correct options for MC/TF */}
          {(type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE') &&
            correctOptionIds.length > 0 &&
            originalQuestion && (
              <div className="text-sm">
                <p className="font-medium text-gray-700 mb-1">
                  {t('lms.quiz.correctAnswer')}:
                </p>
                <ul className="space-y-1">
                  {correctOptionIds.map((optId) => {
                    const opt = originalQuestion.options.find((o) => o.id === optId);
                    return (
                      <li key={optId} className="flex items-center gap-2 text-green-700">
                        <Check className="w-3.5 h-3.5" />
                        <span>{opt?.text || optId}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
