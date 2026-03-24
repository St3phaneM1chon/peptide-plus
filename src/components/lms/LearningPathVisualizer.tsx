'use client';

import { useMemo } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

// ── Types ────────────────────────────────────────────────────

export type StepType = 'lesson' | 'quiz' | 'video' | 'exercise' | 'project' | 'review';
export type StepStatus = 'completed' | 'current' | 'unlocked' | 'locked';

export interface PathStep {
  id: string;
  title: string;
  type: StepType;
  status: StepStatus;
  estimatedMinutes: number;
  completedAt?: Date | string | null;
  /** Actual time taken in minutes */
  timeTaken?: number;
  /** Can this step be skipped via diagnostic */
  canSkip?: boolean;
}

export interface LearningPathVisualizerProps {
  steps: PathStep[];
  currentStepIndex: number;
  onStepClick?: (step: PathStep, index: number) => void;
  onSkipAhead?: (step: PathStep) => void;
}

// ── Icons per type ──────────────────────────────────────────

function StepIcon({ type, status }: { type: StepType; status: StepStatus }) {
  const color = status === 'completed'
    ? 'text-white'
    : status === 'current'
      ? 'text-blue-600'
      : status === 'locked'
        ? 'text-gray-300'
        : 'text-gray-500';

  const iconMap: Record<StepType, React.ReactNode> = {
    lesson: (
      <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    quiz: (
      <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
    video: (
      <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
      </svg>
    ),
    exercise: (
      <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.656-3.262 1.41-1.41L11.42 14.5l7.658-7.65 1.41 1.41L11.42 15.17z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 2.25v3a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75v-3m4.5 0H6.375c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h11.25c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875H14.25" />
      </svg>
    ),
    project: (
      <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    ),
    review: (
      <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
      </svg>
    ),
  };

  return iconMap[type] || iconMap.lesson;
}

function getTypeLabel(type: StepType, t: (key: string) => string): string {
  const labels: Record<StepType, string> = {
    lesson: t('learn.learningPath.typeLesson'),
    quiz: t('learn.learningPath.typeQuiz'),
    video: t('learn.learningPath.typeVideo'),
    exercise: t('learn.learningPath.typeExercise'),
    project: t('learn.learningPath.typeProject'),
    review: t('learn.learningPath.typeReview'),
  };
  return labels[type] || type;
}

// ── Component ───────────────────────────────────────────────

export default function LearningPathVisualizer({
  steps,
  currentStepIndex,
  onStepClick,
  onSkipAhead,
}: LearningPathVisualizerProps) {
  const { t } = useTranslations();

  // ── Computed stats ────────────────────────────────────────

  const completedSteps = useMemo(() => steps.filter(s => s.status === 'completed').length, [steps]);
  const progressPercent = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  const estimatedRemainingMinutes = useMemo(
    () => steps
      .filter(s => s.status !== 'completed')
      .reduce((sum, s) => sum + s.estimatedMinutes, 0),
    [steps]
  );

  function formatDuration(minutes: number): string {
    if (minutes < 60) return t('learn.learningPath.minutesShort', { count: minutes });
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return t('learn.learningPath.hoursShort', { count: h });
    return `${h}h ${m}m`;
  }

  function formatCompletedDate(d: Date | string | null | undefined): string {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6">
      {/* Summary header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{t('learn.learningPath.title')}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('learn.learningPath.progressSummary', {
              completed: completedSteps,
              total: steps.length,
            })}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{progressPercent}%</div>
          <div className="text-xs text-gray-400">
            {estimatedRemainingMinutes > 0 &&
              t('learn.learningPath.timeRemaining', {
                time: formatDuration(estimatedRemainingMinutes),
              })
            }
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-gray-100 rounded-full mb-8 overflow-hidden" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Timeline */}
      <div className="relative">
        {steps.map((step, index) => {
          const isCurrent = index === currentStepIndex;
          const isCompleted = step.status === 'completed';
          const isLocked = step.status === 'locked';
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
              {/* Vertical line */}
              {!isLast && (
                <div
                  className={`absolute left-5 top-10 w-0.5 bottom-0 ${
                    isCompleted ? 'bg-green-400' : 'bg-gray-200'
                  }`}
                  style={{ marginLeft: '-1px' }}
                />
              )}

              {/* Circle/dot */}
              <div className="relative flex-shrink-0 z-10">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 shadow-md shadow-green-200'
                      : isCurrent
                        ? 'bg-white border-blue-500 shadow-lg shadow-blue-200'
                        : isLocked
                          ? 'bg-gray-100 border-gray-200'
                          : 'bg-white border-gray-300'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isLocked ? (
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  ) : (
                    <StepIcon type={step.type} status={step.status} />
                  )}
                </div>

                {/* Pulse animation for current step */}
                {isCurrent && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-20" />
                )}
              </div>

              {/* Content */}
              <div
                className={`flex-1 min-w-0 rounded-xl p-4 transition-all ${
                  isCurrent
                    ? 'bg-blue-50 border-2 border-blue-200 shadow-sm'
                    : isCompleted
                      ? 'bg-gray-50 border border-gray-100'
                      : isLocked
                        ? 'bg-gray-50 border border-gray-100 opacity-60'
                        : 'bg-white border border-gray-200 hover:shadow-sm'
                } ${!isLocked ? 'cursor-pointer' : ''}`}
                onClick={() => !isLocked && onStepClick?.(step, index)}
                role={!isLocked ? 'button' : undefined}
                tabIndex={!isLocked ? 0 : undefined}
                aria-label={`${step.title} - ${getTypeLabel(step.type, t)}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLocked) onStepClick?.(step, index);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {/* Type badge */}
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5 ${
                      isCurrent
                        ? 'bg-blue-100 text-blue-700'
                        : isCompleted
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}>
                      <StepIcon type={step.type} status={step.status} />
                      {getTypeLabel(step.type, t)}
                    </span>

                    {/* Title */}
                    <h4 className={`text-sm font-semibold truncate ${
                      isLocked ? 'text-gray-400' : isCurrent ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {step.title}
                    </h4>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatDuration(step.estimatedMinutes)}
                      </span>

                      {isCompleted && step.timeTaken && (
                        <span className="flex items-center gap-1 text-green-600">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {formatDuration(step.timeTaken)}
                        </span>
                      )}

                      {isCompleted && step.completedAt && (
                        <span className="text-green-500">
                          {formatCompletedDate(step.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Skip button */}
                  {step.canSkip && !isCompleted && !isLocked && onSkipAhead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSkipAhead(step);
                      }}
                      className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
                      aria-label={t('learn.learningPath.skipAhead')}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.81V8.688zM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.688z" />
                      </svg>
                      {t('learn.learningPath.skipAhead')}
                    </button>
                  )}
                </div>

                {/* Current step call to action */}
                {isCurrent && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      {t('learn.learningPath.continueLearning')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion message */}
      {progressPercent === 100 && (
        <div className="mt-8 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-200">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-green-800 mb-2">
            {t('learn.learningPath.pathComplete')}
          </h3>
          <p className="text-sm text-green-600">
            {t('learn.learningPath.pathCompleteDesc')}
          </p>
        </div>
      )}
    </div>
  );
}
