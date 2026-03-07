/**
 * CRM CDP (Customer Data Platform) Integration (M13)
 *
 * Customer Data Platform integration for unified customer profiles.
 * Similar to Salesforce CDP, HubSpot Data Sync, Dynamics 365 Customer Insights.
 *
 * Supports:
 * - Segment (Twilio Segment)
 * - RudderStack (open-source alternative)
 *
 * Provides event tracking, user identification, profile syncing,
 * and unified customer view across all touchpoints.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CdpProvider = 'segment' | 'rudderstack';

export interface CdpConfig {
  writeKey: string;
  sourceId?: string;
  dataPlaneUrl?: string; // RudderStack-specific
  enabled: boolean;
}

export interface CdpEvent {
  name: string;
  userId?: string;
  anonymousId?: string;
  properties: Record<string, unknown>;
  timestamp?: string;
  context?: Record<string, unknown>;
}

export interface CdpUserTraits {
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  title?: string;
  leadScore?: number;
  leadStatus?: string;
  source?: string;
  [key: string]: unknown;
}

export interface CdpProfile {
  userId: string;
  traits: CdpUserTraits;
  events: {
    name: string;
    count: number;
    lastOccurred: string;
  }[];
  segments: string[];
  lastSeenAt: string;
  firstSeenAt: string;
  totalEvents: number;
}

export interface CdpIntegrationMetrics {
  provider: CdpProvider;
  connected: boolean;
  eventsTracked: number;
  profilesSynced: number;
  errorsLast24h: number;
  avgLatencyMs: number;
  lastEventAt: string | null;
  lastSyncAt: string | null;
}

export interface CdpSyncResult {
  synced: number;
  skipped: number;
  errors: number;
  details: {
    leadId: string;
    success: boolean;
    error?: string;
  }[];
}

// ---------------------------------------------------------------------------
// Helpers - Config
// ---------------------------------------------------------------------------

/**
 * Get CDP configuration from AuditTrail config store.
 */
async function getCdpConfig(
  provider: CdpProvider,
): Promise<CdpConfig | null> {
  try {
    const trail = await prisma.auditTrail.findFirst({
      where: { entityType: `CDP_CONFIG_${provider.toUpperCase()}`, action: 'CONFIG' },
      orderBy: { createdAt: 'desc' },
    });
    if (!trail?.metadata) return null;
    const config = trail.metadata as Record<string, unknown>;
    return config as unknown as CdpConfig;
  } catch {
    return null;
  }
}

/**
 * Determine which CDP provider is active.
 */
async function getActiveCdp(): Promise<{ provider: CdpProvider; config: CdpConfig } | null> {
  for (const provider of ['segment', 'rudderstack'] as CdpProvider[]) {
    const config = await getCdpConfig(provider);
    if (config?.enabled && config?.writeKey) {
      return { provider, config };
    }
  }
  return null;
}

/**
 * Get the CDP API endpoint for the active provider.
 */
function getCdpEndpoint(provider: CdpProvider, config: CdpConfig): string {
  if (provider === 'rudderstack') {
    return config.dataPlaneUrl || 'https://hosted.rudderlabs.com';
  }
  return 'https://api.segment.io/v1';
}

/**
 * Send a request to the CDP API.
 */
