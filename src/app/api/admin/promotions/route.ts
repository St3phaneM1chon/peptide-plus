export const dynamic = 'force-dynamic';

/**
 * Admin Promotions/Discounts API
 * GET  - List all discounts with related category and product names
 * POST - Create a new discount/promotion
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { createPromotionSchema } from '@/lib/validations/promotion';

// GET /api/admin/promotions - List all promotions/discounts
export const GET = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [discounts, total] = await Promise.all([
      prisma.discount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.discount.count({ where }),
    ]);

    // Collect unique categoryIds and productIds for lookups
    const categoryIds = [
      ...new Set(discounts.map((d) => d.categoryId).filter(Boolean)),
    ] as string[];
    const productIds = [
      ...new Set(discounts.map((d) => d.productId).filter(Boolean)),
    ] as string[];

    // Batch fetch related names
    const [categories, products] = await Promise.all([
      categoryIds.length > 0
        ? prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [],
      productIds.length > 0
        ? prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    // Map to frontend-expected shape
    const promotions = discounts.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.appliesToAll
        ? 'FLASH_SALE'
        : d.categoryId
          ? 'CATEGORY_DISCOUNT'
          : d.productId
            ? 'PRODUCT_DISCOUNT'
            : 'PRODUCT_DISCOUNT',
      discountType: d.type,
      discountValue: Number(d.value),
      appliesToAll: d.appliesToAll,
      categoryId: d.categoryId,
      categoryName: d.categoryId ? categoryMap.get(d.categoryId) || null : null,
      productId: d.productId,
      productName: d.productId ? productMap.get(d.productId) || null : null,
      badge: d.badge,
      badgeColor: d.badgeColor,
      startsAt: d.startsAt?.toISOString() || null,
      endsAt: d.endsAt?.toISOString() || null,
      isActive: d.isActive,
      priority: 0,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      promotions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin promotions GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/promotions - Create a new promotion/discount
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = createPromotionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
      name,
      type,
      value,
      appliesToAll,
      categoryId,
      productId,
      badge,
      badgeColor,
      startsAt,
      endsAt,
      isActive,
    } = parsed.data;

    // Validate category exists if provided
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Validate product exists if provided
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!product) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }
    }

    const discount = await prisma.discount.create({
      data: {
        name: name.trim(),
        type: type || 'PERCENTAGE',
        value: Number(value),
        appliesToAll: appliesToAll ?? false,
        categoryId: categoryId || null,
        productId: productId || null,
        badge: badge || null,
        badgeColor: badgeColor || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        isActive: isActive ?? true,
      },
    });

    // Audit log for promotion creation (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_PROMOTION',
      targetType: 'Discount',
      targetId: discount.id,
      newValue: { name: discount.name, type: discount.type, value: Number(discount.value), appliesToAll: discount.appliesToAll, categoryId: discount.categoryId, productId: discount.productId, isActive: discount.isActive },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    // Fetch related names for response
    let categoryName: string | null = null;
    let productName: string | null = null;

    if (discount.categoryId) {
      const cat = await prisma.category.findUnique({
        where: { id: discount.categoryId },
        select: { name: true },
      });
      categoryName = cat?.name || null;
    }

    if (discount.productId) {
      const prod = await prisma.product.findUnique({
        where: { id: discount.productId },
        select: { name: true },
      });
      productName = prod?.name || null;
    }

    return NextResponse.json(
      {
        promotion: {
          id: discount.id,
          name: discount.name,
          type: discount.appliesToAll
            ? 'FLASH_SALE'
            : discount.categoryId
              ? 'CATEGORY_DISCOUNT'
              : discount.productId
                ? 'PRODUCT_DISCOUNT'
                : 'PRODUCT_DISCOUNT',
          discountType: discount.type,
          discountValue: Number(discount.value),
          appliesToAll: discount.appliesToAll,
          categoryId: discount.categoryId,
          categoryName,
          productId: discount.productId,
          productName,
          badge: discount.badge,
          badgeColor: discount.badgeColor,
          startsAt: discount.startsAt?.toISOString() || null,
          endsAt: discount.endsAt?.toISOString() || null,
          isActive: discount.isActive,
          priority: 0,
          createdAt: discount.createdAt.toISOString(),
          updatedAt: discount.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Admin promotions POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
