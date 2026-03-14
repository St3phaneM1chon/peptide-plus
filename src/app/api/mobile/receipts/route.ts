export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { checkPeriodLock } from '@/lib/accounting/period-close.service';
import { logger } from '@/lib/logger';

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
    const result = receiptSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      );
    }
    const parsed = result.data;

    // Check if the target accounting period is locked
    const periodLockError = await checkPeriodLock(new Date(parsed.date));
    if (periodLockError) {
      return NextResponse.json({ error: periodLockError }, { status: 403 });
    }

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

    // Validate debit/credit balance
    const lines = [
      { accountId: expenseAccount.id, description: `Reçu ${parsed.vendor}`, debit: parsed.amount, credit: 0, type: 'DEBIT' as const },
      { accountId: cashAccount.id, description: `Paiement ${parsed.vendor}`, debit: 0, credit: parsed.amount, type: 'CREDIT' as const },
    ];
    const totalDebits = lines.filter(l => l.type === 'DEBIT').reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredits = lines.filter(l => l.type === 'CREDIT').reduce((sum, l) => sum + Number(l.credit), 0);
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json({ error: 'Journal entry debits must equal credits' }, { status: 400 });
    }

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
    logger.error('[mobile/receipts] Error creating receipt entry', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur enregistrement reçu' }, { status: 500 });
  }
});
