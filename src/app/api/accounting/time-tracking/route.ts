export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createTimeEntrySchema = z.object({
  employeeId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  userName: z.string().min(1, 'Le nom est requis'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD').optional(),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  hoursWorked: z.number().min(0).max(24),
  description: z.string().max(2000).optional().nullable(),
  projectId: z.string().optional().nullable(),
  projectName: z.string().optional().nullable(),
  taskCategory: z.string().optional().nullable(),
  isBillable: z.boolean().optional().default(false),
  billableRate: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/time-tracking
// List time entries with pagination and filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);
    const employeeId = searchParams.get('employeeId');
    const userId = searchParams.get('userId');
    const projectName = searchParams.get('projectName');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const isBillable = searchParams.get('isBillable');
    const taskCategory = searchParams.get('taskCategory');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { deletedAt: null };

    if (employeeId) where.employeeId = employeeId;
    if (userId) where.userId = userId;
    if (projectName) where.projectName = projectName;
    if (status) where.status = status;
    if (taskCategory) where.taskCategory = taskCategory;
    if (isBillable === 'true') where.isBillable = true;
    if (isBillable === 'false') where.isBillable = false;

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    const [entries, total] = await Promise.all([
      prisma.timeEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.timeEntry.count({ where }),
    ]);

    const mapped = entries.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      userId: e.userId,
      userName: e.userName,
      date: e.date.toISOString().split('T')[0],
      startTime: e.startTime?.toISOString() ?? null,
      endTime: e.endTime?.toISOString() ?? null,
      hoursWorked: Number(e.hoursWorked),
      description: e.description,
      projectId: e.projectId,
      projectName: e.projectName,
      taskCategory: e.taskCategory,
      isBillable: e.isBillable,
      billableRate: e.billableRate ? Number(e.billableRate) : null,
      status: e.status,
      approvedBy: e.approvedBy,
      approvedAt: e.approvedAt?.toISOString() ?? null,
      rejectedReason: e.rejectedReason,
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
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
    logger.error('Error fetching time entries', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des entrees de temps' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/time-tracking
// Create a time entry (manual or from timer)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = createTimeEntrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // If startTime and endTime provided, calculate hoursWorked from diff
    let hoursWorked = data.hoursWorked;
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      if (end <= start) {
        return NextResponse.json(
          { error: 'L\'heure de fin doit etre apres l\'heure de debut' },
          { status: 400 }
        );
      }
      hoursWorked = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }

    const entry = await prisma.timeEntry.create({
      data: {
        employeeId: data.employeeId || null,
        userId: data.userId || null,
        userName: data.userName,
        date: data.date ? new Date(data.date) : new Date(),
        startTime: data.startTime ? new Date(data.startTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,
        hoursWorked,
        description: data.description || null,
        projectId: data.projectId || null,
        projectName: data.projectName || null,
        taskCategory: data.taskCategory || null,
        isBillable: data.isBillable,
        billableRate: data.billableRate ?? null,
        notes: data.notes || null,
        status: 'DRAFT',
      },
    });

    logger.info('Time entry created', {
      timeEntryId: entry.id,
      userName: entry.userName,
      hoursWorked: Number(entry.hoursWorked),
    });

    return NextResponse.json(
      {
        success: true,
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
          notes: entry.notes,
          createdAt: entry.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating time entry', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la creation de l\'entree de temps' },
      { status: 500 }
    );
  }
});
