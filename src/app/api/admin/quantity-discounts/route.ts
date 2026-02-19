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
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

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
    console.error('Error fetching quantity discounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quantity discounts' },
      { status: 500 }
    );
  }
});

// POST - Create or update quantity discounts for a product
export const POST = withAdminGuard(async (request, { session: _session }) => {
  try {
    const body = await request.json();
    const { productId, tiers } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(tiers)) {
      return NextResponse.json(
        { error: 'tiers must be an array' },
        { status: 400 }
      );
    }

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

    // Validate tiers
    for (const tier of tiers) {
      if (typeof tier.minQty !== 'number' || tier.minQty < 1) {
        return NextResponse.json(
          { error: 'Each tier must have a valid minQty (>= 1)' },
          { status: 400 }
        );
      }
      if (tier.maxQty !== null && tier.maxQty !== undefined && tier.maxQty < tier.minQty) {
        return NextResponse.json(
          { error: 'maxQty must be greater than or equal to minQty' },
          { status: 400 }
        );
      }
      if (typeof tier.discount !== 'number' || tier.discount < 0 || tier.discount > 100) {
        return NextResponse.json(
          { error: 'Discount must be between 0 and 100' },
          { status: 400 }
        );
      }
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

    return NextResponse.json({
      success: true,
      discounts: formattedDiscounts,
    });
  } catch (error) {
    console.error('Error creating/updating quantity discounts:', error);
    return NextResponse.json(
      { error: 'Failed to save quantity discounts' },
      { status: 500 }
    );
  }
});

// DELETE - Remove a specific quantity discount tier
export const DELETE = withAdminGuard(async (request, { session: _session }) => {
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

    return NextResponse.json({
      success: true,
      message: 'Quantity discount tier deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting quantity discount:', error);
    return NextResponse.json(
      { error: 'Failed to delete quantity discount' },
      { status: 500 }
    );
  }
});
