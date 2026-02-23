export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/accounting/budgets
 * List budgets with lines, optional year filter
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);

    const where: Record<string, unknown> = {};
    if (year) where.year = parseInt(year);

    const [budgets, total] = await Promise.all([
      prisma.budget.findMany({
        where,
        include: { lines: { orderBy: { accountCode: 'asc' } } },
        orderBy: { year: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.budget.count({ where }),
    ]);

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

    return NextResponse.json({
      budgets: mapped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Get budgets error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des budgets' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/budgets
 * Create a new budget with lines
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const { name, year, lines } = body;

    if (!name || !year || !lines || !Array.isArray(lines)) {
      return NextResponse.json(
        { error: 'name, year et lines sont requis' },
        { status: 400 }
      );
    }

    // #62 Audit: Validate that budget amounts are positive numbers
    for (const line of lines) {
      const monthFields = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
      ];
      for (const m of monthFields) {
        if (line[m] !== undefined && line[m] !== null) {
          const val = Number(line[m]);
          if (isNaN(val) || val < 0) {
            return NextResponse.json(
              { error: `Invalid budget amount for ${line.accountCode || 'unknown'}.${m}: must be a positive number or zero` },
              { status: 400 }
            );
          }
        }
      }
    }

    // #63 Audit: Validate year is reasonable
    const currentYear = new Date().getFullYear();
    if (year < currentYear - 5 || year > currentYear + 5) {
      return NextResponse.json(
        { error: `Budget year ${year} is out of reasonable range (${currentYear - 5} to ${currentYear + 5})` },
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
    logger.error('Create budget error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création du budget' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/accounting/budgets
 * Update a budget line
 */
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
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
        const val = Number(months[m]);
        if (isNaN(val) || val < 0) {
          return NextResponse.json(
            { error: `Valeur invalide pour ${m}: doit être un nombre positif ou zéro` },
            { status: 400 }
          );
        }
        updateData[m] = val;
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

    // #79 Compliance: Audit logging for budget modifications
    logger.info('AUDIT: Budget line updated', {
      budgetLineId: lineId,
      budgetId: existing.budgetId,
      accountCode: existing.accountCode,
      modifiedBy: session.user.id || session.user.email,
      modifiedAt: new Date().toISOString(),
      previousTotal: Number(existing.total),
      newTotal: total,
      changedMonths: Object.keys(updateData).filter(k => k !== 'total'),
    });

    return NextResponse.json({ success: true, line });
  } catch (error) {
    logger.error('Update budget line error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la ligne budgétaire' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/accounting/budgets
 * Delete a budget and its lines
 */
export const DELETE = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.budget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Budget non trouvé' }, { status: 404 });
    }

    // #44 Soft-delete: preserve budget for audit trail instead of hard delete
    if (existing.isActive === false) {
      return NextResponse.json(
        { error: 'Ce budget est déjà désactivé' },
        { status: 400 }
      );
    }

    await prisma.budget.update({
      where: { id },
      data: { isActive: false },
    });

    // #79 Compliance: Audit logging for budget soft-delete
    logger.info('AUDIT: Budget soft-deleted', {
      budgetId: id,
      budgetName: existing.name,
      budgetYear: existing.year,
      deletedBy: session.user.id || session.user.email,
      deletedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'Budget désactivé' });
  } catch (error) {
    logger.error('Delete budget error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du budget' },
      { status: 500 }
    );
  }
});
