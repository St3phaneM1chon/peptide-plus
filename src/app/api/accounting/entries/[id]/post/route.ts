export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting';
import { roundCurrency } from '@/lib/financial';
import { logger } from '@/lib/logger';

/**
 * POST /api/accounting/entries/[id]/post
 * Post a draft journal entry
 */
export const POST = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params?.id;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Écriture non trouvée' }, { status: 404 });
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Seules les écritures en brouillon peuvent être validées' },
        { status: 400 }
      );
    }

    // #72 Compliance: Check for closed fiscal year before posting
    const entryDate = existing.date;
    const closedFiscalYear = await prisma.fiscalYear.findFirst({
      where: {
        isClosed: true,
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
    });
    if (closedFiscalYear) {
      return NextResponse.json(
        { error: `Impossible de valider une écriture dans l'exercice fiscal clos "${closedFiscalYear.name}" (${closedFiscalYear.startDate.toISOString().split('T')[0]} — ${closedFiscalYear.endDate.toISOString().split('T')[0]})` },
        { status: 400 }
      );
    }

    // Verify balanced
    const totalDebits = existing.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredits = existing.lines.reduce((s, l) => s + Number(l.credit), 0);

    if (roundCurrency(totalDebits - totalCredits) !== 0) {
      return NextResponse.json(
        { error: `L'écriture n'est pas équilibrée. Débits: ${totalDebits.toFixed(2)}, Crédits: ${totalCredits.toFixed(2)}` },
        { status: 400 }
      );
    }

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'POSTED',
        postedBy: session.user.id || session.user.email,
        postedAt: new Date(),
      },
    });

    // Phase 4 Compliance: Audit trail logging
    logAuditTrail({
      entityType: 'JournalEntry',
      entityId: id,
      action: 'POST',
      userId: session.user.id || session.user.email || 'unknown',
      userName: session.user.name || undefined,
    });

    return NextResponse.json({
      success: true,
      entry: {
        id: updated.id,
        entryNumber: updated.entryNumber,
        status: updated.status,
        postedAt: updated.postedAt?.toISOString(),
        postedBy: updated.postedBy,
      },
      message: `Écriture ${updated.entryNumber} validée avec succès`,
    });
  } catch (error) {
    logger.error('Post entry error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la validation' },
      { status: 500 }
    );
  }
});
