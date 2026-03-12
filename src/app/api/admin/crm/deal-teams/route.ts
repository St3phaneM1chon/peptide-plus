export const dynamic = 'force-dynamic';

/**
 * CRM Deal Teams API (B17 - Commission splits)
 * GET    /api/admin/crm/deal-teams?dealId=... - List team members for a deal
 * POST   /api/admin/crm/deal-teams           - Add a team member
 * DELETE /api/admin/crm/deal-teams?id=...    - Remove a team member
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

const addMemberSchema = z.object({
  dealId: z.string().min(1, 'Deal ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['owner', 'member', 'support', 'overlay']).default('member'),
  splitPercent: z.number().min(0).max(100).default(0),
  isPrimary: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// GET: List team members for a deal
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const dealId = searchParams.get('dealId');

  if (!dealId) {
    return apiError('dealId query parameter is required', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      request,
    });
  }

  const members = await prisma.crmDealTeam.findMany({
    where: { dealId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });

  // Fetch user details separately (CrmDealTeam has no relation to User in schema)
  const userIds = members.map((m) => m.userId).filter((id): id is string => id != null);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, image: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const enriched = members.map((m) => ({
    ...m,
    user: m.userId ? (userMap.get(m.userId) || { id: m.userId, name: null, email: null, image: null }) : { id: null, name: null, email: null, image: null },
  }));

  return apiSuccess(enriched, { request });
}, { requiredPermission: 'crm.deals.view' });

// ---------------------------------------------------------------------------
// POST: Add a team member
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const body = await request.json();
  const parsed = addMemberSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { dealId, userId, role, splitPercent, isPrimary } = parsed.data;

  // Verify deal exists
  const deal = await prisma.crmDeal.findUnique({
    where: { id: dealId },
    select: { id: true },
  });

  if (!deal) {
    return apiError('Deal not found', ErrorCode.NOT_FOUND, { status: 404, request });
  }

  // Check if user is already on the team
  const existing = await prisma.crmDealTeam.findUnique({
    where: { dealId_userId: { dealId, userId } },
  });

  if (existing) {
    return apiError('User is already on this deal team', ErrorCode.VALIDATION_ERROR, {
      status: 409,
      request,
    });
  }

  // Validate total split does not exceed 100%
  const currentMembers = await prisma.crmDealTeam.findMany({
    where: { dealId },
    select: { splitPercent: true },
  });

  const currentTotal = currentMembers.reduce((sum, m) => sum + Number(m.splitPercent), 0);
  if (currentTotal + splitPercent > 100) {
    return apiError(
      `Total split would exceed 100% (current: ${currentTotal}%, adding: ${splitPercent}%)`,
      ErrorCode.VALIDATION_ERROR,
      { status: 400, request }
    );
  }

  const member = await prisma.crmDealTeam.create({
    data: { dealId, userId, role, splitPercent, isPrimary },
  });

  logger.info('Deal team member added', {
    event: 'deal_team_member_added',
    dealId,
    userId,
    role,
    splitPercent,
    addedBy: session.user.id,
  });

  return apiSuccess(member, { status: 201, request });
}, { requiredPermission: 'crm.deals.edit' });

// ---------------------------------------------------------------------------
// DELETE: Remove a team member
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return apiError('id query parameter is required', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      request,
    });
  }

  const member = await prisma.crmDealTeam.findUnique({
    where: { id },
    select: { id: true, dealId: true, userId: true },
  });

  if (!member) {
    return apiError('Team member not found', ErrorCode.NOT_FOUND, { status: 404, request });
  }

  await prisma.crmDealTeam.delete({ where: { id } });

  logger.info('Deal team member removed', {
    event: 'deal_team_member_removed',
    dealId: member.dealId,
    userId: member.userId,
    removedBy: session.user.id,
  });

  return apiSuccess({ deleted: true }, { request });
}, { requiredPermission: 'crm.deals.delete' });
