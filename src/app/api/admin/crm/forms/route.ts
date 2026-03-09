export const dynamic = 'force-dynamic';

/**
 * CRM Lead Capture Forms API
 * GET: List forms
 * POST: Create form
 */

import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';

export const GET = withAdminGuard(async (request) => {
  const forms = await prisma.crmLeadForm.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return apiSuccess(forms, { request });
}, { requiredPermission: 'crm.leads.view' });

const createFormSchema = z.object({
  name: z.string().min(1, 'Name required').max(255),
  fields: z.array(z.object({
    name: z.string().min(1).max(100),
    label: z.string().min(1).max(200),
    type: z.string().min(1).max(50),
    required: z.boolean().optional(),
  })).optional(),
  redirectUrl: z.string().url().max(2048).optional().nullable(),
  notifyEmails: z.array(z.string().email().max(320)).max(20).optional(),
  assignToId: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional(),
});

export const POST = withAdminGuard(async (request, { session }) => {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError('Invalid JSON body', 'VALIDATION_ERROR', { status: 400 });
  }

  const parsed = createFormSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError(
      parsed.error.errors[0]?.message || 'Invalid form data',
      'VALIDATION_ERROR',
      { status: 400 }
    );
  }

  const { name, fields, redirectUrl, notifyEmails, assignToId, tags } = parsed.data;

  const form = await prisma.crmLeadForm.create({
    data: {
      name,
      fields: fields || [
        { name: 'contactName', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'phone', label: 'Phone', type: 'tel', required: false },
        { name: 'message', label: 'Message', type: 'textarea', required: false },
      ],
      redirectUrl: redirectUrl || null,
      notifyEmails: notifyEmails || [],
      assignToId: assignToId || null,
      tags: tags || [],
      createdById: session.user.id,
    },
  });

  return apiSuccess(form, { request, status: 201 });
}, { requiredPermission: 'crm.leads.edit' });
