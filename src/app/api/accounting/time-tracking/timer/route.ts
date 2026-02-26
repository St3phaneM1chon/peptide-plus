export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const timerSchema = z.object({
  action: z.enum(['start', 'stop']),
  // Required for start
  userName: z.string().min(1).optional(),
  description: z.string().max(2000).optional().nullable(),
  projectId: z.string().optional().nullable(),
  projectName: z.string().optional().nullable(),
  taskCategory: z.string().optional().nullable(),
  isBillable: z.boolean().optional().default(false),
  billableRate: z.number().min(0).optional().nullable(),
  // Required for stop
  entryId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/accounting/time-tracking/timer
// Start or stop a timer. Server-side timestamps for trust.
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = timerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { action } = parsed.data;

    if (action === 'start') {
      if (!parsed.data.userName) {
        return NextResponse.json(
          { error: 'userName est requis pour demarrer le minuteur' },
          { status: 400 }
        );
      }

      // Create a DRAFT entry with startTime = now, hoursWorked = 0
      const now = new Date();
      const entry = await prisma.timeEntry.create({
        data: {
          userName: parsed.data.userName,
          date: now,
          startTime: now,
          endTime: null,
          hoursWorked: 0,
          description: parsed.data.description || null,
          projectId: parsed.data.projectId || null,
          projectName: parsed.data.projectName || null,
          taskCategory: parsed.data.taskCategory || null,
          isBillable: parsed.data.isBillable,
          billableRate: parsed.data.billableRate ?? null,
          status: 'DRAFT',
        },
      });

      logger.info('Timer started', {
        timeEntryId: entry.id,
        userName: entry.userName,
        startTime: now.toISOString(),
      });

      return NextResponse.json(
        {
          success: true,
          action: 'start',
          entry: {
            id: entry.id,
            userName: entry.userName,
            date: entry.date.toISOString().split('T')[0],
            startTime: entry.startTime!.toISOString(),
            endTime: null,
            hoursWorked: 0,
            description: entry.description,
            projectName: entry.projectName,
            taskCategory: entry.taskCategory,
            status: entry.status,
          },
        },
        { status: 201 }
      );
    }

    // action === 'stop'
    if (!parsed.data.entryId) {
      return NextResponse.json(
        { error: 'entryId est requis pour arreter le minuteur' },
        { status: 400 }
      );
    }

    const existing = await prisma.timeEntry.findFirst({
      where: { id: parsed.data.entryId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Entree de temps non trouvee' }, { status: 404 });
    }

    if (!existing.startTime) {
      return NextResponse.json(
        { error: 'Cette entree n\'a pas de temps de debut (pas un minuteur)' },
        { status: 400 }
      );
    }

    if (existing.endTime) {
      return NextResponse.json(
        { error: 'Le minuteur est deja arrete' },
        { status: 400 }
      );
    }

    const now = new Date();
    const hoursWorked = (now.getTime() - existing.startTime.getTime()) / (1000 * 60 * 60);

    const updated = await prisma.timeEntry.update({
      where: { id: parsed.data.entryId },
      data: {
        endTime: now,
        hoursWorked: Math.round(hoursWorked * 100) / 100, // Round to 2 decimals
      },
    });

    logger.info('Timer stopped', {
      timeEntryId: updated.id,
      userName: updated.userName,
      endTime: now.toISOString(),
      hoursWorked: Number(updated.hoursWorked),
    });

    return NextResponse.json({
      success: true,
      action: 'stop',
      entry: {
        id: updated.id,
        userName: updated.userName,
        date: updated.date.toISOString().split('T')[0],
        startTime: updated.startTime!.toISOString(),
        endTime: updated.endTime!.toISOString(),
        hoursWorked: Number(updated.hoursWorked),
        description: updated.description,
        projectName: updated.projectName,
        taskCategory: updated.taskCategory,
        status: updated.status,
      },
    });
  } catch (error) {
    logger.error('Error with timer action', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de l\'action du minuteur' },
      { status: 500 }
    );
  }
});
