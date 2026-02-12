'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PostLoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.replace('/auth/signin');
      return;
    }

    const role = (session.user as any)?.role;
    if (role === 'OWNER' || role === 'EMPLOYEE') {
      router.replace('/admin');
    } else {
      router.replace('/account');
    }
  }, [session, status, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirection...</p>
      </div>
    </div>
  );
}
