import { redirect } from 'next/navigation';
import { isModuleEnabled } from '@/lib/module-flags';

/**
 * Formation module layout guard.
 * Verifies the 'formation' module is enabled for the current tenant.
 * If not enabled, redirects to the admin dashboard with a message.
 */
export default async function FormationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enabled = await isModuleEnabled('formation');

  if (!enabled) {
    redirect('/admin?module=formation&error=disabled');
  }

  return <>{children}</>;
}
