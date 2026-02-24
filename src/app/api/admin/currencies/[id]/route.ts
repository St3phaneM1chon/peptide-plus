export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updateCurrencySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  symbol: z.string().min(1).max(10).optional(),
  exchangeRate: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

/**
 * PATCH /api/admin/currencies/[id]
 * Update a currency (exchange rate, isActive, isDefault, etc.)
 */
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const parsed = updateCurrencySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const existing = await prisma.currency.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Currency not found' },
        { status: 404 }
      );
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.symbol !== undefined) updateData.symbol = data.symbol;

    if (data.exchangeRate !== undefined) {
      updateData.exchangeRate = data.exchangeRate;
      updateData.rateUpdatedAt = new Date();
    }

    if (data.isActive !== undefined) {
      // Cannot deactivate the default currency
      if (!data.isActive && existing.isDefault) {
        return NextResponse.json(
          { error: 'Cannot deactivate the default currency' },
          { status: 400 }
        );
      }
      updateData.isActive = data.isActive;
    }

    if (data.isDefault !== undefined && data.isDefault) {
      // Unset current default
      await prisma.currency.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      updateData.isDefault = true;
      updateData.isActive = true; // Default must be active
    }

    const currency = await prisma.currency.update({
      where: { id },
      data: updateData,
    });

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_CURRENCY',
      targetType: 'Currency',
      targetId: id,
      previousValue: { code: existing.code, exchangeRate: Number(existing.exchangeRate), isActive: existing.isActive, isDefault: existing.isDefault },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        ...currency,
        exchangeRate: Number(currency.exchangeRate),
        lastUpdated: currency.rateUpdatedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Update currency error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error updating currency' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/currencies/[id]
 * Delete a currency (only if not used in orders and not default)
 */
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.currency.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Currency not found' },
        { status: 404 }
      );
    }

    // Cannot delete default currency
    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete the default currency' },
        { status: 400 }
      );
    }

    // Cannot delete if used in orders
    if (existing._count.orders > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete currency: it is used in ${existing._count.orders} order(s). Deactivate it instead.`,
        },
        { status: 400 }
      );
    }

    await prisma.currency.delete({ where: { id } });

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_CURRENCY',
      targetType: 'Currency',
      targetId: id,
      previousValue: { code: existing.code, name: existing.name },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete currency error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error deleting currency' },
      { status: 500 }
    );
  }
});
