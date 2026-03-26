'use client';

/**
 * BADGE DISPLAY — Dark Glass Premium Badge Collection + Streak Counter
 * =====================================================================
 * Glass surface badges with category-color glow for earned,
 * glass-thin with grayscale for locked.
 *
 * Usage:
 *   <BadgeDisplay badges={badges} streak={12} />
 *   <BadgeDisplay badges={badges} streak={3} compact />
 */

import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/i18n/client';

export interface Badge {
  name: string;
  icon: string;
  description: string;
  earnedAt: string;
}

interface BadgeDisplayProps {
  /** Array of earned badges */
  badges: Badge[];
  /** Current streak in consecutive days */
  streak: number;
  /** Compact mode renders horizontal icon row with tooltips */
  compact?: boolean;
}

export default function BadgeDisplay({ badges, streak, compact = false }: BadgeDisplayProps) {
  const { t, formatDate } = useI18n();

  return (
    <div>
      {/* Streak */}
      {streak > 0 && (
        <StreakIndicator streak={streak} t={t} />
      )}

      {/* Badges */}
      {badges.length === 0 ? (
        <EmptyBadges t={t} />
      ) : compact ? (
        <CompactBadges badges={badges} t={t} formatDate={formatDate} />
      ) : (
        <FullBadges badges={badges} t={t} formatDate={formatDate} />
      )}
    </div>
  );
}

// ── Streak Indicator ─────────────────────────────────────────

function StreakIndicator({ streak, t }: { streak: number; t: (key: string, params?: Record<string, string | number>) => string }) {
  const isHot = streak > 7;

  return (
    <div
      className="flex items-center gap-2 mb-4 px-3 py-2"
      style={{
        background: isHot ? 'rgba(249, 115, 22, 0.1)' : 'var(--k-glass-thin)',
        border: `1px solid ${isHot ? 'rgba(249, 115, 22, 0.25)' : 'var(--k-border-subtle)'}`,
        borderRadius: 'var(--k-radius-lg)',
        backdropFilter: 'blur(var(--k-blur-md))',
        WebkitBackdropFilter: 'blur(var(--k-blur-md))',
      }}
    >
      <span
        className={`text-xl ${isHot ? 'animate-bounce' : ''}`}
        role="img"
        aria-hidden="true"
      >
        🔥
      </span>
      <span
        className="text-sm font-semibold"
        style={{ color: isHot ? '#f97316' : 'var(--k-text-primary)' }}
      >
        {t('learn.badges.streakDays', { count: streak })}
      </span>
      {isHot && (
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: 'rgba(249, 115, 22, 0.15)',
            color: '#fb923c',
          }}
        >
          {t('learn.badges.streakHot')}
        </span>
      )}
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────

function EmptyBadges({ t }: { t: (key: string) => string }) {
  return (
    <div className="text-center py-6" style={{ color: 'var(--k-text-muted)' }}>
      <div
        className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{
          background: 'var(--k-glass-thin)',
          border: '1px solid var(--k-border-subtle)',
        }}
      >
        <svg className="w-6 h-6" style={{ color: 'var(--k-text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.27.308 6.022 6.022 0 01-2.27-.308" />
        </svg>
      </div>
      <p className="text-sm" style={{ color: 'var(--k-text-tertiary)' }}>{t('learn.badges.noBadges')}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--k-text-muted)' }}>{t('learn.badges.noBadgesDesc')}</p>
    </div>
  );
}

// ── Compact Mode (horizontal icon row with tooltips) ─────────

function CompactBadges({
  badges,
  t,
  formatDate,
}: {
  badges: Badge[];
  t: (key: string) => string;
  formatDate: (date: Date | string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label={t('learn.badges.earned')}>
      {badges.map((badge, idx) => (
        <BadgeTooltip key={idx} badge={badge} formatDate={formatDate} t={t}>
          <div
            className="w-10 h-10 flex items-center justify-center text-lg hover:scale-110 transition-transform cursor-default"
            style={{
              background: 'var(--k-glass-regular)',
              border: '1px solid var(--k-accent-indigo-20)',
              borderRadius: 'var(--k-radius-lg)',
              backdropFilter: 'blur(var(--k-blur-md))',
              WebkitBackdropFilter: 'blur(var(--k-blur-md))',
              boxShadow: '0 0 12px rgba(99, 102, 241, 0.15)',
            }}
            role="listitem"
            aria-label={badge.name}
          >
            {badge.icon}
          </div>
        </BadgeTooltip>
      ))}
    </div>
  );
}

// ── Full Mode (card grid) ────────────────────────────────────

function FullBadges({
  badges,
  t,
  formatDate,
}: {
  badges: Badge[];
  t: (key: string) => string;
  formatDate: (date: Date | string) => string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="list" aria-label={t('learn.badges.earned')}>
      {badges.map((badge, idx) => (
        <div
          key={idx}
          className="flex items-start gap-3 p-4 transition-all hover:-translate-y-0.5"
          style={{
            background: 'var(--k-glass-regular)',
            backdropFilter: 'blur(var(--k-blur-lg))',
            WebkitBackdropFilter: 'blur(var(--k-blur-lg))',
            border: '1px solid var(--k-border-subtle)',
            borderRadius: 'var(--k-radius-xl)',
            boxShadow: 'var(--k-shadow-md)',
          }}
          role="listitem"
        >
          <div
            className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-2xl"
            style={{
              background: 'var(--k-glass-thick)',
              border: '1px solid var(--k-accent-indigo-20)',
              borderRadius: 'var(--k-radius-lg)',
              boxShadow: '0 0 16px rgba(99, 102, 241, 0.2)',
            }}
          >
            {badge.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--k-text-primary)' }}>
              {badge.name}
            </h4>
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--k-text-secondary)' }}>
              {badge.description}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--k-text-muted)' }}>
              {formatDate(badge.earnedAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tooltip Wrapper ──────────────────────────────────────────

function BadgeTooltip({
  badge,
  formatDate,
  t,
  children,
}: {
  badge: Badge;
  formatDate: (date: Date | string) => string;
  t: (key: string) => string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!show) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [show]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}

      {show && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 z-50 pointer-events-none"
          style={{
            background: 'var(--k-glass-thick)',
            backdropFilter: 'blur(var(--k-blur-xl))',
            WebkitBackdropFilter: 'blur(var(--k-blur-xl))',
            border: '1px solid var(--k-border-default)',
            borderRadius: 'var(--k-radius-lg)',
            boxShadow: 'var(--k-shadow-xl)',
          }}
          role="tooltip"
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--k-text-primary)' }}>{badge.name}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--k-text-secondary)' }}>{badge.description}</p>
          <p className="text-xs mt-1.5" style={{ color: 'var(--k-text-muted)' }}>
            {t('learn.badges.earnedOn')} {formatDate(badge.earnedAt)}
          </p>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div
              className="w-2.5 h-2.5 rotate-45"
              style={{
                background: 'var(--k-glass-thick)',
                borderRight: '1px solid var(--k-border-default)',
                borderBottom: '1px solid var(--k-border-default)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
