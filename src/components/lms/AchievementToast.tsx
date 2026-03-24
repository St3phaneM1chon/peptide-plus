'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

// ── Types ────────────────────────────────────────────────────

export type AchievementType = 'badge' | 'streak' | 'milestone' | 'completion';

export interface AchievementToastProps {
  type: AchievementType;
  title: string;
  description: string;
  icon?: string;
  /** Auto-dismiss after ms (default 5000) */
  duration?: number;
  /** Play sound on show */
  playSound?: boolean;
  /** Called when toast is dismissed */
  onDismiss?: () => void;
}

// ── Confetti particle system (pure CSS + JS) ────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  delay: number;
  duration: number;
  shape: 'circle' | 'square' | 'triangle';
}

function generateConfetti(count: number, type: AchievementType): Particle[] {
  const colorsByType: Record<AchievementType, string[]> = {
    badge: ['#fbbf24', '#f59e0b', '#d97706', '#fef3c7', '#92400e'],
    streak: ['#f97316', '#ef4444', '#dc2626', '#fed7aa', '#fca5a5'],
    milestone: ['#8b5cf6', '#a78bfa', '#6d28d9', '#ddd6fe', '#4c1d95'],
    completion: ['#22c55e', '#16a34a', '#15803d', '#bbf7d0', '#065f46'],
  };

  const colors = colorsByType[type];
  const shapes: Particle['shape'][] = ['circle', 'square', 'triangle'];
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      x: Math.random() * 100, // percentage
      y: -10 - Math.random() * 20,
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1.5,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    });
  }

  return particles;
}

// ── Type-specific styles ────────────────────────────────────

function getTypeStyles(type: AchievementType) {
  switch (type) {
    case 'badge':
      return {
        gradient: 'from-amber-500 via-yellow-400 to-amber-500',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        iconBg: 'bg-gradient-to-br from-yellow-400 to-amber-500',
        textColor: 'text-amber-900',
        subtextColor: 'text-amber-700',
        shimmer: 'from-transparent via-yellow-200/40 to-transparent',
      };
    case 'streak':
      return {
        gradient: 'from-red-500 via-orange-400 to-red-500',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        iconBg: 'bg-gradient-to-br from-orange-400 to-red-500',
        textColor: 'text-orange-900',
        subtextColor: 'text-orange-700',
        shimmer: 'from-transparent via-orange-200/40 to-transparent',
      };
    case 'milestone':
      return {
        gradient: 'from-purple-500 via-violet-400 to-purple-500',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        iconBg: 'bg-gradient-to-br from-violet-400 to-purple-500',
        textColor: 'text-purple-900',
        subtextColor: 'text-purple-700',
        shimmer: 'from-transparent via-purple-200/40 to-transparent',
      };
    case 'completion':
      return {
        gradient: 'from-green-500 via-emerald-400 to-green-500',
        bg: 'bg-green-50',
        border: 'border-green-200',
        iconBg: 'bg-gradient-to-br from-emerald-400 to-green-500',
        textColor: 'text-green-900',
        subtextColor: 'text-green-700',
        shimmer: 'from-transparent via-green-200/40 to-transparent',
      };
  }
}

function getDefaultIcon(type: AchievementType): React.ReactNode {
  switch (type) {
    case 'badge':
      return (
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-3.27.972 6.003 6.003 0 01-3.27-.972" />
        </svg>
      );
    case 'streak':
      return (
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
        </svg>
      );
    case 'milestone':
      return (
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      );
    case 'completion':
      return (
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
        </svg>
      );
  }
}

// ── Component ───────────────────────────────────────────────

