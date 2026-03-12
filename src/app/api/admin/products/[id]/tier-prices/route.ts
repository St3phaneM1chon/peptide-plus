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

    const basePriceNum = Number(product.price);

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        basePrice: basePriceNum,
      },
      // A8-P2-002: Clarify that tier prices are absolute values, not percentage discounts.
      // Each entry includes computed savings vs. base price for admin clarity.
      priceType: 'absolute',
      tierPrices: tierPrices.map(tp => {
        const tpNum = Number(tp.price);
        const savingsAmt = basePriceNum - tpNum;
        const savingsPct = basePriceNum > 0 ? ((savingsAmt / basePriceNum) * 100) : 0;

        return {
          id: tp.id,
          tierName: tp.tierName,
          price: tpNum,
          priceType: 'absolute',                                        // A8-P2-002: explicit label
          savingsAmount: Math.max(0, Number(savingsAmt.toFixed(2))),     // A8-P2-002: computed savings
          savingsPercent: Math.max(0, Number(savingsPct.toFixed(2))),    // A8-P2-002: computed discount %
          active: tp.active,
          startDate: tp.startDate.toISOString(),
          endDate: tp.endDate?.toISOString() ?? null,
          tierDefaultDiscountPercent: Number(tp.tier.discountPercent),   // renamed for clarity
          tierPriority: tp.tier.priority,
          warning: tpNum >= basePriceNum
            ? 'Tier price is >= base price — customers see no savings'
            : undefined,
          createdAt: tp.createdAt.toISOString(),
          updatedAt: tp.updatedAt.toISOString(),
        };
      }),
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

    // Verify product exists (include price for tier-price validation — A8-P2-002)
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true },
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

    // A8-P2-002: Warn (but allow) when tier price >= base price — likely a data-entry error
    const basePrice = product.price ? Number(product.price) : null;
    let warning: string | undefined;
    if (basePrice !== null && parsed.data.price >= basePrice) {
      warning =
        `Tier price (${parsed.data.price}) is >= base product price (${basePrice}). ` +
        `Tier prices are absolute prices, not discounts. Customers in this tier will see no savings.`;
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

    // A8-P2-002: Include pricing context so admins understand the relationship
    const tierPriceNum = Number(tierPrice.price);
    const basePriceNum = basePrice ?? 0;
    const savingsAmount = basePriceNum - tierPriceNum;
    const savingsPercent = basePriceNum > 0 ? ((savingsAmount / basePriceNum) * 100) : 0;

    return NextResponse.json(
      {
        tierPrice: {
          id: tierPrice.id,
          productId: tierPrice.productId,
          tierName: tierPrice.tierName,
          price: tierPriceNum,
          priceType: 'absolute',          // A8-P2-002: Clarify this is an absolute price, not a discount
          basePrice: basePriceNum,         // A8-P2-002: Include base price for comparison
          savingsAmount: Math.max(0, Number(savingsAmount.toFixed(2))),
          savingsPercent: Math.max(0, Number(savingsPercent.toFixed(2))),
          active: tierPrice.active,
          startDate: tierPrice.startDate.toISOString(),
          endDate: tierPrice.endDate?.toISOString() ?? null,
        },
        ...(warning && { warning }),      // A8-P2-002: Surface warning if tier price >= base price
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
