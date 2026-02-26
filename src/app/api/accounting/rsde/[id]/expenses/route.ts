export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { listExpenses, createExpense } from '@/lib/accounting/rsde.service';

const createSchema = z.object({
  category: z.enum(['SALARY', 'MATERIALS', 'SUBCONTRACTOR', 'CAPITAL', 'OVERHEAD']),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeName: z.string().max(200).optional(),
  hoursWorked: z.number().positive().optional(),
  hourlyRate: z.number().positive().optional(),
  isEligible: z.boolean().optional(),
  eligibilityNotes: z.string().max(1000).optional(),
});

export const GET = withAdminGuard(async (request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as 'SALARY' | 'MATERIALS' | 'SUBCONTRACTOR' | 'CAPITAL' | 'OVERHEAD' | undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50')), 200);
    const result = await listExpenses(id, { category: category || undefined, page, limit });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des dépenses' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = createSchema.parse(body);
    const expense = await createExpense({ ...parsed, projectId: id });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erreur lors de la création de la dépense' }, { status: 500 });
  }
});
