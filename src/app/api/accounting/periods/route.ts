export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/accounting/periods
 * List accounting periods with optional year and status filters
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (year) where.code = { startsWith: `${year}-` };
    if (status) where.status = status;

    const periods = await prisma.accountingPeriod.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({ periods });
  } catch (error) {
    logger.error('Get periods error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des périodes comptables' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/periods
 * Create a new accounting period
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const { name, code, startDate, endDate } = body;

    if (!name || !code || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'name, code, startDate et endDate sont requis' },
        { status: 400 }
      );
    }

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);

    if (parsedStart >= parsedEnd) {
      return NextResponse.json(
        { error: 'La date de début doit être antérieure à la date de fin' },
        { status: 400 }
      );
    }

    // Check for overlapping periods
    const overlapping = await prisma.accountingPeriod.findFirst({
      where: {
        startDate: { lte: parsedEnd },
        endDate: { gte: parsedStart },
      },
    });
    if (overlapping) {
      return NextResponse.json(
        { error: `La période chevauche une période existante: ${overlapping.code}` },
        { status: 409 }
      );
    }

    const existing = await prisma.accountingPeriod.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: `La période ${code} existe déjà` },
        { status: 409 }
      );
    }

    const period = await prisma.accountingPeriod.create({
      data: {
        name,
        code,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'OPEN',
      },
    });

    return NextResponse.json({ success: true, period }, { status: 201 });
  } catch (error) {
    logger.error('Create period error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création de la période comptable' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/accounting/periods
 * Delete an OPEN accounting period only
 */
export const DELETE = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.accountingPeriod.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Période non trouvée' }, { status: 404 });
    }

    if (existing.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Seules les périodes ouvertes (OPEN) peuvent être supprimées' },
        { status: 400 }
      );
    }

    await prisma.accountingPeriod.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Période comptable supprimée' });
  } catch (error) {
    logger.error('Delete period error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la période comptable' },
      { status: 500 }
    );
  }
});
