export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { withTranslation, withTranslations } from '@/lib/translation';
import { getServerLocale } from '@/i18n/server';
import CategoryPageClient from './CategoryPageClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, description: true },
  });

  if (!category) {
    return { title: 'Catégorie non trouvée' };
  }

  const locale = await getServerLocale();
  const translated = await withTranslation(category, 'Category', locale);

  return {
    title: `${translated.name} | BioCycle Peptides`,
    description: translated.description || '',
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

  // Requête Prisma réelle avec produits, formats et images
  const dbProducts = await prisma.product.findMany({
    where: {
      categoryId: category.id,
      isActive: true,
    },
    include: {
      images: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, url: true, alt: true, isPrimary: true },
      },
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

  // Apply translations for current locale
  const locale = await getServerLocale();
  const translatedCategory = await withTranslation(category, 'Category', locale);
  const translatedProducts = await withTranslations(dbProducts, 'Product', locale);

  // Mapper vers le format attendu par CategoryPageClient
  const products = translatedProducts.map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: p.subtitle || undefined,
    slug: p.slug,
    price: Number(p.price),
    purity: p.purity ? Number(p.purity) : undefined,
    imageUrl: p.images?.find((img: { isPrimary: boolean; url: string }) => img.isPrimary)?.url || p.images?.[0]?.url || p.imageUrl || undefined,
    isNew: p.isNew || undefined,
    isBestseller: p.isBestseller || undefined,
    inStock: p.formats.some((f: { inStock: boolean }) => f.inStock),
    formats: p.formats.map((f: { id: string; name: string; price: number | { toNumber?: () => number }; comparePrice: number | { toNumber?: () => number } | null; inStock: boolean; stockQuantity: number }) => ({
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
        slug: translatedCategory.slug,
        name: translatedCategory.name,
        description: translatedCategory.description || '',
        longDescription: translatedCategory.description || '',
      }}
      products={products}
    />
  );
}
