'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from '@/hooks/useTranslations';
import { toast } from 'sonner';

interface StockAlertButtonProps {
  productId: string;
  formatId?: string;
  productName: string;
  formatName?: string;
}

export default function StockAlertButton({
  productId,
  formatId,
  productName,
  formatName,
}: StockAlertButtonProps) {
  const { data: session } = useSession();
  const { t } = useTranslations();
  const [email, setEmail] = useState(session?.user?.email || '');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!email) {
      toast.error(t('validation.emailRequired') || 'Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error(t('validation.invalidEmail') || 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/stock-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          productId,
          formatId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to subscribe');
      }

      setIsSubscribed(true);
      toast.success(
        t('shop.stockAlert.success') ||
        "You'll be notified when this product is back in stock!"
      );
    } catch (error) {
      console.error('Stock alert error:', error);
      toast.error(
        t('shop.stockAlert.error') ||
        'Failed to subscribe. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubscribed) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-green-700">
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">
            {t('shop.stockAlert.subscribed') || "You'll be notified!"}
          </span>
        </div>
        <p className="text-sm text-green-600 mt-1">
          {t('shop.stockAlert.subscribedMessage') ||
            "We'll send you an email when this product is back in stock."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg
          className="w-5 h-5 text-amber-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <h3 className="font-semibold text-amber-900">
          {t('shop.stockAlert.title') || 'Notify Me When Available'}
        </h3>
      </div>

      <p className="text-sm text-amber-700 mb-3">
        {t('shop.stockAlert.description') ||
          'Get notified by email when this product is back in stock.'}
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('shop.stockAlert.emailPlaceholder') || 'your@email.com'}
          disabled={isLoading}
          className="flex-1 px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSubscribe}
          disabled={isLoading}
          className="px-6 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {isLoading
            ? (t('common.loading') || 'Loading...')
            : (t('shop.stockAlert.notifyMe') || 'Notify Me')}
        </button>
      </div>
    </div>
  );
}
