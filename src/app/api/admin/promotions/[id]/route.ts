export const dynamic = 'force-dynamic';

/**
 * Admin Single Promotion/Discount API
 * GET    - Get promotion detail with related category/product names
 * PATCH  - Update promotion fields
 * DELETE - Delete a promotion
 *
 * TODO (item 77): Scheduled Price Changes
 * Add scheduled pricing capabilities beyond the current startsAt/endsAt promo dates:
 *   - New model ScheduledPriceChange with fields:
 *     id, productId, formatId?, newPrice, newCompareAtPrice?,
 *     scheduledAt (when to apply), appliedAt (when actually applied),
 *     revertAt (optional: auto-revert date), revertedAt, status (PENDING/APPLIED/REVERTED),
 *     createdBy, reason
 *   - CRUD endpoint: /api/admin/products/[id]/scheduled-prices
 *   - Cron job /api/cron/apply-price-changes that runs every 15 minutes:
 *     1. Find all PENDING changes where scheduledAt <= NOW()
 *     2. Update product/format price
 *     3. Mark as APPLIED
 *     4. Find all APPLIED changes where revertAt <= NOW()
 *     5. Restore original price
 *     6. Mark as REVERTED
 *     7. Create AuditLog entries for each change
 *   - Use cases: seasonal sales, flash sales that auto-start/end,
 *     MAP compliance (minimum advertised price at specific times),
 *     price matching with competitors on a schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

// Helper: map a Discount record to the frontend promotion shape
async function mapDiscountToPromotion(discount: {
  id: string;
  name: string;
  type: string;
  value: unknown;
  appliesToAll: boolean;
  categoryId: string | null;
  productId: string | null;
  badge: string | null;
  badgeColor: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
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

  return {
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
  };
}

// GET /api/admin/promotions/[id] - Get single promotion detail
export const GET = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const discount = await prisma.discount.findUnique({
      where: { id },
    });

    if (!discount) {
      return NextResponse.json(
        { error: 'Promotion not found' },
        { status: 404 }
      );
    }

    const promotion = await mapDiscountToPromotion(discount);

    return NextResponse.json({ promotion });
  } catch (error) {
    console.error('Admin promotion GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/promotions/[id] - Update promotion
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    // Verify discount exists
    const existing = await prisma.discount.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Promotion not found' },
        { status: 404 }
      );
    }

    // Build update data from allowed fields
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (!body.name || body.name.trim() === '') {
        return NextResponse.json(
          { error: 'Name cannot be empty' },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.type !== undefined) {
      const validTypes = ['PERCENTAGE', 'FIXED_AMOUNT'];
      if (!validTypes.includes(body.type)) {
        return NextResponse.json(
          { error: `Invalid discount type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.type = body.type;
    }

    if (body.value !== undefined) {
      if (Number(body.value) < 0) {
        return NextResponse.json(
          { error: 'Discount value cannot be negative' },
          { status: 400 }
        );
      }
      // Check percentage cap
      const effectiveType = body.type || existing.type;
      if (effectiveType === 'PERCENTAGE' && Number(body.value) > 100) {
        return NextResponse.json(
          { error: 'Percentage discount cannot exceed 100%' },
          { status: 400 }
        );
      }
      updateData.value = Number(body.value);
    }

    if (body.appliesToAll !== undefined) {
      updateData.appliesToAll = Boolean(body.appliesToAll);
    }

    if (body.categoryId !== undefined) {
      if (body.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: body.categoryId },
          select: { id: true },
        });
        if (!category) {
          return NextResponse.json(
            { error: 'Category not found' },
            { status: 404 }
          );
        }
      }
      updateData.categoryId = body.categoryId || null;
    }

    if (body.productId !== undefined) {
      if (body.productId) {
        const product = await prisma.product.findUnique({
          where: { id: body.productId },
          select: { id: true },
        });
        if (!product) {
          return NextResponse.json(
            { error: 'Product not found' },
            { status: 404 }
          );
        }
      }
      updateData.productId = body.productId || null;
    }

    if (body.badge !== undefined) {
      updateData.badge = body.badge || null;
    }

    if (body.badgeColor !== undefined) {
      updateData.badgeColor = body.badgeColor || null;
    }

    if (body.startsAt !== undefined) {
      updateData.startsAt = body.startsAt ? new Date(body.startsAt) : null;
    }

    if (body.endsAt !== undefined) {
      updateData.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
    }

    // Perform update
    const discount = await prisma.discount.update({
      where: { id },
      data: updateData,
    });

    const promotion = await mapDiscountToPromotion(discount);

    return NextResponse.json({ promotion });
  } catch (error) {
    console.error('Admin promotion PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/promotions/[id] - Delete a promotion
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    // Verify discount exists
    const existing = await prisma.discount.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Promotion not found' },
        { status: 404 }
      );
    }

    await prisma.discount.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Promotion "${existing.name}" deleted`,
    });
  } catch (error) {
    console.error('Admin promotion DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
