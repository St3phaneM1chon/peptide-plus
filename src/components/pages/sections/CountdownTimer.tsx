'use client';

import { useState, useEffect } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(targetDate: string): TimeLeft {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function isExpired(targetDate: string): boolean {
  return new Date(targetDate).getTime() - Date.now() <= 0;
}

interface TimeUnitCardProps {
  value: number;
  label: string;
}

function TimeUnitCard({ value, label }: TimeUnitCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        minWidth: '80px',
      }}
    >
      <div
        style={{
          background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
          border: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
          borderRadius: '14px',
          padding: '16px 20px',
          minWidth: '80px',
          textAlign: 'center',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* subtle accent glow on top edge */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            height: '1px',
            background:
              'linear-gradient(90deg, transparent, var(--k-accent, #6366f1), transparent)',
            opacity: 0.6,
          }}
        />
        <span
          style={{
            display: 'block',
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: '"tnum"',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
          }}
        >
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span
        style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--k-text-tertiary, rgba(255,255,255,0.40))',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return (
    <span
      aria-hidden="true"
      style={{
        fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
        fontWeight: 700,
        color: 'var(--k-text-tertiary, rgba(255,255,255,0.25))',
        lineHeight: 1,
        marginBottom: '28px', // offset to align with digits, not label
        userSelect: 'none',
      }}
    >
      :
    </span>
  );
}

interface CountdownTimerProps {
  targetDate: string;
  title?: string;
}

export function CountdownTimer({ targetDate, title }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calcTimeLeft(targetDate));
  const [expired, setExpired] = useState<boolean>(() => isExpired(targetDate));

  useEffect(() => {
    if (expired) return;

    const timer = setInterval(() => {
      const tl = calcTimeLeft(targetDate);
      setTimeLeft(tl);
      if (isExpired(targetDate)) {
        setExpired(true);
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, expired]);

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '28px',
      }}
    >
      {title && (
        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
            fontWeight: 700,
            color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
            textAlign: 'center',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h2>
      )}

      {expired ? (
        <div
          style={{
            background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
            border: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
            borderRadius: '14px',
            padding: '20px 40px',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--k-accent, #6366f1)',
              textAlign: 'center',
            }}
          >
            {"L'événement est en cours\u00a0!"}
          </p>
        </div>
      ) : (
        <div
          role="timer"
          aria-label="Compte à rebours"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            width: '100%',
          }}
        >
          <TimeUnitCard value={timeLeft.days} label="Jours" />
          <Separator />
          <TimeUnitCard value={timeLeft.hours} label="Heures" />
          <Separator />
          <TimeUnitCard value={timeLeft.minutes} label="Minutes" />
          <Separator />
          <TimeUnitCard value={timeLeft.seconds} label="Secondes" />
        </div>
      )}
    </div>
  );
}
