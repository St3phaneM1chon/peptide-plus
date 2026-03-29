export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const updateReturnSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'EXCHANGE']).optional(),
  resolution: z.string().optional(),
  adminNotes: z.string().optional(),
  refundAmount: z.number().min(0).optional(),
  exchangeFor: z.string().optional(),
  trackingNumber: z.string().optional(),
});

/**
 * GET /api/admin/returns
 * List all return requests with pagination and filtering
 */
export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
    const status = url.searchParams.get('status');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [returns, total] = await prisma.$transaction([
      prisma.returnRequest.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              status: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          refunds: {
            select: {
              id: true,
              amount: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.returnRequest.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      returns: returns.map((r) => ({
        ...r,
        refundAmount: r.refundAmount ? Number(r.refundAmount) : null,
        order: r.order ? {
          ...r.order,
          total: r.order.total ? Number(r.order.total) : null,
        } : null,
        refunds: r.refunds.map((ref) => ({
          ...ref,
          amount: Number(ref.amount),
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('[Returns] Failed to list return requests', { error: error instanceof Error ? error.message : String(error), userId: session.user?.id });
    return NextResponse.json({ success: false, error: { message: 'Failed to load return requests' } }, { status: 500 });
  }
});

/**
 * PUT /api/admin/returns
 * Update a return request status/resolution
 */
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const data = updateReturnSchema.parse(body);

    const existing = await prisma.returnRequest.findUnique({
      where: { id: data.id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: 'Return request not found' } }, { status: 404 });
    }

    const updated = await prisma.returnRequest.update({
      where: { id: data.id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.resolution !== undefined && { resolution: data.resolution }),
        ...(data.adminNotes !== undefined && { adminNotes: data.adminNotes }),
        ...(data.refundAmount !== undefined && { refundAmount: data.refundAmount }),
        ...(data.exchangeFor !== undefined && { exchangeFor: data.exchangeFor }),
        ...(data.trackingNumber !== undefined && { trackingNumber: data.trackingNumber }),
      },
    });

    // Inventory rollback: restore stock when return is APPROVED or COMPLETED
    if (data.status && ['APPROVED', 'COMPLETED'].includes(data.status) && existing.status === 'PENDING') {
      try {
        const returnWithOrder = await prisma.returnRequest.findUnique({
          where: { id: data.id },
          include: {
            order: {
              select: {
                id: true,
                tenantId: true,
                orderNumber: true,
                items: {
                  select: { productId: true, optionId: true, quantity: true, productName: true },
                },
              },
            },
          },
        });

        if (returnWithOrder?.order?.items) {
          for (const item of returnWithOrder.order.items) {
            // Restore stock on product option (source of truth) or product
            if (item.optionId) {
              await prisma.productOption.update({
                where: { id: item.optionId },
                data: { stockQuantity: { increment: item.quantity } },
              });
            }
            // Also update aggregate product stock
            await prisma.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: item.quantity } },
            });

            // Create inventory transaction for audit trail
            await prisma.inventoryTransaction.create({
              data: {
                tenantId: returnWithOrder.order.tenantId,
                productId: item.productId,
                optionId: item.optionId,
                type: 'RETURN',
                quantity: item.quantity,
                unitCost: 0, // WAC recalculated on next purchase
                runningWAC: 0,
                orderId: returnWithOrder.order.id,
                reason: `Return #${data.id.slice(-8)} — ${item.productName}`,
                createdBy: session.user?.id || 'system',
              },
            });
          }

          logger.info('[Returns] Inventory restored for approved return', {
            returnId: data.id,
            orderId: returnWithOrder.order.id,
            itemCount: returnWithOrder.order.items.length,
          });
        }
      } catch (invError) {
        logger.error('[Returns] Inventory rollback failed (non-blocking)', {
          returnId: data.id,
          error: invError instanceof Error ? invError.message : String(invError),
        });
      }
    }

    await logAdminAction({
      adminUserId: session.user?.id || '',
      action: 'RETURN_REQUEST_UPDATE',
      targetType: 'ReturnRequest',
      targetId: data.id,
      previousValue: { status: existing.status },
      newValue: { status: data.status },
      ipAddress: getClientIpFromRequest(request),
    });

    return NextResponse.json({
      success: true,
      returnRequest: {
        ...updated,
        refundAmount: updated.refundAmount ? Number(updated.refundAmount) : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { message: 'Validation error', details: error.errors } }, { status: 400 });
    }
    logger.error('[Returns] Failed to update return request', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: { message: 'Failed to update return request' } }, { status: 500 });
  }
});
