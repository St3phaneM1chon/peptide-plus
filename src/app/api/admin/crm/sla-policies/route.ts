export const dynamic = 'force-dynamic';

/**
 * CRM SLA Policies API
 * GET  /api/admin/crm/sla-policies - List all active SLA policies
 * POST /api/admin/crm/sla-policies - Create a new SLA policy
 * PUT  /api/admin/crm/sla-policies - Update an existing SLA policy
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createSlaPolicySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  firstResponseMinutes: z.number().int().min(1),
  resolutionMinutes: z.number().int().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  channels: z.array(z.enum(['EMAIL', 'SMS', 'PHONE', 'CHAT', 'WHATSAPP'])).min(1, 'At least one channel is required'),
});

const updateSlaPolicySchema = z.object({
  id: z.string().cuid('Invalid policy ID'),
  name: z.string().min(1).max(200).trim().optional(),
  firstResponseMinutes: z.number().int().min(1).optional(),
  resolutionMinutes: z.number().int().min(1).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  isActive: z.boolean().optional(),
  channels: z.array(z.enum(['EMAIL', 'SMS', 'PHONE', 'CHAT', 'WHATSAPP'])).optional(),
});

// ---------------------------------------------------------------------------
// GET: List all active SLA policies
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const policies = await prisma.slaPolicy.findMany({
      where: { isActive: true },
      orderBy: [
        { priority: 'desc' },
        { name: 'asc' },
      ],
    });

    return apiSuccess(policies, { request });
  } catch (error) {
    logger.error('[crm/sla-policies] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch SLA policies', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.settings' });

// ---------------------------------------------------------------------------
// POST: Create a new SLA policy
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createSlaPolicySchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    const { name, firstResponseMinutes, resolutionMinutes, priority, channels } = parsed.data;

    // Check for duplicate name
    const existing = await prisma.slaPolicy.findFirst({
      where: { name, isActive: true },
      select: { id: true },
    });

    if (existing) {
      return apiError('An active SLA policy with this name already exists', ErrorCode.DUPLICATE_ENTRY, {
        status: 409,
        request,
      });
    }

    const policy = await prisma.slaPolicy.create({
      data: {
        name,
        firstResponseMinutes,
        resolutionMinutes,
        priority,
        channels,
        isActive: true,
      },
    });

    logger.info('[crm/sla-policies] Policy created', {
      policyId: policy.id,
      name,
      priority,
    });

    return apiSuccess(policy, { status: 201, request });
  } catch (error) {
    logger.error('[crm/sla-policies] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create SLA policy', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.settings' });

// ---------------------------------------------------------------------------
// PUT: Update an existing SLA policy
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = updateSlaPolicySchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    const { id, ...updateData } = parsed.data;

    // Verify policy exists
    const existing = await prisma.slaPolicy.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return apiError('SLA policy not found', ErrorCode.NOT_FOUND, { request });
    }

    // If renaming, check for duplicate name
    if (updateData.name) {
      const duplicate = await prisma.slaPolicy.findFirst({
        where: {
          name: updateData.name,
          isActive: true,
          id: { not: id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return apiError('An active SLA policy with this name already exists', ErrorCode.DUPLICATE_ENTRY, {
          status: 409,
          request,
        });
      }
    }

    const policy = await prisma.slaPolicy.update({
      where: { id },
      data: updateData,
    });

    logger.info('[crm/sla-policies] Policy updated', {
      policyId: id,
    });

    return apiSuccess(policy, { request });
  } catch (error) {
    logger.error('[crm/sla-policies] PUT error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to update SLA policy', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.settings' });
