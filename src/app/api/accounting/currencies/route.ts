export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/currencies
 * List all currencies
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    const currencies = await prisma.currency.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    const mapped = currencies.map((c) => ({
      ...c,
      exchangeRate: Number(c.exchangeRate),
    }));

    return NextResponse.json({ currencies: mapped });
  } catch (error) {
    console.error('Get currencies error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des devises' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/currencies
 * Create a new currency
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const { code, name, symbol, exchangeRate } = body;

    if (!code || !name || !symbol || exchangeRate === undefined) {
      return NextResponse.json(
        { error: 'code, name, symbol et exchangeRate sont requis' },
        { status: 400 }
      );
    }

    const existing = await prisma.currency.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: `La devise ${code} existe déjà` },
        { status: 409 }
      );
    }

    const currency = await prisma.currency.create({
      data: { code, name, symbol, exchangeRate },
    });

    return NextResponse.json({ success: true, currency }, { status: 201 });
  } catch (error) {
    console.error('Create currency error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la devise' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/accounting/currencies
 * Update a currency
 */
export const PUT = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const { id, exchangeRate, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.currency.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Devise non trouvée' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (exchangeRate !== undefined) {
      updateData.exchangeRate = exchangeRate;
      updateData.rateUpdatedAt = new Date();
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    const currency = await prisma.currency.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, currency });
  } catch (error) {
    console.error('Update currency error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la devise' },
      { status: 500 }
    );
  }
});
