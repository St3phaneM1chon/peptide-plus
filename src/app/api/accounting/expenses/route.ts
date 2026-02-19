export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  createExpenseEntry,
  getExpensesByDepartment,
  DEPARTMENTS,
  type DepartmentCode,
} from '@/lib/accounting/expense.service';
import { formatZodErrors } from '@/lib/accounting';
import { z } from 'zod';

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department') as DepartmentCode | null;
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    // Validate date range if provided
    if (fromStr || toStr) {
      const parsedFrom = fromStr ? new Date(fromStr) : null;
      const parsedTo = toStr ? new Date(toStr) : null;

      if ((fromStr && isNaN(parsedFrom!.getTime())) || (toStr && isNaN(parsedTo!.getTime()))) {
        return NextResponse.json({ error: 'Format de date invalide. Utilisez le format ISO (YYYY-MM-DD)' }, { status: 400 });
      }
      if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
        return NextResponse.json({ error: 'La date de début doit être antérieure à la date de fin' }, { status: 400 });
      }
      if (parsedFrom && parsedTo) {
        const oneYearMs = 365 * 24 * 60 * 60 * 1000;
        if (parsedTo.getTime() - parsedFrom.getTime() > oneYearMs) {
          return NextResponse.json({ error: 'La plage de dates ne peut pas dépasser 1 an' }, { status: 400 });
        }
      }
    }

    const now = new Date();
    const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toStr ? new Date(toStr) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const expenses = await getExpensesByDepartment(from, to);

    if (department && expenses[department]) {
      return NextResponse.json({
        department: expenses[department],
        departments: DEPARTMENTS,
      });
    }

    return NextResponse.json({
      expenses: Object.values(expenses),
      departments: DEPARTMENTS,
      period: { from, to },
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();

    // Zod validation (route-specific: matches expense service contract)
    const expenseSchema = z.object({
      description: z.string().min(1, 'Description requise').max(500),
      accountCode: z.string().min(1, 'accountCode requis'),
      amount: z.union([z.number().positive('Montant doit être positif'), z.string().min(1)]),
      department: z.enum(['OPS', 'MKT', 'TECH', 'ADMIN', 'FULFIL', 'RD'], { errorMap: () => ({ message: 'department invalide' }) }),
      date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide').optional(),
      reference: z.string().optional(),
      createdBy: z.string().default('system'),
    });
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }
    const { description, accountCode, amount, date, department, reference, createdBy } = parsed.data;

    // Validation handled by Zod schema above

    const entryId = await createExpenseEntry({
      description,
      accountCode,
      amount: typeof amount === 'number' ? amount : parseFloat(amount),
      date: date ? new Date(date) : new Date(),
      department,
      reference,
      createdBy,
    });

    return NextResponse.json({ success: true, entryId }, { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
});
