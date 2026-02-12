import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/budgets
 * List budgets with lines, optional year filter
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    const where: Record<string, unknown> = {};
    if (year) where.year = parseInt(year);

    const budgets = await prisma.budget.findMany({
      where,
      include: { lines: { orderBy: { accountCode: 'asc' } } },
      orderBy: { year: 'desc' },
    });

    const mapped = budgets.map((b) => ({
      ...b,
      lines: b.lines.map((l) => ({
        ...l,
        january: Number(l.january),
        february: Number(l.february),
        march: Number(l.march),
        april: Number(l.april),
        may: Number(l.may),
        june: Number(l.june),
        july: Number(l.july),
        august: Number(l.august),
        september: Number(l.september),
        october: Number(l.october),
        november: Number(l.november),
        december: Number(l.december),
        total: Number(l.total),
      })),
    }));

    return NextResponse.json({ budgets: mapped });
  } catch (error) {
    console.error('Get budgets error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des budgets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/budgets
 * Create a new budget with lines
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { name, year, lines } = body;

    if (!name || !year || !lines || !Array.isArray(lines)) {
      return NextResponse.json(
        { error: 'name, year et lines sont requis' },
        { status: 400 }
      );
    }

    const budget = await prisma.budget.create({
      data: {
        name,
        year,
        lines: {
          create: lines.map((l: {
            accountCode: string;
            accountName: string;
            type?: string;
            january?: number;
            february?: number;
            march?: number;
            april?: number;
            may?: number;
            june?: number;
            july?: number;
            august?: number;
            september?: number;
            october?: number;
            november?: number;
            december?: number;
          }) => {
            const jan = l.january || 0;
            const feb = l.february || 0;
            const mar = l.march || 0;
            const apr = l.april || 0;
            const may = l.may || 0;
            const jun = l.june || 0;
            const jul = l.july || 0;
            const aug = l.august || 0;
            const sep = l.september || 0;
            const oct = l.october || 0;
            const nov = l.november || 0;
            const dec = l.december || 0;
            const total = jan + feb + mar + apr + may + jun + jul + aug + sep + oct + nov + dec;

            return {
              accountCode: l.accountCode,
              accountName: l.accountName,
              type: l.type || 'EXPENSE',
              january: jan,
              february: feb,
              march: mar,
              april: apr,
              may: may,
              june: jun,
              july: jul,
              august: aug,
              september: sep,
              october: oct,
              november: nov,
              december: dec,
              total,
            };
          }),
        },
      },
      include: { lines: true },
    });

    return NextResponse.json({ success: true, budget }, { status: 201 });
  } catch (error) {
    console.error('Create budget error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du budget' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounting/budgets
 * Update a budget line
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { lineId, ...months } = body;

    if (!lineId) {
      return NextResponse.json({ error: 'lineId requis' }, { status: 400 });
    }

    const existing = await prisma.budgetLine.findUnique({ where: { id: lineId } });
    if (!existing) {
      return NextResponse.json({ error: 'Ligne budgétaire non trouvée' }, { status: 404 });
    }

    const monthFields = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ];

    const updateData: Record<string, unknown> = {};
    for (const m of monthFields) {
      if (months[m] !== undefined) {
        updateData[m] = months[m];
      }
    }

    // Recalculate total
    const merged = { ...existing, ...updateData };
    const total = monthFields.reduce((s, m) => s + Number(merged[m as keyof typeof merged] || 0), 0);
    updateData.total = total;

    const line = await prisma.budgetLine.update({
      where: { id: lineId },
      data: updateData,
    });

    return NextResponse.json({ success: true, line });
  } catch (error) {
    console.error('Update budget line error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la ligne budgétaire' },
      { status: 500 }
    );
  }
}
