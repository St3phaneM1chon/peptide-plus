export const dynamic = 'force-dynamic';

/**
 * Admin Product Tier Prices API
 * GET  - Get all tier prices for a product
 * POST - Set/update a tier price for a product (upsert by productId + tierName)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const setTierPriceSchema = z.object({
  tierName: z.string().min(1).max(50).toUpperCase(),
  price: z.number().min(0),
  active: z.boolean().optional().default(true),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/admin/products/[id]/tier-prices
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const productId = params?.id as string;
    if (!productId) {
      return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const tierPrices = await prisma.productTierPrice.findMany({
      where: { productId },
      include: {
        tier: {
          select: { name: true, discountPercent: true, priority: true },
        },
      },
      orderBy: { tier: { priority: 'asc' } },
    });

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        basePrice: Number(product.price),
      },
      tierPrices: tierPrices.map(tp => ({
        id: tp.id,
        tierName: tp.tierName,
        price: Number(tp.price),
        active: tp.active,
        startDate: tp.startDate.toISOString(),
        endDate: tp.endDate?.toISOString() ?? null,
        tierDiscountPercent: Number(tp.tier.discountPercent),
        tierPriority: tp.tier.priority,
        createdAt: tp.createdAt.toISOString(),
        updatedAt: tp.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error('Admin product tier-prices GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { requiredPermission: 'products.edit' });

// ---------------------------------------------------------------------------
// POST /api/admin/products/[id]/tier-prices
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const productId = params?.id as string;
    if (!productId) {
      return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = setTierPriceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Verify tier config exists
    const tierConfig = await prisma.loyaltyTierConfig.findUnique({
      where: { name: parsed.data.tierName },
    });

    if (!tierConfig) {
      return NextResponse.json(
        { error: `Tier config '${parsed.data.tierName}' not found. Create it first.` },
        { status: 400 }
      );
    }

    const tierPrice = await prisma.productTierPrice.upsert({
      where: {
        productId_tierName: {
          productId,
          tierName: parsed.data.tierName,
        },
      },
      update: {
        price: parsed.data.price,
        active: parsed.data.active,
        ...(parsed.data.startDate && { startDate: new Date(parsed.data.startDate) }),
        ...(parsed.data.endDate !== undefined && {
          endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        }),
      },
      create: {
        productId,
        tierName: parsed.data.tierName,
        price: parsed.data.price,
        active: parsed.data.active,
        ...(parsed.data.startDate && { startDate: new Date(parsed.data.startDate) }),
        ...(parsed.data.endDate !== undefined && {
          endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        }),
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'SET_PRODUCT_TIER_PRICE',
      targetType: 'ProductTierPrice',
      targetId: tierPrice.id,
      newValue: {
        productId,
        productName: product.name,
        tierName: parsed.data.tierName,
        price: Number(tierPrice.price),
        active: tierPrice.active,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) =>
      logger.error('Audit log failed for SET_PRODUCT_TIER_PRICE', {
        error: err instanceof Error ? err.message : String(err),
      })
    );

    return NextResponse.json(
      {
        tierPrice: {
          id: tierPrice.id,
          productId: tierPrice.productId,
          tierName: tierPrice.tierName,
          price: Number(tierPrice.price),
          active: tierPrice.active,
          startDate: tierPrice.startDate.toISOString(),
          endDate: tierPrice.endDate?.toISOString() ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Admin product tier-prices POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { requiredPermission: 'products.edit' });
