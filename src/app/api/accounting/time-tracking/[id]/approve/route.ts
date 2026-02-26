export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const approvalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectedReason: z.string().max(2000).optional().nullable(),
  approvedBy: z.string().min(1, 'approvedBy est requis'),
});

// Helper to extract route param id from URL
function extractId(request: NextRequest): string {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  // /api/accounting/time-tracking/[id]/approve => id is second-to-last
  return segments[segments.length - 2];
}

// ---------------------------------------------------------------------------
// POST /api/accounting/time-tracking/[id]/approve
// Approve or reject a SUBMITTED time entry
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractId(request);
    const body = await request.json();
    const parsed = approvalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { action, rejectedReason, approvedBy } = parsed.data;

    const existing = await prisma.timeEntry.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Entree de temps non trouvee' }, { status: 404 });
    }

    if (existing.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: `Seules les entrees SUBMITTED peuvent etre approuvees/rejetees. Statut actuel: ${existing.status}` },
        { status: 400 }
      );
    }

    if (action === 'reject' && !rejectedReason) {
      return NextResponse.json(
        { error: 'La raison du rejet est requise' },
        { status: 400 }
      );
    }

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: action === 'approve'
        ? {
            status: 'APPROVED',
            approvedBy,
            approvedAt: new Date(),
            rejectedReason: null,
          }
        : {
            status: 'REJECTED',
            approvedBy: null,
            approvedAt: null,
            rejectedReason: rejectedReason || null,
          },
    });

    logger.info(`Time entry ${action}d`, {
      timeEntryId: id,
      action,
      approvedBy: action === 'approve' ? approvedBy : undefined,
      rejectedReason: action === 'reject' ? rejectedReason : undefined,
    });

    return NextResponse.json({
      success: true,
      entry: {
        id: updated.id,
        userName: updated.userName,
        status: updated.status,
        approvedBy: updated.approvedBy,
        approvedAt: updated.approvedAt?.toISOString() ?? null,
        rejectedReason: updated.rejectedReason,
      },
    });
  } catch (error) {
    logger.error('Error approving/rejecting time entry', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de l\'approbation/rejet' },
      { status: 500 }
    );
  }
});
