/**
 * Public API v1 - Inventory (stock levels)
 * GET /api/v1/inventory - Get stock levels for all products (or filtered)
 */

import { NextRequest } from 'next/server';
import { withApiAuth, jsonSuccess } from '@/lib/api/api-auth.middleware';
import { prisma } from '@/lib/db';

export const GET = withApiAuth(async (request: NextRequest) => {
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const skip = (page - 1) * limit;

  const lowStock = url.searchParams.get('lowStock');
  const outOfStock = url.searchParams.get('outOfStock');
  const categoryId = url.searchParams.get('categoryId');
  const search = url.searchParams.get('search');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    isActive: true,
    trackInventory: true,
  };

  if (categoryId) where.categoryId = categoryId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (outOfStock === 'true') {
    where.stockQuantity = 0;
  } else if (lowStock === 'true') {
    // Low stock: quantity <= reorderPoint (or <= 5 if no reorder point)
    where.OR = [
      {
        AND: [
          { reorderPoint: { not: null } },
          { stockQuantity: { lte: 5 } },
        ],
      },
    ];
    // Simpler approach: just filter low stock as <= 10
    delete where.OR;
    where.stockQuantity = { lte: 10, gt: 0 };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { stockQuantity: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        stockQuantity: true,
        trackInventory: true,
        allowBackorder: true,
        reorderPoint: true,
        reorderQuantity: true,
        leadTimeDays: true,
        isActive: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        formats: {
          select: {
            id: true,
            name: true,
            sku: true,
            stockQuantity: true,
            inStock: true,
            lowStockThreshold: true,
            availability: true,
          },
          where: { isActive: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  // Compute summary statistics
  const allProducts = await prisma.product.aggregate({
    where: { isActive: true, trackInventory: true },
    _sum: { stockQuantity: true },
    _count: true,
  });

  const outOfStockCount = await prisma.product.count({
    where: { isActive: true, trackInventory: true, stockQuantity: 0 },
  });

  const lowStockCount = await prisma.product.count({
    where: { isActive: true, trackInventory: true, stockQuantity: { lte: 10, gt: 0 } },
  });

  return jsonSuccess(products, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    summary: {
      totalProducts: allProducts._count,
      totalStock: allProducts._sum.stockQuantity || 0,
      outOfStock: outOfStockCount,
      lowStock: lowStockCount,
    },
  });
}, 'inventory:read');
