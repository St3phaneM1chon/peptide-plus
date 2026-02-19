/**
 * PAGE RÉINITIALISATION MOT DE PASSE - BioCycle Peptides
 * Formulaire pour définir un nouveau mot de passe
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

function LoadingFallback() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">{t('auth.loading')}</p>
      </div>
    </div>
  );
}

function ResetPasswordContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Vérifier que les paramètres sont présents
  useEffect(() => {
    if (!token || !email) {
      setError(t('auth.errorGeneric'));
    }
  }, [token, email, t]);

  // Validation du mot de passe
  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return t('auth.passwordMinLength');
    }
    if (!/[A-Z]/.test(pwd)) {
      return t('auth.passwordUppercase');
    }
    if (!/[a-z]/.test(pwd)) {
      return t('auth.passwordLowercase');
    }
    if (!/[0-9]/.test(pwd)) {
      return t('auth.passwordDigit');
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsNoMatch'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('auth.errorGeneric'));
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push('/auth/signin?reset=success');
      }, 3000);

    } catch {
      setError(t('auth.errorNetworkGeneric'));
    } finally {
      setIsLoading(false);
    }
  };

  // Message de succès
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('account.passwordUpdated')}</h2>
          <p className="text-gray-600 mb-6">
            {t('auth.forgotPasswordTitle')}
          </p>
          <p className="text-sm text-gray-500">
            {t('auth.redirectingToSignIn')}
          </p>
        </div>
      </div>
    );
  }

  // Erreur de lien invalide
  if (!token || !email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.errorGeneric')}</h2>
          <p className="text-gray-600 mb-6">
            {t('auth.errorNetworkGeneric')}
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-block px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            {t('auth.sendResetLink')}
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
            {t('auth.forgotPasswordTitle')}
          </h2>
          <p className="mt-2 text-gray-600">
            {t('auth.password')}
          </p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t('account.newPassword')}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <p className={password.length >= 8 ? 'text-green-600' : ''}>
                  {password.length >= 8 ? '✓' : '○'} {t('auth.passwordMinChars')}
                </p>
                <p className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
                  {/[A-Z]/.test(password) ? '✓' : '○'} {t('auth.passwordOneUppercase')}
                </p>
                <p className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
                  {/[a-z]/.test(password) ? '✓' : '○'} {t('auth.passwordOneLowercase')}
                </p>
                <p className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
                  {/[0-9]/.test(password) ? '✓' : '○'} {t('auth.passwordOneDigit')}
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="••••••••"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">{t('auth.passwordsNoMatch')}</p>
              )}
              {confirmPassword && password === confirmPassword && (
                <p className="mt-1 text-xs text-green-600">✓ {t('auth.passwordsMatch')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 mt-6"
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
                t('auth.forgotPasswordTitle')
              )}
            </button>
          </form>
        </div>

        {/* Retour */}
        <div className="mt-4 text-center">
          <Link href="/auth/signin" className="text-sm text-gray-500 hover:text-orange-600">
            {t('auth.backToSignIn')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
