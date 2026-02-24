/**
 * PAGE MOT DE PASSE OUBLIÉ - BioCycle Peptides
 * Demande de réinitialisation du mot de passe
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('auth.errorGeneric'));
        setIsLoading(false);
        return;
      }

      setIsSubmitted(true);
    } catch (error: unknown) {
      console.error('Forgot password request failed:', error instanceof Error ? error.message : error);
      setError(t('auth.errorNetworkGeneric'));
    } finally {
      setIsLoading(false);
    }
  };

  // Message de succès
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.sendResetLink')}</h2>
          <p className="text-gray-600 mb-6">
            <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {t('auth.redirectingToSignIn')}
          </p>
          <Link
            href="/auth/signin"
            className="inline-block px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            {t('auth.backToSignIn')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 justify-center">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">BC</span>
            </div>
            <span className="font-bold text-2xl text-gray-900">BioCycle Peptides</span>
          </Link>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            {t('auth.forgotPassword')}
          </h2>
          <p className="mt-2 text-gray-600">
            {t('auth.forgotPasswordTitle')}
          </p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ms-1 me-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('auth.loading')}
                </span>
              ) : (
                t('auth.sendResetLink')
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/auth/signin" className="text-sm text-orange-600 hover:underline">
              {t('auth.backToSignIn')}
            </Link>
          </div>
        </div>

        {/* Aide */}
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2 text-sm">
            {t('faq.stillHaveQuestions')}
          </h3>
          <p className="text-sm text-gray-600">
            {t('faq.contactUs')}{' '}
            <a href="mailto:support@biocyclepeptides.com" className="text-orange-600 hover:underline">
              support@biocyclepeptides.com
            </a>
          </p>
        </div>

        {/* Retour boutique */}
        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-orange-600">
            {t('auth.backToShop')}
          </Link>
        </div>
      </div>
    </div>
  );
}
