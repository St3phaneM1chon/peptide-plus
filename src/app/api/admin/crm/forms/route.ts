export const dynamic = 'force-dynamic';

/**
 * CRM Lead Capture Forms API
 * GET: List forms
 * POST: Create form
 */

import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';

export const GET = withAdminGuard(async (request) => {
  const forms = await prisma.crmLeadForm.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return apiSuccess(forms, { request });
});

export const POST = withAdminGuard(async (request, { session }) => {
  const body = await request.json();
  const { name, fields, redirectUrl, notifyEmails, assignToId, tags } = body;

  if (!name) return apiError('Name required', 'VALIDATION_ERROR', { status: 400 });

  const form = await prisma.crmLeadForm.create({
    data: {
      name,
      fields: fields || [
        { name: 'contactName', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'phone', label: 'Phone', type: 'tel', required: false },
        { name: 'message', label: 'Message', type: 'textarea', required: false },
      ],
      redirectUrl,
      notifyEmails: notifyEmails || [],
      assignToId,
      tags: tags || [],
      createdById: session.user.id,
    },
  });

  return apiSuccess(form, { request, status: 201 });
});
