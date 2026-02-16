export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ProductPageClient from './ProductPageClient';
import { prisma } from '@/lib/db';
import { getServerLocale } from '@/i18n/server';
import { withTranslation, getTranslatedFields } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';
import { JsonLd } from '@/components/seo/JsonLd';
import { productSchema, breadcrumbSchema } from '@/lib/structured-data';

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
      quantityDiscounts: {
        orderBy: { minQty: 'asc' },
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

async function getActivePromotionForProduct(productId: string) {
  const now = new Date();
  const promotion = await prisma.discount.findFirst({
    where: {
      OR: [
        { productId },
        { appliesToAll: true },
      ],
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { value: 'desc' }, // Get the best promotion
  });
  return promotion;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductFromDB(slug);

  if (!product) {
    return { title: 'Product not found' };
  }

  // Apply translations for metadata
  const locale = await getServerLocale();
  let name = product.name;
  let subtitle = product.subtitle || '';
  let description = product.shortDescription || product.description?.substring(0, 160) || '';

  if (locale !== defaultLocale) {
    const translated = await getTranslatedFields('Product', product.id, locale);
    if (translated) {
      name = translated.name || name;
      subtitle = translated.subtitle || subtitle;
      description = translated.metaDescription || translated.shortDescription || description;
    }
  }

  const primaryImage = product.images.find(img => img.isPrimary) || product.images[0];
  const imageUrl = primaryImage?.url || product.imageUrl || '/images/og-default.jpg';

  return {
    title: `${name} - ${subtitle}`,
    description,
    alternates: {
      canonical: `https://biocyclepeptides.com/product/${slug}`,
    },
    openGraph: {
      title: `${name} - ${subtitle}`,
      description,
      url: `https://biocyclepeptides.com/product/${slug}`,
      type: 'website',
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 800,
          alt: name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} - ${subtitle}`,
      description,
      images: [imageUrl],
    },
  };
}

// Transform DB product for the client component
function transformProductForClient(
  product: NonNullable<Awaited<ReturnType<typeof getProductFromDB>>>,
  relatedProducts: Awaited<ReturnType<typeof getRelatedProductsFromDB>>,
  promotion: Awaited<ReturnType<typeof getActivePromotionForProduct>>
) {
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
    videoUrl: product.videoUrl || undefined,
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
    quantityDiscounts: product.quantityDiscounts.map(qd => ({
      id: qd.id,
      minQty: qd.minQty,
      maxQty: qd.maxQty,
      discount: Number(qd.discount),
    })),
    createdAt: product.createdAt,
    purchaseCount: product.purchaseCount,
    averageRating: product.averageRating ? Number(product.averageRating) : undefined,
    reviewCount: product.reviewCount,
    restockedAt: product.restockedAt,
    promotion: promotion ? {
      id: promotion.id,
      name: promotion.name,
      endsAt: promotion.endsAt?.toISOString() || null,
      badge: promotion.badge || null,
    } : null,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductFromDB(slug);

  if (!product) {
    notFound();
  }

  // Apply translations to product and its category
  const locale = await getServerLocale();
  let translatedProduct = product;
  if (locale !== defaultLocale) {
    translatedProduct = await withTranslation(product, 'Product', locale) as typeof product;
    // Also translate the category name
    if (translatedProduct.category) {
      const catTrans = await getTranslatedFields('Category', translatedProduct.category.id, locale);
      if (catTrans?.name) {
        translatedProduct = {
          ...translatedProduct,
          category: { ...translatedProduct.category, name: catTrans.name },
        } as typeof product;
      }
    }
  }

  const relatedProducts = await getRelatedProductsFromDB(product.categoryId, product.id);
  const promotion = await getActivePromotionForProduct(product.id);
  const transformedProduct = transformProductForClient(translatedProduct, relatedProducts, promotion);

  // Build JSON-LD structured data
  const primaryImage = product.images.find(img => img.isPrimary) || product.images[0];
  const lowestPrice = product.formats.length > 0
    ? Math.min(...product.formats.map(f => Number(f.price)))
    : Number(product.price);
  const hasStock = product.formats.some(f => f.inStock);

  const productJsonLd = productSchema({
    name: translatedProduct.name,
    description: translatedProduct.shortDescription || translatedProduct.description?.substring(0, 300) || '',
    slug: product.slug,
    image: primaryImage?.url || product.imageUrl || undefined,
    images: product.images.map(img => ({ url: img.url })),
    price: lowestPrice,
    purity: product.purity ? Number(product.purity) : undefined,
    sku: product.formats[0]?.sku || product.id,
    inStock: hasStock,
    categoryName: product.category?.name || undefined,
  });

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
  ];
  if (product.category) {
    breadcrumbItems.push({
      name: product.category.name,
      url: `/shop?category=${product.category.slug}`,
    });
  }
  breadcrumbItems.push({
    name: translatedProduct.name,
    url: `/product/${product.slug}`,
  });

  const breadcrumbJsonLd = breadcrumbSchema(breadcrumbItems);

  return (
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <ProductPageClient product={transformedProduct} />
    </>
  );
}
