export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';
import { roundCurrency } from '@/lib/financial';

/**
 * GET /api/accounting/entries
 * List journal entries with filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const type = searchParams.get('type');
    const includeLines = searchParams.get('includeLines') !== 'false'; // default true

    const where: Record<string, unknown> = { deletedAt: null };

    if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }
    if (search) {
      where.OR = [
        { entryNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
      ];
    }

    // #76 Audit: Uses Prisma `include` to eager-load lines + accounts in a single
    // round-trip (no N+1). Line totals are computed in JS on already-fetched data.
    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: includeLines ? {
          lines: {
            include: {
              account: { select: { code: true, name: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        } : undefined,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.journalEntry.count({ where }),
    ]);

    // Map to expected format
    const mapped = entries.map((e) => {
      const entryLines = (e as unknown as { lines?: { account: { code: string; name: string }; debit: unknown; credit: unknown }[] }).lines;
      return {
        id: e.id,
        entryNumber: e.entryNumber,
        date: e.date.toISOString().split('T')[0],
        description: e.description,
        type: e.type,
        status: e.status,
        reference: e.reference,
        ...(entryLines ? {
          lines: entryLines.map((l) => ({
            accountCode: l.account.code,
            accountName: l.account.name,
            debit: Number(l.debit),
            credit: Number(l.credit),
          })),
          totalDebits: roundCurrency(entryLines.reduce((s, l) => s + Number(l.debit), 0)),
          totalCredits: roundCurrency(entryLines.reduce((s, l) => s + Number(l.credit), 0)),
          isBalanced: roundCurrency(
            entryLines.reduce((s, l) => s + Number(l.debit), 0) -
            entryLines.reduce((s, l) => s + Number(l.credit), 0)
          ) === 0,
        } : {}),
        createdBy: e.createdBy,
        createdAt: e.createdAt.toISOString(),
        postedBy: e.postedBy,
        postedAt: e.postedAt?.toISOString() || null,
      };
    });

    return NextResponse.json({
      entries: mapped,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get entries error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des écritures' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/entries
 * Create a new journal entry
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }
    if (!session.user.id) {
      return NextResponse.json({ error: 'ID utilisateur manquant dans la session' }, { status: 401 });
    }

    const body = await request.json();
    const { date, description, type, reference, lines, postImmediately } = body;

    if (!date || !description || !lines || lines.length < 2) {
      return NextResponse.json(
        { error: 'Date, description et au moins 2 lignes sont requis' },
        { status: 400 }
      );
    }

    // Validate balance
    const totalDebits = roundCurrency(lines.reduce((sum: number, line: { debit?: number }) => sum + (Number(line.debit) || 0), 0));
    const totalCredits = roundCurrency(lines.reduce((sum: number, line: { credit?: number }) => sum + (Number(line.credit) || 0), 0));

    if (roundCurrency(totalDebits - totalCredits) !== 0) {
      return NextResponse.json(
        { error: `L'écriture n'est pas équilibrée. Débits: ${totalDebits.toFixed(2)}, Crédits: ${totalCredits.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Prevent posting to a closed fiscal year
    const entryDate = new Date(date);
    const closedFiscalYear = await prisma.fiscalYear.findFirst({
      where: {
        isClosed: true,
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
    });
    if (closedFiscalYear) {
      return NextResponse.json(
        { error: `Impossible de créer une écriture dans l'exercice fiscal clos "${closedFiscalYear.name}" (${closedFiscalYear.startDate.toISOString().split('T')[0]} — ${closedFiscalYear.endDate.toISOString().split('T')[0]})` },
        { status: 400 }
      );
    }

    // Check for locked accounting period
    const lockedPeriod = await prisma.accountingPeriod.findFirst({
      where: {
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
        status: 'LOCKED',
      },
    });
    if (lockedPeriod) {
      return NextResponse.json(
        { error: `Impossible de créer une écriture dans la période comptable verrouillée "${lockedPeriod.name}" (${lockedPeriod.code})` },
        { status: 400 }
      );
    }

    // Resolve account IDs from codes
    const accountCodes = lines.map((l: { accountCode: string }) => l.accountCode);
    const accounts = await prisma.chartOfAccount.findMany({
      where: { code: { in: accountCodes } },
      select: { id: true, code: true, name: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.code, a]));

    // Validate all account codes exist
    for (const line of lines) {
      if (!accountMap.has(line.accountCode)) {
        return NextResponse.json(
          { error: `Compte comptable ${line.accountCode} introuvable` },
          { status: 400 }
        );
      }
    }

    // Generate entry number inside a transaction to prevent race conditions.
    // Using SELECT ... FOR UPDATE on the max entry ensures no two concurrent
    // requests can produce the same number.
    const year = new Date(date).getFullYear();
    const prefix = `JV-${year}-`;

    const entry = await prisma.$transaction(async (tx) => {
      // Lock the row with the highest entry number for this year to
      // serialize concurrent inserts. If no entries exist yet the
      // query returns null and we start at 1.
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

      return tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(date),
          description,
          type: type || 'MANUAL',
          status: postImmediately ? 'POSTED' : 'DRAFT',
          reference,
          createdBy: session.user.id!,
          postedBy: postImmediately ? session.user.id! : undefined,
          postedAt: postImmediately ? new Date() : undefined,
          lines: {
            create: lines.map((l: { accountCode: string; debit?: number; credit?: number; description?: string }) => ({
              accountId: accountMap.get(l.accountCode)!.id,
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0,
              description: l.description || null,
            })),
          },
        },
        include: {
          lines: { include: { account: { select: { code: true, name: true } } } },
        },
      });
    });

    console.info('Journal entry created:', {
      entryId: entry.id,
      entryNumber: entry.entryNumber,
      type: type || 'MANUAL',
      status: postImmediately ? 'POSTED' : 'DRAFT',
      linesCount: lines.length,
      createdBy: session.user.id,
    });

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error('Create entry error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'écriture' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounting/entries
 * Update an existing draft entry
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { id, date, description, reference, lines } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.journalEntry.findFirst({
      where: { id, deletedAt: null },
      select: { status: true, date: true, description: true, reference: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Écriture non trouvée' }, { status: 404 });
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Seules les écritures en brouillon peuvent être modifiées' },
        { status: 400 }
      );
    }

    // Validate balance if lines provided
    if (lines) {
      const totalDebits = roundCurrency(lines.reduce((sum: number, line: { debit?: number }) => sum + (Number(line.debit) || 0), 0));
      const totalCredits = roundCurrency(lines.reduce((sum: number, line: { credit?: number }) => sum + (Number(line.credit) || 0), 0));

      if (roundCurrency(totalDebits - totalCredits) !== 0) {
        return NextResponse.json(
          { error: `L'écriture n'est pas équilibrée` },
          { status: 400 }
        );
      }
    }

    // #41 Check for closed fiscal year (same as POST)
    if (date) {
      const updateDate = new Date(date);
      const closedFiscalYear = await prisma.fiscalYear.findFirst({
        where: {
          isClosed: true,
          startDate: { lte: updateDate },
          endDate: { gte: updateDate },
        },
      });
      if (closedFiscalYear) {
        return NextResponse.json(
          { error: `Impossible de modifier une écriture dans l'exercice fiscal clos "${closedFiscalYear.name}" (${closedFiscalYear.startDate.toISOString().split('T')[0]} — ${closedFiscalYear.endDate.toISOString().split('T')[0]})` },
          { status: 400 }
        );
      }
    }

    // Check for locked accounting period if date is being changed
    if (date) {
      const updateDate = new Date(date);
      const lockedPeriod = await prisma.accountingPeriod.findFirst({
        where: {
          startDate: { lte: updateDate },
          endDate: { gte: updateDate },
          status: 'LOCKED',
        },
      });
      if (lockedPeriod) {
        return NextResponse.json(
          { error: `Impossible de modifier une écriture dans la période comptable verrouillée "${lockedPeriod.name}" (${lockedPeriod.code})` },
          { status: 400 }
        );
      }
    }

    // #91 Audit trail: capture previous values before modification
    const previousValues: Record<string, unknown> = {};
    if (date) previousValues.date = existing.date;
    if (description) previousValues.description = existing.description;
    if (reference !== undefined) previousValues.reference = existing.reference;
    if (lines) previousValues.linesModified = true;

    // Update entry
    const updateData: Record<string, unknown> = {};
    if (date) updateData.date = new Date(date);
    if (description) updateData.description = description;
    if (reference !== undefined) updateData.reference = reference;
    // #91 Track who modified and when
    updateData.updatedAt = new Date();

    // If lines provided, replace them (delete old, create new)
    if (lines) {
      const accountCodes = lines.map((l: { accountCode: string }) => l.accountCode);
      const accounts = await prisma.chartOfAccount.findMany({
        where: { code: { in: accountCodes } },
        select: { id: true, code: true },
      });
      const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

      // Validate all account codes exist before modifying lines
      const missingCodes = accountCodes.filter((code: string) => !accountMap.has(code));
      if (missingCodes.length > 0) {
        return NextResponse.json(
          { error: `Compte(s) comptable(s) introuvable(s): ${missingCodes.join(', ')}` },
          { status: 400 }
        );
      }

      // #81 Error Recovery: Wrap deleteMany+createMany+update in $transaction
      // to ensure atomicity - if createMany fails, deleteMany is rolled back
      const updated = await prisma.$transaction(async (tx) => {
        await tx.journalLine.deleteMany({ where: { entryId: id } });
        await tx.journalLine.createMany({
          data: lines.map((l: { accountCode: string; debit?: number; credit?: number; description?: string }) => ({
            entryId: id,
            accountId: accountMap.get(l.accountCode)!,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || null,
          })),
        });
        return tx.journalEntry.update({
          where: { id },
          data: updateData,
          include: {
            lines: { include: { account: { select: { code: true, name: true } } } },
          },
        });
      });

      // #91 Log audit trail for the modification
      console.info('Entry modified:', {
        entryId: id,
        modifiedBy: session.user.id || session.user.email,
        modifiedAt: new Date().toISOString(),
        previousValues,
        newValues: {
          ...(date && { date }),
          ...(description && { description }),
          ...(reference !== undefined && { reference }),
          ...(lines && { linesCount: lines.length }),
        },
      });

      return NextResponse.json({ success: true, entry: updated });
    }

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: updateData,
      include: {
        lines: { include: { account: { select: { code: true, name: true } } } },
      },
    });

    // #91 Log audit trail for the modification
    console.info('Entry modified:', {
      entryId: id,
      modifiedBy: session.user.id || session.user.email,
      modifiedAt: new Date().toISOString(),
      previousValues,
      newValues: {
        ...(date && { date }),
        ...(description && { description }),
        ...(reference !== undefined && { reference }),
        ...(lines && { linesCount: lines.length }),
      },
    });

    return NextResponse.json({ success: true, entry: updated });
  } catch (error) {
    console.error('Update entry error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/accounting/entries
 * Delete a draft entry or void a posted entry
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action') || 'delete';

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.journalEntry.findFirst({
      where: { id, deletedAt: null },
      select: { status: true, entryNumber: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Écriture non trouvée' }, { status: 404 });
    }

    if (action === 'delete') {
      if (existing.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'Seules les écritures en brouillon peuvent être supprimées' },
          { status: 400 }
        );
      }
      // Soft delete: set deletedAt instead of hard delete to preserve audit trail
      await prisma.journalEntry.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      console.info('Journal entry deleted:', {
        entryId: id,
        entryNumber: existing.entryNumber,
        action: 'delete',
        deletedBy: session.user.id || session.user.email,
      });
      return NextResponse.json({ success: true, message: 'Écriture supprimée' });
    }

    if (action === 'void') {
      if (existing.status !== 'POSTED') {
        return NextResponse.json(
          { error: 'Seules les écritures validées peuvent être annulées' },
          { status: 400 }
        );
      }

      // #71 [CRITICAL] Auto-create reversing entry when voiding (swap debits/credits)
      // This is required for NCECF compliance: voiding a posted entry must create
      // a counterbalancing entry to maintain the audit trail integrity.
      const originalEntry = await prisma.journalEntry.findUnique({
        where: { id },
        include: { lines: true },
      });

      if (!originalEntry) {
        return NextResponse.json({ error: 'Écriture non trouvée' }, { status: 404 });
      }

      // Generate reversing entry inside a transaction
      const year = originalEntry.date.getFullYear();
      const prefix = `JV-${year}-`;

      const [voidedEntry, reversingEntry] = await prisma.$transaction(async (tx) => {
        // 1. Mark original as VOIDED
        const voided = await tx.journalEntry.update({
          where: { id },
          data: {
            status: 'VOIDED',
            voidedBy: session.user.id || session.user.email,
            voidedAt: new Date(),
          },
        });

        // 2. Generate entry number for reversing entry
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
        const reversingEntryNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

        // 3. Create reversing entry with swapped debits/credits
        const reversing = await tx.journalEntry.create({
          data: {
            entryNumber: reversingEntryNumber,
            date: new Date(),
            description: `Écriture de contrepassation - Annulation ${originalEntry.entryNumber}`,
            type: originalEntry.type,
            status: 'POSTED',
            reference: `VOID-${originalEntry.entryNumber}`,
            orderId: originalEntry.orderId,
            createdBy: session.user.id || session.user.email || 'system',
            postedBy: session.user.id || session.user.email || 'system',
            postedAt: new Date(),
            currency: originalEntry.currency,
            exchangeRate: originalEntry.exchangeRate,
            lines: {
              create: originalEntry.lines.map((line) => ({
                accountId: line.accountId,
                description: `Contrepassation: ${line.description || ''}`,
                debit: line.credit,   // Swap: original credit becomes debit
                credit: line.debit,   // Swap: original debit becomes credit
              })),
            },
          },
        });

        return [voided, reversing];
      });

      return NextResponse.json({
        success: true,
        message: `Écriture ${existing.entryNumber} annulée avec écriture de contrepassation ${reversingEntry.entryNumber}`,
        voidedEntryId: voidedEntry.id,
        reversingEntryId: reversingEntry.id,
        reversingEntryNumber: reversingEntry.entryNumber,
      });
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  } catch (error) {
    console.error('Delete/void entry error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'opération' },
      { status: 500 }
    );
  }
}
