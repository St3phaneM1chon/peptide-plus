export const dynamic = 'force-dynamic';

/**
 * CRM Inbox Status API
 * PUT /api/admin/crm/inbox/[id]/status - Change conversation status
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

const statusSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']),
});

// ---------------------------------------------------------------------------
// PUT: Change conversation status
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        request,
        details: parsed.error.flatten(),
      });
    }

    const { status } = parsed.data;

    // Verify conversation exists
    const conversation = await prisma.inboxConversation.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!conversation) {
      return apiError('Conversation not found', ErrorCode.NOT_FOUND, { request });
    }

    const updated = await prisma.inboxConversation.update({
      where: { id },
      data: { status },
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

    logger.info('[crm/inbox/[id]/status] Status changed', {
      conversationId: id,
      oldStatus: conversation.status,
      newStatus: status,
    });

    return apiSuccess(updated, { request });
  } catch (error) {
    logger.error('[crm/inbox/[id]/status] PUT error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to update status', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.edit' });
