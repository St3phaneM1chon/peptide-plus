export const dynamic = 'force-dynamic';

/**
 * Order Split API (Partial Shipments)
 * POST /api/admin/orders/[id]/split
 *
 * Creates a new "child" order linked via parentOrderId.
 * Transfers specified items (or partial quantities) to the new order.
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

const splitItemSchema = z.object({
  orderItemId: z.string().min(1),
  quantity: z.number().int().min(1),
}).strict();

const splitOrderSchema = z.object({
  items: z.array(splitItemSchema).min(1).max(100),
}).strict();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a split order number based on the parent: e.g. ORD-001 -> ORD-001-S1 */
async function generateSplitOrderNumber(parentOrderNumber: string): Promise<string> {
  const existing = await prisma.order.count({
    where: { parentOrderId: { not: null }, orderNumber: { startsWith: parentOrderNumber + '-S' } },
  });
  return `${parentOrderNumber}-S${existing + 1}`;
}

// ---------------------------------------------------------------------------
// POST /api/admin/orders/[id]/split
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const parentId = params!.id;

    const body = await request.json();
    const parsed = splitOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed' },
        { status: 400 }
      );
    }

    const { items: splitItems } = parsed.data;

    // Fetch the parent order with its items
    const parentOrder = await prisma.order.findUnique({
      where: { id: parentId },
      include: { items: true },
    });

    if (!parentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only allow splitting from non-terminal states
    const terminalStates = ['CANCELLED', 'REFUNDED', 'DELIVERED'];
    if (terminalStates.includes(parentOrder.status)) {
      return NextResponse.json(
        { error: `Cannot split order in ${parentOrder.status} status` },
        { status: 400 }
      );
    }

    // Validate each split item exists in the parent order and has sufficient quantity
    const parentItemMap = new Map(parentOrder.items.map((item) => [item.id, item]));
    const errors: string[] = [];
    const validatedItems: Array<{
      parentItem: typeof parentOrder.items[0];
      splitQuantity: number;
    }> = [];

    for (const splitItem of splitItems) {
      const parentItem = parentItemMap.get(splitItem.orderItemId);
      if (!parentItem) {
        errors.push(`Order item ${splitItem.orderItemId} not found in this order`);
        continue;
      }
      if (splitItem.quantity > parentItem.quantity) {
        errors.push(
          `Cannot split ${splitItem.quantity} of item ${parentItem.productName} (only ${parentItem.quantity} available)`
        );
        continue;
      }
      if (splitItem.quantity === parentItem.quantity) {
        // Full transfer is OK but we need to ensure at least one item stays on the parent
        validatedItems.push({ parentItem, splitQuantity: splitItem.quantity });
      } else {
        validatedItems.push({ parentItem, splitQuantity: splitItem.quantity });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation errors', details: errors }, { status: 400 });
    }

    // Ensure the parent order retains at least one item (or partial quantity)
    const allItemIds = new Set(parentOrder.items.map((i) => i.id));
    const fullyTransferredIds = new Set(
      validatedItems.filter((v) => v.splitQuantity === v.parentItem.quantity).map((v) => v.parentItem.id)
    );
    const remainingItemCount = allItemIds.size - fullyTransferredIds.size;
    const hasPartialSplits = validatedItems.some((v) => v.splitQuantity < v.parentItem.quantity);

    if (remainingItemCount === 0 && !hasPartialSplits) {
      return NextResponse.json(
        { error: 'Cannot transfer all items. Parent order must retain at least one item.' },
        { status: 400 }
      );
    }

    // Calculate totals for the new child order
    let childSubtotal = 0;
    for (const { parentItem, splitQuantity } of validatedItems) {
      childSubtotal += Number(parentItem.unitPrice) * splitQuantity;
    }

    // Proportion-based tax/shipping calculation
    const parentSubtotal = Number(parentOrder.subtotal);
    const ratio = parentSubtotal > 0 ? childSubtotal / parentSubtotal : 0;
    const childShipping = Number(parentOrder.shippingCost) * ratio;
    const childTax = Number(parentOrder.tax) * ratio;
    const childTaxTps = Number(parentOrder.taxTps) * ratio;
    const childTaxTvq = Number(parentOrder.taxTvq) * ratio;
    const childTaxTvh = Number(parentOrder.taxTvh) * ratio;
    const childTaxPst = Number(parentOrder.taxPst) * ratio;
    const childDiscount = Number(parentOrder.discount) * ratio;
    const childTotal = childSubtotal + childShipping + childTax - childDiscount;

    const splitOrderNumber = await generateSplitOrderNumber(parentOrder.orderNumber);

    // Execute in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the child order
      const childOrder = await tx.order.create({
        data: {
          orderNumber: splitOrderNumber,
          userId: parentOrder.userId,
          subtotal: childSubtotal,
          shippingCost: childShipping,
          discount: childDiscount,
          tax: childTax,
          total: childTotal,
          currencyId: parentOrder.currencyId,
          exchangeRate: parentOrder.exchangeRate,
          paymentMethod: parentOrder.paymentMethod,
          paymentStatus: parentOrder.paymentStatus,
          status: parentOrder.status,
          shippingName: parentOrder.shippingName,
          shippingAddress1: parentOrder.shippingAddress1,
          shippingAddress2: parentOrder.shippingAddress2,
          shippingCity: parentOrder.shippingCity,
          shippingState: parentOrder.shippingState,
          shippingPostal: parentOrder.shippingPostal,
          shippingCountry: parentOrder.shippingCountry,
          shippingPhone: parentOrder.shippingPhone,
          customerNotes: parentOrder.customerNotes,
          adminNotes: `Split from ${parentOrder.orderNumber}`,
          orderType: 'SPLIT',
          parentOrderId: parentOrder.id,
          taxTps: childTaxTps,
          taxTvq: childTaxTvq,
          taxTvh: childTaxTvh,
          taxPst: childTaxPst,
          billingName: parentOrder.billingName,
          billingAddress1: parentOrder.billingAddress1,
          billingAddress2: parentOrder.billingAddress2,
          billingCity: parentOrder.billingCity,
          billingState: parentOrder.billingState,
          billingPostal: parentOrder.billingPostal,
          billingCountry: parentOrder.billingCountry,
          billingSameAsShipping: parentOrder.billingSameAsShipping,
        },
      });

      // 2. Create items on the child order and adjust parent items
      // N+1 fix: run all child item creates in parallel, then all parent adjustments in parallel
      await Promise.all(
        validatedItems.map(({ parentItem, splitQuantity }) =>
          tx.orderItem.create({
            data: {
              orderId: childOrder.id,
              productId: parentItem.productId,
              optionId: parentItem.optionId,
              productName: parentItem.productName,
              optionName: parentItem.optionName,
              sku: parentItem.sku,
              quantity: splitQuantity,
              unitPrice: parentItem.unitPrice,
              discount: Number(parentItem.discount) * (splitQuantity / parentItem.quantity),
              total: Number(parentItem.unitPrice) * splitQuantity,
            },
          })
        )
      );

      await Promise.all(
        validatedItems.map(({ parentItem, splitQuantity }) => {
          if (splitQuantity === parentItem.quantity) {
            // Full transfer: delete from parent
            return tx.orderItem.delete({ where: { id: parentItem.id } });
          } else {
            // Partial transfer: reduce quantity on parent
            const remainingQty = parentItem.quantity - splitQuantity;
            return tx.orderItem.update({
              where: { id: parentItem.id },
              data: {
                quantity: remainingQty,
                total: Number(parentItem.unitPrice) * remainingQty,
                discount: Number(parentItem.discount) * (remainingQty / parentItem.quantity),
              },
            });
          }
        })
      );

      // 3. Recalculate parent order totals
      const remainingItems = await tx.orderItem.findMany({
        where: { orderId: parentOrder.id },
      });

      const newParentSubtotal = remainingItems.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0
      );
      const parentRatio = parentSubtotal > 0 ? newParentSubtotal / parentSubtotal : 0;

      await tx.order.update({
        where: { id: parentOrder.id },
        data: {
          subtotal: newParentSubtotal,
          shippingCost: Number(parentOrder.shippingCost) * parentRatio,
          discount: Number(parentOrder.discount) * parentRatio,
          tax: Number(parentOrder.tax) * parentRatio,
          total: newParentSubtotal + Number(parentOrder.shippingCost) * parentRatio +
            Number(parentOrder.tax) * parentRatio - Number(parentOrder.discount) * parentRatio,
          taxTps: Number(parentOrder.taxTps) * parentRatio,
          taxTvq: Number(parentOrder.taxTvq) * parentRatio,
          taxTvh: Number(parentOrder.taxTvh) * parentRatio,
          taxPst: Number(parentOrder.taxPst) * parentRatio,
          adminNotes: parentOrder.adminNotes
            ? `${parentOrder.adminNotes}\nSplit: items moved to ${splitOrderNumber}`
            : `Split: items moved to ${splitOrderNumber}`,
        },
      });

      return childOrder;
    });

    // Audit log
    const ipAddress = getClientIpFromRequest(request);
    await logAdminAction({
      adminUserId: session.user.id,
      action: 'SPLIT_ORDER',
      targetType: 'Order',
      targetId: parentId,
      previousValue: { orderNumber: parentOrder.orderNumber, itemCount: parentOrder.items.length },
      newValue: {
        childOrderId: result.id,
        childOrderNumber: splitOrderNumber,
        splitItems: validatedItems.map((v) => ({
          productName: v.parentItem.productName,
          quantity: v.splitQuantity,
        })),
      },
      ipAddress,
    });

    logger.info('Order split', {
      event: 'order_split',
      parentOrderId: parentId,
      childOrderId: result.id,
      childOrderNumber: splitOrderNumber,
      itemsSplit: validatedItems.length,
    });

    return NextResponse.json({
      success: true,
      parentOrder: {
        id: parentId,
        orderNumber: parentOrder.orderNumber,
      },
      childOrder: {
        id: result.id,
        orderNumber: splitOrderNumber,
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('Order split failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
