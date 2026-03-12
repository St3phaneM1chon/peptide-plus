export const dynamic = 'force-dynamic';

/**
 * GET /api/accounting/entries/[id] - Get a single journal entry with lines
 * PUT /api/accounting/entries/[id] - Update a draft journal entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { updateJournalEntrySchema, assertJournalBalance, assertPeriodOpen } from '@/lib/accounting/validation';
import { logAuditTrail } from '@/lib/accounting';
import { roundCurrency } from '@/lib/financial';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET: Single journal entry with lines
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  _request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      lines: {
        include: { account: { select: { code: true, name: true } } },
        orderBy: { id: 'asc' },
      },
    },
  });

  if (!entry) {
    return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
  }

  return NextResponse.json(entry);
}, { skipCsrf: true, requiredPermission: 'accounting.view' });

// ---------------------------------------------------------------------------
// PUT: Update a draft journal entry
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (
  request: NextRequest,
  { params, session }: { session: { user: { id: string } }; params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const existing = await prisma.journalEntry.findUnique({
    where: { id },
    include: { lines: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
  }

  if (existing.status === 'POSTED') {
    return NextResponse.json(
      { error: 'Cannot modify a posted entry. Create a reversal instead.' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = updateJournalEntrySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    // Validate period is open if date changes
    if (data.date) {
      await assertPeriodOpen(new Date(data.date));
    }

    // Validate balance if lines are provided (Zod schema already checks, but runtime guard)
    if (data.lines && data.lines.length > 0) {
      assertJournalBalance(
        data.lines.map((l, i) => ({
          id: String(i),
          accountCode: l.accountId,
          accountName: '',
          description: l.description || '',
          debit: roundCurrency(l.debit || 0),
          credit: roundCurrency(l.credit || 0),
        })),
        `update-${id}`
      );
    }

    // Update entry in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update entry fields
      await tx.journalEntry.update({
        where: { id },
        data: {
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.date ? { date: new Date(data.date) } : {}),
          ...(data.reference !== undefined ? { reference: data.reference } : {}),
        },
      });

      // Replace lines if provided
      if (data.lines && data.lines.length > 0) {
        await tx.journalLine.deleteMany({ where: { entryId: id } });
        await tx.journalLine.createMany({
          data: data.lines.map(l => ({
            entryId: id,
            accountId: l.accountId,
            description: l.description || '',
            debit: roundCurrency(l.debit || 0),
            credit: roundCurrency(l.credit || 0),
          })),
        });
      }

      return tx.journalEntry.findUnique({
        where: { id },
        include: { lines: true },
      });
    });

    // Audit trail
    logAuditTrail({
      action: 'UPDATE',
      entityType: 'JournalEntry',
      entityId: id,
      userId: session.user.id,
      newValue: JSON.stringify(data),
    }).catch(err => logger.error('Audit trail failed', { error: err }));

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Journal entry update error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update entry' },
      { status: 400 }
    );
  }
}, { requiredPermission: 'accounting.journal.create' });
