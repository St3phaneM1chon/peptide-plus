export const dynamic = 'force-dynamic';

/**
 * CRM Leads API
 * GET  /api/admin/crm/leads - List leads with filters, search, pagination
 * POST /api/admin/crm/leads - Create a new lead
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createLeadSchema = z.object({
  contactName: z.string().min(1, 'Contact name is required').max(200).trim(),
  companyName: z.string().max(200).trim().optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(50).trim().optional(),
  source: z.enum(['WEB', 'REFERRAL', 'IMPORT', 'CAMPAIGN', 'MANUAL', 'PARTNER', 'EMAIL', 'SOCIAL', 'CHATBOT']).optional(),
  assignedToId: z.string().cuid().optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  customFields: z.record(z.unknown()).optional(),
  timezone: z.string().max(100).optional(),
  preferredLang: z.string().max(10).optional(),
});

// ---------------------------------------------------------------------------
// GET: List leads
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  // Filters
  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const temperature = searchParams.get('temperature');
  const assignedToId = searchParams.get('assignedToId');
  const dncStatus = searchParams.get('dncStatus');
  const search = searchParams.get('search');
  const minScore = searchParams.get('minScore');
  const maxScore = searchParams.get('maxScore');
  const tagsParam = searchParams.get('tags');

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (status) where.status = status;
  if (source) where.source = source;
  if (temperature) where.temperature = temperature;
  if (assignedToId) where.assignedToId = assignedToId;
  if (dncStatus) where.dncStatus = dncStatus;

  if (search) {
    where.OR = [
      { contactName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (minScore || maxScore) {
    where.score = {};
    if (minScore) where.score.gte = parseInt(minScore, 10);
    if (maxScore) where.score.lte = parseInt(maxScore, 10);
  }

  if (tagsParam) {
    const tags = tagsParam.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length > 0) {
      where.tags = { hasSome: tags };
    }
  }

  const [leads, total] = await Promise.all([
    prisma.crmLead.findMany({
      where,
      include: {
        assignedTo: {
          select: { name: true, email: true },
        },
      },
      orderBy: { score: 'desc' },
      skip,
      take: limit,
    }),
    prisma.crmLead.count({ where }),
  ]);

  return apiPaginated(leads, page, limit, total, { request });
}, { requiredPermission: 'crm.leads.view' });

// ---------------------------------------------------------------------------
// POST: Create a lead
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = createLeadSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const {
    contactName,
    companyName,
    email,
    phone,
    source,
    assignedToId,
    tags,
    customFields,
    timezone,
    preferredLang,
  } = parsed.data;

  // Validate assignedToId if provided
  if (assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true },
    });
    if (!assignee) {
      return apiError('Assigned user not found', 'RESOURCE_NOT_FOUND', {
        status: 404,
        request,
      });
    }
  }

  const lead = await prisma.crmLead.create({
    data: {
      contactName,
      companyName: companyName || null,
      email: email || null,
      phone: phone || null,
      source: source || 'MANUAL',
      status: 'NEW',
      score: 0,
      temperature: 'COLD',
      assignedToId: assignedToId || null,
      tags: tags || [],
      customFields: customFields ? JSON.parse(JSON.stringify(customFields)) : undefined,
      timezone: timezone || null,
      preferredLang: preferredLang || null,
    },
    include: {
      assignedTo: {
        select: { name: true, email: true },
      },
    },
  });

  return apiSuccess(lead, { status: 201, request });
}, { requiredPermission: 'crm.leads.create' });
