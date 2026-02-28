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

    // Expense entries: entries with lines on expense accounts (5xxx)
    const data = await prisma.journalEntry.findMany({
      where: {
        status: 'POSTED',
        lines: { some: { account: { code: { startsWith: '5' } } } },
      },
      select: {
        id: true,
        description: true,
        date: true,
        type: true,
        lines: {
          where: { account: { code: { startsWith: '5' } } },
          select: { debit: true, credit: true },
        },
      },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.journalEntry.count({
      where: {
        status: 'POSTED',
        lines: { some: { account: { code: { startsWith: '5' } } } },
      },
    });

    return NextResponse.json({
      data: data.map(e => ({
        id: e.id,
        description: e.description,
        date: e.date,
        type: e.type,
        amount: e.lines.reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0),
      })),
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

    // Find actual account IDs from codes
    const [expenseAccount, cashAccount] = await Promise.all([
      prisma.chartOfAccount.findFirst({ where: { code: parsed.accountCode }, select: { id: true } }),
      prisma.chartOfAccount.findFirst({ where: { code: '1000' }, select: { id: true } }),
    ]);

    if (!expenseAccount || !cashAccount) {
      return NextResponse.json({ error: 'Compte comptable introuvable' }, { status: 400 });
    }

    // Generate entry number
    const count = await prisma.journalEntry.count();
    const entryNumber = `EXP-${String(count + 1).padStart(6, '0')}`;

    const entry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        description: parsed.description,
        date: new Date(parsed.date),
        type: 'MANUAL',
        status: 'POSTED',
        createdBy: 'mobile-app',
        attachments: parsed.note ? `Note: ${parsed.note}. Catégorie: ${parsed.category}` : `Catégorie: ${parsed.category}`,
        lines: {
          create: [
            { accountId: expenseAccount.id, description: parsed.description, debit: parsed.amount, credit: 0 },
            { accountId: cashAccount.id, description: parsed.description, debit: 0, credit: parsed.amount },
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
