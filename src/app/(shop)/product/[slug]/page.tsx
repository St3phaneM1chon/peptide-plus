export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ProductPageClient from './ProductPageClient';
import { getProductBySlug, getRelatedProducts, type Product } from '@/data/products';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return { title: 'Product not found' };
  }

  return {
    title: `${product.name} - ${product.subtitle || ''} | Peptide Plus+`,
    description: product.shortDescription,
  };
}

// Transform Product data for the client component
function transformProductForClient(product: Product) {
  const relatedProducts = getRelatedProducts(product);
  
  return {
    id: product.id,
    name: product.name,
    nameKey: product.nameKey,
    subtitle: product.subtitle || '',
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    specifications: product.specifications,
    price: product.price,
    purity: product.purity,
    avgMass: product.avgMass,
    molecularWeight: product.molecularWeight,
    casNumber: product.casNumber,
    molecularFormula: product.molecularFormula,
    storageConditions: product.storageConditions,
    categoryName: product.categoryName,
    categoryKey: product.categoryKey,
    categorySlug: product.categorySlug,
    isNew: product.isNew,
    isBestseller: product.isBestseller,
    formats: product.formats.map(f => ({
      id: f.id,
      name: f.name,
      nameKey: f.nameKey,
      type: f.type,
      dosageMg: f.dosageMg,
      price: f.price,
      comparePrice: f.comparePrice,
      sku: f.sku,
      inStock: f.inStock,
      stockQuantity: f.stockQuantity,
      image: f.image,
    })),
    relatedProducts: relatedProducts.map(rp => ({
      id: rp.id,
      name: rp.name,
      nameKey: rp.nameKey,
      slug: rp.slug,
      price: rp.price,
      purity: rp.purity,
    })),
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const transformedProduct = transformProductForClient(product);

  return <ProductPageClient product={transformedProduct} />;
}
