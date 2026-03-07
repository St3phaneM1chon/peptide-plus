/**
 * CRM LinkedIn Sales Navigator Integration (M7)
 *
 * LinkedIn Sales Navigator integration scaffold for lead research and enrichment.
 * Similar to Salesforce, HubSpot, and Dynamics 365 LinkedIn integrations.
 *
 * NOTE: LinkedIn API requires an approved LinkedIn Partner Program membership.
 * This module provides the integration scaffold; actual API calls depend on
 * having valid LinkedIn API credentials configured.
 *
 * LinkedIn data is stored in CrmLead.metadata.linkedin JSON.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkedInProfileQuery {
  name?: string;
  company?: string;
  title?: string;
  location?: string;
  industry?: string;
  keywords?: string;
}

export interface LinkedInProfile {
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  headline: string;
  title?: string;
  company?: string;
  location?: string;
  industry?: string;
  connectionDegree?: number;
  connectionsCount?: number;
  summary?: string;
  profilePicUrl?: string;
  experienceYears?: number;
}

export interface LinkedInSearchResult {
  profiles: LinkedInProfile[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface LinkedInEnrichmentResult {
  leadId: string;
  linkedinUrl: string;
  fieldsEnriched: string[];
  data: {
    title?: string;
    company?: string;
    headline?: string;
    location?: string;
    connectionsCount?: number;
    summary?: string;
    industry?: string;
  };
}

export interface LinkedInConnection {
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  company?: string;
  title?: string;
  connectedAt?: string;
}

export interface LinkedInActivityItem {
  type: 'post' | 'share' | 'comment' | 'reaction' | 'article';
  content: string;
  timestamp: string;
  url?: string;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
  };
}

export interface LinkedInIntegrationStatus {
  connected: boolean;
  lastSyncAt: string | null;
  leadsEnriched: number;
  apiQuota: {
    dailyLimit: number;
    used: number;
    remaining: number;
  };
  errors: string[];
}

// ---------------------------------------------------------------------------
// Lazy LinkedIn API client
// ---------------------------------------------------------------------------

let _linkedinConfig: { accessToken: string; apiBaseUrl: string } | null = null;

function getLinkedInConfig(): { accessToken: string; apiBaseUrl: string } {
  if (_linkedinConfig) return _linkedinConfig;

  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      'LINKEDIN_ACCESS_TOKEN not set. LinkedIn Sales Navigator API requires approved partnership.'
    );
  }

  _linkedinConfig = {
    accessToken,
    apiBaseUrl: process.env.LINKEDIN_API_URL || 'https://api.linkedin.com/v2',
  };
  return _linkedinConfig;
}

// ---------------------------------------------------------------------------
// LinkedIn API helpers
// ---------------------------------------------------------------------------

/**
 * Make an authenticated request to the LinkedIn API.
 * Returns null on failure (logs the error).
 */
