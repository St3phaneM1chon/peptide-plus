export const dynamic = 'force-dynamic';

/**
 * CRM Inbox API
 * GET  /api/admin/crm/inbox - List conversations with filters, search, pagination
 * POST /api/admin/crm/inbox - Create a new conversation
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createConversationSchema = z.object({
  channel: z.enum(['EMAIL', 'SMS', 'PHONE', 'CHAT', 'WHATSAPP']),
  subject: z.string().max(500).trim().optional(),
  contactId: z.string().cuid().optional(),
  leadId: z.string().cuid().optional(),
  assignedToId: z.string().cuid().optional(),
});

// ---------------------------------------------------------------------------
// GET: List conversations
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  // Filters
  const channel = searchParams.get('channel');
  const status = searchParams.get('status');
  const assignedToId = searchParams.get('assignedToId');
  const search = searchParams.get('search');

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (channel) where.channel = channel;
  if (status) where.status = status;
  if (assignedToId) where.assignedToId = assignedToId;

  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [conversations, total] = await Promise.all([
    prisma.inboxConversation.findMany({
      where,
      include: {
        contact: {
          select: { name: true, email: true },
        },
        lead: {
          select: { contactName: true },
        },
        assignedTo: {
          select: { name: true, email: true },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.inboxConversation.count({ where }),
  ]);

  return apiPaginated(conversations, page, limit, total, { request });
}, { requiredPermission: 'crm.leads.view' });

// ---------------------------------------------------------------------------
// POST: Create a conversation
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createConversationSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    const { channel, subject, contactId, leadId, assignedToId } = parsed.data;

    // Validate contactId if provided
    if (contactId) {
      const contact = await prisma.user.findUnique({
        where: { id: contactId },
        select: { id: true },
      });
      if (!contact) {
        return apiError('Contact not found', ErrorCode.RESOURCE_NOT_FOUND, {
          status: 404,
          request,
        });
      }
    }

    // Validate leadId if provided
    if (leadId) {
      const lead = await prisma.crmLead.findUnique({
        where: { id: leadId },
        select: { id: true },
      });
      if (!lead) {
        return apiError('Lead not found', ErrorCode.RESOURCE_NOT_FOUND, {
          status: 404,
          request,
        });
      }
    }

    // Validate assignedToId if provided
    if (assignedToId) {
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
    }

    const conversation = await prisma.inboxConversation.create({
      data: {
        channel,
        status: 'OPEN',
        subject: subject || null,
        contactId: contactId || null,
        leadId: leadId || null,
        assignedToId: assignedToId || null,
      },
      include: {
        contact: {
          select: { name: true, email: true },
        },
        lead: {
          select: { contactName: true },
        },
        assignedTo: {
          select: { name: true, email: true },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    logger.info('[crm/inbox] Conversation created', {
      conversationId: conversation.id,
      channel,
    });

    return apiSuccess(conversation, { status: 201, request });
  } catch (error) {
    logger.error('[crm/inbox] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create conversation', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.edit' });
