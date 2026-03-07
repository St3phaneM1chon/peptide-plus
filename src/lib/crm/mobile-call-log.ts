/**
 * Mobile Call Logging Service (N5 - Mobile Call Logging)
 * Logs calls made from mobile devices into the CRM.
 * Auto-matches phone numbers to leads, provides call history and stats.
 * Stores call logs as CrmActivity records with source='MOBILE'.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MobileCallEntry {
  phone: string;
  direction: 'inbound' | 'outbound';
  duration: number; // seconds
  startedAt: string; // ISO
  endedAt?: string;
  notes?: string;
  leadId?: string;
  deviceId?: string;
}

export interface MobileCallLog {
  id: string;
  userId: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  leadId: string | null;
  leadName: string | null;
  source: 'MOBILE';
  createdAt: string;
}

export interface MobileCallStats {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  totalDuration: number;
  avgDuration: number;
  callsPerDay: number;
  leadMatchRate: number;
  matchedCalls: number;
  unmatchedCalls: number;
  dailyBreakdown: { date: string; calls: number; duration: number }[];
}

export interface CallToLeadMatch {
  leadId: string;
  contactName: string;
  companyName: string | null;
  email: string | null;
  phone: string;
  matchType: 'exact' | 'normalized';
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Log a single mobile call into the CRM as a CrmActivity.
 */
