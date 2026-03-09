export const dynamic = 'force-dynamic';

/**
 * CRM Inbox Assign API
 * PUT /api/admin/crm/inbox/[id]/assign - Assign a conversation to a user
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

const assignSchema = z.object({
  assignedToId: z.string().cuid('Invalid user ID'),
});

// ---------------------------------------------------------------------------
// PUT: Assign conversation to a user
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = assignSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        request,
        details: parsed.error.flatten(),
      });
    }

    const { assignedToId } = parsed.data;

    // Verify conversation exists
    const conversation = await prisma.inboxConversation.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!conversation) {
      return apiError('Conversation not found', ErrorCode.NOT_FOUND, { request });
    }

    // Verify assignee exists
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true },
    });

    if (!assignee) {
      return apiError('Assigned user not found', ErrorCode.RESOURCE_NOT_FOUND, {
        status: 404,
        request,
      });
    }

    const updated = await prisma.inboxConversation.update({
      where: { id },
      data: { assignedToId },
      include: {
        contact: {
          select: { name: true, email: true },
        },
        lead: {
          select: { contactName: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    logger.info('[crm/inbox/[id]/assign] Conversation assigned', {
      conversationId: id,
      assignedToId,
    });

    return apiSuccess(updated, { request });
  } catch (error) {
    logger.error('[crm/inbox/[id]/assign] PUT error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to assign conversation', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.edit' });
