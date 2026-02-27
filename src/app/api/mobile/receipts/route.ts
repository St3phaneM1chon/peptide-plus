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

    const entry = await prisma.journalEntry.create({
      data: {
        description: `Reçu: ${parsed.vendor}${parsed.description ? ` - ${parsed.description}` : ''}`,
        date: new Date(parsed.date),
        entryType: 'EXPENSE',
        totalAmount: parsed.amount,
        status: 'POSTED',
        notes: parsed.ocrText ? `OCR: ${parsed.ocrText.slice(0, 500)}` : undefined,
        lines: {
          create: [
            { accountId: parsed.category, description: `Reçu ${parsed.vendor}`, debit: parsed.amount, credit: 0, lineOrder: 1 },
            { accountId: '1000', description: `Paiement ${parsed.vendor}`, debit: 0, credit: parsed.amount, lineOrder: 2 },
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
