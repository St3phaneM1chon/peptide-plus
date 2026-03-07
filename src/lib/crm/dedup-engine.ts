/**
 * CRM Duplicate Detection Engine
 *
 * Matching rules:
 * - Exact email match
 * - Normalized phone match
 * - Fuzzy name + company match
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DuplicateMatch {
  leadId: string;
  matchedLeadId: string;
  matchType: 'email_exact' | 'phone_exact' | 'name_fuzzy' | 'name_company_fuzzy';
  confidence: number; // 0-1
  leadA: { contactName: string; email?: string; phone?: string; companyName?: string };
  leadB: { contactName: string; email?: string; phone?: string; companyName?: string };
}

export interface MergeResult {
  survivorId: string;
  mergedId: string;
  fieldsUpdated: string[];
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Find duplicates for a specific lead.
 */
export async function findDuplicatesForLead(leadId: string): Promise<DuplicateMatch[]> {
  const lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
  if (!lead) return [];

  const matches: DuplicateMatch[] = [];
  const seenIds = new Set<string>();

  // 1. Exact email match
  if (lead.email) {
    const emailMatches = await prisma.crmLead.findMany({
      where: { email: lead.email, id: { not: leadId } },
      select: { id: true, contactName: true, email: true, phone: true, companyName: true },
    });

    for (const match of emailMatches) {
      if (seenIds.has(match.id)) continue;
      seenIds.add(match.id);
      matches.push({
        leadId,
        matchedLeadId: match.id,
        matchType: 'email_exact',
        confidence: 0.95,
        leadA: { contactName: lead.contactName, email: lead.email || undefined, phone: lead.phone || undefined, companyName: lead.companyName || undefined },
        leadB: { contactName: match.contactName, email: match.email || undefined, phone: match.phone || undefined, companyName: match.companyName || undefined },
      });
    }
  }

  // 2. Normalized phone match
  if (lead.phone) {
    const normalizedPhone = normalizePhone(lead.phone);
    const phoneMatches = await prisma.crmLead.findMany({
      where: { id: { not: leadId } },
      select: { id: true, contactName: true, email: true, phone: true, companyName: true },
    });

    for (const match of phoneMatches) {
      if (seenIds.has(match.id) || !match.phone) continue;
      if (normalizePhone(match.phone) === normalizedPhone) {
        seenIds.add(match.id);
        matches.push({
          leadId,
          matchedLeadId: match.id,
          matchType: 'phone_exact',
          confidence: 0.9,
          leadA: { contactName: lead.contactName, email: lead.email || undefined, phone: lead.phone || undefined, companyName: lead.companyName || undefined },
          leadB: { contactName: match.contactName, email: match.email || undefined, phone: match.phone || undefined, companyName: match.companyName || undefined },
        });
      }
    }
  }

  // 3. Fuzzy name match (Levenshtein-based)
  if (lead.contactName) {
    const nameNorm = normalizeName(lead.contactName);
    const candidates = await prisma.crmLead.findMany({
      where: { id: { not: leadId } },
      select: { id: true, contactName: true, email: true, phone: true, companyName: true },
      take: 1000,
    });

    for (const match of candidates) {
      if (seenIds.has(match.id)) continue;
      const matchNameNorm = normalizeName(match.contactName);
      const similarity = stringSimilarity(nameNorm, matchNameNorm);

      if (similarity >= 0.85) {
        // High name similarity
        const hasCompanyMatch = lead.companyName && match.companyName &&
          stringSimilarity(normalizeName(lead.companyName), normalizeName(match.companyName)) >= 0.8;

        seenIds.add(match.id);
        matches.push({
          leadId,
          matchedLeadId: match.id,
          matchType: hasCompanyMatch ? 'name_company_fuzzy' : 'name_fuzzy',
          confidence: hasCompanyMatch ? 0.85 : 0.7,
          leadA: { contactName: lead.contactName, email: lead.email || undefined, phone: lead.phone || undefined, companyName: lead.companyName || undefined },
          leadB: { contactName: match.contactName, email: match.email || undefined, phone: match.phone || undefined, companyName: match.companyName || undefined },
        });
      }
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Scan entire database for duplicates.
 */
export async function scanAllDuplicates(limit: number = 100): Promise<DuplicateMatch[]> {
  const allMatches: DuplicateMatch[] = [];
  const processedPairs = new Set<string>();

  // Email duplicates (most reliable)
  const emailDups = await prisma.$queryRaw<{ email: string; count: number }[]>`
    SELECT email, COUNT(*)::int as count FROM "CrmLead"
    WHERE email IS NOT NULL AND email != ''
    GROUP BY email HAVING COUNT(*) > 1
    LIMIT ${limit}
  `;

  // Batch fetch all leads with duplicate emails in one query
  const dupEmails = emailDups.map((d) => d.email);
  const allDupLeads = dupEmails.length > 0
    ? await prisma.crmLead.findMany({
        where: { email: { in: dupEmails } },
        select: { id: true, contactName: true, email: true, phone: true, companyName: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  // Group by email
  const leadsByEmail = new Map<string, typeof allDupLeads>();
  for (const lead of allDupLeads) {
    if (!lead.email) continue;
    if (!leadsByEmail.has(lead.email)) leadsByEmail.set(lead.email, []);
    leadsByEmail.get(lead.email)!.push(lead);
  }

  for (const dup of emailDups) {
    const leads = leadsByEmail.get(dup.email) || [];

    for (let i = 0; i < leads.length - 1; i++) {
      for (let j = i + 1; j < leads.length; j++) {
        const pairKey = [leads[i].id, leads[j].id].sort().join(':');
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        allMatches.push({
          leadId: leads[i].id,
          matchedLeadId: leads[j].id,
          matchType: 'email_exact',
          confidence: 0.95,
          leadA: { contactName: leads[i].contactName, email: leads[i].email || undefined, phone: leads[i].phone || undefined, companyName: leads[i].companyName || undefined },
          leadB: { contactName: leads[j].contactName, email: leads[j].email || undefined, phone: leads[j].phone || undefined, companyName: leads[j].companyName || undefined },
        });
      }
    }
  }

  return allMatches.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

/**
 * Merge two leads — survivor keeps all data, merged lead is deleted.
 * Relations (deals, tasks, activities) are transferred to survivor.
 */
export async function mergeLeads(survivorId: string, mergedId: string): Promise<MergeResult> {
  const [survivor, merged] = await Promise.all([
    prisma.crmLead.findUnique({ where: { id: survivorId } }),
    prisma.crmLead.findUnique({ where: { id: mergedId } }),
  ]);

  if (!survivor || !merged) throw new Error('One or both leads not found');

  const fieldsUpdated: string[] = [];

  // Fill empty fields from merged lead
  const updateData: Record<string, unknown> = {};
  if (!survivor.email && merged.email) { updateData.email = merged.email; fieldsUpdated.push('email'); }
  if (!survivor.phone && merged.phone) { updateData.phone = merged.phone; fieldsUpdated.push('phone'); }
  if (!survivor.companyName && merged.companyName) { updateData.companyName = merged.companyName; fieldsUpdated.push('companyName'); }
  if (!survivor.timezone && merged.timezone) { updateData.timezone = merged.timezone; fieldsUpdated.push('timezone'); }

  // Merge tags
  const mergedTags = [...new Set([...survivor.tags, ...merged.tags])];
  if (mergedTags.length > survivor.tags.length) {
    updateData.tags = mergedTags;
    fieldsUpdated.push('tags');
  }

  // Keep higher score
  if (merged.score > survivor.score) {
    updateData.score = merged.score;
    updateData.temperature = merged.temperature;
    fieldsUpdated.push('score');
  }

  // Merge custom fields
  const survivorCustom = (survivor.customFields as Record<string, unknown>) || {};
  const mergedCustom = (merged.customFields as Record<string, unknown>) || {};
  const combinedCustom = { ...mergedCustom, ...survivorCustom }; // survivor takes precedence
  if (Object.keys(mergedCustom).length > 0) {
    updateData.customFields = combinedCustom;
    fieldsUpdated.push('customFields');
  }

  // Transaction: update survivor, transfer relations, delete merged
  await prisma.$transaction([
    // Update survivor
    prisma.crmLead.update({
      where: { id: survivorId },
      data: updateData as Parameters<typeof prisma.crmLead.update>[0]['data'],
    }),
    // Transfer deals
    prisma.crmDeal.updateMany({ where: { leadId: mergedId }, data: { leadId: survivorId } }),
    // Transfer tasks
    prisma.crmTask.updateMany({ where: { leadId: mergedId }, data: { leadId: survivorId } }),
    // Transfer activities
    prisma.crmActivity.updateMany({ where: { leadId: mergedId }, data: { leadId: survivorId } }),
    // Transfer inbox conversations
    prisma.inboxConversation.updateMany({ where: { leadId: mergedId }, data: { leadId: survivorId } }),
    // Create merge activity
    prisma.crmActivity.create({
      data: {
        type: 'NOTE',
        title: 'Lead merged',
        description: `Merged lead "${merged.contactName}" (${mergedId}) into this lead`,
        leadId: survivorId,
        metadata: { mergedLeadId: mergedId, mergedLeadName: merged.contactName, fieldsUpdated: fieldsUpdated as string[] },
      },
    }),
    // Delete merged lead
    prisma.crmLead.delete({ where: { id: mergedId } }),
  ]);

  logger.info('Leads merged', { survivorId, mergedId, fieldsUpdated });

  return { survivorId, mergedId, fieldsUpdated };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^1/, '');
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-zà-ÿ\s]/g, '').replace(/\s+/g, ' ');
}

/**
 * Simple string similarity (Dice coefficient).
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));

  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2));

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}
