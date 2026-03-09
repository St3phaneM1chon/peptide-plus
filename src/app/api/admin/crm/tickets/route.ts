export const dynamic = 'force-dynamic';

/**
 * CRM Tickets API (E19)
 * GET  /api/admin/crm/tickets — List tickets with filters, search, pagination
 * POST /api/admin/crm/tickets — Create a new support ticket
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

const createTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500).trim(),
  description: z.string().max(10000).trim().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']).default('MEDIUM'),
  category: z.enum([
    'GENERAL', 'BILLING', 'TECHNICAL', 'SHIPPING', 'RETURNS',
    'PRODUCT_INQUIRY', 'COMPLAINT', 'FEATURE_REQUEST', 'OTHER',
  ]).default('GENERAL'),
  contactEmail: z.string().email().optional(),
  contactName: z.string().max(200).trim().optional(),
  assignedToId: z.string().cuid().optional(),
  tags: z.array(z.string().max(50).trim()).max(20).default([]),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate the next ticket number in TKT-XXX format.
 */
async function generateTicketNumber(): Promise<string> {
  const lastTicket = await prisma.crmTicket.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { number: true },
  });

  let nextNum = 1;
  if (lastTicket?.number) {
    const match = lastTicket.number.match(/TKT-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `TKT-${String(nextNum).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// GET: List tickets with filters and pagination
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  // Filters
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const category = searchParams.get('category');
  const assignedToId = searchParams.get('assignedToId');
  const search = searchParams.get('search');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;
  if (assignedToId) where.assignedToId = assignedToId;

  if (search) {
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
      { contactName: { contains: search, mode: 'insensitive' } },
      { contactEmail: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.crmTicket.findMany({
      where,
      include: {
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, authorName: true, createdAt: true },
        },
        _count: { select: { comments: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: limit,
    }),
    prisma.crmTicket.count({ where }),
  ]);

  logger.info('[Tickets] Listed', { page, limit, total, status, priority, category });

  return apiPaginated(tickets, page, limit, total, { request });
}, { requiredPermission: 'crm.leads.view' });

// ---------------------------------------------------------------------------
// POST: Create a new ticket
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const body = await request.json();
  const parsed = createTicketSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const {
    subject, description, priority, category,
    contactEmail, contactName, assignedToId, tags,
  } = parsed.data;

  // Validate assignee exists if provided
  if (assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true },
    });
    if (!assignee) {
      return apiError('Assigned user not found', ErrorCode.NOT_FOUND, {
        status: 404,
        request,
      });
    }
  }

  // Try to find contact by email
  let contactId: string | null = null;
  if (contactEmail) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: contactEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    contactId = user?.id ?? null;
  }

  const ticketNumber = await generateTicketNumber();

  const ticket = await prisma.crmTicket.create({
    data: {
      number: ticketNumber,
      subject,
      description: description ?? null,
      priority,
      category,
      contactId,
      contactName: contactName ?? null,
      contactEmail: contactEmail ?? null,
      assignedToId: assignedToId ?? null,
      tags,
    },
    include: {
      _count: { select: { comments: true } },
    },
  });

  logger.info('[Tickets] Ticket created', {
    event: 'ticket_created',
    ticketId: ticket.id,
    number: ticket.number,
    priority,
    category,
    assignedToId,
    userId: session.user.id,
  });

  return apiSuccess(ticket, { status: 201, request });
}, { requiredPermission: 'crm.leads.edit' });
