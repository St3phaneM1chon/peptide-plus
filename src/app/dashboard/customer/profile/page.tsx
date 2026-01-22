/**
 * PAGE PROFIL UTILISATEUR
 * Paramètres du compte incluant la langue
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { ProfileForm } from './ProfileForm';

async function getUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      locale: true,
      timezone: true,
      mfaEnabled: true,
      createdAt: true,
    },
  });
}

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/dashboard/customer/profile');
  }

  const user = await getUserProfile(session.user.id);

  if (!user) {
    redirect('/');
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
      <ProfileForm user={user} />
    </div>
  );
}
