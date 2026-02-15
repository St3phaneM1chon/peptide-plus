'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useI18n } from '@/i18n/client';

export default function SignOutPage() {
  const { t } = useI18n();

  useEffect(() => {
    signOut({ callbackUrl: '/' });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">{t('auth.signOut')}...</p>
      </div>
    </div>
  );
}
