export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createSchema = z.object({
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  category: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(1000).optional(),
  accountCode: z.string().default('5000'),
});

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));

    const [data, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where: { entryType: 'EXPENSE', status: 'POSTED' },
        select: { id: true, description: true, date: true, totalAmount: true, notes: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.journalEntry.count({ where: { entryType: 'EXPENSE', status: 'POSTED' } }),
    ]);

    return NextResponse.json({
      data: data.map(e => ({ ...e, totalAmount: Number(e.totalAmount) })),
      total,
      page,
      limit,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur récupération dépenses' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = createSchema.parse(body);

    const entry = await prisma.journalEntry.create({
      data: {
        description: parsed.description,
        date: new Date(parsed.date),
        entryType: 'EXPENSE',
        totalAmount: parsed.amount,
        status: 'POSTED',
        notes: parsed.note || `Catégorie: ${parsed.category}`,
        lines: {
          create: [
            { accountId: parsed.accountCode, description: parsed.description, debit: parsed.amount, credit: 0, lineOrder: 1 },
            { accountId: '1000', description: parsed.description, debit: 0, credit: parsed.amount, lineOrder: 2 },
          ],
        },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erreur création dépense' }, { status: 500 });
  }
});
