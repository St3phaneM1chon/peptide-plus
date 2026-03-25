'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

// ── Types ────────────────────────────────────────────────────

export interface StudyTimerProps {
  /** Called when a study/break session finishes */
  onSessionEnd?: (sessionData: {
    type: 'focus' | 'break';
    durationMinutes: number;
    pomodoroNumber: number;
    totalStudyMinutes: number;
  }) => void;
  /** Default focus duration in minutes */
  defaultDuration?: number;
  /** Default break duration in minutes */
  defaultBreak?: number;
  /** Start in compact mode */
  compact?: boolean;
}

type TimerPhase = 'idle' | 'focus' | 'break';

// ── Component ───────────────────────────────────────────────

export default function StudyTimer({
  onSessionEnd,
  defaultDuration = 25,
  defaultBreak = 5,
  compact: initialCompact = false,
}: StudyTimerProps) {
  const { t } = useTranslations();

  const [phase, setPhase] = useState<TimerPhase>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [focusDuration, setFocusDuration] = useState(defaultDuration);
  const [breakDuration, setBreakDuration] = useState(defaultBreak);
  const [secondsLeft, setSecondsLeft] = useState(defaultDuration * 60);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [totalStudySeconds, setTotalStudySeconds] = useState(0);
  const [isCompact, setIsCompact] = useState(initialCompact);
  const [showBreakSuggestion, setShowBreakSuggestion] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const totalSeconds = phase === 'break' ? breakDuration * 60 : focusDuration * 60;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;

  // ── Timer tick ────────────────────────────────────────────

  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            return 0;
          }
          return prev - 1;
        });
        if (phase === 'focus') {
          setTotalStudySeconds(prev => prev + 1);
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, phase, secondsLeft]);

  // ── Handle timer reaching zero ────────────────────────────

  useEffect(() => {
    if (secondsLeft === 0 && isRunning) {
      setIsRunning(false);
      playNotificationSound();

      if (phase === 'focus') {
        const newCount = pomodoroCount + 1;
        setPomodoroCount(newCount);
        setShowBreakSuggestion(true);
        onSessionEnd?.({
          type: 'focus',
          durationMinutes: focusDuration,
          pomodoroNumber: newCount,
          totalStudyMinutes: Math.round(totalStudySeconds / 60),
        });
      } else if (phase === 'break') {
        onSessionEnd?.({
          type: 'break',
          durationMinutes: breakDuration,
          pomodoroNumber: pomodoroCount,
          totalStudyMinutes: Math.round(totalStudySeconds / 60),
        });
        // Auto-transition to next focus session
        setPhase('focus');
        setSecondsLeft(focusDuration * 60);
        setShowBreakSuggestion(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, isRunning, phase, pomodoroCount, focusDuration, breakDuration, totalStudySeconds, onSessionEnd]);

  // ── Sound ─────────────────────────────────────────────────

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = audioContextRef.current || new AudioContext();
      audioContextRef.current = ctx;

      // Pleasant chime: two sine tones
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playTone(523.25, now, 0.4);       // C5
      playTone(659.25, now + 0.2, 0.4); // E5
      playTone(783.99, now + 0.4, 0.6); // G5
    } catch {
      // Audio not available — silent fallback
    }
  }, []);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────

  const handleStart = useCallback(() => {
    if (phase === 'idle') {
      setPhase('focus');
      setSecondsLeft(focusDuration * 60);
    }
    setIsRunning(true);
    setShowBreakSuggestion(false);
  }, [phase, focusDuration]);

  const handlePause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setPhase('idle');
    setSecondsLeft(focusDuration * 60);
    setShowBreakSuggestion(false);
  }, [focusDuration]);

  const handleStartBreak = useCallback(() => {
    setPhase('break');
    setSecondsLeft(breakDuration * 60);
    setIsRunning(true);
    setShowBreakSuggestion(false);
  }, [breakDuration]);

  const handleSkipBreak = useCallback(() => {
    setPhase('focus');
    setSecondsLeft(focusDuration * 60);
    setShowBreakSuggestion(false);
  }, [focusDuration]);

  // ── Format time ───────────────────────────────────────────

  const formatTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Break suggestions ────────────────────────────────────

  const breakActivities = [
    t('learn.studyTimer.breakStretch'),
    t('learn.studyTimer.breakWalk'),
    t('learn.studyTimer.breakWater'),
    t('learn.studyTimer.breakBreathe'),
    t('learn.studyTimer.breakEyes'),
  ];

  // Rotate suggestion based on pomodoro count
  const breakSuggestion = breakActivities[pomodoroCount % breakActivities.length];

  // ── SVG Circle ────────────────────────────────────────────

  const circleSize = isCompact ? 80 : 160;
  const strokeWidth = isCompact ? 4 : 6;
  const radius = (circleSize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const phaseColor = phase === 'break' ? '#22c55e' : '#3b82f6';
  const phaseColorLight = phase === 'break' ? '#dcfce7' : '#dbeafe';

  // ── Compact Mode ──────────────────────────────────────────

  if (isCompact) {
    return (
      <div className="fixed bottom-6 left-6 z-40">
        <button
          onClick={() => setIsCompact(false)}
          className="group relative flex items-center gap-3 rounded-full shadow-lg border border-gray-200 bg-white px-4 py-2 hover:shadow-xl transition-all"
          aria-label={t('learn.studyTimer.expand')}
        >
          {/* Mini circle */}
          <svg width={36} height={36} className="flex-shrink-0">
            <circle
              cx={18} cy={18} r={14}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={3}
            />
            <circle
              cx={18} cy={18} r={14}
              fill="none"
              stroke={phaseColor}
              strokeWidth={3}
              strokeDasharray={2 * Math.PI * 14}
              strokeDashoffset={2 * Math.PI * 14 * (1 - progress)}
              strokeLinecap="round"
              transform="rotate(-90 18 18)"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="text-left">
            <div className="text-sm font-mono font-bold text-gray-900">{formatTime(secondsLeft)}</div>
            <div className="text-[10px] text-gray-400 font-medium">
              {phase === 'focus'
                ? t('learn.studyTimer.focusPhase')
                : phase === 'break'
                  ? t('learn.studyTimer.breakPhase')
                  : t('learn.studyTimer.idle')}
            </div>
          </div>
          {isRunning && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          )}
        </button>
      </div>
    );
  }

  // ── Full Mode ─────────────────────────────────────────────

  return (
    <div className="w-full max-w-sm mx-auto px-4 py-6">
      <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{t('learn.studyTimer.title')}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {phase === 'focus'
                ? t('learn.studyTimer.focusPhase')
                : phase === 'break'
                  ? t('learn.studyTimer.breakPhase')
                  : t('learn.studyTimer.idle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Pomodoro counter */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(pomodoroCount, 8) }).map((_, i) => (
                <span key={i} className="w-2.5 h-2.5 rounded-full bg-red-400" />
              ))}
              {pomodoroCount > 8 && (
                <span className="text-xs text-gray-400 ml-1">+{pomodoroCount - 8}</span>
              )}
              {pomodoroCount === 0 && (
                <span className="text-xs text-gray-400">{t('learn.studyTimer.noPomodorosYet')}</span>
              )}
            </div>

            {/* Compact toggle */}
            <button
              onClick={() => setIsCompact(true)}
              className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              aria-label={t('learn.studyTimer.minimize')}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Timer Circle */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <svg width={circleSize} height={circleSize} className="transform -rotate-90">
              {/* Background circle */}
              <circle
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={radius}
                fill="none"
                stroke="#f3f4f6"
                strokeWidth={strokeWidth}
              />
              {/* Progress circle */}
              <circle
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={radius}
                fill="none"
                stroke={phaseColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            {/* Time display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-mono font-bold text-gray-900">
                {formatTime(secondsLeft)}
              </span>
              {phase !== 'idle' && (
                <span
                  className="text-xs font-medium mt-1 px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: phaseColorLight, color: phaseColor }}
                >
                  #{pomodoroCount + (phase === 'focus' ? 1 : 0)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Duration config (only in idle) */}
        {phase === 'idle' && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t('learn.studyTimer.focusMinutes')}
              </label>
              <div className="flex items-center gap-1">
                {[15, 25, 45, 60].map(m => (
                  <button
                    key={m}
                    onClick={() => { setFocusDuration(m); setSecondsLeft(m * 60); }}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      focusDuration === m
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t('learn.studyTimer.breakMinutes')}
              </label>
              <div className="flex items-center gap-1">
                {[3, 5, 10, 15].map(m => (
                  <button
                    key={m}
                    onClick={() => setBreakDuration(m)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      breakDuration === m
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Break suggestion */}
        {showBreakSuggestion && (
          <div className="mb-6 rounded-xl bg-green-50 border border-green-200 p-4 text-center">
            <p className="text-sm font-semibold text-green-800 mb-1">
              {t('learn.studyTimer.pomodoroComplete')}
            </p>
            <p className="text-xs text-green-600 mb-3">
              {breakSuggestion}
            </p>
            <div className="flex items-center gap-2 justify-center">
              <button
                onClick={handleStartBreak}
                className="px-4 py-2 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {t('learn.studyTimer.takeBreak', { minutes: breakDuration })}
              </button>
              <button
                onClick={handleSkipBreak}
                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('learn.studyTimer.skipBreak')}
              </button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {!isRunning && phase !== 'break' && !showBreakSuggestion && (
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors active:scale-95"
              aria-label={t('learn.studyTimer.start')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {phase === 'idle' ? t('learn.studyTimer.start') : t('learn.studyTimer.resume')}
            </button>
          )}

          {isRunning && (
            <button
              onClick={handlePause}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-600 text-white font-semibold rounded-xl hover:bg-gray-700 transition-colors active:scale-95"
              aria-label={t('learn.studyTimer.pause')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
              {t('learn.studyTimer.pause')}
            </button>
          )}

          {phase !== 'idle' && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-3 text-gray-500 font-medium rounded-xl hover:bg-gray-100 transition-colors active:scale-95"
              aria-label={t('learn.studyTimer.reset')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('learn.studyTimer.reset')}
            </button>
          )}
        </div>

        {/* Stats footer */}
        {(pomodoroCount > 0 || totalStudySeconds > 0) && (
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-around text-center">
            <div>
              <div className="text-lg font-bold text-gray-900">{pomodoroCount}</div>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                {t('learn.studyTimer.sessions')}
              </div>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <div className="text-lg font-bold text-gray-900">{Math.round(totalStudySeconds / 60)}</div>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                {t('learn.studyTimer.minutesStudied')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
