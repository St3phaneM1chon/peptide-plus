export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import CategoryPageClient from './CategoryPageClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { name: true, description: true },
  });

  if (!category) {
    return { title: 'Catégorie non trouvée' };
  }

  return {
    title: `${category.name} | BioCycle Peptides`,
    description: category.description || '',
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, description: true },
  });

  if (!category) {
    notFound();
  }

  // Requête Prisma réelle avec produits et formats
  const dbProducts = await prisma.product.findMany({
    where: {
      categoryId: category.id,
      isActive: true,
    },
    include: {
      formats: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          price: true,
          comparePrice: true,
          inStock: true,
          stockQuantity: true,
        },
      },
    },
    orderBy: [
      { isFeatured: 'desc' },
      { isBestseller: 'desc' },
      { name: 'asc' },
    ],
  });

  // Mapper vers le format attendu par CategoryPageClient
  const products = dbProducts.map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: p.subtitle || undefined,
    slug: p.slug,
    price: Number(p.price),
    purity: p.purity ? Number(p.purity) : undefined,
    imageUrl: p.imageUrl || undefined,
    isNew: p.isNew || undefined,
    isBestseller: p.isBestseller || undefined,
    inStock: p.formats.some((f) => f.inStock),
    formats: p.formats.map((f) => ({
      id: f.id,
      name: f.name,
      price: Number(f.price),
      comparePrice: f.comparePrice ? Number(f.comparePrice) : undefined,
      inStock: f.inStock,
      stockQuantity: f.stockQuantity,
    })),
  }));

  return (
    <CategoryPageClient
      category={{
        slug: category.slug,
        name: category.name,
        description: category.description || '',
        longDescription: category.description || '',
      }}
      products={products}
    />
  );
}
