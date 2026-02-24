export const dynamic = 'force-dynamic';

/**
 * Admin Single Promo Code API
 * GET    - Get promo code detail with usage history
 * PUT    - Full update of promo code (form submission)
 * PATCH  - Partial update (toggle isActive)
 * DELETE - Delete promo code
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { updatePromoCodeSchema, patchPromoCodeSchema } from '@/lib/validations/promo-code';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET /api/admin/promo-codes/[id] - Get single promo code with usages
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params!.id;

    const promoCode = await prisma.promoCode.findUnique({
      where: { id },
      include: {
        usages: {
          orderBy: { usedAt: 'desc' },
          take: 50,
        },
        _count: {
          select: { usages: true },
        },
      },
    });

    if (!promoCode) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
    }

    // Fetch user details for usages
    const userIdSet = new Set(promoCode.usages.map((u) => u.userId));
    const userIds = Array.from(userIdSet);
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u] as const));

    return NextResponse.json({
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        description: promoCode.description,
        type: promoCode.type,
        value: Number(promoCode.value),
        minOrderAmount: promoCode.minOrderAmount ? Number(promoCode.minOrderAmount) : null,
        maxDiscount: promoCode.maxDiscount ? Number(promoCode.maxDiscount) : null,
        usageLimit: promoCode.usageLimit,
        usageLimitPerUser: promoCode.usageLimitPerUser,
        usageCount: promoCode.usageCount,
        startsAt: promoCode.startsAt?.toISOString() ?? null,
        endsAt: promoCode.endsAt?.toISOString() ?? null,
        firstOrderOnly: promoCode.firstOrderOnly,
        productIds: promoCode.productIds,
        categoryIds: promoCode.categoryIds,
        isActive: promoCode.isActive,
        createdAt: promoCode.createdAt.toISOString(),
        updatedAt: promoCode.updatedAt.toISOString(),
        _count: promoCode._count,
      },
      usages: promoCode.usages.map((u) => ({
        id: u.id,
        userId: u.userId,
        userName: userMap.get(u.userId)?.name ?? null,
        userEmail: userMap.get(u.userId)?.email ?? null,
        orderId: u.orderId,
        discount: Number(u.discount),
        usedAt: u.usedAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error('Admin promo-code GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PUT /api/admin/promo-codes/[id] - Full update (edit form)
export const PUT = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    // Validate with Zod
    const parsed = updatePromoCodeSchema.safeParse(body);
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

    const existing = await prisma.promoCode.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
    }

    // Check for duplicate code (excluding current)
    const upperCode = code.toUpperCase();
    if (upperCode !== existing.code) {
      const duplicate = await prisma.promoCode.findUnique({
        where: { code: upperCode },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A promo code with this code already exists' },
          { status: 409 }
        );
      }
    }

    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: {
        code: upperCode,
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
      action: 'UPDATE_PROMO_CODE',
      targetType: 'PromoCode',
      targetId: id,
      previousValue: { code: existing.code, type: existing.type, isActive: existing.isActive },
      newValue: { code: upperCode, type, value },
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
    });
  } catch (error) {
    logger.error('Admin promo-code PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/promo-codes/[id] - Partial update (toggle isActive, etc.)
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    // Validate with Zod
    const parsed = patchPromoCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const existing = await prisma.promoCode.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
    }

    // Build update data from validated fields only
    const updateData: Record<string, unknown> = {};

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    if (data.code !== undefined) {
      updateData.code = data.code.toUpperCase();
    }

    if (data.description !== undefined) {
      updateData.description = data.description || null;
    }

    if (data.type !== undefined) {
      updateData.type = data.type;
    }

    if (data.value !== undefined) {
      updateData.value = data.value;
    }

    if (data.minOrderAmount !== undefined) {
      updateData.minOrderAmount = data.minOrderAmount;
    }

    if (data.maxDiscount !== undefined) {
      updateData.maxDiscount = data.maxDiscount;
    }

    if (data.usageLimit !== undefined) {
      updateData.usageLimit = data.usageLimit;
    }

    if (data.usageLimitPerUser !== undefined) {
      updateData.usageLimitPerUser = data.usageLimitPerUser;
    }

    if (data.startsAt !== undefined) {
      updateData.startsAt = data.startsAt ? new Date(data.startsAt) : null;
    }

    if (data.endsAt !== undefined) {
      updateData.endsAt = data.endsAt ? new Date(data.endsAt) : null;
    }

    if (data.firstOrderOnly !== undefined) {
      updateData.firstOrderOnly = data.firstOrderOnly;
    }

    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: updateData,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_PROMO_CODE',
      targetType: 'PromoCode',
      targetId: id,
      previousValue: { code: existing.code, isActive: existing.isActive },
      newValue: updateData,
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
    });
  } catch (error) {
    logger.error('Admin promo-code PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/promo-codes/[id] - Delete promo code
export const DELETE = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.promoCode.findUnique({
      where: { id },
      include: {
        _count: { select: { usages: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
    }

    // If the promo code has been used, soft delete (deactivate) instead of hard delete
    if (existing._count.usages > 0) {
      await prisma.promoCode.update({
        where: { id },
        data: { isActive: false },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'DEACTIVATE_PROMO_CODE',
        targetType: 'PromoCode',
        targetId: id,
        previousValue: { code: existing.code, isActive: existing.isActive },
        newValue: { isActive: false, softDeleted: true },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        softDeleted: true,
        message: 'Promo code has usage history and was deactivated instead of deleted',
      });
    }

    // No usages - safe to hard delete
    await prisma.promoCode.delete({
      where: { id },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_PROMO_CODE',
      targetType: 'PromoCode',
      targetId: id,
      previousValue: { code: existing.code },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    logger.error('Admin promo-code DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