export default function AchievementToast({
  type,
  title,
  description,
  duration = 5000,
  playSound = true,
  onDismiss,
}: AchievementToastProps) {
  const { t } = useTranslations();
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [confetti, setConfetti] = useState<Particle[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Mount animation ───────────────────────────────────────

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setIsVisible(true));

    // Generate confetti
    setConfetti(generateConfetti(30, type));

    // Play sound
    if (playSound) {
      playAchievementSound(type);
    }

    // Auto-dismiss timer
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      audioContextRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sound ─────────────────────────────────────────────────

  const playAchievementSound = useCallback((achievementType: AchievementType) => {
    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const now = ctx.currentTime;

      const playTone = (freq: number, start: number, dur: number, vol: number = 0.15) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(vol, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.start(start);
        osc.stop(start + dur);
      };

      // Different melodies per type
      switch (achievementType) {
        case 'badge':
          // Triumphant fanfare
          playTone(523.25, now, 0.15, 0.2);
          playTone(659.25, now + 0.12, 0.15, 0.2);
          playTone(783.99, now + 0.24, 0.15, 0.2);
          playTone(1046.5, now + 0.36, 0.5, 0.25);
          break;
        case 'streak':
          // Fire crackling up
          playTone(440, now, 0.1);
          playTone(523.25, now + 0.08, 0.1);
          playTone(659.25, now + 0.16, 0.1);
          playTone(783.99, now + 0.24, 0.1);
          playTone(880, now + 0.32, 0.3);
          break;
        case 'milestone':
          // Star twinkling
          playTone(880, now, 0.2);
          playTone(1108.73, now + 0.15, 0.2);
          playTone(880, now + 0.3, 0.2);
          playTone(1318.51, now + 0.45, 0.5);
          break;
        case 'completion':
          // Graduation chord
          playTone(523.25, now, 0.4);
          playTone(659.25, now, 0.4);
          playTone(783.99, now, 0.4);
          playTone(1046.5, now + 0.35, 0.6);
          break;
      }
    } catch {
      // Audio not available
    }
  }, []);

  // ── Inject keyframe styles ─────────────────────────────────

  useEffect(() => {
    const styleId = 'achievement-toast-keyframes';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes confetti-fall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(350px) rotate(720deg); opacity: 0; }
      }
      @keyframes shrink-width {
        from { width: 100%; }
        to { width: 0%; }
      }
      @keyframes achievement-shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      .animate-shimmer { animation-name: achievement-shimmer; }
    `;
    document.head.appendChild(style);
  }, []);

  // ── Dismiss ───────────────────────────────────────────────

  const handleDismiss = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 400);
  }, [onDismiss]);

  const styles = getTypeStyles(type);

  if (!isVisible && isLeaving) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 transition-all duration-500 ease-out ${
        isVisible && !isLeaving
          ? 'opacity-100 translate-y-0 scale-100'
          : isLeaving
            ? 'opacity-0 -translate-y-8 scale-95'
            : 'opacity-0 -translate-y-12 scale-90'
      }`}
      role="alert"
      aria-live="polite"
      aria-label={t('learn.achievement.notification')}
      onClick={handleDismiss}
    >
      {/* Confetti container */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {confetti.map(p => (
          <div
            key={p.id}
            className="absolute"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              animationName: 'confetti-fall',
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              animationTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              animationFillMode: 'forwards',
              transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
            }}
          >
            {p.shape === 'circle' && (
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            )}
            {p.shape === 'square' && (
              <div className="w-2 h-2" style={{ backgroundColor: p.color, transform: `rotate(${p.rotation}deg)` }} />
            )}
            {p.shape === 'triangle' && (
              <div
                className="w-0 h-0"
                style={{
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderBottom: `6px solid ${p.color}`,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Toast card */}
      <div className={`relative overflow-hidden rounded-2xl ${styles.bg} ${styles.border} border-2 shadow-2xl cursor-pointer`}>
        {/* Shimmer effect */}
        <div
          className={`absolute inset-0 bg-gradient-to-r ${styles.shimmer} animate-shimmer pointer-events-none`}
          style={{
            animationDuration: '2s',
            animationIterationCount: '3',
          }}
        />

        {/* Top gradient bar */}
        <div className={`h-1 bg-gradient-to-r ${styles.gradient}`} />

        <div className="relative flex items-center gap-4 px-5 py-4">
          {/* Icon */}
          <div className={`flex-shrink-0 w-14 h-14 rounded-2xl ${styles.iconBg} flex items-center justify-center shadow-lg`}>
            {getDefaultIcon(type)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-bold uppercase tracking-wider ${styles.subtextColor} mb-0.5`}>
              {type === 'badge' && t('learn.achievement.badgeEarned')}
              {type === 'streak' && t('learn.achievement.streakRecord')}
              {type === 'milestone' && t('learn.achievement.milestoneReached')}
              {type === 'completion' && t('learn.achievement.courseCompleted')}
            </div>
            <h4 className={`text-base font-bold ${styles.textColor} truncate`}>
              {title}
            </h4>
            <p className={`text-sm ${styles.subtextColor} mt-0.5 line-clamp-2`}>
              {description}
            </p>
          </div>

          {/* Close hint */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-black/5 transition-colors"
            aria-label={t('learn.achievement.dismiss')}
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar (auto-dismiss countdown) */}
        <div className="h-0.5 bg-black/5">
          <div
            className={`h-full bg-gradient-to-r ${styles.gradient} transition-none`}
            style={{
              width: '100%',
              animation: `shrink-width ${duration}ms linear forwards`,
            }}
          />
        </div>
      </div>

    </div>
  );
}
