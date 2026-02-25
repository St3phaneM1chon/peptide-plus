export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { logAuditTrail } from '@/lib/accounting/audit-trail.service';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
// FIX: F017 - Import consolidated schemas from validation.ts instead of duplicating
import { createExpenseSchema, updateExpenseSchema, assertPeriodOpen } from '@/lib/accounting/validation';

// ---------------------------------------------------------------------------
// Deductibility rules per category (Canadian tax rules)
// ---------------------------------------------------------------------------

// F096 FIX: Complete deductibility map aligned with DEDUCTIBILITY_RULES in canadian-tax-config.ts
// All expense categories now have explicit deductibility rates per CRA rules.
const CATEGORY_DEDUCTIBILITY: Record<string, number> = {
  // Fully deductible (100%) - per CRA rules
  travel: 100,
  office: 100,
  professional: 100,
  advertising: 100,
  insurance: 100,
  rent: 100,
  utilities: 100,
  telephone: 100,
  vehicle: 100,
  shipping: 100,
  software: 100,
  repairs: 100,
  bank_fees: 100,
  training: 100,
  subscriptions: 100,
  equipment: 100,
  supplies: 100,
  salaries: 100,
  wages: 100,
  contractor: 100,
  hosting: 100,
  accounting: 100,
  legal: 100,
  // Partially deductible (50%) - meals & entertainment per CRA s.67.1
  meals: 50,
  entertainment: 50,
  // Non-deductible (0%) - per CRA rules
  fines: 0,
  penalties: 0,
  personal: 0,
  commuting: 0,
  political_donations: 0,
  club_dues: 0,
  life_insurance: 0,
  income_tax: 0,
  capital_expenditure: 0,  // Goes through CCA instead
};

// ---------------------------------------------------------------------------
// Sequential number generator: DEP-{year}-{sequential}
// ---------------------------------------------------------------------------

/**
 * FIX (F002): Generate expense number inside a transaction with FOR UPDATE
 * to prevent race conditions where two concurrent requests get the same number.
 * The tx parameter must be a Prisma transaction client.
 */
