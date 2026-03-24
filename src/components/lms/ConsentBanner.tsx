'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';

const CONSENT_STORAGE_KEY = 'lms-profiling-consent';

interface ConsentBannerProps {
  onConsent: (accepted: boolean) => void;
}

export default function ConsentBanner({ onConsent }: ConsentBannerProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored === null) {
      setVisible(true);
    }
  }, []);

  const handleConsent = useCallback(async (accepted: boolean) => {
    setSubmitting(true);
    try {
      await fetch('/api/lms/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PROFILING', accepted }),
      });
    } catch {
      // Persist locally even if API fails
    }
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ accepted, date: new Date().toISOString() }));
    setVisible(false);
    setSubmitting(false);
    onConsent(accepted);
  }, [onConsent]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-4xl px-4 pb-4">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5 overflow-hidden">
          {/* Accent bar */}
          <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">
                  {t('learn.consent.title')}
                </h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  {t('learn.consent.description')}
                </p>
                <p className="mt-1.5 text-xs text-gray-400">
                  {t('learn.consent.legalNote')}
                </p>
              </div>

              {/* Buttons */}
              <div className="flex shrink-0 flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-0.5">
                <button
                  onClick={() => handleConsent(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {t('learn.consent.decline')}
                </button>
                <button
                  onClick={() => handleConsent(true)}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      ...
                    </span>
                  ) : (
                    t('learn.consent.accept')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
