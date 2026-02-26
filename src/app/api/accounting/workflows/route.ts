export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { seedDefaultWorkflowRules } from '@/lib/accounting/workflow-engine.service';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});

const actionSchema = z.object({
  type: z.enum(['REQUIRE_APPROVAL', 'SEND_NOTIFICATION', 'AUTO_APPROVE', 'BLOCK']),
  params: z
    .object({
      role: z.string().optional(),
      userId: z.string().optional(),
      message: z.string().optional(),
      expiresInDays: z.number().int().positive().optional(),
    })
    .optional(),
});

const createWorkflowRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  entityType: z.enum([
    'JOURNAL_ENTRY',
    'EXPENSE',
    'PURCHASE_ORDER',
    'INVOICE',
    'CREDIT_NOTE',
    'PAYROLL_RUN',
    'TIME_ENTRY',
  ]),
  triggerEvent: z.enum(['CREATE', 'UPDATE', 'STATUS_CHANGE', 'AMOUNT_THRESHOLD']),
  conditions: z.array(conditionSchema),
  actions: z.array(actionSchema).min(1, 'At least one action is required'),
  priority: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/workflows - List workflow rules
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const isActive = searchParams.get('isActive');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);
    const seedDefaults = searchParams.get('seedDefaults');

    // Optional: seed default rules
    if (seedDefaults === 'true') {
      const seeded = await seedDefaultWorkflowRules();
      if (seeded > 0) {
        logger.info(`Seeded ${seeded} default workflow rules via API`);
      }
    }

    // Build where clause
    const where: Record<string, unknown> = { deletedAt: null };
    if (entityType) where.entityType = entityType;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const [rules, total] = await Promise.all([
      prisma.workflowRule.findMany({
        where,
        orderBy: { priority: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.workflowRule.count({ where }),
    ]);

    // Parse JSON fields for the response
    const mapped = rules.map((rule) => ({
      ...rule,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions),
    }));

    return apiPaginated(mapped, page, limit, total, { request });
  } catch (error) {
    logger.error('Error fetching workflow rules', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Error fetching workflow rules', 'INTERNAL_ERROR', { status: 500, request });
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/workflows - Create workflow rule
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createWorkflowRuleSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid data', 'VALIDATION_ERROR', {
        status: 400,
        details: parsed.error.flatten().fieldErrors,
        request,
      });
    }

    const data = parsed.data;

    const rule = await prisma.workflowRule.create({
      data: {
        name: data.name,
        description: data.description || null,
        entityType: data.entityType,
        triggerEvent: data.triggerEvent,
        conditions: JSON.stringify(data.conditions),
        actions: JSON.stringify(data.actions),
        priority: data.priority,
        isActive: data.isActive,
        createdBy: session.user?.email || null,
      },
    });

    logger.info('Workflow rule created', {
      ruleId: rule.id,
      name: rule.name,
      entityType: rule.entityType,
      createdBy: session.user?.email,
    });

    return apiSuccess(
      {
        ...rule,
        conditions: JSON.parse(rule.conditions),
        actions: JSON.parse(rule.actions),
      },
      { status: 201, request },
    );
  } catch (error) {
    logger.error('Error creating workflow rule', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Error creating workflow rule', 'INTERNAL_ERROR', { status: 500, request });
  }
});
