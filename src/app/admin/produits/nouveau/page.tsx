/**
 * ADMIN - NOUVEAU PRODUIT
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import ProductForm from '../ProductForm';

export const metadata = {
  title: 'Nouveau produit | Admin',
};

export default async function NewProductPage() {
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
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '32px' }}>
        Nouveau produit
      </h1>
      <ProductForm 
        categories={JSON.parse(JSON.stringify(categories))} 
        mode="create"
      />
    </div>
  );
}