async function cdpRequest(
  provider: CdpProvider,
  config: CdpConfig,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    const baseUrl = getCdpEndpoint(provider, config);
    const auth = Buffer.from(`${config.writeKey}:`).toString('base64');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString(),
        context: {
          library: { name: 'biocycle-crm', version: '1.0.0' },
          ...(payload.context as Record<string, unknown> || {}),
        },
      }),
    });

    clearTimeout(timeout);
    return response.ok;
  } catch (error) {
    logger.error('[CDP] API request failed', {
      provider,
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// configureCdp
// ---------------------------------------------------------------------------

/**
 * Configure a CDP provider with write key and source settings.
 */
export async function configureCdp(
  provider: CdpProvider,
  config: { writeKey: string; sourceId?: string; dataPlaneUrl?: string },
): Promise<{ success: boolean; error?: string }> {
  if (!config.writeKey) {
    return { success: false, error: 'writeKey is required' };
  }

  if (provider === 'rudderstack' && !config.dataPlaneUrl) {
    return { success: false, error: 'dataPlaneUrl is required for RudderStack' };
  }

  const fullConfig: CdpConfig = {
    writeKey: config.writeKey,
    sourceId: config.sourceId,
    dataPlaneUrl: config.dataPlaneUrl,
    enabled: true,
  };

  await prisma.auditTrail.create({
    data: {
      entityType: `CDP_CONFIG_${provider.toUpperCase()}`,
      entityId: 'singleton',
      action: 'CONFIG',
      metadata: fullConfig as unknown as Prisma.InputJsonValue,
      userId: 'system',
    },
  });

  logger.info('[CDP] Provider configured', { provider });
  return { success: true };
}

// ---------------------------------------------------------------------------
// trackEvent
// ---------------------------------------------------------------------------

/**
 * Send an event to the CDP.
 * Events are used for behavioral tracking and segmentation.
 */
export async function trackEvent(event: CdpEvent): Promise<boolean> {
  const active = await getActiveCdp();
  if (!active) {
    logger.debug('[CDP] No active CDP provider configured');
    return false;
  }

  const payload: Record<string, unknown> = {
    event: event.name,
    properties: event.properties,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  if (event.userId) payload.userId = event.userId;
  if (event.anonymousId) payload.anonymousId = event.anonymousId;
  if (event.context) payload.context = event.context;

  // Must have either userId or anonymousId
  if (!event.userId && !event.anonymousId) {
    logger.warn('[CDP] Event missing both userId and anonymousId', { event: event.name });
    return false;
  }

  const success = await cdpRequest(active.provider, active.config, '/track', payload);

  if (success) {
    logger.debug('[CDP] Event tracked', { event: event.name, userId: event.userId });
  }

  return success;
}

// ---------------------------------------------------------------------------
// identifyUser
// ---------------------------------------------------------------------------

/**
 * Identify a user in the CDP with their traits.
 * Creates or updates the user profile in the CDP.
 */
export async function identifyUser(
  userId: string,
  traits: CdpUserTraits,
): Promise<boolean> {
  const active = await getActiveCdp();
  if (!active) {
    logger.debug('[CDP] No active CDP provider configured');
    return false;
  }

  const success = await cdpRequest(active.provider, active.config, '/identify', {
    userId,
    traits: {
      ...traits,
      updatedAt: new Date().toISOString(),
    },
  });

  if (success) {
    logger.info('[CDP] User identified', { userId, traitCount: Object.keys(traits).length });
  }

  return success;
}

// ---------------------------------------------------------------------------
// syncLeadsToCdp
// ---------------------------------------------------------------------------

/**
 * Bulk sync CRM leads to the CDP as identified profiles.
 */
export async function syncLeadsToCdp(
  leadIds: string[],
): Promise<CdpSyncResult> {
  const active = await getActiveCdp();
  if (!active) {
    return {
      synced: 0,
      skipped: leadIds.length,
      errors: 0,
      details: leadIds.map((id) => ({ leadId: id, success: false, error: 'No CDP configured' })),
    };
  }

  // Batch fetch all leads at once instead of one query per lead
  const allLeads = await prisma.crmLead.findMany({
    where: { id: { in: leadIds } },
  });
  const leadMap = new Map(allLeads.map((l) => [l.id, l]));

  const result: CdpSyncResult = { synced: 0, skipped: 0, errors: 0, details: [] };

  for (const leadId of leadIds) {
    try {
      const lead = leadMap.get(leadId);
      if (!lead) {
        result.skipped++;
        result.details.push({ leadId, success: false, error: 'Lead not found' });
        continue;
      }

      const traits: CdpUserTraits = {
        name: lead.contactName,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        company: lead.companyName || undefined,
        leadScore: lead.score,
        leadStatus: lead.status,
        source: lead.source,
      };

      const success = await cdpRequest(active.provider, active.config, '/identify', {
        userId: leadId,
        traits,
      });

      if (success) {
        result.synced++;
        result.details.push({ leadId, success: true });
      } else {
        result.errors++;
        result.details.push({ leadId, success: false, error: 'CDP API call failed' });
      }
    } catch (err) {
      result.errors++;
      result.details.push({
        leadId,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('[CDP] Bulk sync complete', {
    synced: result.synced,
    skipped: result.skipped,
    errors: result.errors,
  });

  return result;
}

// ---------------------------------------------------------------------------
// getCdpProfile
// ---------------------------------------------------------------------------

/**
 * Fetch a unified profile from the CDP for a given lead.
 * Falls back to local CRM data if CDP is not available.
 */
export async function getCdpProfile(leadId: string): Promise<CdpProfile | null> {
  const lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
  if (!lead) return null;

  const active = await getActiveCdp();

  // Try fetching from CDP Profile API
  if (active) {
    try {
      const baseUrl = getCdpEndpoint(active.provider, active.config);
      const profileEndpoint = active.provider === 'segment'
        ? `/v1/spaces/${active.config.sourceId}/collections/users/profiles/user_id:${leadId}/traits`
        : `/v1/profiles/${leadId}`;

      const auth = Buffer.from(`${active.config.writeKey}:`).toString('base64');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${baseUrl}${profileEndpoint}`, {
        signal: controller.signal,
        headers: { Authorization: `Basic ${auth}` },
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        return {
          userId: leadId,
          traits: (data.traits || {}) as CdpUserTraits,
          events: ((data.events || []) as Array<Record<string, unknown>>).map((e) => ({
            name: String(e.name || ''),
            count: Number(e.count || 0),
            lastOccurred: String(e.lastOccurred || ''),
          })),
          segments: (data.segments || []) as string[],
          lastSeenAt: String(data.lastSeenAt || ''),
          firstSeenAt: String(data.firstSeenAt || lead.createdAt.toISOString()),
          totalEvents: Number(data.totalEvents || 0),
        };
      }
    } catch (error) {
      logger.warn('[CDP] Profile fetch failed, falling back to CRM data', {
        leadId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to local CRM data
  const activities = await prisma.crmActivity.findMany({
    where: { leadId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const eventCounts = new Map<string, { count: number; last: string }>();
  for (const act of activities) {
    const existing = eventCounts.get(act.type) || { count: 0, last: '' };
    eventCounts.set(act.type, {
      count: existing.count + 1,
      last: existing.last || act.createdAt.toISOString(),
    });
  }

  return {
    userId: leadId,
    traits: {
      name: lead.contactName,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      company: lead.companyName || undefined,
      leadScore: lead.score,
      leadStatus: lead.status,
      source: lead.source,
    },
    events: Array.from(eventCounts.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      lastOccurred: data.last,
    })),
    segments: [],
    lastSeenAt: lead.lastContactedAt?.toISOString() || lead.updatedAt.toISOString(),
    firstSeenAt: lead.createdAt.toISOString(),
    totalEvents: activities.length,
  };
}

// ---------------------------------------------------------------------------
// getCdpIntegrationMetrics
// ---------------------------------------------------------------------------

/**
 * Get CDP integration metrics: events tracked, profiles synced, error rate.
 */
export async function getCdpIntegrationMetrics(): Promise<CdpIntegrationMetrics> {
  const active = await getActiveCdp();

  return {
    provider: active?.provider || 'segment',
    connected: !!active,
    eventsTracked: 0,   // Would be tracked via a metrics counter
    profilesSynced: 0,  // Would be tracked via a metrics counter
    errorsLast24h: 0,
    avgLatencyMs: 0,
    lastEventAt: null,
    lastSyncAt: null,
  };
}
