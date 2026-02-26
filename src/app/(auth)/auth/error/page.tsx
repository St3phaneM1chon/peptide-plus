'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const { t } = useI18n();

  const errorMessages: Record<string, string> = {
    Configuration: t('auth.errorConfiguration'),
    AccessDenied: t('auth.errorAccessDenied'),
    Verification: t('auth.errorVerification'),
    OAuthSignin: t('auth.errorOAuthSignin'),
    OAuthCallback: t('auth.errorOAuthCallback'),
    OAuthCreateAccount: t('auth.errorOAuthCreateAccount'),
    EmailCreateAccount: t('auth.errorEmailCreateAccount'),
    Callback: t('auth.errorCallback'),
    OAuthAccountNotLinked: t('auth.errorAccountNotLinked'),
    CredentialsSignin: t('auth.errorCredentials'),
    SessionRequired: t('auth.errorSessionRequired'),
    SessionTimeout: t('auth.errorSessionTimeout'),
    Default: t('auth.errorGeneric'),
  };

  const message = error ? (errorMessages[error] || errorMessages.Default) : errorMessages.Default;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {t('auth.errorTitle')}
        </h1>

        <p className="text-gray-600 mb-8">{message}</p>

        <div className="space-y-3">
          <Link
            href="/auth/signin"
            className="block w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors text-center"
          >
            {t('auth.tryAgain')}
          </Link>
          <Link
            href="/"
            className="block w-full py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-center"
          >
            {t('auth.backToShop')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
