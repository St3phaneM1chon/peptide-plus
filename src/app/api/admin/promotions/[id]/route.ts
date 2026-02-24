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
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { patchPromotionSchema } from '@/lib/validations/promotion';
import { logger } from '@/lib/logger';

// FIX: FLAW-028 - Fetch category/product names in parallel instead of sequential N+1 queries.
// Note: Discount model lacks @relation directives (FLAW-040), so we use Promise.all instead of include.
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
  // Parallel fetch instead of sequential to reduce latency
  const [category, product] = await Promise.all([
    discount.categoryId
      ? prisma.category.findUnique({ where: { id: discount.categoryId }, select: { name: true } })
      : null,
    discount.productId
      ? prisma.product.findUnique({ where: { id: discount.productId }, select: { name: true } })
      : null,
  ]);

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
    categoryName: category?.name || null,
    productId: discount.productId,
    productName: product?.name || null,
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
export const GET = withAdminGuard(async (_request, { params }) => {
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
    logger.error('Admin promotion GET error', { error: error instanceof Error ? error.message : String(error) });
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

    // Validate with Zod
    const parsed = patchPromotionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

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

    // Cross-field validation: percentage cap check
    if (data.value !== undefined) {
      const effectiveType = data.type || existing.type;
      if (effectiveType === 'PERCENTAGE' && data.value > 100) {
        return NextResponse.json(
          { error: 'Percentage discount cannot exceed 100%' },
          { status: 400 }
        );
      }
    }

    // Build update data from validated fields
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.type !== undefined) {
      updateData.type = data.type;
    }

    if (data.value !== undefined) {
      updateData.value = data.value;
    }

    if (data.appliesToAll !== undefined) {
      updateData.appliesToAll = data.appliesToAll;
    }

    if (data.categoryId !== undefined) {
      if (data.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId },
          select: { id: true },
        });
        if (!category) {
          return NextResponse.json(
            { error: 'Category not found' },
            { status: 404 }
          );
        }
      }
      updateData.categoryId = data.categoryId || null;
    }

    if (data.productId !== undefined) {
      if (data.productId) {
        const product = await prisma.product.findUnique({
          where: { id: data.productId },
          select: { id: true },
        });
        if (!product) {
          return NextResponse.json(
            { error: 'Product not found' },
            { status: 404 }
          );
        }
      }
      updateData.productId = data.productId || null;
    }

    if (data.badge !== undefined) {
      updateData.badge = data.badge || null;
    }

    if (data.badgeColor !== undefined) {
      updateData.badgeColor = data.badgeColor || null;
    }

    if (data.startsAt !== undefined) {
      updateData.startsAt = data.startsAt ? new Date(data.startsAt) : null;
    }

    if (data.endsAt !== undefined) {
      updateData.endsAt = data.endsAt ? new Date(data.endsAt) : null;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    // Perform update
    const discount = await prisma.discount.update({
      where: { id },
      data: updateData,
    });

    // Audit log for promotion update (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_PROMOTION',
      targetType: 'Discount',
      targetId: id,
      previousValue: { name: existing.name, type: existing.type, value: Number(existing.value), isActive: existing.isActive },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    const promotion = await mapDiscountToPromotion(discount);

    return NextResponse.json({ promotion });
  } catch (error) {
    logger.error('Admin promotion PATCH error', { error: error instanceof Error ? error.message : String(error) });
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

    // Audit log for promotion deletion (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_PROMOTION',
      targetType: 'Discount',
      targetId: id,
      previousValue: { name: existing.name },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Promotion "${existing.name}" deleted`,
    });
  } catch (error) {
    logger.error('Admin promotion DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
