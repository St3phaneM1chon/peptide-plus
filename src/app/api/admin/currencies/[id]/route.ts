export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/admin/currencies/[id]
 * Update a currency (exchange rate, isActive, isDefault, etc.)
 */
export const PATCH = withAdminGuard(async (request, { session: _session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    const existing = await prisma.currency.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Currency not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.symbol !== undefined) updateData.symbol = body.symbol;

    if (body.exchangeRate !== undefined) {
      updateData.exchangeRate = body.exchangeRate;
      updateData.rateUpdatedAt = new Date();
    }

    if (body.isActive !== undefined) {
      // Cannot deactivate the default currency
      if (!body.isActive && existing.isDefault) {
        return NextResponse.json(
          { error: 'Cannot deactivate the default currency' },
          { status: 400 }
        );
      }
      updateData.isActive = body.isActive;
    }

    if (body.isDefault !== undefined && body.isDefault) {
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

    return NextResponse.json({
      success: true,
      currency: {
        ...currency,
        exchangeRate: Number(currency.exchangeRate),
        lastUpdated: currency.rateUpdatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update currency error:', error);
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
export const DELETE = withAdminGuard(async (_request, { session: _session, params }) => {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete currency error:', error);
    return NextResponse.json(
      { error: 'Error deleting currency' },
      { status: 500 }
    );
  }
});
