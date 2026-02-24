'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useI18n } from '@/i18n/client';

function AcceptTermsContent() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // If not authenticated, redirect to signin
  if (status === 'unauthenticated') {
    router.replace('/auth/signin');
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accepted) {
      setError(t('auth.acceptTermsRequired'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const callbackUrl = searchParams.get('callbackUrl') || '/';

      const response = await fetch('/api/auth/accept-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termsVersion: '1.0',
          privacyVersion: '1.0',
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch((parseErr) => {
          console.error('Failed to parse accept-terms response:', parseErr instanceof Error ? parseErr.message : parseErr);
          return {};
        });
        throw new Error(data.error || 'Failed to accept terms');
      }

      // Refresh session to pick up updated termsAcceptedAt
      await updateSession();

      // Redirect to intended destination
      router.replace(callbackUrl);
    } catch (err) {
      console.error('Accept terms error:', err);
      setError(t('auth.acceptTermsError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-full mb-3">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">{t('auth.acceptTermsTitle')}</h1>
          <p className="text-orange-100 text-sm mt-1">
            {t('auth.acceptTermsDescription')}
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Terms summary */}
          <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto text-sm text-gray-600 leading-relaxed border border-gray-200">
            {t('auth.acceptTermsSummary')}
          </div>

          {/* Checkbox */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="accept-terms"
              checked={accepted}
              onChange={(e) => {
                setAccepted(e.target.checked);
                if (error) setError('');
              }}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
            />
            <label htmlFor="accept-terms" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
              {t('auth.acceptTermsCheckbox')
                .replace('{terms}', '')
                .replace('{privacy}', '')
                .split(/(?=\s*$)/)
                .map(() => null)}
              {/* Render with inline links */}
              <span>
                {(() => {
                  const text = t('auth.acceptTermsCheckbox');
                  const parts = text.split(/\{terms\}|\{privacy\}/);
                  const hasTermsFirst = text.indexOf('{terms}') < text.indexOf('{privacy}');
                  return (
                    <>
                      {parts[0]}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline hover:text-orange-600">
                        {hasTermsFirst ? t('auth.termsOfService') : t('auth.privacyPolicy')}
                      </a>
                      {parts[1]}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline hover:text-orange-600">
                        {hasTermsFirst ? t('auth.privacyPolicy') : t('auth.termsOfService')}
                      </a>
                      {parts[2]}
                    </>
                  );
                })()}
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !accepted}
            className="w-full py-3 px-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('auth.loading')}
              </span>
            ) : (
              t('auth.acceptTermsSubmit')
            )}
          </button>

          {/* Logged-in user info */}
          {session?.user?.email && (
            <p className="text-xs text-gray-400 text-center">
              {session.user.email}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default function AcceptTermsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
        </div>
      }
    >
      <AcceptTermsContent />
    </Suspense>
  );
}
