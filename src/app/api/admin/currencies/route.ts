export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createCurrencySchema = z.object({
  code: z.string().min(1, 'code is required').max(10),
  name: z.string().min(1, 'name is required').max(100),
  symbol: z.string().min(1, 'symbol is required').max(10),
  exchangeRate: z.number({ required_error: 'exchangeRate is required' }).positive('exchangeRate must be positive'),
  isDefault: z.boolean().optional().default(false),
});

/**
 * GET /api/admin/currencies
 * List all currencies
 */
export const GET = withAdminGuard(async (_request, { session: _session }) => {
  try {
    const currencies = await prisma.currency.findMany({
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });

    // Map to the format the frontend expects
    // The page uses: code, name, symbol, exchangeRate, isActive, isDefault, lastUpdated
    const mapped = currencies.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      exchangeRate: Number(c.exchangeRate),
      isDefault: c.isDefault,
      isActive: c.isActive,
      lastUpdated: c.rateUpdatedAt.toISOString(),
      rateUpdatedAt: c.rateUpdatedAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return NextResponse.json({ currencies: mapped });
  } catch (error) {
    logger.error('Get currencies error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error fetching currencies' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/currencies
 * Create a new currency
 */
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createCurrencySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { code, name, symbol, exchangeRate, isDefault } = parsed.data;

    // Check for existing currency with the same code
    const existing = await prisma.currency.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Currency ${code} already exists` },
        { status: 409 }
      );
    }

    // If this is being set as default, unset current default first
    if (isDefault) {
      await prisma.currency.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const currency = await prisma.currency.create({
      data: {
        code: code.toUpperCase(),
        name,
        symbol,
        exchangeRate,
        isDefault: isDefault ?? false,
        isActive: true,
      },
    });

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_CURRENCY',
      targetType: 'Currency',
      targetId: currency.id,
      newValue: { code: currency.code, name: currency.name, symbol: currency.symbol, exchangeRate: Number(currency.exchangeRate), isDefault: currency.isDefault },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        data: {
          ...currency,
          exchangeRate: Number(currency.exchangeRate),
          lastUpdated: currency.rateUpdatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Create currency error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error creating currency' },
      { status: 500 }
    );
  }
});
