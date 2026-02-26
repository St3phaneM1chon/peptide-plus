/**
 * Public API v1 - Products (list)
 * GET /api/v1/products - List products with pagination and filtering
 */

import { NextRequest } from 'next/server';
import { withApiAuth, jsonSuccess } from '@/lib/api/api-auth.middleware';
import { prisma } from '@/lib/db';

export const GET = withApiAuth(async (request: NextRequest) => {
  const url = new URL(request.url);

  // Pagination
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  // Filters
  const categoryId = url.searchParams.get('categoryId');
  const search = url.searchParams.get('search');
  const isActive = url.searchParams.get('isActive');
  const isFeatured = url.searchParams.get('isFeatured');
  const productType = url.searchParams.get('productType');
  const sortBy = url.searchParams.get('sortBy') || 'createdAt';
  const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (categoryId) where.categoryId = categoryId;
  if (isActive !== null && isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true';
  } else {
    where.isActive = true; // Default: only active products
  }
  if (isFeatured === 'true') where.isFeatured = true;
  if (productType) where.productType = productType;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Validate sortBy field
  const allowedSortFields = ['name', 'price', 'createdAt', 'updatedAt', 'purchaseCount', 'averageRating'];
  const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [orderByField]: sortOrder },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        productType: true,
        price: true,
        compareAtPrice: true,
        imageUrl: true,
        categoryId: true,
        sku: true,
        manufacturer: true,
        isActive: true,
        isFeatured: true,
        isBestseller: true,
        isNew: true,
        stockQuantity: true,
        averageRating: true,
        reviewCount: true,
        purchaseCount: true,
        weight: true,
        purity: true,
        molecularFormula: true,
        molecularWeight: true,
        casNumber: true,
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
            sku: true,
            inStock: true,
          },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return jsonSuccess(products, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}, 'products:read');
