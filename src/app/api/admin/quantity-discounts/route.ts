export const dynamic = 'force-dynamic';

/**
 * Admin Quantity Discounts API
 * GET    - List quantity discounts for a product
 * POST   - Create or update quantity discounts for a product
 * DELETE - Remove a specific quantity discount tier
 *
 * TODO (item 83): Bulk Discount Rules Engine
 * Current implementation only supports simple percentage-based quantity tiers per product.
 * A full rules engine should support:
 *
 * 1. Discount Types (beyond percentage):
 *    - PERCENTAGE: X% off (current)
 *    - FIXED_AMOUNT: $X off per unit
 *    - FIXED_PRICE: Set unit price to $X (override)
 *    - FREE_SHIPPING: Free shipping when qty >= threshold
 *    - BUY_X_GET_Y: Buy X get Y free (e.g., buy 3 get 1 free)
 *    - BUNDLE_PRICE: Fixed price for a bundle of N items
 *
 * 2. Scope Targets (beyond per-product):
 *    - Per-product (current)
 *    - Per-category (apply to all products in a category)
 *    - Per-cart (total cart quantity across all products)
 *    - Cross-product bundles (buy product A + product B = 15% off)
 *    - Per-customer-tier (different discounts for GOLD vs SILVER)
 *
 * 3. Stacking Rules:
 *    - Define priority order for discount rules
 *    - Choose stacking behavior: BEST_ONLY, ADDITIVE, MULTIPLICATIVE
 *    - Mutual exclusion groups (can't combine certain discounts)
 *
 * 4. Time-based Rules:
 *    - Start/end dates for quantity discount tiers
 *    - Day-of-week restrictions (e.g., Tuesday special: buy 2 get 1 free)
 *    - Flash quantity deals (first 50 buyers at bulk price)
 *
 * Implementation:
 *    - New DiscountRule model with:
 *      id, name, type (enum), scope (PRODUCT/CATEGORY/CART/BUNDLE),
 *      targetId (productId or categoryId), conditions (JSON),
 *      discount (JSON: { type, value, freeQty? }),
 *      priority, stackGroup?, startsAt?, endsAt?, isActive
 *    - Rules evaluation engine in @/lib/discount-engine.ts
 *    - Endpoint: /api/admin/discount-rules (CRUD)
 *    - Evaluation: /api/cart/calculate-discounts (called by checkout)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const quantityDiscountTierSchema = z.object({
  minQty: z.number().int().min(1, 'Each tier must have a valid minQty (>= 1)'),
  maxQty: z.number().int().min(1).nullable().optional(),
  discount: z.number().min(0, 'Discount must be between 0 and 100').max(100, 'Discount must be between 0 and 100'),
});

const createQuantityDiscountsSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  tiers: z.array(quantityDiscountTierSchema),
}).refine((data) => {
  // Validate that maxQty >= minQty for each tier
  for (const tier of data.tiers) {
    if (tier.maxQty !== null && tier.maxQty !== undefined && tier.maxQty < tier.minQty) {
      return false;
    }
  }
  return true;
}, { message: 'maxQty must be greater than or equal to minQty' });

// GET - List quantity discounts for a product
export const GET = withAdminGuard(async (request, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const discounts = await prisma.quantityDiscount.findMany({
      where: { productId },
      orderBy: { minQty: 'asc' },
    });

    // Convert Decimal to number for JSON serialization
    const formattedDiscounts = discounts.map(d => ({
      ...d,
      discount: Number(d.discount),
    }));

    return NextResponse.json({ discounts: formattedDiscounts });
  } catch (error) {
    logger.error('Error fetching quantity discounts', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch quantity discounts' },
      { status: 500 }
    );
  }
});

// POST - Create or update quantity discounts for a product
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();

    const parsed = createQuantityDiscountsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { productId, tiers } = parsed.data;

    // Validate product exists
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

    // Delete existing tiers and create new ones (replace all)
    await prisma.$transaction(async (tx) => {
      // Delete existing tiers
      await tx.quantityDiscount.deleteMany({
        where: { productId },
      });

      // Create new tiers
      if (tiers.length > 0) {
        await tx.quantityDiscount.createMany({
          data: tiers.map((tier: { minQty: number; maxQty?: number | null; discount: number }) => ({
            productId,
            minQty: tier.minQty,
            maxQty: tier.maxQty ?? null,
            discount: tier.discount,
          })),
        });
      }
    });

    // Fetch and return the updated tiers
    const updatedDiscounts = await prisma.quantityDiscount.findMany({
      where: { productId },
      orderBy: { minQty: 'asc' },
    });

    const formattedDiscounts = updatedDiscounts.map(d => ({
      ...d,
      discount: Number(d.discount),
    }));

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_QUANTITY_DISCOUNTS',
      targetType: 'QuantityDiscount',
      targetId: productId,
      newValue: { productId, tierCount: tiers.length },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      discounts: formattedDiscounts,
    });
  } catch (error) {
    logger.error('Error creating/updating quantity discounts', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to save quantity discounts' },
      { status: 500 }
    );
  }
});

// DELETE - Remove a specific quantity discount tier
export const DELETE = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    await prisma.quantityDiscount.delete({
      where: { id },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_QUANTITY_DISCOUNT',
      targetType: 'QuantityDiscount',
      targetId: id,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Quantity discount tier deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting quantity discount', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to delete quantity discount' },
      { status: 500 }
    );
  }
});
