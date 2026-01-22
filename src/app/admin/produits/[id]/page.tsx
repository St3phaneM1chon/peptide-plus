/**
 * ADMIN - MODIFIER PRODUIT
 */

import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import ProductForm from '../ProductForm';

export const metadata = {
  title: 'Modifier produit | Admin',
};

interface Props {
  params: { id: string };
}

export default async function EditProductPage({ params }: Props) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      modules: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!product) {
    notFound();
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '32px' }}>
        Modifier: {product.name}
      </h1>
      <ProductForm 
        categories={JSON.parse(JSON.stringify(categories))}
        initialData={JSON.parse(JSON.stringify(product))}
        mode="edit"
      />
    </div>
  );
}
