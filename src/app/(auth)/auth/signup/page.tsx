/**
 * PAGE D'INSCRIPTION - BioCycle Peptides
 * Création de compte avec validation
 */

'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">...</p>
      </div>
    </div>
  );
}

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    // A-044: Referral code field, pre-filled from URL param (?ref=CODE)
    referralCode: '',
  });
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralName, setReferralName] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);

  // A-044: Pre-fill referral code from URL query parameter
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode && !formData.referralCode) {
      setFormData(prev => ({ ...prev, referralCode: refCode }));
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // A-044: Validate referral code when user finishes typing
  useEffect(() => {
    if (!formData.referralCode || formData.referralCode.length < 4) {
      setReferralValid(null);
      setReferralName('');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/referrals/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: formData.referralCode, email: formData.email || undefined }),
        });
        const data = await res.json();
        setReferralValid(data.valid === true);
        setReferralName(data.referrerName || '');
      } catch {
        setReferralValid(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.referralCode, formData.email]);

  // Validation du mot de passe
  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return t('auth.passwordMinLength');
    }
    if (!/[A-Z]/.test(password)) {
      return t('auth.passwordUppercase');
    }
    if (!/[a-z]/.test(password)) {
      return t('auth.passwordLowercase');
    }
    if (!/[0-9]/.test(password)) {
      return t('auth.passwordDigit');
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validations
    if (!formData.name.trim()) {
      setFormError(t('auth.nameRequired'));
      return;
    }

    if (!formData.email.trim()) {
      setFormError(t('auth.emailRequired'));
      return;
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setFormError(passwordError);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError(t('auth.passwordsNoMatch'));
      return;
    }

    if (!formData.acceptTerms) {
      setFormError(t('auth.acceptTermsRequired'));
      return;
    }

    setIsLoading(true);

    try {
      // A-044: Include referral code in signup request
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          acceptTerms: formData.acceptTerms,
          referralCode: formData.referralCode || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error || t('auth.errorSignup'));
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/auth/signin?registered=true');
      }, 2000);
    } catch (error: unknown) {
      console.error('Sign-up request failed:', error instanceof Error ? error.message : error);
      setFormError(t('auth.errorNetworkGeneric'));
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.accountCreated')}</h2>
          <p className="text-gray-600 mb-4">
            {t('auth.accountCreatedMessage')}
          </p>
          <p className="text-sm text-gray-500">
            {t('auth.redirectingToSignIn')}
          </p>
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
            {t('auth.signUpTitle')}
          </h2>
          <p className="mt-2 text-gray-600">
            {t('auth.orSignIn', { link: '' }).split('{link}')[0]}
            <Link href="/auth/signin" className="text-orange-600 hover:underline font-medium">
              {t('auth.signInLink')}
            </Link>
          </p>
        </div>

        {/* Erreur */}
        {formError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <p className="text-sm">{formError}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          {/* Boutons OAuth */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => signIn('google', { callbackUrl: '/auth/post-login' })}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5 me-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="font-medium">{t('auth.continueWithGoogle')}</span>
            </button>

            <button
              onClick={() => signIn('apple', { callbackUrl: '/auth/post-login' })}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5 me-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <span className="font-medium">{t('auth.continueWithApple')}</span>
            </button>

            <button
              onClick={() => signIn('twitter', { callbackUrl: '/auth/post-login' })}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5 me-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="font-medium">{t('auth.continueWithX')}</span>
            </button>
          </div>

          {/* Séparateur */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-500">
                {t('auth.orWithEmail')}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nom */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.fullName')}
              </label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={t('auth.namePlaceholder')}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <p className={formData.password.length >= 8 ? 'text-green-600' : ''}>
                  {formData.password.length >= 8 ? '✓' : '○'} {t('auth.passwordMinChars')}
                </p>
                <p className={/[A-Z]/.test(formData.password) ? 'text-green-600' : ''}>
                  {/[A-Z]/.test(formData.password) ? '✓' : '○'} {t('auth.passwordOneUppercase')}
                </p>
                <p className={/[a-z]/.test(formData.password) ? 'text-green-600' : ''}>
                  {/[a-z]/.test(formData.password) ? '✓' : '○'} {t('auth.passwordOneLowercase')}
                </p>
                <p className={/[0-9]/.test(formData.password) ? 'text-green-600' : ''}>
                  {/[0-9]/.test(formData.password) ? '✓' : '○'} {t('auth.passwordOneDigit')}
                </p>
              </div>
            </div>

            {/* Confirmation mot de passe */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="••••••••"
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">{t('auth.passwordsNoMatch')}</p>
              )}
              {formData.confirmPassword && formData.password === formData.confirmPassword && (
                <p className="mt-1 text-xs text-green-600">✓ {t('auth.passwordsMatch')}</p>
              )}
            </div>

            {/* A-044: Referral code field (optional) */}
            <div>
              <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.referralCode') || 'Referral Code'} <span className="text-gray-400 font-normal">({t('common.optional') || 'optional'})</span>
              </label>
              <input
                id="referralCode"
                type="text"
                autoComplete="off"
                value={formData.referralCode}
                onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                  referralValid === true ? 'border-green-300 bg-green-50' :
                  referralValid === false ? 'border-red-300 bg-red-50' :
                  'border-gray-200'
                }`}
                placeholder={t('auth.referralCodePlaceholder') || 'e.g. STX1A2B3'}
              />
              {referralValid === true && referralName && (
                <p className="mt-1 text-xs text-green-600">
                  {t('auth.referredBy') || 'Referred by'}: {referralName}
                </p>
              )}
              {referralValid === false && (
                <p className="mt-1 text-xs text-red-500">
                  {t('auth.invalidReferralCode') || 'Invalid referral code'}
                </p>
              )}
            </div>

            {/* Conditions */}
            <div className="flex items-start">
              <input
                id="acceptTerms"
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                className="mt-1 h-4 w-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="acceptTerms" className="ms-2 text-sm text-gray-600">
                {t('auth.acceptTerms', { link: '' }).split('{link}')[0]}
                <Link href="/mentions-legales/conditions" className="text-orange-600 hover:underline">
                  {t('auth.termsOfUse')}
                </Link>{' '}
                {t('auth.andThe')}{' '}
                <Link href="/mentions-legales/confidentialite" className="text-orange-600 hover:underline">
                  {t('auth.privacyPolicy')}
                </Link>
              </label>
            </div>

            {/* Bouton */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ms-1 me-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('auth.creating')}
                </span>
              ) : (
                t('auth.createMyAccount')
              )}
            </button>
          </form>
        </div>

        {/* Avantages compte */}
        <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-100">
          <h3 className="font-semibold text-orange-900 mb-2 text-sm">
            {t('auth.accountBenefitsTitle')}
          </h3>
          <ul className="text-sm text-orange-700 space-y-1">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('auth.welcomePoints')}
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('auth.realtimeTracking')}
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('auth.exclusiveOffers')}
            </li>
          </ul>
        </div>

        {/* Retour boutique */}
        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-orange-600">
            &larr; {t('auth.backToShop')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SignUpContent />
    </Suspense>
  );
}
