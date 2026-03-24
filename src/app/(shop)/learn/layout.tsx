import { redirect } from 'next/navigation';
import { isModuleEnabled } from '@/lib/module-flags';

/**
 * Learn section layout guard.
 * Verifies the 'formation' module is enabled.
 * Student pages under /learn/* require this module to be active.
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

  return <>{children}</>;
}
