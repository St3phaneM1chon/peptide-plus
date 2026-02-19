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

// GET /api/admin/promo-codes/[id] - Get single promo code with usages
export const GET = withAdminGuard(async (_request, { session, params }) => {
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
    console.error('Admin promo-code GET error:', error);
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

    const existing = await prisma.promoCode.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
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
    } = body;

    // Validate required fields
    if (!code || !type || value === undefined || value === null) {
      return NextResponse.json(
        { error: 'code, type, and value are required' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['PERCENTAGE', 'FIXED_AMOUNT'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be PERCENTAGE or FIXED_AMOUNT' },
        { status: 400 }
      );
    }

    // Validate value
    if (typeof value !== 'number' || value <= 0) {
      return NextResponse.json(
        { error: 'value must be a positive number' },
        { status: 400 }
      );
    }

    if (type === 'PERCENTAGE' && value > 100) {
      return NextResponse.json(
        { error: 'Percentage value cannot exceed 100' },
        { status: 400 }
      );
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
    console.error('Admin promo-code PUT error:', error);
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

    const existing = await prisma.promoCode.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
    }

    // Build update data from provided fields only
    const updateData: Record<string, unknown> = {};

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    if (body.code !== undefined) {
      updateData.code = body.code.toUpperCase();
    }

    if (body.description !== undefined) {
      updateData.description = body.description || null;
    }

    if (body.type !== undefined) {
      if (!['PERCENTAGE', 'FIXED_AMOUNT'].includes(body.type)) {
        return NextResponse.json(
          { error: 'type must be PERCENTAGE or FIXED_AMOUNT' },
          { status: 400 }
        );
      }
      updateData.type = body.type;
    }

    if (body.value !== undefined) {
      updateData.value = body.value;
    }

    if (body.minOrderAmount !== undefined) {
      updateData.minOrderAmount = body.minOrderAmount;
    }

    if (body.maxDiscount !== undefined) {
      updateData.maxDiscount = body.maxDiscount;
    }

    if (body.usageLimit !== undefined) {
      updateData.usageLimit = body.usageLimit;
    }

    if (body.usageLimitPerUser !== undefined) {
      updateData.usageLimitPerUser = body.usageLimitPerUser;
    }

    if (body.startsAt !== undefined) {
      updateData.startsAt = body.startsAt ? new Date(body.startsAt) : null;
    }

    if (body.endsAt !== undefined) {
      updateData.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    }

    if (body.firstOrderOnly !== undefined) {
      updateData.firstOrderOnly = body.firstOrderOnly;
    }

    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: updateData,
    });

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
    console.error('Admin promo-code PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/promo-codes/[id] - Delete promo code
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
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

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Admin promo-code DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
