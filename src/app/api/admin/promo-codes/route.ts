export const dynamic = 'force-dynamic';

/**
 * Admin Promo Codes API
 * GET  - List all promo codes with usage stats
 * POST - Create a new promo code
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { validateCsrf } from '@/lib/csrf-middleware';

// GET /api/admin/promo-codes - List all promo codes with usage counts
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const promoCodes = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { usages: true },
        },
      },
    });

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
      usageCount: pc.usageCount,
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

    return NextResponse.json({ promoCodes: serialized });
  } catch (error) {
    console.error('Admin promo-codes GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/promo-codes - Create a new promo code
export async function POST(request: NextRequest) {
  try {
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
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

    // For percentage, cap at 100
    if (type === 'PERCENTAGE' && value > 100) {
      return NextResponse.json(
        { error: 'Percentage value cannot exceed 100' },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
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
    console.error('Admin promo-codes POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
