'use client';

import { useState, useCallback } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';

interface PasskeyButtonProps {
  callbackUrl?: string;
}

export default function PasskeyButton({ callbackUrl = '/' }: PasskeyButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { t } = useI18n();

  const handlePasskeyLogin = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      // 1. Get authentication options from server
      const optionsRes = await fetch('/api/auth/webauthn/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error || 'Failed to get options');
      }

      const options = await optionsRes.json();

      // 2. Start WebAuthn authentication (triggers Face ID / Touch ID / fingerprint)
      const authResponse = await startAuthentication({ optionsJSON: options });

      // 3. Verify with server
      const verifyRes = await fetch('/api/auth/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResponse),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || 'Verification failed');
      }

      const result = await verifyRes.json();

      if (result.verified) {
        // Role-based redirect
        const role = result.user?.role;
        if (callbackUrl === '/' || !callbackUrl) {
          if (role === 'OWNER' || role === 'EMPLOYEE' || role === 'CLIENT') {
            router.push('/admin');
          } else {
            router.push('/');
          }
        } else {
          router.push(callbackUrl);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      // User cancelled the biometric prompt
      if (message.includes('cancelled') || message.includes('canceled') || message.includes('NotAllowedError')) {
        setError('');
      } else {
        setError(t('auth.passkeyError'));
      }
      setIsLoading(false);
    }
  }, [callbackUrl, router, t]);

  return (
    <div>
      <button
        onClick={handlePasskeyLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        type="button"
      >
        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
          />
        </svg>
        <span className="font-medium">
          {isLoading ? t('auth.passkeyLoading') : t('auth.signInWithPasskey')}
        </span>
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
