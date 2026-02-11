export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ProductPageClient from './ProductPageClient';
import { prisma } from '@/lib/db';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getProductFromDB(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
      images: {
        orderBy: { sortOrder: 'asc' },
      },
      formats: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  return product;
}

async function getRelatedProductsFromDB(categoryId: string, excludeId: string) {
  const related = await prisma.product.findMany({
    where: {
      categoryId,
      id: { not: excludeId },
      isActive: true,
    },
    include: {
      images: {
        where: { isPrimary: true },
        take: 1,
      },
    },
    take: 4,
  });
  return related;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductFromDB(slug);

  if (!product) {
    return { title: 'Product not found' };
  }

  return {
    title: `${product.name} - ${product.subtitle || ''} | Peptide Plus+`,
    description: product.shortDescription || product.description?.substring(0, 160) || '',
  };
}

// Transform DB product for the client component
function transformProductForClient(product: NonNullable<Awaited<ReturnType<typeof getProductFromDB>>>, relatedProducts: Awaited<ReturnType<typeof getRelatedProductsFromDB>>) {
  // Find primary image or first image
  const primaryImage = product.images.find(img => img.isPrimary) || product.images[0];
  const productImage = primaryImage?.url || product.imageUrl || undefined;

  // Compute lowest price from formats
  const lowestPrice = product.formats.length > 0
    ? Math.min(...product.formats.map(f => Number(f.price)))
    : Number(product.price);

  return {
    id: product.id,
    name: product.name,
    subtitle: product.subtitle || '',
    slug: product.slug,
    shortDescription: product.shortDescription || '',
    description: product.description || '',
    specifications: product.specifications || '',
    price: lowestPrice,
    purity: product.purity ? Number(product.purity) : undefined,
    avgMass: product.molecularWeight ? `${Number(product.molecularWeight)} Da` : undefined,
    molecularWeight: product.molecularWeight ? Number(product.molecularWeight) : undefined,
    casNumber: product.casNumber || undefined,
    molecularFormula: product.molecularFormula || undefined,
    storageConditions: product.storageConditions || undefined,
    categoryName: product.category?.name || '',
    categorySlug: product.category?.slug || '',
    isNew: product.isNew,
    isBestseller: product.isBestseller,
    productImage,
    images: product.images.map(img => ({
      id: img.id,
      url: img.url,
      alt: img.alt || product.name,
      isPrimary: img.isPrimary,
    })),
    formats: product.formats.map(f => ({
      id: f.id,
      name: f.name,
      type: f.formatType?.toLowerCase() || 'vial_2ml',
      dosageMg: f.dosageMg ? Number(f.dosageMg) : undefined,
      price: Number(f.price),
      comparePrice: f.comparePrice ? Number(f.comparePrice) : undefined,
      sku: f.sku || '',
      inStock: f.inStock,
      stockQuantity: f.stockQuantity,
      image: f.imageUrl || undefined,
    })),
    relatedProducts: relatedProducts.map(rp => ({
      id: rp.id,
      name: rp.name,
      slug: rp.slug,
      price: Number(rp.price),
      purity: rp.purity ? Number(rp.purity) : undefined,
      image: rp.images[0]?.url || rp.imageUrl || undefined,
    })),
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductFromDB(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await getRelatedProductsFromDB(product.categoryId, product.id);
  const transformedProduct = transformProductForClient(product, relatedProducts);

  return <ProductPageClient product={transformedProduct} />;
}
