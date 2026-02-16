'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTranslations } from '@/hooks/useTranslations';

export default function GiftCardRedeem() {
  const { formatPrice } = useCurrency();
  const { t } = useTranslations();
  const [code, setCode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckBalance = async () => {
    if (!code.trim()) {
      toast.error(t('giftCard.enterCode'));
      return;
    }

    setIsChecking(true);
    setError(null);
    setBalance(null);

    try {
      const response = await fetch(`/api/gift-cards/balance?code=${encodeURIComponent(code)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check balance');
      }

      setBalance(data.balance);
      toast.success(`Balance: ${formatPrice(data.balance)}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to check balance';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsChecking(false);
    }
  };

  const handleRedeem = async () => {
    if (!code.trim()) {
      toast.error(t('giftCard.enterCode'));
      return;
    }

    setIsRedeeming(true);
    setError(null);

    try {
      const response = await fetch('/api/gift-cards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to redeem gift card');
      }

      setBalance(data.balance);
      toast.success(data.message || t('giftCard.linkedSuccess'));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to redeem gift card';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="font-semibold text-gray-900">{t('giftCard.title')}</h3>
      </div>

      <div className="space-y-3">
        <div>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm uppercase font-mono"
            maxLength={19}
          />
        </div>

        {balance !== null && !error && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-green-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">{t('giftCard.balance').replace('{amount}', formatPrice(balance))}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCheckBalance}
            disabled={isChecking || !code.trim()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </span>
            ) : (
              t('giftCard.checkBalance')
            )}
          </button>

          <button
            onClick={handleRedeem}
            disabled={isRedeeming || !code.trim()}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRedeeming ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </span>
            ) : (
              t('giftCard.redeem')
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          {t('giftCard.note')}
        </p>
      </div>
    </div>
  );
}
