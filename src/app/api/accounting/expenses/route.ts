export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { formatZodErrors } from '@/lib/accounting';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Deductibility rules per category (Canadian tax rules)
// ---------------------------------------------------------------------------

const CATEGORY_DEDUCTIBILITY: Record<string, number> = {
  meals: 50,
  entertainment: 50,
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
  fines: 0,
  personal: 0,
};

// ---------------------------------------------------------------------------
// Sequential number generator: DEP-{year}-{sequential}
// ---------------------------------------------------------------------------

async function generateExpenseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEP-${year}-`;

  const lastExpense = await prisma.expense.findFirst({
    where: { expenseNumber: { startsWith: prefix } },
    orderBy: { expenseNumber: 'desc' },
    select: { expenseNumber: true },
  });

  let nextSeq = 1;
  if (lastExpense) {
    const parts = lastExpense.expenseNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createExpenseSchema = z.object({
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
  description: z.string().min(1, 'Description requise').max(500),
  subtotal: z.number().min(0, 'Le sous-total doit être positif'),
  taxGst: z.number().min(0).default(0),
  taxQst: z.number().min(0).default(0),
  taxOther: z.number().min(0).default(0),
  total: z.number().min(0, 'Le total doit être positif'),
  category: z.string().min(1, 'Catégorie requise'),
  accountId: z.string().optional().nullable(),
  vendorName: z.string().max(200).optional().nullable(),
  vendorTaxNumber: z.string().max(50).optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  mileageKm: z.number().min(0).optional().nullable(),
  mileageRate: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const updateExpenseSchema = z.object({
  id: z.string().min(1, 'ID requis'),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide').optional(),
  description: z.string().min(1).max(500).optional(),
  subtotal: z.number().min(0).optional(),
  taxGst: z.number().min(0).optional(),
  taxQst: z.number().min(0).optional(),
  taxOther: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
  category: z.string().min(1).optional(),
  accountId: z.string().optional().nullable(),
  vendorName: z.string().max(200).optional().nullable(),
  vendorTaxNumber: z.string().max(50).optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  mileageKm: z.number().min(0).optional().nullable(),
  mileageRate: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  // Status transitions
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED']).optional(),
  rejectionReason: z.string().max(500).optional().nullable(),
});

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
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des dépenses' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/expenses
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const expenseNumber = await generateExpenseNumber();
    const deductiblePercent = CATEGORY_DEDUCTIBILITY[data.category] ?? 100;

    const expense = await prisma.expense.create({
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
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Erreur lors de la création de la dépense' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/expenses
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request, { session }) => {
  try {
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
    console.error('Error updating expense:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour de la dépense' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/expenses (soft-delete)
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 });
    }

    await prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'Dépense supprimée' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression de la dépense' }, { status: 500 });
  }
});
