'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useI18n } from '@/i18n/client';
import { Shield } from 'lucide-react';

export default function MfaVerifyClient() {
  const { t } = useI18n();
  const { update } = useSession();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/admin';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/mfa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setError(t('auth.mfaChallenge.tooManyAttempts'));
        } else {
          setError(t('auth.mfaChallenge.invalidCode'));
        }
        setIsLoading(false);
        return;
      }

      if (data.success) {
        await update({ mfaVerified: true });
        window.location.href = callbackUrl;
      }
    } catch {
      setError(t('auth.mfaChallenge.verificationError'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('auth.mfaChallenge.title')}
          </h1>
          <p className="text-gray-500 text-center mt-2">
            {t('auth.mfaChallenge.description')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="mfaCode"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('auth.mfaChallenge.codeLabel')}
            </label>
            <input
              id="mfaCode"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center text-2xl tracking-widest"
              placeholder="000000"
              maxLength={8}
              pattern="[A-Za-z0-9]{6,8}"
              autoComplete="one-time-code"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              {t('auth.mfaChallenge.codeHint')}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || code.length < 6}
            className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {isLoading ? t('auth.mfaChallenge.verifying') : t('auth.mfaChallenge.verifyButton')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            {t('auth.mfaChallenge.signOutLink')}
          </button>
        </div>
      </div>
    </div>
  );
}