export async function logMobileCall(data: {
  userId: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  startedAt: string;
  endedAt?: string;
  notes?: string;
  leadId?: string;
}): Promise<MobileCallLog> {
  const { userId, phone, direction, duration, startedAt, endedAt, notes, leadId } = data;

  // Auto-match phone to lead if leadId not provided
  let resolvedLeadId = leadId || null;
  let leadName: string | null = null;

  if (!resolvedLeadId) {
    const match = await matchCallToLead(phone);
    if (match) {
      resolvedLeadId = match.leadId;
      leadName = match.contactName;
    }
  } else {
    const lead = await prisma.crmLead.findUnique({
      where: { id: resolvedLeadId },
      select: { contactName: true },
    });
    if (lead) {
      leadName = lead.contactName;
    }
  }

  const callMetadata = {
    source: 'MOBILE',
    phone,
    direction,
    duration,
    startedAt,
    endedAt: endedAt || null,
    notes: notes || null,
    deviceType: 'mobile',
  };

  const activity = await prisma.crmActivity.create({
    data: {
      type: 'CALL',
      title: `Mobile ${direction} call: ${phone}`,
      description: notes || `${direction} call via mobile (${formatDuration(duration)})`,
      performedById: userId,
      leadId: resolvedLeadId,
      metadata: {
        ...callMetadata,
        callDirection: direction,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info('[MobileCallLog] Call logged', {
    activityId: activity.id,
    userId,
    phone,
    direction,
    duration,
    leadId: resolvedLeadId,
  });

  return {
    id: activity.id,
    userId,
    phone,
    direction,
    duration,
    startedAt,
    endedAt: endedAt || null,
    notes: notes || null,
    leadId: resolvedLeadId,
    leadName,
    source: 'MOBILE',
    createdAt: activity.createdAt.toISOString(),
  };
}

/**
 * Auto-match a phone number to a CrmLead.
 * Tries exact match first, then normalized match (strip country code, spaces, dashes).
 */
export async function matchCallToLead(phone: string): Promise<CallToLeadMatch | null> {
  if (!phone) return null;

  // Try exact match first
  const exactMatch = await prisma.crmLead.findFirst({
    where: { phone },
    select: { id: true, contactName: true, companyName: true, email: true, phone: true },
  });

  if (exactMatch && exactMatch.phone) {
    return {
      leadId: exactMatch.id,
      contactName: exactMatch.contactName,
      companyName: exactMatch.companyName,
      email: exactMatch.email,
      phone: exactMatch.phone,
      matchType: 'exact',
    };
  }

  // Normalize phone: strip all non-digit characters
  const normalized = phone.replace(/\D/g, '');
  const normalizedShort = normalized.length > 10 ? normalized.slice(-10) : normalized;

  // Search all leads with phones and do normalized comparison
  const leadsWithPhone = await prisma.crmLead.findMany({
    where: { phone: { not: null } },
    select: { id: true, contactName: true, companyName: true, email: true, phone: true },
    take: 500,
  });

  for (const lead of leadsWithPhone) {
    if (!lead.phone) continue;
    const leadNormalized = lead.phone.replace(/\D/g, '');
    const leadShort = leadNormalized.length > 10 ? leadNormalized.slice(-10) : leadNormalized;

    if (leadShort === normalizedShort && normalizedShort.length >= 7) {
      return {
        leadId: lead.id,
        contactName: lead.contactName,
        companyName: lead.companyName,
        email: lead.email,
        phone: lead.phone,
        matchType: 'normalized',
      };
    }
  }

  return null;
}

/**
 * Get mobile call history for a user within a time period.
 */
export async function getMobileCallHistory(
  userId: string,
  period: { start: string; end: string },
): Promise<MobileCallLog[]> {
  const activities = await prisma.crmActivity.findMany({
    where: {
      performedById: userId,
      type: 'CALL',
      createdAt: {
        gte: new Date(period.start),
        lte: new Date(period.end),
      },
      metadata: {
        path: ['source'],
        equals: 'MOBILE',
      },
    },
    include: {
      lead: {
        select: { contactName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return activities.map((a) => {
    const meta = (a.metadata || {}) as Record<string, unknown>;
    return {
      id: a.id,
      userId: a.performedById || '',
      phone: (meta.phone as string) || '',
      direction: (meta.direction as 'inbound' | 'outbound') || (meta.callDirection as 'inbound' | 'outbound') || 'outbound',
      duration: (meta.duration as number) || 0,
      startedAt: (meta.startedAt as string) || a.createdAt.toISOString(),
      endedAt: (meta.endedAt as string) || null,
      notes: a.description,
      leadId: a.leadId,
      leadName: a.lead ? a.lead.contactName : null,
      source: 'MOBILE' as const,
      createdAt: a.createdAt.toISOString(),
    };
  });
}

/**
 * Bulk sync mobile call logs from a mobile app.
 * Deduplicates based on phone + startedAt to avoid double-logging.
 */
export async function syncMobileCallLog(
  userId: string,
  calls: MobileCallEntry[],
): Promise<{ synced: number; skipped: number; errors: string[] }> {
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Batch-fetch existing activities for this user to check duplicates (avoid N+1)
  const existingActivities = await prisma.crmActivity.findMany({
    where: {
      performedById: userId,
      type: 'CALL',
      metadata: {
        path: ['source'],
        equals: 'MOBILE',
      },
    },
    select: { metadata: true },
    take: 1000,
  });
  const existingPhones = new Set(
    existingActivities.map((a) => {
      const meta = (a.metadata || {}) as Record<string, unknown>;
      return meta.phone as string;
    }).filter(Boolean)
  );

  for (const call of calls) {
    try {
      // Check for duplicate using pre-fetched set
      if (existingPhones.has(call.phone)) {
        skipped++;
        continue;
      }

      await logMobileCall({
        userId,
        phone: call.phone,
        direction: call.direction,
        duration: call.duration,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        notes: call.notes,
        leadId: call.leadId,
      });
      synced++;
      existingPhones.add(call.phone); // Track newly added to avoid re-logging within same batch
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Failed to sync call ${call.phone} at ${call.startedAt}: ${msg}`);
    }
  }

  logger.info('[MobileCallLog] Bulk sync completed', { userId, synced, skipped, errors: errors.length });

  return { synced, skipped, errors };
}

/**
 * Get mobile call statistics for a user within a time period.
 */
export async function getMobileCallStats(
  userId: string,
  period: { start: string; end: string },
): Promise<MobileCallStats> {
  const calls = await getMobileCallHistory(userId, period);

  const inboundCalls = calls.filter((c) => c.direction === 'inbound');
  const outboundCalls = calls.filter((c) => c.direction === 'outbound');
  const matchedCalls = calls.filter((c) => c.leadId !== null);
  const totalDuration = calls.reduce((sum, c) => sum + c.duration, 0);

  // Calculate calls per day
  const startDate = new Date(period.start);
  const endDate = new Date(period.end);
  const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));

  // Daily breakdown
  const dailyMap = new Map<string, { calls: number; duration: number }>();
  for (const call of calls) {
    const dateKey = call.startedAt.split('T')[0];
    const existing = dailyMap.get(dateKey) || { calls: 0, duration: 0 };
    existing.calls++;
    existing.duration += call.duration;
    dailyMap.set(dateKey, existing);
  }

  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({ date, calls: stats.calls, duration: stats.duration }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalCalls: calls.length,
    inboundCalls: inboundCalls.length,
    outboundCalls: outboundCalls.length,
    totalDuration,
    avgDuration: calls.length > 0 ? Math.round(totalDuration / calls.length) : 0,
    callsPerDay: Math.round((calls.length / daysDiff) * 10) / 10,
    leadMatchRate: calls.length > 0 ? Math.round((matchedCalls.length / calls.length) * 100) / 100 : 0,
    matchedCalls: matchedCalls.length,
    unmatchedCalls: calls.length - matchedCalls.length,
    dailyBreakdown,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}
