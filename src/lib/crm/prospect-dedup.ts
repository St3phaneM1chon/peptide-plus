/**
 * Prospect Duplicate Detection & Merge Engine
 *
 * Reuses patterns from dedup-engine.ts (CrmLead) adapted for Prospect model.
 * Rules: email exact → phone normalized → fuzzy name+company
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProspectDuplicateMatch {
  prospectId: string;
  matchedId: string;
  matchType: 'email_exact' | 'phone_exact' | 'name_fuzzy' | 'name_company_fuzzy' | 'google_place_id';
  confidence: number;
}

export interface ProspectMergeResult {
  survivorId: string;
  mergedId: string;
  fieldsUpdated: string[];
}

// ---------------------------------------------------------------------------
// Helpers (same as dedup-engine.ts)
// ---------------------------------------------------------------------------

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^1/, '');
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-zà-ÿ\s]/g, '').replace(/\s+/g, ' ');
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));
  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2));
  let intersection = 0;
  for (const bg of bigramsA) { if (bigramsB.has(bg)) intersection++; }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

// ---------------------------------------------------------------------------
// Detection within a list
// ---------------------------------------------------------------------------

export async function findProspectDuplicates(
  prospect: { id: string; email?: string | null; phone?: string | null; contactName: string; companyName?: string | null; googlePlaceId?: string | null },
  listId: string,
): Promise<ProspectDuplicateMatch[]> {
  const matches: ProspectDuplicateMatch[] = [];
  const seenIds = new Set<string>();

  // 1. Google Place ID exact match
  if (prospect.googlePlaceId) {
    const placeMatches = await prisma.prospect.findMany({
      where: { listId, googlePlaceId: prospect.googlePlaceId, id: { not: prospect.id }, status: { notIn: ['MERGED', 'EXCLUDED'] } },
      select: { id: true },
    });
    for (const m of placeMatches) {
      seenIds.add(m.id);
      matches.push({ prospectId: prospect.id, matchedId: m.id, matchType: 'google_place_id', confidence: 0.98 });
    }
  }

  // 2. Email exact
  if (prospect.email) {
    const emailNorm = prospect.email.toLowerCase().trim();
    const emailMatches = await prisma.prospect.findMany({
      where: { listId, email: { equals: emailNorm, mode: 'insensitive' }, id: { not: prospect.id }, status: { notIn: ['MERGED', 'EXCLUDED'] } },
      select: { id: true },
    });
    for (const m of emailMatches) {
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      matches.push({ prospectId: prospect.id, matchedId: m.id, matchType: 'email_exact', confidence: 0.95 });
    }
  }

  // 3. Phone normalized
  if (prospect.phone) {
    const normalizedPhone = normalizePhone(prospect.phone);
    const candidates = await prisma.prospect.findMany({
      where: { listId, phone: { not: null }, id: { not: prospect.id }, status: { notIn: ['MERGED', 'EXCLUDED'] } },
      select: { id: true, phone: true },
    });
    for (const m of candidates) {
      if (seenIds.has(m.id) || !m.phone) continue;
      if (normalizePhone(m.phone) === normalizedPhone) {
        seenIds.add(m.id);
        matches.push({ prospectId: prospect.id, matchedId: m.id, matchType: 'phone_exact', confidence: 0.9 });
      }
    }
  }

  // 4. Fuzzy name + company
  if (prospect.contactName) {
    const nameNorm = normalizeName(prospect.contactName);
    const candidates = await prisma.prospect.findMany({
      where: { listId, id: { not: prospect.id }, status: { notIn: ['MERGED', 'EXCLUDED'] } },
      select: { id: true, contactName: true, companyName: true },
      take: 500,
    });
    for (const m of candidates) {
      if (seenIds.has(m.id)) continue;
      const sim = stringSimilarity(nameNorm, normalizeName(m.contactName));
      if (sim >= 0.85) {
        const hasCompanyMatch = prospect.companyName && m.companyName &&
          stringSimilarity(normalizeName(prospect.companyName), normalizeName(m.companyName)) >= 0.8;
        seenIds.add(m.id);
        matches.push({
          prospectId: prospect.id,
          matchedId: m.id,
          matchType: hasCompanyMatch ? 'name_company_fuzzy' : 'name_fuzzy',
          confidence: hasCompanyMatch ? 0.85 : 0.7,
        });
      }
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

// ---------------------------------------------------------------------------
// Cross-list duplicate detection (against CrmLead)
// ---------------------------------------------------------------------------

export async function findCrossListDuplicates(
  prospect: { email?: string | null; phone?: string | null; contactName: string },
): Promise<{ leadId: string; matchType: string; confidence: number }[]> {
  const matches: { leadId: string; matchType: string; confidence: number }[] = [];

  if (prospect.email) {
    const emailMatches = await prisma.crmLead.findMany({
      where: { email: { equals: prospect.email, mode: 'insensitive' } },
      select: { id: true },
    });
    for (const m of emailMatches) {
      matches.push({ leadId: m.id, matchType: 'email_exact', confidence: 0.95 });
    }
  }

  if (prospect.phone) {
    const normalizedPhone = normalizePhone(prospect.phone);
    const candidates = await prisma.crmLead.findMany({
      where: { phone: { not: null } },
      select: { id: true, phone: true },
      take: 1000,
    });
    for (const m of candidates) {
      if (!m.phone) continue;
      if (normalizePhone(m.phone) === normalizedPhone) {
        if (!matches.some((x) => x.leadId === m.id)) {
          matches.push({ leadId: m.id, matchType: 'phone_exact', confidence: 0.9 });
        }
      }
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Merge prospects
// ---------------------------------------------------------------------------

export async function mergeProspects(survivorId: string, mergedId: string): Promise<ProspectMergeResult> {
  const [survivor, merged] = await Promise.all([
    prisma.prospect.findUnique({ where: { id: survivorId } }),
    prisma.prospect.findUnique({ where: { id: mergedId } }),
  ]);
  if (!survivor || !merged) throw new Error('One or both prospects not found');

  const fieldsUpdated: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  // Fill empty fields from merged
  const fillFields = [
    'email', 'phone', 'companyName', 'website', 'address', 'city',
    'province', 'postalCode', 'country', 'industry', 'googlePlaceId',
    'googleRating', 'googleReviewCount', 'googleCategory', 'latitude', 'longitude',
  ] as const;

  for (const field of fillFields) {
    if (!survivor[field] && merged[field]) {
      updateData[field] = merged[field];
      fieldsUpdated.push(field);
    }
  }

  // Concatenate notes
  if (merged.notes) {
    updateData.notes = survivor.notes ? `${survivor.notes}\n---\n${merged.notes}` : merged.notes;
    fieldsUpdated.push('notes');
  }

  // Merge customFields (survivor takes precedence)
  const survivorCustom = (survivor.customFields as Record<string, unknown>) || {};
  const mergedCustom = (merged.customFields as Record<string, unknown>) || {};
  if (Object.keys(mergedCustom).length > 0) {
    updateData.customFields = { ...mergedCustom, ...survivorCustom };
    fieldsUpdated.push('customFields');
  }

  // Merge openingHours if survivor has none
  if (!survivor.openingHours && merged.openingHours) {
    updateData.openingHours = merged.openingHours;
    fieldsUpdated.push('openingHours');
  }

  await prisma.$transaction([
    prisma.prospect.update({ where: { id: survivorId }, data: updateData }),
    prisma.prospect.update({ where: { id: mergedId }, data: { status: 'MERGED', duplicateOfId: survivorId } }),
  ]);

  // Update list counters
  await updateListCounters(survivor.listId);

  logger.info('Prospects merged', { survivorId, mergedId, fieldsUpdated });
  return { survivorId, mergedId, fieldsUpdated };
}

// ---------------------------------------------------------------------------
// Auto-deduplicate entire list
// ---------------------------------------------------------------------------

export async function autoDeduplicateList(listId: string): Promise<{ scanned: number; duplicatesFound: number; merged: number }> {
  const prospects = await prisma.prospect.findMany({
    where: { listId, status: { notIn: ['MERGED', 'EXCLUDED'] } },
    select: { id: true, contactName: true, email: true, phone: true, companyName: true, googlePlaceId: true },
    orderBy: { createdAt: 'asc' },
  });

  const processed = new Set<string>();
  let duplicatesFound = 0;
  let merged = 0;

  for (const prospect of prospects) {
    if (processed.has(prospect.id)) continue;
    const matches = await findProspectDuplicates(prospect, listId);
    for (const match of matches) {
      if (processed.has(match.matchedId)) continue;
      if (match.confidence >= 0.85) {
        try {
          await mergeProspects(prospect.id, match.matchedId);
          processed.add(match.matchedId);
          merged++;
        } catch {
          // Skip if merge fails (already merged, etc.)
        }
      }
      duplicatesFound++;
    }
  }

  await updateListCounters(listId);
  return { scanned: prospects.length, duplicatesFound, merged };
}

// ---------------------------------------------------------------------------
// Update list counters
// ---------------------------------------------------------------------------

export async function updateListCounters(listId: string): Promise<void> {
  const [total, validated, duplicate, integrated] = await Promise.all([
    prisma.prospect.count({ where: { listId, status: { notIn: ['MERGED'] } } }),
    prisma.prospect.count({ where: { listId, status: 'VALIDATED' } }),
    prisma.prospect.count({ where: { listId, status: 'DUPLICATE' } }),
    prisma.prospect.count({ where: { listId, status: 'INTEGRATED' } }),
  ]);

  await prisma.prospectList.update({
    where: { id: listId },
    data: { totalCount: total, validatedCount: validated, duplicateCount: duplicate, integratedCount: integrated },
  });
}
