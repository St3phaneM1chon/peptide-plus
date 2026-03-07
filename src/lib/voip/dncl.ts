/**
 * DNCL (Do Not Call List) — Canada CRTC Compliance
 *
 * Implements the Canadian National DNCL rules:
 * - Check numbers against imported DNCL list before dialing
 * - Support internal DNC (customer requests)
 * - CRTC-compliant logging of all telemarketing calls
 * - Caller ID display enforcement (Canadian law)
 *
 * DNCL list: Downloaded monthly from https://www.lnnte-dncl.gc.ca/
 * Format: CSV with phone numbers in E.164 or 10-digit format
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Check if a phone number is on the DNCL (Do Not Call List).
 * Returns true if the number MUST NOT be called.
 */
export async function checkDncl(phoneNumber: string): Promise<boolean> {
  const normalized = normalizePhone(phoneNumber);

  const entry = await prisma.dnclEntry.findUnique({
    where: { phoneNumber: normalized },
  });

  if (!entry) return false;

  // Check expiration
  if (entry.expiresAt && entry.expiresAt < new Date()) {
    return false; // Expired entry
  }

  logger.info('[DNCL] Number blocked', {
    phone: normalized,
    source: entry.source,
  });

  return true;
}

/**
 * Bulk check multiple numbers against DNCL.
 * Returns set of blocked numbers.
 */
export async function bulkCheckDncl(phoneNumbers: string[]): Promise<Set<string>> {
  const normalized = phoneNumbers.map(normalizePhone);

  const entries = await prisma.dnclEntry.findMany({
    where: {
      phoneNumber: { in: normalized },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: { phoneNumber: true },
  });

  return new Set(entries.map(e => e.phoneNumber));
}

/**
 * Import DNCL entries from a CSV-style array of phone numbers.
 * Typically from the CRTC monthly download.
 */
export async function importDnclList(
  phoneNumbers: string[],
  source = 'crtc'
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  // Process in batches of 500
  const batchSize = 500;
  for (let i = 0; i < phoneNumbers.length; i += batchSize) {
    const batch = phoneNumbers.slice(i, i + batchSize);
    const normalized = batch.map(normalizePhone).filter(Boolean);

    // Upsert each entry
    const results = await Promise.allSettled(
      normalized.map(phone =>
        prisma.dnclEntry.upsert({
          where: { phoneNumber: phone },
          update: { source, addedAt: new Date() },
          create: { phoneNumber: phone, source },
        })
      )
    );

    imported += results.filter(r => r.status === 'fulfilled').length;
    skipped += results.filter(r => r.status === 'rejected').length;
  }

  logger.info('[DNCL] Import completed', { source, imported, skipped, total: phoneNumbers.length });

  return { imported, skipped };
}

/**
 * Add a single number to internal DNC list (customer request).
 */
export async function addToDncl(
  phoneNumber: string,
  reason?: string
): Promise<void> {
  const normalized = normalizePhone(phoneNumber);

  await prisma.dnclEntry.upsert({
    where: { phoneNumber: normalized },
    update: {
      source: 'customer_request',
      reason: reason || 'Customer requested removal',
      addedAt: new Date(),
    },
    create: {
      phoneNumber: normalized,
      source: 'customer_request',
      reason: reason || 'Customer requested removal',
    },
  });

  logger.info('[DNCL] Number added (customer request)', { phone: normalized });
}

/**
 * Remove a number from internal DNC list.
 * Note: Cannot remove CRTC entries — only internal ones.
 */
export async function removeFromDncl(phoneNumber: string): Promise<boolean> {
  const normalized = normalizePhone(phoneNumber);

  const entry = await prisma.dnclEntry.findUnique({
    where: { phoneNumber: normalized },
  });

  if (!entry) return false;

  if (entry.source === 'crtc') {
    logger.warn('[DNCL] Cannot remove CRTC entry', { phone: normalized });
    return false;
  }

  await prisma.dnclEntry.delete({
    where: { phoneNumber: normalized },
  });

  return true;
}

/**
 * Get DNCL stats.
 */
export async function getDnclStats(): Promise<{
  total: number;
  byCrtc: number;
  byInternal: number;
  byCustomer: number;
}> {
  const [total, byCrtc, byInternal, byCustomer] = await Promise.all([
    prisma.dnclEntry.count(),
    prisma.dnclEntry.count({ where: { source: 'crtc' } }),
    prisma.dnclEntry.count({ where: { source: 'internal' } }),
    prisma.dnclEntry.count({ where: { source: 'customer_request' } }),
  ]);

  return { total, byCrtc, byInternal, byCustomer };
}

/**
 * Mark DNCL entries in a campaign's contact list.
 * Run before starting a campaign to pre-flag blocked numbers.
 */
export async function markCampaignDncl(campaignId: string): Promise<number> {
  const entries = await prisma.dialerListEntry.findMany({
    where: {
      campaignId,
      isDncl: false,
      isCalled: false,
    },
    select: { id: true, phoneNumber: true },
  });

  const phones = entries.map(e => e.phoneNumber);
  const blockedSet = await bulkCheckDncl(phones);

  // Batch update all blocked entries instead of N+1 individual updates
  const blockedEntryIds = entries
    .filter(e => blockedSet.has(normalizePhone(e.phoneNumber)))
    .map(e => e.id);

  let marked = 0;
  if (blockedEntryIds.length > 0) {
    const result = await prisma.dialerListEntry.updateMany({
      where: { id: { in: blockedEntryIds } },
      data: { isDncl: true, dnclCheckedAt: new Date() },
    });
    marked = result.count;
  }

  logger.info('[DNCL] Campaign pre-check completed', {
    campaignId,
    checked: entries.length,
    blocked: marked,
  });

  return marked;
}

// ── Helpers ──────────────────

/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX for NA).
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (phone.startsWith('+')) {
    return phone;
  }
  return `+${digits}`;
}
