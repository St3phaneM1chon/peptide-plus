export const dynamic = 'force-dynamic';
/**
 * ADMIN - LISTE DES PRODUITS
 * Gestion complète pour Employee et Owner
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import ProductsListClient from './ProductsListClient';
import Loading from './loading';

export const metadata = {
  title: 'Gestion des produits | Admin',
  description: 'Créer, modifier et supprimer des produits.',
};

async function ProductsContent({ isOwner }: { isOwner: boolean }) {
  let products: Awaited<ReturnType<typeof prisma.product.findMany>> = [];
  let categories: Awaited<ReturnType<typeof prisma.category.findMany>> = [];

  try {
    // Récupérer les produits avec catégories et options
    products = await prisma.product.findMany({
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        options: {
          select: {
            id: true,
            name: true,
            price: true,
            stockQuantity: true,
            availability: true,
            isActive: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Récupérer les catégories pour le filtre
    categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  } catch (error) {
    console.error('Products data fetch failed:', error);
  }

  // Stats — generic product types
  const stats = {
    total: products.length,
    active: products.filter(p => p.isActive).length,
    peptides: products.filter(p => p.productType === 'PEPTIDE').length,
    supplements: products.filter(p => p.productType === 'SUPPLEMENT').length,
    accessories: products.filter(p => p.productType === 'ACCESSORY').length,
    featured: products.filter(p => p.isFeatured).length,
  };

  return (
    <ProductsListClient
      initialProducts={JSON.parse(JSON.stringify(products))}
      categories={JSON.parse(JSON.stringify(categories))}
      stats={stats}
      isOwner={isOwner}
    />
  );
}

export default async function AdminProductsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  return (
    <Suspense fallback={<Loading />}>
      <ProductsContent isOwner={session.user.role === UserRole.OWNER} />
    </Suspense>
  );
}
