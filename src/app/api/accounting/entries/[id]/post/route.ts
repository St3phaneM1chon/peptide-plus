import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';

/**
 * POST /api/accounting/entries/[id]/post
 * Post a draft journal entry
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { id } = await params;

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

    // Verify balanced
    const totalDebits = existing.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredits = existing.lines.reduce((s, l) => s + Number(l.credit), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
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
    console.error('Post entry error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la validation' },
      { status: 500 }
    );
  }
}
