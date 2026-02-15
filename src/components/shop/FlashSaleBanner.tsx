'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { useTranslations } from '@/hooks/useTranslations';

interface FlashSaleBannerProps {
  title: string;
  description: string;
  endDate: Date | string;
  link: string;
  dismissible?: boolean;
}

export default function FlashSaleBanner({
  title,
  description,
  endDate,
  link,
  dismissible = true,
}: FlashSaleBannerProps) {
  const { t } = useTranslations();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  // Check localStorage on mount to see if user dismissed this banner
  useEffect(() => {
    const dismissed = localStorage.getItem('flash-sale-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
    const now = Date.now();

    // Auto-show banner after 24 hours
    if (now - dismissedTime < 24 * 60 * 60 * 1000) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('flash-sale-dismissed', Date.now().toString());
  };

  const handleExpire = () => {
    setIsExpired(true);
    // Auto-dismiss when expired
    if (dismissible) {
      setTimeout(() => setIsDismissed(true), 3000);
    }
  };

  // Don't render if dismissed or expired (after delay)
  if (isDismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer"></div>
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
          {/* Left: Title & Description */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <span className="text-2xl md:text-3xl animate-pulse">⚡</span>
              <h2 className="text-2xl md:text-3xl font-bold drop-shadow-lg">
                {title}
              </h2>
            </div>
            <p className="text-white/90 text-sm md:text-base max-w-xl">
              {description}
            </p>
          </div>

          {/* Center: Countdown Timer */}
          <div className="flex-shrink-0">
            <CountdownTimer
              endDate={endDate}
              label={t('flashSale.endsIn') || 'Ends In:'}
              variant="full"
              onExpire={handleExpire}
              showDays={true}
            />
          </div>

          {/* Right: CTA Button */}
          <div className="flex-shrink-0">
            <Link
              href={link}
              className="inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-white text-orange-600 rounded-lg font-bold text-base md:text-lg hover:bg-orange-50 transition-all transform hover:scale-105 shadow-xl"
            >
              <span>{t('flashSale.shopNow') || 'Shop Now'}</span>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
          </div>
        </div>

        {/* Dismiss Button */}
        {dismissible && !isExpired && (
          <button
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="absolute top-2 right-2 md:top-4 md:right-4 p-1.5 md:p-2 rounded-lg hover:bg-white/20 transition-colors"
          >
            <svg
              className="w-5 h-5 md:w-6 md:h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Expired overlay */}
        {isExpired && (
          <div className="absolute inset-0 bg-neutral-900/80 flex items-center justify-center backdrop-blur-sm">
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold mb-2">
                {t('flashSale.expired') || 'Sale Ended'}
              </p>
              <p className="text-white/80">
                {t('flashSale.thankYou') || 'Thanks for your interest!'}
              </p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>
    </div>
  );
}
