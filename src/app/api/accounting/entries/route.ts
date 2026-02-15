export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};

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

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: { select: { code: true, name: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.journalEntry.count({ where }),
    ]);

    // Map to expected format
    const mapped = entries.map((e) => ({
      id: e.id,
      entryNumber: e.entryNumber,
      date: e.date.toISOString().split('T')[0],
      description: e.description,
      type: e.type,
      status: e.status,
      reference: e.reference,
      lines: e.lines.map((l) => ({
        accountCode: l.account.code,
        accountName: l.account.name,
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
      totalDebits: e.lines.reduce((s, l) => s + Number(l.debit), 0),
      totalCredits: e.lines.reduce((s, l) => s + Number(l.credit), 0),
      isBalanced: Math.abs(
        e.lines.reduce((s, l) => s + Number(l.debit), 0) -
        e.lines.reduce((s, l) => s + Number(l.credit), 0)
      ) < 0.01,
      createdBy: e.createdBy,
      createdAt: e.createdAt.toISOString(),
      postedBy: e.postedBy,
      postedAt: e.postedAt?.toISOString() || null,
    }));

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

    const body = await request.json();
    const { date, description, type, reference, lines, postImmediately } = body;

    if (!date || !description || !lines || lines.length < 2) {
      return NextResponse.json(
        { error: 'Date, description et au moins 2 lignes sont requis' },
        { status: 400 }
      );
    }

    // Validate balance
    const totalDebits = lines.reduce((sum: number, line: { debit?: number }) => sum + (Number(line.debit) || 0), 0);
    const totalCredits = lines.reduce((sum: number, line: { credit?: number }) => sum + (Number(line.credit) || 0), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json(
        { error: `L'écriture n'est pas équilibrée. Débits: ${totalDebits.toFixed(2)}, Crédits: ${totalCredits.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Generate entry number
    const lastEntry = await prisma.journalEntry.findFirst({
      orderBy: { entryNumber: 'desc' },
      select: { entryNumber: true },
    });
    const nextNum = lastEntry
      ? parseInt(lastEntry.entryNumber.split('-').pop() || '0') + 1
      : 1;
    const entryNumber = `JV-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

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

    const entry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        date: new Date(date),
        description,
        type: type || 'MANUAL',
        status: postImmediately ? 'POSTED' : 'DRAFT',
        reference,
        createdBy: session.user.id || session.user.email || 'unknown',
        postedBy: postImmediately ? (session.user.id || session.user.email) : undefined,
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

    const existing = await prisma.journalEntry.findUnique({
      where: { id },
      select: { status: true },
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
      const totalDebits = lines.reduce((sum: number, line: { debit?: number }) => sum + (Number(line.debit) || 0), 0);
      const totalCredits = lines.reduce((sum: number, line: { credit?: number }) => sum + (Number(line.credit) || 0), 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        return NextResponse.json(
          { error: `L'écriture n'est pas équilibrée` },
          { status: 400 }
        );
      }
    }

    // Update entry
    const updateData: Record<string, unknown> = {};
    if (date) updateData.date = new Date(date);
    if (description) updateData.description = description;
    if (reference !== undefined) updateData.reference = reference;

    // If lines provided, replace them (delete old, create new)
    if (lines) {
      const accountCodes = lines.map((l: { accountCode: string }) => l.accountCode);
      const accounts = await prisma.chartOfAccount.findMany({
        where: { code: { in: accountCodes } },
        select: { id: true, code: true },
      });
      const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

      await prisma.journalLine.deleteMany({ where: { entryId: id } });
      await prisma.journalLine.createMany({
        data: lines.map((l: { accountCode: string; debit?: number; credit?: number; description?: string }) => ({
          entryId: id,
          accountId: accountMap.get(l.accountCode)!,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || null,
        })),
      });
    }

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: updateData,
      include: {
        lines: { include: { account: { select: { code: true, name: true } } } },
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

    const existing = await prisma.journalEntry.findUnique({
      where: { id },
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
      await prisma.journalEntry.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Écriture supprimée' });
    }

    if (action === 'void') {
      if (existing.status !== 'POSTED') {
        return NextResponse.json(
          { error: 'Seules les écritures validées peuvent être annulées' },
          { status: 400 }
        );
      }
      await prisma.journalEntry.update({
        where: { id },
        data: {
          status: 'VOIDED',
          voidedBy: session.user.id || session.user.email,
          voidedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, message: 'Écriture annulée' });
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
