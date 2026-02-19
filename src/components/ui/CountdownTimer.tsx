'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';

interface CountdownTimerProps {
  endDate: Date | string;
  label?: string;
  onExpire?: () => void;
  variant?: 'compact' | 'full';
  showDays?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export default function CountdownTimer({
  endDate,
  label,
  onExpire,
  variant = 'full',
  showDays = true,
}: CountdownTimerProps) {
  const { t } = useI18n();
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });
  const [mounted, setMounted] = useState(false);

  const calculateTimeLeft = useCallback((): TimeLeft => {
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    const now = new Date();
    const difference = end.getTime() - now.getTime();

    if (difference <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
      };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      isExpired: false,
    };
  }, [endDate]);

  useEffect(() => {
    setMounted(true);
    setTimeLeft(calculateTimeLeft());
  }, [calculateTimeLeft]);

  useEffect(() => {
    if (!mounted) return;

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.isExpired && onExpire) {
        onExpire();
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [mounted, calculateTimeLeft, onExpire]);

  // Don't render anything until mounted (prevents hydration mismatch)
  if (!mounted) {
    return (
      <div className={variant === 'compact' ? 'h-12' : 'h-20'}>
        <div className="animate-pulse bg-neutral-200 rounded-lg h-full"></div>
      </div>
    );
  }

  if (timeLeft.isExpired) {
    return (
      <div
        className={`flex items-center justify-center ${
          variant === 'compact'
            ? 'py-2 px-4 text-sm'
            : 'py-4 px-6 text-lg'
        } bg-neutral-200 text-neutral-600 rounded-lg font-medium`}
      >
        {t('countdown.expired') || 'Offer Expired'}
      </div>
    );
  }

  const TimeUnit = ({
    value,
    label,
    showColon,
  }: {
    value: number;
    label: string;
    showColon?: boolean;
  }) => {
    const displayValue = value.toString().padStart(2, '0');

    if (variant === 'compact') {
      return (
        <div className="flex items-baseline gap-0.5">
          <span className="font-bold text-lg tabular-nums">{displayValue}</span>
          <span className="text-xs text-neutral-600">{label}</span>
          {showColon && <span className="mx-0.5 text-neutral-400">:</span>}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center">
        <div className="bg-white rounded-lg shadow-md px-3 py-2 min-w-[60px] border-2 border-orange-200">
          <div className="text-2xl md:text-3xl font-bold text-orange-600 tabular-nums transition-all">
            {displayValue}
          </div>
        </div>
        <div className="text-xs md:text-sm text-neutral-600 mt-1 font-medium uppercase tracking-wide">
          {label}
        </div>
      </div>
    );
  };

  const Separator = () => {
    if (variant === 'compact') return null;
    return (
      <div className="text-2xl md:text-3xl font-bold text-orange-400 mx-1">
        :
      </div>
    );
  };

  return (
    <div
      className={`${
        variant === 'compact'
          ? 'flex items-center gap-1'
          : 'flex flex-col items-center'
      }`}
    >
      {label && (
        <div
          className={`${
            variant === 'compact'
              ? 'text-sm font-medium text-neutral-700 me-2'
              : 'text-lg md:text-xl font-bold text-neutral-800 mb-4'
          }`}
        >
          {label}
        </div>
      )}

      <div
        className={`flex items-center ${
          variant === 'compact' ? 'gap-1' : 'gap-2 md:gap-3'
        }`}
        role="timer"
        aria-label={`${label || 'Countdown'}: ${
          showDays && timeLeft.days > 0
            ? `${timeLeft.days} days, `
            : ''
        }${timeLeft.hours} hours, ${timeLeft.minutes} minutes, ${timeLeft.seconds} seconds remaining`}
      >
        {showDays && timeLeft.days > 0 && (
          <>
            <TimeUnit
              value={timeLeft.days}
              label={t('countdown.days') || 'd'}
              showColon={variant === 'compact'}
            />
            {variant === 'full' && <Separator />}
          </>
        )}
        <TimeUnit
          value={timeLeft.hours}
          label={t('countdown.hours') || 'h'}
          showColon={variant === 'compact'}
        />
        {variant === 'full' && <Separator />}
        <TimeUnit
          value={timeLeft.minutes}
          label={t('countdown.minutes') || 'm'}
          showColon={variant === 'compact'}
        />
        {variant === 'full' && <Separator />}
        <TimeUnit
          value={timeLeft.seconds}
          label={t('countdown.seconds') || 's'}
        />
      </div>
    </div>
  );
}
