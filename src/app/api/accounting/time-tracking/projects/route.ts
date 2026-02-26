export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createProjectSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(200),
  code: z.string().min(1, 'Le code est requis').max(50).regex(/^[A-Z0-9_-]+$/i, 'Code: lettres, chiffres, tirets, underscores'),
  description: z.string().max(2000).optional().nullable(),
  clientName: z.string().max(200).optional().nullable(),
  budget: z.number().min(0).optional().nullable(),
  budgetAmount: z.number().min(0).optional().nullable(),
  defaultRate: z.number().min(0).optional().nullable(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'ARCHIVED']).optional().default('ACTIVE'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/time-tracking/projects
// List time projects with optional filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { deletedAt: null };

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.timeProject.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.timeProject.count({ where }),
    ]);

    // Get hours used per project
    const projectNames = projects.map((p) => p.name);
    const hoursUsed = await prisma.timeEntry.groupBy({
      by: ['projectName'],
      where: {
        projectName: { in: projectNames },
        deletedAt: null,
      },
      _sum: { hoursWorked: true },
    });

    const hoursMap: Record<string, number> = {};
    for (const h of hoursUsed) {
      if (h.projectName) {
        hoursMap[h.projectName] = Number(h._sum.hoursWorked) || 0;
      }
    }

    const mapped = projects.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      description: p.description,
      clientName: p.clientName,
      budget: p.budget ? Number(p.budget) : null,
      budgetAmount: p.budgetAmount ? Number(p.budgetAmount) : null,
      defaultRate: p.defaultRate ? Number(p.defaultRate) : null,
      status: p.status,
      startDate: p.startDate?.toISOString().split('T')[0] ?? null,
      endDate: p.endDate?.toISOString().split('T')[0] ?? null,
      hoursUsed: Math.round((hoursMap[p.name] || 0) * 100) / 100,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      projects: mapped,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching time projects', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des projets' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/time-tracking/projects
// Create a time project
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check code uniqueness
    const existing = await prisma.timeProject.findFirst({
      where: { code: data.code, deletedAt: null },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Un projet avec le code "${data.code}" existe deja` },
        { status: 409 }
      );
    }

    const project = await prisma.timeProject.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description || null,
        clientName: data.clientName || null,
        budget: data.budget ?? null,
        budgetAmount: data.budgetAmount ?? null,
        defaultRate: data.defaultRate ?? null,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    logger.info('Time project created', { projectId: project.id, code: project.code });

    return NextResponse.json(
      {
        success: true,
        project: {
          id: project.id,
          name: project.name,
          code: project.code,
          description: project.description,
          clientName: project.clientName,
          budget: project.budget ? Number(project.budget) : null,
          budgetAmount: project.budgetAmount ? Number(project.budgetAmount) : null,
          defaultRate: project.defaultRate ? Number(project.defaultRate) : null,
          status: project.status,
          startDate: project.startDate?.toISOString().split('T')[0] ?? null,
          endDate: project.endDate?.toISOString().split('T')[0] ?? null,
          hoursUsed: 0,
          createdAt: project.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating time project', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la creation du projet' },
      { status: 500 }
    );
  }
});
