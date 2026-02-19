import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import AdminLayoutClient from './AdminLayoutClient';

export const metadata: Metadata = {
  title: 'Admin',
  description: 'BioCycle Peptides administration dashboard.',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Server-side auth guard: redirect unauthenticated or unauthorized users
  if (!session?.user) {
    redirect('/auth/signin');
  }

  const role = session.user.role as string;
  if (role !== UserRole.EMPLOYEE && role !== UserRole.OWNER) {
    redirect('/auth/signin');
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
