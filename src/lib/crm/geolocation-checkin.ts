/**
 * Geolocation Check-in Service (N7 - Geolocation / Check-in)
 * GPS check-in for field sales reps at customer locations.
 * Stores visits as CrmActivity records with type='MEETING'
 * and GPS coordinates + field_visit source in metadata.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeoLocation {
  lat: number;
  lng: number;
  address?: string;
  accuracy?: number;
}

export interface CheckInRecord {
  id: string;
  userId: string;
  userName: string | null;
  location: GeoLocation;
  leadId: string | null;
  leadName: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
  status: 'ACTIVE' | 'COMPLETED';
}

export interface TeamLocationEntry {
  userId: string;
  userName: string | null;
  userEmail: string;
  location: GeoLocation;
  checkedInAt: string;
  leadId: string | null;
  leadName: string | null;
  checkinId: string;
}

export interface VisitHistoryEntry {
  id: string;
  userId: string;
  userName: string | null;
  location: GeoLocation;
  checkedInAt: string;
  checkedOutAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
}

export interface FieldSalesMetrics {
  totalVisits: number;
  uniqueLeadsVisited: number;
  avgVisitDuration: number; // minutes
  totalDuration: number; // minutes
  visitsPerDay: number;
  estimatedKmTraveled: number;
  visitsByDay: { date: string; visits: number }[];
  topLeadsVisited: { leadId: string; leadName: string; visitCount: number }[];
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Record a GPS check-in at a location.
 * Creates a CrmActivity with type='MEETING' and GPS coords + field_visit source in metadata.
 */
