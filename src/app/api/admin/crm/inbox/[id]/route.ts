export const dynamic = 'force-dynamic';

/**
 * CRM Inbox Conversation Detail API
 * GET /api/admin/crm/inbox/[id] - Get conversation with messages, contact, lead, assignedTo
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET: Get single conversation with all messages
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const conversation = await prisma.inboxConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        contact: {
          select: { id: true, name: true, email: true, image: true },
        },
        lead: {
          select: { id: true, contactName: true, email: true, phone: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    if (!conversation) {
      return apiError('Conversation not found', ErrorCode.NOT_FOUND, { request });
    }

    return apiSuccess(conversation, { request });
  } catch (error) {
    logger.error('[crm/inbox/[id]] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch conversation', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.view' });