async function linkedInRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T | null> {
  try {
    const config = getLinkedInConfig();
    const url = `${config.apiBaseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        ...options.headers,
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.error('[LinkedIn] API request failed', {
        endpoint,
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    logger.error('[LinkedIn] API request error', {
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// searchLinkedInProfiles
// ---------------------------------------------------------------------------

/**
 * Search LinkedIn profiles matching given criteria.
 * Uses LinkedIn Sales Navigator search API (requires partnership).
 */
export async function searchLinkedInProfiles(
  query: LinkedInProfileQuery,
  page: number = 1,
  pageSize: number = 25,
): Promise<LinkedInSearchResult> {
  const params = new URLSearchParams();
  if (query.name) params.set('firstName', query.name.split(' ')[0] || '');
  if (query.company) params.set('company', query.company);
  if (query.title) params.set('title', query.title);
  if (query.location) params.set('location', query.location);
  if (query.keywords) params.set('keywords', query.keywords);
  params.set('start', String((page - 1) * pageSize));
  params.set('count', String(pageSize));

  const result = await linkedInRequest<{
    elements: Array<Record<string, unknown>>;
    paging: { total: number; count: number; start: number };
  }>(`/salesNavigator/search?${params.toString()}`);

  if (!result) {
    return { profiles: [], total: 0, page, hasMore: false };
  }

  const profiles: LinkedInProfile[] = (result.elements || []).map((el) => ({
    linkedinUrl: String(el.linkedinUrl || el.publicProfileUrl || ''),
    firstName: String(el.firstName || ''),
    lastName: String(el.lastName || ''),
    headline: String(el.headline || ''),
    title: el.title ? String(el.title) : undefined,
    company: el.company ? String(el.company) : undefined,
    location: el.location ? String(el.location) : undefined,
    industry: el.industry ? String(el.industry) : undefined,
    connectionDegree: el.connectionDegree ? Number(el.connectionDegree) : undefined,
    connectionsCount: el.connectionsCount ? Number(el.connectionsCount) : undefined,
    summary: el.summary ? String(el.summary) : undefined,
  }));

  const total = result.paging?.total || 0;

  logger.info('[LinkedIn] Profile search completed', {
    query,
    resultsCount: profiles.length,
    total,
  });

  return {
    profiles,
    total,
    page,
    hasMore: page * pageSize < total,
  };
}

// ---------------------------------------------------------------------------
// enrichLeadFromLinkedIn
// ---------------------------------------------------------------------------

/**
 * Enrich a CrmLead with data from a LinkedIn profile URL.
 * Fetches profile details and stores them in CrmLead.customFields.linkedin.
 */
export async function enrichLeadFromLinkedIn(
  leadId: string,
  linkedinUrl: string,
): Promise<LinkedInEnrichmentResult> {
  const lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  // Extract LinkedIn profile data
  const profileData = await linkedInRequest<Record<string, unknown>>(
    `/people/(url=${encodeURIComponent(linkedinUrl)})`,
  );

  const fieldsEnriched: string[] = [];
  const data: LinkedInEnrichmentResult['data'] = {};

  if (profileData) {
    if (profileData.headline) {
      data.headline = String(profileData.headline);
      fieldsEnriched.push('headline');
    }
    if (profileData.title || profileData.currentPosition) {
      data.title = String(profileData.title || profileData.currentPosition);
      fieldsEnriched.push('title');
    }
    if (profileData.company || profileData.currentCompany) {
      data.company = String(profileData.company || profileData.currentCompany);
      fieldsEnriched.push('company');
    }
    if (profileData.location) {
      data.location = String(profileData.location);
      fieldsEnriched.push('location');
    }
    if (profileData.numConnections) {
      data.connectionsCount = Number(profileData.numConnections);
      fieldsEnriched.push('connectionsCount');
    }
    if (profileData.summary) {
      data.summary = String(profileData.summary);
      fieldsEnriched.push('summary');
    }
    if (profileData.industry) {
      data.industry = String(profileData.industry);
      fieldsEnriched.push('industry');
    }
  }

  // Store LinkedIn data in CrmLead.customFields.linkedin
  const existingCustom = (lead.customFields as Record<string, unknown>) || {};
  const linkedinData = {
    url: linkedinUrl,
    enrichedAt: new Date().toISOString(),
    ...data,
  };

  await prisma.crmLead.update({
    where: { id: leadId },
    data: {
      companyName: lead.companyName || data.company || undefined,
      customFields: {
        ...existingCustom,
        linkedin: linkedinData,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info('[LinkedIn] Lead enriched from LinkedIn', { leadId, fieldsEnriched });
  return { leadId, linkedinUrl, fieldsEnriched, data };
}

// ---------------------------------------------------------------------------
// syncLinkedInConnections
// ---------------------------------------------------------------------------

/**
 * Import a user's LinkedIn connections as CRM leads.
 * Creates new CrmLead records for connections not already in the system.
 */
export async function syncLinkedInConnections(
  userId: string,
): Promise<{ imported: number; skipped: number; errors: number }> {
  const result = await linkedInRequest<{
    elements: Array<Record<string, unknown>>;
  }>('/connections?count=500&start=0');

  if (!result || !result.elements) {
    return { imported: 0, skipped: 0, errors: 0 };
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Pre-collect emails and names to batch-check for existing leads
  const connectionEmails: string[] = [];
  const connectionNames: string[] = [];
  for (const connection of result.elements) {
    const email = connection.emailAddress ? String(connection.emailAddress) : null;
    const contactName = `${connection.firstName || ''} ${connection.lastName || ''}`.trim();
    if (email) connectionEmails.push(email);
    if (contactName) connectionNames.push(contactName);
  }

  // Batch fetch existing leads by email and name
  const [existingByEmail, existingByName] = await Promise.all([
    connectionEmails.length > 0
      ? prisma.crmLead.findMany({
          where: { email: { in: connectionEmails } },
          select: { email: true },
        })
      : [],
    connectionNames.length > 0
      ? prisma.crmLead.findMany({
          where: { contactName: { in: connectionNames } },
          select: { contactName: true },
        })
      : [],
  ]);
  const existingEmails = new Set(existingByEmail.map(l => l.email).filter(Boolean));
  const existingNames = new Set(existingByName.map(l => l.contactName));

  for (const connection of result.elements) {
    try {
      const email = connection.emailAddress ? String(connection.emailAddress) : null;
      const contactName = `${connection.firstName || ''} ${connection.lastName || ''}`.trim();

      if (!contactName) {
        skipped++;
        continue;
      }

      // Check if lead already exists (using batch-fetched sets)
      if ((email && existingEmails.has(email)) || existingNames.has(contactName)) {
        skipped++;
        continue;
      }

      await prisma.crmLead.create({
        data: {
          contactName,
          email,
          companyName: connection.company ? String(connection.company) : null,
          source: 'LINKEDIN' as never,
          assignedToId: userId,
          customFields: {
            linkedin: {
              url: connection.linkedinUrl ? String(connection.linkedinUrl) : null,
              title: connection.title ? String(connection.title) : null,
              importedAt: new Date().toISOString(),
            },
          } as unknown as Prisma.InputJsonValue,
        },
      });
      imported++;

      // Track newly created leads to prevent duplicates within this batch
      if (email) existingEmails.add(email);
      existingNames.add(contactName);
    } catch (err) {
      errors++;
      logger.warn('[LinkedIn] Failed to import connection', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('[LinkedIn] Connections sync complete', { userId, imported, skipped, errors });
  return { imported, skipped, errors };
}

// ---------------------------------------------------------------------------
// getLinkedInActivity
// ---------------------------------------------------------------------------

/**
 * Fetch recent LinkedIn activity for a lead (posts, shares, comments).
 * Requires the lead to have a LinkedIn URL stored in customFields.
 */
export async function getLinkedInActivity(
  leadId: string,
): Promise<LinkedInActivityItem[]> {
  const lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  const custom = (lead.customFields as Record<string, unknown>) || {};
  const linkedin = custom.linkedin as Record<string, unknown> | undefined;
  const linkedinUrl = linkedin?.url ? String(linkedin.url) : null;

  if (!linkedinUrl) {
    logger.warn('[LinkedIn] No LinkedIn URL for lead', { leadId });
    return [];
  }

  const result = await linkedInRequest<{
    elements: Array<Record<string, unknown>>;
  }>(`/people/(url=${encodeURIComponent(linkedinUrl)})/activities?count=20`);

  if (!result || !result.elements) return [];

  return result.elements.map((el) => ({
    type: (String(el.type || 'post')) as LinkedInActivityItem['type'],
    content: String(el.content || el.text || ''),
    timestamp: String(el.timestamp || el.createdAt || new Date().toISOString()),
    url: el.url ? String(el.url) : undefined,
    engagement: el.engagement
      ? {
          likes: Number((el.engagement as Record<string, unknown>).likes || 0),
          comments: Number((el.engagement as Record<string, unknown>).comments || 0),
          shares: Number((el.engagement as Record<string, unknown>).shares || 0),
        }
      : undefined,
  }));
}

// ---------------------------------------------------------------------------
// sendInMail
// ---------------------------------------------------------------------------

/**
 * Send an InMail message to a lead via LinkedIn Sales Navigator.
 * Logs the outreach as a CrmActivity.
 */
export async function sendInMail(
  leadId: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  const custom = (lead.customFields as Record<string, unknown>) || {};
  const linkedin = custom.linkedin as Record<string, unknown> | undefined;
  const linkedinUrl = linkedin?.url ? String(linkedin.url) : null;

  if (!linkedinUrl) {
    return { success: false, error: 'No LinkedIn URL for this lead' };
  }

  const result = await linkedInRequest<{ id: string }>(
    '/salesNavigator/messages',
    {
      method: 'POST',
      body: JSON.stringify({
        recipientUrl: linkedinUrl,
        subject: `Reaching out to ${lead.contactName}`,
        body: message,
      }),
    },
  );

  if (!result) {
    return { success: false, error: 'Failed to send InMail' };
  }

  // Log as CRM activity
  await prisma.crmActivity.create({
    data: {
      type: 'EMAIL',
      title: `InMail sent via LinkedIn`,
      description: message.slice(0, 500),
      leadId,
      metadata: {
        channel: 'linkedin',
        messageId: result.id,
        linkedinUrl,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info('[LinkedIn] InMail sent', { leadId, messageId: result.id });
  return { success: true, messageId: result.id };
}

// ---------------------------------------------------------------------------
// getLinkedInIntegrationStatus
// ---------------------------------------------------------------------------

/**
 * Get the current LinkedIn integration status: connection health, last sync, quota.
 */
export async function getLinkedInIntegrationStatus(): Promise<LinkedInIntegrationStatus> {
  let connected = false;
  const errors: string[] = [];

  try {
    const config = getLinkedInConfig();
    connected = !!config.accessToken;
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  // Count leads enriched with LinkedIn data
  const enrichedLeads = await prisma.crmLead.count({
    where: {
      customFields: {
        path: ['linkedin'],
        not: Prisma.JsonNull,
      },
    },
  });

  // Estimate API quota (LinkedIn standard limits)
  const dailyLimit = 500;
  const used = 0; // Would track via a counter/cache in production

  return {
    connected,
    lastSyncAt: null, // Would be stored in site settings
    leadsEnriched: enrichedLeads,
    apiQuota: {
      dailyLimit,
      used,
      remaining: dailyLimit - used,
    },
    errors,
  };
}
