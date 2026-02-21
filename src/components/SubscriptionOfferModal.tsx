'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/i18n/client';

interface SubscriptionOfferModalProps {
  productId: string;
  formatId?: string | null;
  productName: string;
  formatName?: string | null;
  currentPrice: number;
  onAccept: (frequency: string, discountPercent: number) => void;
  onDecline: () => void;
}

export default function SubscriptionOfferModal({
  productName,
  formatName,
  currentPrice,
  onAccept,
  onDecline,
}: SubscriptionOfferModalProps) {
  const { t } = useI18n();
  const [selectedFrequency, setSelectedFrequency] = useState('EVERY_2_MONTHS');
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDecline();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onDecline]
  );

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    document.addEventListener('keydown', handleKeyDown);

    requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [handleKeyDown]);

  const FREQUENCIES = [
    { id: 'EVERY_2_MONTHS', label: t('subscriptions.every2Months') || 'Every 2 Months', discount: 15 },
    { id: 'EVERY_4_MONTHS', label: t('subscriptions.every4Months') || 'Every 4 Months', discount: 12 },
    { id: 'EVERY_6_MONTHS', label: t('subscriptions.every6Months') || 'Every 6 Months', discount: 10 },
    { id: 'EVERY_12_MONTHS', label: t('subscriptions.every12Months') || 'Every 12 Months', discount: 5 },
  ];

  const selected = FREQUENCIES.find((f) => f.id === selectedFrequency)!;
  const discountedPrice = currentPrice * (1 - selected.discount / 100);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('subscriptions.offerTitle')}
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-5 text-white">
          <h2 className="text-xl font-bold">{t('subscriptions.offerTitle')}</h2>
          <p className="text-sm text-white/80 mt-1">
            {productName}
            {formatName ? ` — ${formatName}` : ''}
          </p>
        </div>

        <div className="p-6">
          {/* Current price */}
          <div className="mb-5">
            <p className="text-sm text-gray-500">{t('subscriptions.currentPrice')}</p>
            <p className="text-2xl font-bold text-gray-900">${currentPrice.toFixed(2)}</p>
          </div>

          {/* Frequency options */}
          <div className="space-y-2 mb-6">
            {FREQUENCIES.map((freq) => {
              const price = currentPrice * (1 - freq.discount / 100);
              return (
                <label
                  key={freq.id}
                  className={`flex items-center justify-between p-3 border-2 rounded-xl cursor-pointer transition-all ${
                    selectedFrequency === freq.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="subscription-frequency"
                      value={freq.id}
                      checked={selectedFrequency === freq.id}
                      onChange={() => setSelectedFrequency(freq.id)}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">{freq.label}</span>
                      <span className="ms-2 text-sm text-green-600 font-medium">
                        {t('subscriptions.save', { percent: freq.discount })}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900">${price.toFixed(2)}</span>
                </label>
              );
            })}
          </div>

          {/* Savings highlight */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-green-700">
              {t('subscriptions.youSave')}{' '}
              <span className="font-bold text-green-800">
                ${(currentPrice - discountedPrice).toFixed(2)}
              </span>{' '}
              {t('subscriptions.perDelivery')} ({selected.discount}%)
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onDecline}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              {t('subscriptions.decline')}
            </button>
            <button
              onClick={() => onAccept(selectedFrequency, selected.discount)}
              className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
            >
              {t('subscriptions.subscribe')}
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-3">
            {t('subscriptions.cancelAnytime')}
          </p>
        </div>
      </div>
    </div>
  );
}
