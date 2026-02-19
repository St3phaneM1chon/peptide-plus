export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { fullStripeSync, getStripeBalance } from '@/lib/accounting';
import { prisma } from '@/lib/db';

/**
 * POST /api/accounting/stripe-sync
 * Synchronize Stripe transactions with accounting
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate et endDate sont requis' },
        { status: 400 }
      );
    }

    // #93 Integration: Validate date range (startDate < endDate, max 1 year)
    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide. Utilisez le format ISO (YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    if (parsedStart >= parsedEnd) {
      return NextResponse.json(
        { error: 'startDate doit être antérieure à endDate' },
        { status: 400 }
      );
    }
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    if (parsedEnd.getTime() - parsedStart.getTime() > oneYearMs) {
      return NextResponse.json(
        { error: 'La plage de dates ne peut pas dépasser 1 an' },
        { status: 400 }
      );
    }

    // #82 Error Recovery: Move idempotency check BEFORE fullStripeSync call
    // to avoid performing expensive Stripe API calls for duplicate syncs
    const idempotencyKey = `stripe-sync-${startDate}-${endDate}`;
    const existingSync = await prisma.journalEntry.findFirst({
      where: {
        reference: idempotencyKey,
        type: 'AUTO_SALE',
        deletedAt: null,
      },
      select: { id: true, createdAt: true },
    });

    if (existingSync) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: `Ce synchronisation a déjà été effectuée le ${existingSync.createdAt.toISOString()}`,
        idempotencyKey,
      });
    }

    // Perform sync with structured logging (only after idempotency check passes)
    const syncId = `sync-${Date.now()}`;
    const syncStartTime = Date.now();
    console.info('Stripe sync started:', { syncId, startDate, endDate, initiatedBy: session.user.id || session.user.email });

    const result = await fullStripeSync(parsedStart, parsedEnd);

    // Persist generated entries and transactions to the database
    if (result.entries?.length || result.transactions?.length) {
      await prisma.$transaction(async (tx) => {
        // #96 Track Stripe IDs to skip already-imported transactions
        const stripeRefs = (result.entries || [])
          .map((e: { reference?: string }) => e.reference)
          .filter(Boolean) as string[];
        const existingEntries = stripeRefs.length > 0
          ? await tx.journalEntry.findMany({
              where: { reference: { in: stripeRefs }, deletedAt: null },
              select: { reference: true },
            })
          : [];
        const existingRefs = new Set(existingEntries.map((e) => e.reference));

        for (const entry of (result.entries || [])) {
          // #96 Skip entries that already exist (idempotency per Stripe reference)
          if (entry.reference && existingRefs.has(entry.reference)) {
            continue;
          }

          const accountCodes = entry.lines.map((l: { accountCode: string }) => l.accountCode);
          const accounts = await tx.chartOfAccount.findMany({
            where: { code: { in: accountCodes } },
            select: { id: true, code: true },
          });
          const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

          const year = new Date(entry.date).getFullYear();
          const prefix = `JV-${year}-`;
          const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
            SELECT MAX("entryNumber") as max_num
            FROM "JournalEntry"
            WHERE "entryNumber" LIKE ${prefix + '%'}
            FOR UPDATE
          `;
          let nextNum = 1;
          if (maxRow?.max_num) {
            const parsed = parseInt(maxRow.max_num.split('-').pop() || '0');
            if (!isNaN(parsed)) nextNum = parsed + 1;
          }
          const entryNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

          await tx.journalEntry.create({
            data: {
              entryNumber,
              date: new Date(entry.date),
              description: entry.description,
              type: entry.type || 'AUTO_SALE',
              status: 'POSTED',
              reference: entry.reference,
              createdBy: 'Stripe Sync',
              postedBy: 'Stripe Sync',
              postedAt: new Date(),
              lines: {
                create: entry.lines.map((l: { accountCode: string; description?: string; debit: number; credit: number }) => ({
                  // #94 Integration: Throw error when account code not found instead of using empty string
                  accountId: accountMap.get(l.accountCode) || (() => { throw new Error(`Account code ${l.accountCode} not found in chart of accounts`); })(),
                  description: l.description || null,
                  debit: l.debit,
                  credit: l.credit,
                })),
              },
            },
          });
        }

        for (const tx_data of (result.transactions || [])) {
          if (tx_data.bankAccountId) {
            // #96 Skip already-imported bank transactions by checking Stripe ID
            const existingBankTx = await tx.bankTransaction.findFirst({
              where: {
                rawData: { path: ['stripeId'], equals: tx_data.id },
              },
              select: { id: true },
            });
            if (existingBankTx) continue;

            await tx.bankTransaction.create({
              data: {
                bankAccountId: tx_data.bankAccountId,
                date: new Date(tx_data.date),
                description: tx_data.description,
                amount: tx_data.amount,
                type: tx_data.type || 'CREDIT',
                reconciliationStatus: 'PENDING',
                rawData: JSON.stringify(tx_data),
              },
            });
          }
        }
      });
    }

    const syncDuration = Date.now() - syncStartTime;
    console.info('Stripe sync completed:', {
      syncId,
      entriesCreated: result.entriesCreated,
      transactionsImported: result.transactionsImported,
      errors: result.errors.length,
      durationMs: syncDuration,
    });

    return NextResponse.json({
      success: result.success,
      syncId,
      summary: {
        entriesCreated: result.entriesCreated,
        transactionsImported: result.transactionsImported,
        errors: result.errors.length,
        durationMs: syncDuration,
      },
      entries: result.entries,
      transactions: result.transactions,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Stripe sync error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la synchronisation Stripe' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/accounting/stripe-sync
 * Get Stripe balance
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const balance = await getStripeBalance();

    return NextResponse.json({
      balance,
      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stripe balance error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du solde Stripe' },
      { status: 500 }
    );
  }
}
