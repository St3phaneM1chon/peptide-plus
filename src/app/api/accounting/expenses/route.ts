import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  createExpenseEntry,
  getExpensesByDepartment,
  DEPARTMENTS,
  type DepartmentCode,
} from '@/lib/accounting/expense.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department') as DepartmentCode | null;
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

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
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, accountCode, amount, date, department, reference, createdBy = 'system' } = body;

    if (!description || !accountCode || !amount || !department) {
      return NextResponse.json(
        { error: 'description, accountCode, amount, and department are required' },
        { status: 400 }
      );
    }

    const entryId = await createExpenseEntry({
      description,
      accountCode,
      amount: parseFloat(amount),
      date: date ? new Date(date) : new Date(),
      department,
      reference,
      createdBy,
    });

    return NextResponse.json({ success: true, entryId }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating expense:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
