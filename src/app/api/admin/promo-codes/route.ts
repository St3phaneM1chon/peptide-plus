export const dynamic = 'force-dynamic';

// FIXED: F-073 - usageCount now derived from _count.usages (relational count) as single source of truth

/**
 * Admin Promo Codes API
 * GET  - List all promo codes with usage stats
 * POST - Create a new promo code
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { createPromoCodeSchema } from '@/lib/validations/promo-code';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET /api/admin/promo-codes - List all promo codes with usage counts
export const GET = withAdminGuard(async (request, _ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    const [promoCodes, total] = await Promise.all([
      prisma.promoCode.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          description: true,
          type: true,
          value: true,
          minOrderAmount: true,
          maxDiscount: true,
          usageLimit: true,
          usageLimitPerUser: true,
          usageCount: true,
          startsAt: true,
          endsAt: true,
          firstOrderOnly: true,
          productIds: true,
          categoryIds: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { usages: true },
          },
        },
        skip,
        take: limit,
      }),
      prisma.promoCode.count(),
    ]);

    // Convert Decimal fields to numbers for JSON serialization
    const serialized = promoCodes.map((pc) => ({
      id: pc.id,
      code: pc.code,
      description: pc.description,
      type: pc.type,
      value: Number(pc.value),
      minOrderAmount: pc.minOrderAmount ? Number(pc.minOrderAmount) : null,
      maxDiscount: pc.maxDiscount ? Number(pc.maxDiscount) : null,
      usageLimit: pc.usageLimit,
      usageLimitPerUser: pc.usageLimitPerUser,
      // FIX: F-073 - Prefer _count.usages as single source of truth; fall back to usageCount field if no usages relation
      usageCount: pc._count?.usages ?? pc.usageCount,
      startsAt: pc.startsAt?.toISOString() ?? null,
      endsAt: pc.endsAt?.toISOString() ?? null,
      firstOrderOnly: pc.firstOrderOnly,
      productIds: pc.productIds,
      categoryIds: pc.categoryIds,
      isActive: pc.isActive,
      createdAt: pc.createdAt.toISOString(),
      updatedAt: pc.updatedAt.toISOString(),
      _count: pc._count,
    }));

    return NextResponse.json({
      promoCodes: serialized,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Admin promo-codes GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/promo-codes - Create a new promo code
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = createPromoCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
      code,
      description,
      type,
      value,
      minOrderAmount,
      maxDiscount,
      usageLimit,
      usageLimitPerUser,
      startsAt,
      endsAt,
      firstOrderOnly,
      productIds,
      categoryIds,
    } = parsed.data;

    // Check for duplicate code
    const existing = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A promo code with this code already exists' },
        { status: 409 }
      );
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        description: description || null,
        type,
        value,
        minOrderAmount: minOrderAmount ?? null,
        maxDiscount: maxDiscount ?? null,
        usageLimit: usageLimit ?? null,
        usageLimitPerUser: usageLimitPerUser ?? null,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        firstOrderOnly: firstOrderOnly ?? false,
        productIds: productIds ?? null,
        categoryIds: categoryIds ?? null,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_PROMO_CODE',
      targetType: 'PromoCode',
      targetId: promoCode.id,
      newValue: { code: promoCode.code, type, value, isActive: true },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      promoCode: {
        ...promoCode,
        value: Number(promoCode.value),
        minOrderAmount: promoCode.minOrderAmount ? Number(promoCode.minOrderAmount) : null,
        maxDiscount: promoCode.maxDiscount ? Number(promoCode.maxDiscount) : null,
        startsAt: promoCode.startsAt?.toISOString() ?? null,
        endsAt: promoCode.endsAt?.toISOString() ?? null,
        createdAt: promoCode.createdAt.toISOString(),
        updatedAt: promoCode.updatedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('Admin promo-codes POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
