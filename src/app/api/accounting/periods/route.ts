import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/periods
 * List accounting periods with optional year and status filters
 */
export async function GET(request: NextRequest) {
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
    console.error('Get periods error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des périodes comptables' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/periods
 * Create a new accounting period
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, startDate, endDate } = body;

    if (!name || !code || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'name, code, startDate et endDate sont requis' },
        { status: 400 }
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
    console.error('Create period error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la période comptable' },
      { status: 500 }
    );
  }
}
