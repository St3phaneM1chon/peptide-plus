export const dynamic = 'force-dynamic';

/**
 * CSV Import into Prospect List
 * POST /api/admin/crm/lists/[id]/import
 *
 * Accepts JSON body with parsed CSV rows (frontend does the CSV parsing).
 * Detects duplicates intra-list + cross-lists.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { updateListCounters } from '@/lib/crm/prospect-dedup';

const importRowSchema = z.object({
  contactName: z.string().min(1).max(200).trim(),
  companyName: z.string().max(200).trim().optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(50).trim().optional(),
  website: z.string().max(500).trim().optional(),
  address: z.string().max(500).trim().optional(),
  city: z.string().max(100).trim().optional(),
  province: z.string().max(100).trim().optional(),
  postalCode: z.string().max(20).trim().optional(),
  country: z.string().max(100).trim().optional(),
  industry: z.string().max(200).trim().optional(),
  notes: z.string().max(5000).trim().optional(),
});

const importSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(2000),
});

export const POST = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: listId } = await context.params;
  const body = await request.json();
  const parsed = importSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const list = await prisma.prospectList.findUnique({ where: { id: listId } });
  if (!list) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  // Build set of existing emails in this list for dedup
  const existingEmails = new Set(
    (await prisma.prospect.findMany({
      where: { listId, email: { not: null }, status: { notIn: ['MERGED'] } },
      select: { email: true },
    })).map((p) => p.email?.toLowerCase()),
  );

  // Also check across all CrmLeads
  const existingLeadEmails = new Set(
    (await prisma.crmLead.findMany({
      where: { email: { not: null } },
      select: { email: true },
    })).map((l) => l.email?.toLowerCase()),
  );

  let imported = 0;
  let duplicates = 0;
  const errors: { index: number; contactName: string; reason: string }[] = [];
  const seenEmails = new Set<string>();

  const createData = [];

  for (let i = 0; i < parsed.data.rows.length; i++) {
    const row = parsed.data.rows[i];
    const emailNorm = row.email?.toLowerCase()?.trim();

    // Check intra-batch duplicate
    if (emailNorm && seenEmails.has(emailNorm)) {
      duplicates++;
      continue;
    }

    // Check intra-list duplicate
    if (emailNorm && existingEmails.has(emailNorm)) {
      duplicates++;
      continue;
    }

    // Check cross-CrmLead duplicate (mark but still import)
    const isCrossListDup = emailNorm && existingLeadEmails.has(emailNorm);

    if (emailNorm) seenEmails.add(emailNorm);

    createData.push({
      listId,
      contactName: row.contactName,
      companyName: row.companyName || null,
      email: emailNorm || null,
      phone: row.phone || null,
      website: row.website || null,
      address: row.address || null,
      city: row.city || null,
      province: row.province || null,
      postalCode: row.postalCode || null,
      country: row.country || null,
      industry: row.industry || null,
      notes: row.notes || null,
      status: isCrossListDup ? 'DUPLICATE' as const : 'NEW' as const,
    });
    imported++;
  }

  // Bulk create
  if (createData.length > 0) {
    await prisma.prospect.createMany({ data: createData, skipDuplicates: true });
  }

  // Update list source if CSV
  if (list.source === 'MANUAL') {
    await prisma.prospectList.update({ where: { id: listId }, data: { source: 'CSV_IMPORT' } });
  }

  await updateListCounters(listId);

  return apiSuccess({ imported, duplicates, errors }, { status: 201, request });
});
