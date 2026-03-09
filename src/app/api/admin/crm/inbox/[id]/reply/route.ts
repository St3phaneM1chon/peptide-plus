export const dynamic = 'force-dynamic';

/**
 * CRM Inbox Reply API
 * POST /api/admin/crm/inbox/[id]/reply - Add a message to a conversation
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

const replySchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000).trim(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).default('OUTBOUND'),
});

// ---------------------------------------------------------------------------
// POST: Add message to conversation
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = replySchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        request,
        details: parsed.error.flatten(),
      });
    }

    const { content, direction } = parsed.data;

    // Verify conversation exists
    const conversation = await prisma.inboxConversation.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!conversation) {
      return apiError('Conversation not found', ErrorCode.NOT_FOUND, { request });
    }

    // Determine if we need to reopen the conversation
    const shouldReopen =
      direction === 'INBOUND' &&
      (conversation.status === 'RESOLVED' || conversation.status === 'CLOSED');

    // Create message and update conversation in a transaction
    const message = await prisma.$transaction(async (tx) => {
      // Create the message
      const newMessage = await tx.inboxMessage.create({
        data: {
          conversationId: id,
          direction,
          content,
        },
      });

      // Update lastMessageAt and optionally reopen
      await tx.inboxConversation.update({
        where: { id },
        data: {
          lastMessageAt: new Date(),
          ...(shouldReopen ? { status: 'OPEN' } : {}),
        },
      });

      return newMessage;
    });

    logger.info('[crm/inbox/[id]/reply] Message added', {
      conversationId: id,
      messageId: message.id,
      direction,
      reopened: shouldReopen,
    });

    return apiSuccess(message, { status: 201, request });
  } catch (error) {
    logger.error('[crm/inbox/[id]/reply] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to add message', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.edit' });
