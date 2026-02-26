export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createProjectSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  code: z.string().min(1, 'Le code est requis').max(20),
  description: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  clientEmail: z.string().email('Email invalide').optional().nullable(),
  projectManager: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).optional().default('ACTIVE'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  budgetHours: z.number().min(0).optional().nullable(),
  budgetAmount: z.number().min(0).optional().nullable(),
  billingMethod: z.enum(['FIXED', 'TIME_AND_MATERIALS', 'RETAINER']).optional().default('FIXED'),
  fixedPrice: z.number().min(0).optional().nullable(),
  retainerAmount: z.number().min(0).optional().nullable(),
  retainerPeriod: z.enum(['MONTHLY', 'QUARTERLY']).optional().nullable(),
  defaultRate: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapProjectToJson(p: Record<string, unknown>) {
  return {
    ...p,
    budgetHours: p.budgetHours ? Number(p.budgetHours) : null,
    budgetAmount: p.budgetAmount ? Number(p.budgetAmount) : null,
    fixedPrice: p.fixedPrice ? Number(p.fixedPrice) : null,
    retainerAmount: p.retainerAmount ? Number(p.retainerAmount) : null,
    defaultRate: p.defaultRate ? Number(p.defaultRate) : null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/accounting/project-costing
// List projects with summaries
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const billingMethod = searchParams.get('billingMethod');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const allowedSortFields = ['createdAt', 'name', 'code', 'status', 'clientName', 'startDate'];
    const safeSortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { deletedAt: null };

    if (status) where.status = status;
    if (billingMethod) where.billingMethod = billingMethod;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.costProject.findMany({
        where,
        include: {
          costEntries: {
            select: {
              totalCost: true,
              billableAmount: true,
              isBillable: true,
              invoiceId: true,
              type: true,
            },
          },
          milestones: {
            select: {
              id: true,
              status: true,
              amount: true,
            },
          },
        },
        orderBy: { [safeSortField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.costProject.count({ where }),
    ]);

    // Compute summaries for each project
    const mapped = projects.map((p) => {
      const totalCost = p.costEntries.reduce((sum, e) => sum + Number(e.totalCost), 0);
      const totalBillable = p.costEntries
        .filter((e) => e.isBillable)
        .reduce((sum, e) => sum + Number(e.billableAmount), 0);
      const totalBilled = p.costEntries
        .filter((e) => e.invoiceId)
        .reduce((sum, e) => sum + Number(e.billableAmount), 0);
      const budgetAmount = p.budgetAmount ? Number(p.budgetAmount) : 0;
      const budgetUsedPct = budgetAmount > 0 ? Math.round((totalCost / budgetAmount) * 100) : 0;

      // Revenue depends on billing method
      let revenue = 0;
      if (p.billingMethod === 'FIXED' && p.fixedPrice) {
        revenue = Number(p.fixedPrice);
      } else if (p.billingMethod === 'TIME_AND_MATERIALS') {
        revenue = totalBillable;
      } else if (p.billingMethod === 'RETAINER' && p.retainerAmount) {
        revenue = Number(p.retainerAmount);
      }

      const profitability = revenue > 0
        ? Math.round(((revenue - totalCost) / revenue) * 100)
        : 0;

      const completedMilestones = p.milestones.filter((m) => m.status === 'COMPLETED').length;
      const totalMilestones = p.milestones.length;

      // Remove raw entries from response to keep it light
      const { costEntries: _ce, milestones: _ms, ...projectData } = p;

      return {
        ...mapProjectToJson(projectData),
        summary: {
          totalCost: Math.round(totalCost * 100) / 100,
          totalBillable: Math.round(totalBillable * 100) / 100,
          totalBilled: Math.round(totalBilled * 100) / 100,
          budgetUsedPct,
          revenue: Math.round(revenue * 100) / 100,
          profitability,
          completedMilestones,
          totalMilestones,
        },
      };
    });

    return NextResponse.json({
      projects: mapped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Get cost projects error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des projets' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/project-costing
// Create new project
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request, { session }) => {
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
    const existing = await prisma.costProject.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Le code projet "${data.code}" existe deja` },
        { status: 409 }
      );
    }

    const project = await prisma.costProject.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description || null,
        clientName: data.clientName || null,
        clientEmail: data.clientEmail || null,
        projectManager: data.projectManager || null,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        budgetHours: data.budgetHours ?? null,
        budgetAmount: data.budgetAmount ?? null,
        billingMethod: data.billingMethod,
        fixedPrice: data.fixedPrice ?? null,
        retainerAmount: data.retainerAmount ?? null,
        retainerPeriod: data.retainerPeriod || null,
        defaultRate: data.defaultRate ?? null,
        notes: data.notes || null,
        createdBy: session.user.id || session.user.email || null,
      },
    });

    logger.info('Cost project created', {
      projectId: project.id,
      code: project.code,
      name: project.name,
    });

    return NextResponse.json(
      { success: true, project: mapProjectToJson(project) },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Create cost project error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la creation du projet' },
      { status: 500 }
    );
  }
});
