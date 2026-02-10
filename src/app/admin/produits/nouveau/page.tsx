export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import NewProductClient from './NewProductClient';

export const metadata = {
  title: 'Nouveau produit | Admin',
  description: 'Créer un nouveau produit avec ses formats.',
};

export default async function AdminNewProductPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <NewProductClient 
      categories={JSON.parse(JSON.stringify(categories))}
    />
  );
}
