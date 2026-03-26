import { redirect } from 'next/navigation';
import { isModuleEnabled } from '@/lib/module-flags';
import { auth } from '@/lib/auth-config';

/**
 * Learn section layout guard.
 * FIX P1-02: Verifies BOTH module enabled AND user authenticated.
 */
export default async function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enabled = await isModuleEnabled('formation');
  if (!enabled) {
    redirect('/?module=formation&error=disabled');
  }

  // FIX P1-02: Require authentication for all student pages
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/learn');
  }

  const LearnShell = (await import('./LearnShell')).default;
  return <LearnShell>{children}</LearnShell>;
}
