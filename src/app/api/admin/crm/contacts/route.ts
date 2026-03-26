export const dynamic = 'force-dynamic';

/**
 * Admin CRM Contacts API
 * GET  /api/admin/crm/contacts - List CRM contacts with pagination and search
 * POST /api/admin/crm/contacts - Create a new contact
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiPaginated, apiSuccess, apiError } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createContactSchema = z.object({
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
// GET: List contacts
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;
  const search = searchParams.get('search');
  const source = searchParams.get('source');
  const temperature = searchParams.get('temperature');
  const status = searchParams.get('status');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (search) {
    where.OR = [
      { contactName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (source) where.source = source;
  if (temperature) where.temperature = temperature;
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    prisma.crmLead.findMany({
      where,
      select: {
        id: true,
        contactName: true,
        companyName: true,
        email: true,
        phone: true,
        source: true,
        status: true,
        score: true,
        temperature: true,
        tags: true,
        assignedToId: true,
        timezone: true,
        preferredLang: true,
        createdAt: true,
        updatedAt: true,
        assignedTo: { select: { name: true, email: true } },
      },
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.crmLead.count({ where }),
  ]);

  return apiPaginated(data, page, limit, total, { request });
}, { requiredPermission: 'crm.contacts.view' });

// ---------------------------------------------------------------------------
// POST: Create a contact
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = createContactSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
      request,
    });
  }

  const {
    contactName, companyName, email, phone, source,
    assignedToId, tags, customFields, timezone, preferredLang,
  } = parsed.data;

  // Validate assignedToId
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

  // CRM-F1 FIX: Sanitize free-text fields (matches leads pattern)
  const sanitize = (s: string | undefined | null) => s ? stripControlChars(stripHtml(s)).trim() : null;

  const contact = await prisma.crmLead.create({
    data: {
      contactName: sanitize(contactName)!,
      companyName: sanitize(companyName),
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
      assignedTo: { select: { name: true, email: true } },
    },
  });

  return apiSuccess(contact, { status: 201, request });
}, { requiredPermission: 'crm.contacts.edit' });
