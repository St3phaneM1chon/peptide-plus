export const dynamic = 'force-dynamic';

/**
 * CRM Leads Import API
 * POST /api/admin/crm/leads/import - Import leads from a JSON array (CSV-parsed data)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const importLeadItemSchema = z.object({
  contactName: z.string().min(1, 'Contact name is required').max(200).trim(),
  companyName: z.string().max(200).trim().optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(50).trim().optional(),
  source: z.enum(['WEB', 'REFERRAL', 'IMPORT', 'CAMPAIGN', 'MANUAL', 'PARTNER']).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
});

const importLeadsSchema = z.object({
  leads: z.array(importLeadItemSchema).min(1, 'At least one lead is required').max(1000, 'Maximum 1000 leads per import'),
});

// ---------------------------------------------------------------------------
// POST: Import leads
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = importLeadsSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { leads } = parsed.data;

  const results = {
    imported: 0,
    duplicates: 0,
    dncSkipped: 0,
    errors: [] as { index: number; contactName: string; reason: string }[],
  };

  // Collect all emails for dedup check in a single query
  const emails = leads
    .map((l) => l.email?.toLowerCase())
    .filter((e): e is string => !!e);

  const existingLeads = emails.length > 0
    ? await prisma.crmLead.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      })
    : [];

  const existingEmailSet = new Set(
    existingLeads.map((l) => l.email?.toLowerCase()).filter(Boolean)
  );

  // Check DNC list: look for phone numbers that are on the DNC list
  // We check the CrmLead table itself for any existing records with DNC status
  const phones = leads
    .map((l) => l.phone?.trim())
    .filter((p): p is string => !!p);

  const dncPhones = phones.length > 0
    ? await prisma.crmLead.findMany({
        where: {
          phone: { in: phones },
          dncStatus: { not: 'CALLABLE' },
        },
        select: { phone: true },
      })
    : [];

  const dncPhoneSet = new Set(
    dncPhones.map((l) => l.phone).filter(Boolean)
  );

  // Process leads
  const leadsToCreate: {
    contactName: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    source: 'WEB' | 'REFERRAL' | 'IMPORT' | 'CAMPAIGN' | 'MANUAL' | 'PARTNER';
    status: 'NEW';
    score: number;
    temperature: 'COLD';
    tags: string[];
  }[] = [];

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];

    // Check email duplicate
    if (lead.email && existingEmailSet.has(lead.email.toLowerCase())) {
      results.duplicates++;
      continue;
    }

    // Check DNC on phone
    if (lead.phone && dncPhoneSet.has(lead.phone.trim())) {
      results.dncSkipped++;
      continue;
    }

    try {
      leadsToCreate.push({
        contactName: lead.contactName,
        companyName: lead.companyName || null,
        email: lead.email?.toLowerCase() || null,
        phone: lead.phone?.trim() || null,
        source: lead.source || 'IMPORT',
        status: 'NEW',
        score: 0,
        temperature: 'COLD',
        tags: lead.tags || [],
      });

      // Track email to avoid duplicates within the same batch
      if (lead.email) {
        existingEmailSet.add(lead.email.toLowerCase());
      }
    } catch (error) {
      console.error('[CRM/LeadsImport] Error processing lead at index', { index: i, contactName: lead.contactName, error });
      results.errors.push({
        index: i,
        contactName: lead.contactName,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Bulk create all valid leads
  if (leadsToCreate.length > 0) {
    await prisma.crmLead.createMany({
      data: leadsToCreate,
      skipDuplicates: true,
    });
    results.imported = leadsToCreate.length;
  }

  return apiSuccess(results, { request });
}, { requiredPermission: 'crm.leads.import' });
