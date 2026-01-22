/**
 * ADMIN - LISTE DES PRODUITS
 * Gestion complète pour Employee et Owner
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import ProductsListClient from './ProductsListClient';

export const metadata = {
  title: 'Gestion des produits | Admin',
  description: 'Créer, modifier et supprimer des produits.',
};

export default async function AdminProductsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  // Récupérer les produits avec catégories
  const products = await prisma.product.findMany({
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Récupérer les catégories pour le filtre
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  // Stats
  const stats = {
    total: products.length,
    active: products.filter(p => p.isActive).length,
    digital: products.filter(p => p.productType === 'DIGITAL').length,
    physical: products.filter(p => p.productType === 'PHYSICAL').length,
    hybrid: products.filter(p => p.productType === 'HYBRID').length,
    featured: products.filter(p => p.isFeatured).length,
  };

  return (
    <ProductsListClient 
      initialProducts={JSON.parse(JSON.stringify(products))}
      categories={JSON.parse(JSON.stringify(categories))}
      stats={stats}
      isOwner={session.user.role === UserRole.OWNER}
    />
  );
}