async function generateExpenseNumberInTx(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEP-${year}-`;

  // Use FOR UPDATE to lock the row with the highest expense number,
  // serializing concurrent inserts (same pattern as entries/route.ts)
  const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
    SELECT MAX("expenseNumber") as max_num
    FROM "Expense"
    WHERE "expenseNumber" LIKE ${prefix + '%'}
    FOR UPDATE
  `;

  let nextSeq = 1;
  if (maxRow?.max_num) {
    const parts = maxRow.max_num.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  // F063 FIX: Use padStart(5) for consistent 5-digit entry number format across all services
  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

// FIX: F017 - Schemas imported from @/lib/accounting/validation.ts (single source of truth)

// ---------------------------------------------------------------------------
// GET /api/accounting/expenses
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);

    // Build where clause
    const where: Prisma.ExpenseWhereInput = { deletedAt: null };

    if (status) where.status = status as Prisma.EnumExpenseStatusFilter;
    if (category) where.category = category;

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { expenseNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch expenses + count in parallel
    const [expenses, totalCount] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: { account: { select: { id: true, code: true, name: true } } },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    // Stats: total amount, by status, top categories
    const allExpensesWhere: Prisma.ExpenseWhereInput = { deletedAt: null };
    if (dateFrom || dateTo) {
      allExpensesWhere.date = {};
      if (dateFrom) allExpensesWhere.date.gte = new Date(dateFrom);
      if (dateTo) allExpensesWhere.date.lte = new Date(dateTo);
    }

    const [statusCounts, categoryAgg, totalAgg] = await Promise.all([
      prisma.expense.groupBy({
        by: ['status'],
        where: allExpensesWhere,
        _count: { id: true },
        _sum: { total: true },
      }),
      prisma.expense.groupBy({
        by: ['category'],
        where: allExpensesWhere,
        _count: { id: true },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
      prisma.expense.aggregate({
        where: allExpensesWhere,
        _sum: { total: true },
        _count: { id: true },
      }),
    ]);

    // Map Decimal to number for JSON serialization
    const mapped = expenses.map((exp) => ({
      ...exp,
      subtotal: Number(exp.subtotal),
      taxGst: Number(exp.taxGst),
      taxQst: Number(exp.taxQst),
      taxOther: Number(exp.taxOther),
      total: Number(exp.total),
    }));

    const byStatus = Object.fromEntries(
      statusCounts.map((s) => [s.status, { count: s._count.id, total: Number(s._sum.total ?? 0) }])
    );

    const topCategories = categoryAgg.map((c) => ({
      category: c.category,
      count: c._count.id,
      total: Number(c._sum.total ?? 0),
    }));

    return NextResponse.json({
      expenses: mapped,
      pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) },
      stats: {
        totalCount: totalAgg._count.id,
        totalAmount: Number(totalAgg._sum.total ?? 0),
        byStatus,
        topCategories,
      },
    });
  } catch (error) {
    logger.error('Error fetching expenses', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur lors de la récupération des dépenses' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/expenses
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/expenses');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // FIX (F026): Validate that subtotal + taxes = total
    const computedTotal = data.subtotal + data.taxGst + data.taxQst + data.taxOther;
    if (Math.abs(computedTotal - data.total) > 0.01) {
      return NextResponse.json(
        { error: `Le total (${data.total}) ne correspond pas au sous-total + taxes (${computedTotal.toFixed(2)})` },
        { status: 400 }
      );
    }

    // IMP-A017: Check that the expense date is not in a closed/locked accounting period
    try {
      await assertPeriodOpen(new Date(data.date));
    } catch (periodError) {
      return NextResponse.json(
        { error: periodError instanceof Error ? periodError.message : 'Période comptable verrouillée' },
        { status: 400 }
      );
    }

    const deductiblePercent = CATEGORY_DEDUCTIBILITY[data.category] ?? 100;

    // FIX (F002 + F004): Wrap expense creation in a serializable transaction
    // to prevent race conditions on expense number generation
    const expense = await prisma.$transaction(async (tx) => {
      const expenseNumber = await generateExpenseNumberInTx(tx);

      return tx.expense.create({
        data: {
          expenseNumber,
          date: new Date(data.date),
          description: data.description,
          subtotal: new Prisma.Decimal(data.subtotal),
          taxGst: new Prisma.Decimal(data.taxGst),
          taxQst: new Prisma.Decimal(data.taxQst),
          taxOther: new Prisma.Decimal(data.taxOther),
          total: new Prisma.Decimal(data.total),
          category: data.category,
          accountId: data.accountId || null,
          deductiblePercent,
          vendorName: data.vendorName || null,
          vendorTaxNumber: data.vendorTaxNumber || null,
          receiptUrl: data.receiptUrl || null,
          paymentMethod: data.paymentMethod || null,
          mileageKm: data.mileageKm ?? null,
          mileageRate: data.mileageRate ?? null,
          notes: data.notes || null,
          submittedBy: session.user?.email || null,
        },
        include: { account: { select: { id: true, code: true, name: true } } },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return NextResponse.json(
      {
        success: true,
        expense: {
          ...expense,
          subtotal: Number(expense.subtotal),
          taxGst: Number(expense.taxGst),
          taxQst: Number(expense.taxQst),
          taxOther: Number(expense.taxOther),
          total: Number(expense.total),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating expense', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur lors de la création de la dépense' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/expenses
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/expenses');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      );
    }

    const { id, status, rejectionReason, ...updateFields } = parsed.data;

    // Fetch existing expense
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 });
    }

    // Build update data
    const updateData: Prisma.ExpenseUpdateInput = {};

    // Field updates (only for DRAFT status)
    if (existing.status === 'DRAFT') {
      if (updateFields.date) updateData.date = new Date(updateFields.date);
      if (updateFields.description) updateData.description = updateFields.description;
      if (updateFields.subtotal !== undefined) updateData.subtotal = new Prisma.Decimal(updateFields.subtotal);
      if (updateFields.taxGst !== undefined) updateData.taxGst = new Prisma.Decimal(updateFields.taxGst);
      if (updateFields.taxQst !== undefined) updateData.taxQst = new Prisma.Decimal(updateFields.taxQst);
      if (updateFields.taxOther !== undefined) updateData.taxOther = new Prisma.Decimal(updateFields.taxOther);
      if (updateFields.total !== undefined) updateData.total = new Prisma.Decimal(updateFields.total);
      if (updateFields.category) {
        updateData.category = updateFields.category;
        updateData.deductiblePercent = CATEGORY_DEDUCTIBILITY[updateFields.category] ?? 100;
      }
      if (updateFields.accountId !== undefined) {
        if (updateFields.accountId) {
          updateData.account = { connect: { id: updateFields.accountId } };
        } else {
          updateData.account = { disconnect: true };
        }
      }
      if (updateFields.vendorName !== undefined) updateData.vendorName = updateFields.vendorName || null;
      if (updateFields.vendorTaxNumber !== undefined) updateData.vendorTaxNumber = updateFields.vendorTaxNumber || null;
      if (updateFields.receiptUrl !== undefined) updateData.receiptUrl = updateFields.receiptUrl || null;
      if (updateFields.paymentMethod !== undefined) updateData.paymentMethod = updateFields.paymentMethod || null;
      if (updateFields.mileageKm !== undefined) updateData.mileageKm = updateFields.mileageKm ?? null;
      if (updateFields.mileageRate !== undefined) updateData.mileageRate = updateFields.mileageRate ?? null;
      if (updateFields.notes !== undefined) updateData.notes = updateFields.notes || null;
    }

    // Status transitions
    if (status) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['SUBMITTED'],
        SUBMITTED: ['APPROVED', 'REJECTED'],
        APPROVED: ['REIMBURSED'],
        REJECTED: ['DRAFT'],
        REIMBURSED: [],
      };

      const allowed = validTransitions[existing.status] ?? [];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Transition de statut invalide: ${existing.status} -> ${status}` },
          { status: 400 }
        );
      }

      updateData.status = status;

      if (status === 'APPROVED') {
        updateData.approvedBy = session.user?.email || null;
        updateData.approvedAt = new Date();
      }

      if (status === 'REJECTED') {
        updateData.rejectionReason = rejectionReason || null;
      }

      if (status === 'REIMBURSED') {
        updateData.reimbursed = true;
        updateData.reimbursedAt = new Date();
      }

      if (status === 'DRAFT') {
        // Resetting from REJECTED to DRAFT
        updateData.rejectionReason = null;
      }
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: { account: { select: { id: true, code: true, name: true } } },
    });

    return NextResponse.json({
      success: true,
      expense: {
        ...updated,
        subtotal: Number(updated.subtotal),
        taxGst: Number(updated.taxGst),
        taxQst: Number(updated.taxQst),
        taxOther: Number(updated.taxOther),
        total: Number(updated.total),
      },
    });
  } catch (error) {
    logger.error('Error updating expense', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur lors de la mise à jour de la dépense' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/expenses (soft-delete)
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/expenses');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 });
    }

    // F024 FIX: Enforce 7-year retention policy (CRA/RQ section 230(4) ITA)
    // Records within the 7-year retention period CANNOT be deleted (even soft-deleted)
    // if they have been approved or reimbursed (i.e., they are part of the fiscal record).
    const RETENTION_YEARS = 7;
    const retentionCutoff = new Date();
    retentionCutoff.setFullYear(retentionCutoff.getFullYear() - RETENTION_YEARS);
    if (existing.date > retentionCutoff) {
      const protectedStatuses = ['APPROVED', 'REIMBURSED'];
      if (protectedStatuses.includes(existing.status)) {
        const retentionEndDate = new Date(existing.date);
        retentionEndDate.setFullYear(retentionEndDate.getFullYear() + RETENTION_YEARS);
        return NextResponse.json(
          {
            error: `Suppression interdite: cette dépense (${existing.expenseNumber}) est sous la politique de rétention fiscale de ${RETENTION_YEARS} ans (CRA/RQ art. 230(4) LIR). Rétention jusqu'au ${retentionEndDate.toISOString().split('T')[0]}.`,
          },
          { status: 403 }
        );
      }
    }

    // FIX: F015 - Log audit trail BEFORE deletion for compliance
    logAuditTrail({
      entityType: 'SUPPLIER_INVOICE', // Using closest available entity type
      entityId: id,
      action: 'DELETE',
      field: 'deletedAt',
      oldValue: null,
      newValue: new Date().toISOString(),
      userId: session.user?.id || session.user?.email || 'system',
      userName: session.user?.name || session.user?.email || undefined,
      metadata: {
        expenseNumber: existing.expenseNumber,
        description: existing.description,
        total: Number(existing.total),
        category: existing.category,
      },
    }).catch(() => { /* non-blocking */ });

    await prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'Dépense supprimée' });
  } catch (error) {
    logger.error('Error deleting expense', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur lors de la suppression de la dépense' }, { status: 500 });
  }
});