export async function checkIn(
  userId: string,
  location: GeoLocation,
  leadId?: string,
): Promise<CheckInRecord> {
  let leadName: string | null = null;

  if (leadId) {
    const lead = await prisma.crmLead.findUnique({
      where: { id: leadId },
      select: { contactName: true, companyName: true },
    });
    if (lead) {
      leadName = lead.companyName || lead.contactName;
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const checkinMetadata = {
    source: 'field_visit',
    status: 'ACTIVE',
    location: {
      lat: location.lat,
      lng: location.lng,
      address: location.address || null,
      accuracy: location.accuracy || null,
    },
    checkedInAt: new Date().toISOString(),
    checkedOutAt: null,
    notes: null,
  };

  const activity = await prisma.crmActivity.create({
    data: {
      type: 'MEETING',
      title: `Check-in${leadName ? `: ${leadName}` : ''}${location.address ? ` at ${location.address}` : ''}`,
      description: `Field visit check-in at [${location.lat}, ${location.lng}]`,
      performedById: userId,
      leadId: leadId || null,
      metadata: checkinMetadata as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info('[GeoCheckin] Check-in recorded', {
    activityId: activity.id,
    userId,
    lat: location.lat,
    lng: location.lng,
    leadId,
  });

  return {
    id: activity.id,
    userId,
    userName: user?.name || null,
    location,
    leadId: leadId || null,
    leadName,
    checkedInAt: activity.createdAt.toISOString(),
    checkedOutAt: null,
    durationMinutes: null,
    notes: null,
    status: 'ACTIVE',
  };
}

/**
 * Close a check-in with optional notes.
 * Calculates visit duration and updates the activity metadata.
 */
export async function checkOut(
  checkinId: string,
  notes?: string,
): Promise<CheckInRecord> {
  const activity = await prisma.crmActivity.findUnique({
    where: { id: checkinId },
    include: {
      performedBy: { select: { name: true } },
      lead: { select: { contactName: true, companyName: true } },
    },
  });

  if (!activity) {
    throw new Error(`Check-in ${checkinId} not found`);
  }

  const meta = (activity.metadata || {}) as Record<string, unknown>;
  if (meta.status === 'COMPLETED') {
    throw new Error('Check-in is already completed');
  }

  const checkedInAt = new Date(activity.createdAt);
  const checkedOutAt = new Date();
  const durationMs = checkedOutAt.getTime() - checkedInAt.getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  const updatedMeta = {
    ...meta,
    status: 'COMPLETED',
    checkedOutAt: checkedOutAt.toISOString(),
    notes: notes || null,
    durationMinutes,
    durationSeconds: Math.round(durationMs / 1000),
  };

  await prisma.crmActivity.update({
    where: { id: checkinId },
    data: {
      description: notes || activity.description,
      metadata: updatedMeta as unknown as Prisma.InputJsonValue,
    },
  });

  const location = (meta.location || {}) as GeoLocation;
  const leadName = activity.lead
    ? activity.lead.companyName || activity.lead.contactName
    : null;

  logger.info('[GeoCheckin] Check-out recorded', {
    checkinId,
    durationMinutes,
    leadId: activity.leadId,
  });

  return {
    id: checkinId,
    userId: activity.performedById || '',
    userName: activity.performedBy?.name || null,
    location,
    leadId: activity.leadId,
    leadName,
    checkedInAt: checkedInAt.toISOString(),
    checkedOutAt: checkedOutAt.toISOString(),
    durationMinutes,
    notes: notes || null,
    status: 'COMPLETED',
  };
}

/**
 * List check-ins for a user within a time period.
 */
export async function getCheckIns(
  userId: string,
  period: { start: string; end: string },
): Promise<CheckInRecord[]> {
  const activities = await prisma.crmActivity.findMany({
    where: {
      performedById: userId,
      type: 'MEETING',
      metadata: {
        path: ['source'],
        equals: 'field_visit',
      },
      createdAt: {
        gte: new Date(period.start),
        lte: new Date(period.end),
      },
    },
    include: {
      performedBy: { select: { name: true } },
      lead: { select: { contactName: true, companyName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  return activities.map((a) => {
    const meta = (a.metadata || {}) as Record<string, unknown>;
    const location = (meta.location || {}) as GeoLocation;
    const leadName = a.lead
      ? a.lead.companyName || a.lead.contactName
      : null;

    return {
      id: a.id,
      userId: a.performedById || '',
      userName: a.performedBy?.name || null,
      location,
      leadId: a.leadId,
      leadName,
      checkedInAt: a.createdAt.toISOString(),
      checkedOutAt: (meta.checkedOutAt as string) || null,
      durationMinutes: (meta.durationMinutes as number) || null,
      notes: (meta.notes as string) || null,
      status: (meta.status as 'ACTIVE' | 'COMPLETED') || 'COMPLETED',
    };
  });
}

/**
 * Get real-time locations of all currently checked-in field reps.
 */
export async function getTeamLocations(): Promise<TeamLocationEntry[]> {
  const activeCheckins = await prisma.crmActivity.findMany({
    where: {
      type: 'MEETING',
      metadata: {
        path: ['status'],
        equals: 'ACTIVE',
      },
    },
    include: {
      performedBy: { select: { id: true, name: true, email: true } },
      lead: { select: { contactName: true, companyName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  return activeCheckins.map((a) => {
    const meta = (a.metadata || {}) as Record<string, unknown>;
    const location = (meta.location || {}) as GeoLocation;
    const leadName = a.lead
      ? a.lead.companyName || a.lead.contactName
      : null;

    return {
      userId: a.performedBy?.id || a.performedById || '',
      userName: a.performedBy?.name || null,
      userEmail: a.performedBy?.email || '',
      location,
      checkedInAt: a.createdAt.toISOString(),
      leadId: a.leadId,
      leadName,
      checkinId: a.id,
    };
  });
}

/**
 * Get all visits to a specific lead/account.
 */
export async function getVisitHistory(leadId: string): Promise<VisitHistoryEntry[]> {
  const activities = await prisma.crmActivity.findMany({
    where: {
      leadId,
      type: 'MEETING',
      metadata: {
        path: ['source'],
        equals: 'field_visit',
      },
    },
    include: {
      performedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  return activities.map((a) => {
    const meta = (a.metadata || {}) as Record<string, unknown>;
    const location = (meta.location || {}) as GeoLocation;

    return {
      id: a.id,
      userId: a.performedById || '',
      userName: a.performedBy?.name || null,
      location,
      checkedInAt: a.createdAt.toISOString(),
      checkedOutAt: (meta.checkedOutAt as string) || null,
      durationMinutes: (meta.durationMinutes as number) || null,
      notes: (meta.notes as string) || null,
    };
  });
}

/**
 * Get field sales metrics for a user within a time period.
 */
export async function getFieldSalesMetrics(
  userId: string,
  period: { start: string; end: string },
): Promise<FieldSalesMetrics> {
  const checkins = await getCheckIns(userId, period);
  const completedVisits = checkins.filter((c) => c.status === 'COMPLETED');

  // Duration stats
  const durations = completedVisits.map((c) => c.durationMinutes || 0);
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const avgVisitDuration = durations.length > 0 ? Math.round(totalDuration / durations.length) : 0;

  // Visits per day
  const startDate = new Date(period.start);
  const endDate = new Date(period.end);
  const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
  const visitsPerDay = Math.round((checkins.length / daysDiff) * 10) / 10;

  // Unique leads
  const uniqueLeadIds = new Set(checkins.filter((c) => c.leadId).map((c) => c.leadId!));

  // Estimated km traveled (using Haversine between consecutive check-ins)
  let estimatedKmTraveled = 0;
  const sortedByTime = [...checkins].sort(
    (a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime(),
  );

  for (let i = 1; i < sortedByTime.length; i++) {
    const prev = sortedByTime[i - 1].location;
    const curr = sortedByTime[i].location;
    if (prev.lat && prev.lng && curr.lat && curr.lng) {
      estimatedKmTraveled += haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    }
  }

  // Visits by day
  const visitsByDayMap = new Map<string, number>();
  for (const checkin of checkins) {
    const dateKey = checkin.checkedInAt.split('T')[0];
    visitsByDayMap.set(dateKey, (visitsByDayMap.get(dateKey) || 0) + 1);
  }
  const visitsByDay = Array.from(visitsByDayMap.entries())
    .map(([date, visits]) => ({ date, visits }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top leads visited
  const leadVisitCounts = new Map<string, { leadName: string; count: number }>();
  for (const checkin of checkins) {
    if (!checkin.leadId) continue;
    const existing = leadVisitCounts.get(checkin.leadId) || {
      leadName: checkin.leadName || 'Unknown',
      count: 0,
    };
    existing.count++;
    leadVisitCounts.set(checkin.leadId, existing);
  }

  const topLeadsVisited = Array.from(leadVisitCounts.entries())
    .map(([leadId, data]) => ({ leadId, leadName: data.leadName, visitCount: data.count }))
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 10);

  return {
    totalVisits: checkins.length,
    uniqueLeadsVisited: uniqueLeadIds.size,
    avgVisitDuration,
    totalDuration,
    visitsPerDay,
    estimatedKmTraveled: Math.round(estimatedKmTraveled * 10) / 10,
    visitsByDay,
    topLeadsVisited,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Haversine formula to calculate distance between two GPS points in km.
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
