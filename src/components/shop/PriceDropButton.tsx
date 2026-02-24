'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/client';

interface PriceDropButtonProps {
  productId: string;
  currentPrice: number;
  variant?: 'icon' | 'button';
  className?: string;
}

export default function PriceDropButton({
  productId,
  currentPrice,
  variant = 'icon',
  className = '',
}: PriceDropButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { t, locale } = useI18n();
  const fmtPrice = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(amount);
  const [isWatching, setIsWatching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPopover, setShowPopover] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Check if user is already watching this product
  useEffect(() => {
    if (session?.user) {
      checkWatchStatus();
    } else {
      setIsLoading(false);
    }
  }, [session, productId]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(false);
      }
    };

    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopover]);

  const checkWatchStatus = async () => {
    try {
      const res = await fetch('/api/price-watch');
      if (res.ok) {
        const data = await res.json();
        const watching = data.watches?.some((w: { productId: string }) => w.productId === productId);
        setIsWatching(watching);
      }
    } catch (error) {
      console.error('Error checking watch status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleWatch = async () => {
    if (!session?.user) {
      router.push('/auth/signin?callbackUrl=' + encodeURIComponent(window.location.pathname));
      return;
    }

    if (isWatching) {
      // Unwatch
      setIsLoading(true);
      try {
        const res = await fetch('/api/price-watch', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        });

        if (res.ok) {
          setIsWatching(false);
          setShowPopover(false);
          toast.success(t('toast.priceAlert.removed'));
        } else {
          toast.error(t('toast.priceAlert.removeFailed'));
        }
      } catch (error) {
        console.error('Error removing price watch:', error);
        toast.error(t('toast.priceAlert.removeFailed'));
      } finally {
        setIsLoading(false);
      }
    } else {
      // Show popover to optionally set target price
      setShowPopover(true);
    }
  };

  const handleSetWatch = async () => {
    if (!session?.user) {
      router.push('/auth/signin?callbackUrl=' + encodeURIComponent(window.location.pathname));
      return;
    }

    setIsLoading(true);
    try {
      const target = targetPrice ? parseFloat(targetPrice) : null;

      // Validate target price
      if (target !== null && (target <= 0 || target >= currentPrice)) {
        toast.error(t('toast.priceAlert.targetInvalid'));
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/price-watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          targetPrice: target,
        }),
      });

      if (res.ok) {
        setIsWatching(true);
        setShowPopover(false);
        setTargetPrice('');

        if (target) {
          toast.success(t('toast.priceAlert.notifyBelow', { amount: fmtPrice(target) }));
        } else {
          toast.success(t('toast.priceAlert.notifyAnyDrop'));
        }
      } else {
        const data = await res.json();
        toast.error(data.error || t('toast.priceAlert.setFailed'));
      }
    } catch (error) {
      console.error('Error setting price watch:', error);
      toast.error(t('toast.priceAlert.setFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'button') {
    return (
      <div className="relative">
        <button
          onClick={handleToggleWatch}
          disabled={isLoading}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
            isWatching
              ? 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
              : 'bg-white border-neutral-300 text-neutral-600 hover:border-orange-300 hover:text-orange-500'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          title={isWatching ? 'Stop watching price' : 'Watch for price drops'}
        >
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              {isWatching ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              )}
            </svg>
          )}
          <span className="text-sm font-medium">
            {isWatching ? 'Watching Price' : 'Watch Price'}
          </span>
        </button>

        {/* Popover for setting target price */}
        {showPopover && !isWatching && (
          <div
            ref={popoverRef}
            className="absolute top-full start-0 mt-2 z-50 bg-white rounded-lg shadow-xl border border-neutral-200 p-4 w-72"
          >
            <h4 className="font-semibold text-sm mb-2">Set Price Alert</h4>
            <p className="text-xs text-neutral-500 mb-3">
              Get notified when the price drops below your target (optional)
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Target Price (optional)
                </label>
                <div className="relative">
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={currentPrice}
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder={fmtPrice(currentPrice * 0.9)}
                    className="w-full ps-7 pe-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Current: {fmtPrice(currentPrice)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPopover(false)}
                  className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetWatch}
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Setting...' : 'Set Alert'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Icon variant
  return (
    <div className="relative">
      <button
        onClick={handleToggleWatch}
        disabled={isLoading}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm ${
          isWatching
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-white/90 text-neutral-500 hover:bg-white hover:text-orange-500'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        title={isWatching ? 'Stop watching price' : 'Watch for price drops'}
      >
        {isLoading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-5 h-5" fill={isWatching ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        )}
      </button>

      {/* Popover for icon variant */}
      {showPopover && !isWatching && (
        <div
          ref={popoverRef}
          className="absolute top-full end-0 mt-2 z-50 bg-white rounded-lg shadow-xl border border-neutral-200 p-4 w-64"
        >
          <h4 className="font-semibold text-sm mb-2">Set Price Alert</h4>
          <p className="text-xs text-neutral-500 mb-3">
            Get notified when price drops
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Target Price (optional)
              </label>
              <div className="relative">
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={currentPrice}
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder={fmtPrice(currentPrice * 0.9)}
                  className="w-full ps-7 pe-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Current: {fmtPrice(currentPrice)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPopover(false)}
                className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSetWatch}
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Setting...' : 'Set Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
