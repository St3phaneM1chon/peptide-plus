/**
 * Public API v1 - Products (single)
 * GET /api/v1/products/:id - Get a single product by ID or slug
 */

import { NextRequest } from 'next/server';
import { withApiAuth, jsonSuccess, jsonError } from '@/lib/api/api-auth.middleware';
import { prisma } from '@/lib/db';

export const GET = withApiAuth(async (_request: NextRequest, { params }) => {
  const id = params?.id;
  if (!id) {
    return jsonError('Product ID is required', 400);
  }

  // Try finding by ID first, then by slug
  const product = await prisma.product.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      subtitle: true,
      slug: true,
      shortDescription: true,
      description: true,
      fullDetails: true,
      specifications: true,
      productType: true,
      price: true,
      compareAtPrice: true,
      imageUrl: true,
      videoUrl: true,
      certificateUrl: true,
      certificateName: true,
      dataSheetUrl: true,
      dataSheetName: true,
      categoryId: true,
      weight: true,
      dimensions: true,
      requiresShipping: true,
      sku: true,
      barcode: true,
      manufacturer: true,
      origin: true,
      isActive: true,
      isFeatured: true,
      isBestseller: true,
      isNew: true,
      stockQuantity: true,
      trackInventory: true,
      allowBackorder: true,
      averageRating: true,
      reviewCount: true,
      purchaseCount: true,
      purity: true,
      molecularFormula: true,
      molecularWeight: true,
      casNumber: true,
      aminoSequence: true,
      storageConditions: true,
      tags: true,
      metaTitle: true,
      metaDescription: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      formats: {
        select: {
          id: true,
          name: true,
          price: true,
          comparePrice: true,
          sku: true,
          inStock: true,
          stockQuantity: true,
          weightGrams: true,
          dosageMg: true,
          volumeMl: true,
          sortOrder: true,
          isActive: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
      images: {
        select: {
          id: true,
          url: true,
          alt: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
      quantityDiscounts: {
        select: {
          id: true,
          minQty: true,
          maxQty: true,
          discount: true,
        },
        orderBy: { minQty: 'asc' },
      },
    },
  });

  if (!product) {
    return jsonError('Product not found', 404);
  }

  return jsonSuccess(product);
}, 'products:read');
