export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const updateTimeEntrySchema = z.object({
  userName: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  hoursWorked: z.number().min(0).max(24).optional(),
  description: z.string().max(2000).optional().nullable(),
  projectId: z.string().optional().nullable(),
  projectName: z.string().optional().nullable(),
  taskCategory: z.string().optional().nullable(),
  isBillable: z.boolean().optional(),
  billableRate: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
});

// Helper to extract route param id from URL
function extractId(request: NextRequest): string {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  // /api/accounting/time-tracking/[id] => id is last segment
  return segments[segments.length - 1];
}

// ---------------------------------------------------------------------------
// GET /api/accounting/time-tracking/[id]
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractId(request);

    const entry = await prisma.timeEntry.findFirst({
      where: { id, deletedAt: null },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entree de temps non trouvee' }, { status: 404 });
    }

    return NextResponse.json({
      entry: {
        id: entry.id,
        employeeId: entry.employeeId,
        userId: entry.userId,
        userName: entry.userName,
        date: entry.date.toISOString().split('T')[0],
        startTime: entry.startTime?.toISOString() ?? null,
        endTime: entry.endTime?.toISOString() ?? null,
        hoursWorked: Number(entry.hoursWorked),
        description: entry.description,
        projectId: entry.projectId,
        projectName: entry.projectName,
        taskCategory: entry.taskCategory,
        isBillable: entry.isBillable,
        billableRate: entry.billableRate ? Number(entry.billableRate) : null,
        status: entry.status,
        approvedBy: entry.approvedBy,
        approvedAt: entry.approvedAt?.toISOString() ?? null,
        rejectedReason: entry.rejectedReason,
        notes: entry.notes,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching time entry', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation de l\'entree de temps' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/time-tracking/[id]
// Update time entry (content edits DRAFT only, status transitions allowed)
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractId(request);
    const body = await request.json();
    const parsed = updateTimeEntrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const existing = await prisma.timeEntry.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Entree de temps non trouvee' }, { status: 404 });
    }

    const data = parsed.data;

    // Content edits only allowed on DRAFT entries
    const contentFields = ['userName', 'date', 'startTime', 'endTime', 'hoursWorked',
      'description', 'projectId', 'projectName', 'taskCategory', 'isBillable', 'billableRate', 'notes'];
    const hasContentChanges = contentFields.some((f) => data[f as keyof typeof data] !== undefined);

    if (hasContentChanges && existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Seules les entrees DRAFT peuvent etre modifiees. Changez le statut d\'abord.' },
        { status: 400 }
      );
    }

    // Validate status transition
    if (data.status) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['SUBMITTED'],
        SUBMITTED: ['DRAFT', 'APPROVED', 'REJECTED'],
        APPROVED: ['SUBMITTED'], // Can un-approve
        REJECTED: ['DRAFT', 'SUBMITTED'],
      };

      if (!validTransitions[existing.status]?.includes(data.status)) {
        return NextResponse.json(
          { error: `Transition de statut invalide: ${existing.status} -> ${data.status}` },
          { status: 400 }
        );
      }
    }

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    if (data.userName !== undefined) updateData.userName = data.userName;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.startTime !== undefined) updateData.startTime = data.startTime ? new Date(data.startTime) : null;
    if (data.endTime !== undefined) updateData.endTime = data.endTime ? new Date(data.endTime) : null;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.projectId !== undefined) updateData.projectId = data.projectId;
    if (data.projectName !== undefined) updateData.projectName = data.projectName;
    if (data.taskCategory !== undefined) updateData.taskCategory = data.taskCategory;
    if (data.isBillable !== undefined) updateData.isBillable = data.isBillable;
    if (data.billableRate !== undefined) updateData.billableRate = data.billableRate;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;

    // Recalculate hoursWorked if start/end changed
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      if (end <= start) {
        return NextResponse.json(
          { error: 'L\'heure de fin doit etre apres l\'heure de debut' },
          { status: 400 }
        );
      }
      updateData.hoursWorked = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    } else if (data.hoursWorked !== undefined) {
      updateData.hoursWorked = data.hoursWorked;
    }

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: updateData,
    });

    logger.info('Time entry updated', { timeEntryId: id, changes: Object.keys(updateData) });

    return NextResponse.json({
      success: true,
      entry: {
        id: updated.id,
        employeeId: updated.employeeId,
        userId: updated.userId,
        userName: updated.userName,
        date: updated.date.toISOString().split('T')[0],
        startTime: updated.startTime?.toISOString() ?? null,
        endTime: updated.endTime?.toISOString() ?? null,
        hoursWorked: Number(updated.hoursWorked),
        description: updated.description,
        projectId: updated.projectId,
        projectName: updated.projectName,
        taskCategory: updated.taskCategory,
        isBillable: updated.isBillable,
        billableRate: updated.billableRate ? Number(updated.billableRate) : null,
        status: updated.status,
        approvedBy: updated.approvedBy,
        approvedAt: updated.approvedAt?.toISOString() ?? null,
        rejectedReason: updated.rejectedReason,
        notes: updated.notes,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error updating time entry', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour de l\'entree de temps' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/time-tracking/[id]
// Soft delete (DRAFT only)
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractId(request);

    const existing = await prisma.timeEntry.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Entree de temps non trouvee' }, { status: 404 });
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Seules les entrees DRAFT peuvent etre supprimees' },
        { status: 400 }
      );
    }

    await prisma.timeEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.info('Time entry deleted (soft)', { timeEntryId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting time entry', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'entree de temps' },
      { status: 500 }
    );
  }
});
