export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const receiptSchema = z.object({
  vendor: z.string().min(1).max(200),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().default('5000'),
  description: z.string().max(500).optional(),
  ocrText: z.string().max(5000).optional(),
});

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = receiptSchema.parse(body);

    // Find actual account IDs from codes
    const [expenseAccount, cashAccount] = await Promise.all([
      prisma.chartOfAccount.findFirst({ where: { code: parsed.category }, select: { id: true } }),
      prisma.chartOfAccount.findFirst({ where: { code: '1000' }, select: { id: true } }),
    ]);

    if (!expenseAccount || !cashAccount) {
      return NextResponse.json({ error: 'Compte comptable introuvable' }, { status: 400 });
    }

    // Generate entry number
    const count = await prisma.journalEntry.count();
    const entryNumber = `RCT-${String(count + 1).padStart(6, '0')}`;

    const desc = `Reçu: ${parsed.vendor}${parsed.description ? ` - ${parsed.description}` : ''}`;
    const entry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        description: desc,
        date: new Date(parsed.date),
        type: 'MANUAL',
        status: 'POSTED',
        createdBy: 'mobile-app',
        attachments: parsed.ocrText ? `OCR: ${parsed.ocrText.slice(0, 500)}` : undefined,
        lines: {
          create: [
            { accountId: expenseAccount.id, description: `Reçu ${parsed.vendor}`, debit: parsed.amount, credit: 0 },
            { accountId: cashAccount.id, description: `Paiement ${parsed.vendor}`, debit: 0, credit: parsed.amount },
          ],
        },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erreur enregistrement reçu' }, { status: 500 });
  }
});
