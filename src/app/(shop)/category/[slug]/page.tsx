export const revalidate = 3600; // ISR: revalidate every hour

import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { withTranslation, withTranslations } from '@/lib/translation';
import { getServerLocale } from '@/i18n/server';
import CategoryPageClient from './CategoryPageClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true },
    });
    return categories.map((c) => ({ slug: c.slug }));
  } catch {
    // DB unavailable during build - pages will be generated on first request via ISR
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, description: true, parent: { select: { name: true } } },
  });

  if (!category) {
    return { title: 'Catégorie non trouvée' };
  }

  const locale = await getServerLocale();
  const translated = await withTranslation(category, 'Category', locale);

  const title = category.parent
    ? `${translated.name} - ${category.parent.name} | BioCycle Peptides`
    : `${translated.name} | BioCycle Peptides`;
  const description = translated.description || '';

  return {
    title,
    description,
    alternates: {
      canonical: `https://biocyclepeptides.com/category/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `https://biocyclepeptides.com/category/${slug}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parentId: true,
      parent: { select: { id: true, name: true, slug: true } },
      children: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          imageUrl: true,
          _count: { select: { products: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!category) {
    notFound();
  }

  // If parent category, fetch products from ALL children too
  const categoryIds = [category.id, ...category.children.map(c => c.id)];

  const dbProducts = await prisma.product.findMany({
    where: {
      categoryId: { in: categoryIds },
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

  // Translate children categories
  const translatedChildren = await withTranslations(category.children, 'Category', locale);

  // Translate parent if exists
  let translatedParent = category.parent;
  if (category.parent) {
    translatedParent = await withTranslation(category.parent, 'Category', locale);
  }

  // Map products
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
        parentId: category.parentId,
        parent: translatedParent ? { name: translatedParent.name, slug: translatedParent.slug } : undefined,
        children: translatedChildren.map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          imageUrl: c.imageUrl,
          productCount: c._count?.products || 0,
        })),
      }}
      products={products}
    />
  );
}
