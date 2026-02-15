export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/currencies
 * List all currencies
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    console.error('Get currencies error:', error);
    return NextResponse.json(
      { error: 'Error fetching currencies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/currencies
 * Create a new currency
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code, name, symbol, exchangeRate, isDefault } = body;

    if (!code || !name || !symbol) {
      return NextResponse.json(
        { error: 'code, name, and symbol are required' },
        { status: 400 }
      );
    }

    if (exchangeRate === undefined || exchangeRate === null) {
      return NextResponse.json(
        { error: 'exchangeRate is required' },
        { status: 400 }
      );
    }

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

    return NextResponse.json(
      {
        success: true,
        currency: {
          ...currency,
          exchangeRate: Number(currency.exchangeRate),
          lastUpdated: currency.rateUpdatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create currency error:', error);
    return NextResponse.json(
      { error: 'Error creating currency' },
      { status: 500 }
    );
  }
}
