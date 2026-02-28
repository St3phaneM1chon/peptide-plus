/**
 * Ads Sync Service
 * Syncs ad campaign data from various platforms into AdCampaignSnapshot.
 * Each platform has its own sync function that fetches last 30 days of stats.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignData {
  campaignId: string;
  campaignName: string;
  date: Date;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  currency: string;
  rawData?: Record<string, unknown>;
}

interface SyncResult {
  success: boolean;
  platform: string;
  synced: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.siteSetting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

function getLast30Days(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

async function upsertSnapshots(platform: string, campaigns: CampaignData[]): Promise<number> {
  let count = 0;
  for (const c of campaigns) {
    await prisma.adCampaignSnapshot.upsert({
      where: {
        platform_campaignId_date: {
          platform,
          campaignId: c.campaignId,
          date: c.date,
        },
      },
      create: {
        platform,
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        date: c.date,
        impressions: c.impressions,
        clicks: c.clicks,
        spend: c.spend,
        conversions: c.conversions,
        currency: c.currency,
        rawData: (c.rawData ?? null) as Parameters<typeof prisma.adCampaignSnapshot.create>[0]['data']['rawData'],
      },
      update: {
        campaignName: c.campaignName,
        impressions: c.impressions,
        clicks: c.clicks,
        spend: c.spend,
        conversions: c.conversions,
        currency: c.currency,
        rawData: (c.rawData ?? null) as Parameters<typeof prisma.adCampaignSnapshot.update>[0]['data']['rawData'],
      },
    });
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// YouTube Ads (Google Ads API)
// ---------------------------------------------------------------------------

export async function syncYouTubeAds(): Promise<SyncResult> {
  const accessToken = await getSetting('google_ads_access_token');
  const customerId = await getSetting('google_ads_customer_id');

  if (!accessToken || !customerId) {
    return { success: false, platform: 'youtube', synced: 0, error: 'Google Ads credentials not configured' };
  }

  try {
    const { startDate, endDate } = getLast30Days();
    const query = `SELECT campaign.id, campaign.name, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND campaign.advertising_channel_type = 'VIDEO'`;

    const res = await fetch(`https://googleads.googleapis.com/v15/customers/${customerId}/googleAds:search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'developer-token': await getSetting('google_ads_developer_token') || '',
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, platform: 'youtube', synced: 0, error: `API error: ${res.status} - ${err.slice(0, 200)}` };
    }

    const data = await res.json();
    const campaigns: CampaignData[] = (data.results || []).map((r: Record<string, Record<string, string>>) => ({
      campaignId: r.campaign?.id || 'unknown',
      campaignName: r.campaign?.name || 'Unknown',
      date: new Date(r.segments?.date || new Date()),
      impressions: Number(r.metrics?.impressions || 0),
      clicks: Number(r.metrics?.clicks || 0),
      spend: Number(r.metrics?.costMicros || 0) / 1_000_000,
      conversions: Math.round(Number(r.metrics?.conversions || 0)),
      currency: 'CAD',
      rawData: r,
    }));

    const synced = await upsertSnapshots('youtube', campaigns);
    return { success: true, platform: 'youtube', synced };
  } catch (error) {
    logger.error('[AdsSync] YouTube error:', error);
    return { success: false, platform: 'youtube', synced: 0, error: error instanceof Error ? error.message : 'Sync failed' };
  }
}

// ---------------------------------------------------------------------------
// Google Ads
// ---------------------------------------------------------------------------

export async function syncGoogleAds(): Promise<SyncResult> {
  const accessToken = await getSetting('google_ads_access_token');
  const customerId = await getSetting('google_ads_customer_id');

  if (!accessToken || !customerId) {
    return { success: false, platform: 'google-ads', synced: 0, error: 'Google Ads credentials not configured' };
  }

  try {
    const { startDate, endDate } = getLast30Days();
    const query = `SELECT campaign.id, campaign.name, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`;

    const res = await fetch(`https://googleads.googleapis.com/v15/customers/${customerId}/googleAds:search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'developer-token': await getSetting('google_ads_developer_token') || '',
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      return { success: false, platform: 'google-ads', synced: 0, error: `API error: ${res.status}` };
    }

    const data = await res.json();
    const campaigns: CampaignData[] = (data.results || []).map((r: Record<string, Record<string, string>>) => ({
      campaignId: r.campaign?.id || 'unknown',
      campaignName: r.campaign?.name || 'Unknown',
      date: new Date(r.segments?.date || new Date()),
      impressions: Number(r.metrics?.impressions || 0),
      clicks: Number(r.metrics?.clicks || 0),
      spend: Number(r.metrics?.costMicros || 0) / 1_000_000,
      conversions: Math.round(Number(r.metrics?.conversions || 0)),
      currency: 'CAD',
    }));

    const synced = await upsertSnapshots('google-ads', campaigns);
    return { success: true, platform: 'google-ads', synced };
  } catch (error) {
    logger.error('[AdsSync] Google Ads error:', error);
    return { success: false, platform: 'google-ads', synced: 0, error: error instanceof Error ? error.message : 'Sync failed' };
  }
}

// ---------------------------------------------------------------------------
// Meta Ads (Facebook + Instagram)
// ---------------------------------------------------------------------------

export async function syncMetaAds(): Promise<SyncResult> {
  const accessToken = await getSetting('meta_ads_access_token');
  const adAccountId = await getSetting('meta_ad_account_id');

  if (!accessToken || !adAccountId) {
    return { success: false, platform: 'meta', synced: 0, error: 'Meta Ads credentials not configured' };
  }

  try {
    const { startDate, endDate } = getLast30Days();
    const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions&time_range={"since":"${startDate}","until":"${endDate}"}&time_increment=1&level=campaign&access_token=${accessToken}`;

    const res = await fetch(url);
    if (!res.ok) {
      return { success: false, platform: 'meta', synced: 0, error: `API error: ${res.status}` };
    }

    const data = await res.json();
    const campaigns: CampaignData[] = (data.data || []).map((r: Record<string, unknown>) => {
      const actions = (r.actions as Array<{ action_type: string; value: string }>) || [];
      const conversions = actions.find(a => a.action_type === 'offsite_conversion');
      return {
        campaignId: (r.campaign_id as string) || 'unknown',
        campaignName: (r.campaign_name as string) || 'Unknown',
        date: new Date((r.date_start as string) || new Date()),
        impressions: Number(r.impressions || 0),
        clicks: Number(r.clicks || 0),
        spend: Number(r.spend || 0),
        conversions: Number(conversions?.value || 0),
        currency: 'CAD',
      };
    });

    const synced = await upsertSnapshots('meta', campaigns);
    return { success: true, platform: 'meta', synced };
  } catch (error) {
    logger.error('[AdsSync] Meta error:', error);
    return { success: false, platform: 'meta', synced: 0, error: error instanceof Error ? error.message : 'Sync failed' };
  }
}

// ---------------------------------------------------------------------------
// TikTok Ads
// ---------------------------------------------------------------------------

export async function syncTikTokAds(): Promise<SyncResult> {
  const accessToken = await getSetting('tiktok_ads_access_token');
  const advertiserId = await getSetting('tiktok_advertiser_id');

  if (!accessToken || !advertiserId) {
    return { success: false, platform: 'tiktok', synced: 0, error: 'TikTok Ads credentials not configured' };
  }

  try {
    const { startDate, endDate } = getLast30Days();
    const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        advertiser_id: advertiserId,
        report_type: 'BASIC',
        dimensions: ['campaign_id', 'stat_time_day'],
        metrics: ['campaign_name', 'impressions', 'clicks', 'spend', 'conversion'],
        data_level: 'AUCTION_CAMPAIGN',
        start_date: startDate,
        end_date: endDate,
      }),
    });

    if (!res.ok) {
      return { success: false, platform: 'tiktok', synced: 0, error: `API error: ${res.status}` };
    }

    const data = await res.json();
    const campaigns: CampaignData[] = ((data.data?.list) || []).map((r: Record<string, Record<string, string>>) => ({
      campaignId: r.dimensions?.campaign_id || 'unknown',
      campaignName: r.metrics?.campaign_name || 'Unknown',
      date: new Date(r.dimensions?.stat_time_day || new Date()),
      impressions: Number(r.metrics?.impressions || 0),
      clicks: Number(r.metrics?.clicks || 0),
      spend: Number(r.metrics?.spend || 0),
      conversions: Number(r.metrics?.conversion || 0),
      currency: 'CAD',
    }));

    const synced = await upsertSnapshots('tiktok', campaigns);
    return { success: true, platform: 'tiktok', synced };
  } catch (error) {
    logger.error('[AdsSync] TikTok error:', error);
    return { success: false, platform: 'tiktok', synced: 0, error: error instanceof Error ? error.message : 'Sync failed' };
  }
}

// ---------------------------------------------------------------------------
// X / Twitter Ads
// ---------------------------------------------------------------------------

export async function syncXAds(): Promise<SyncResult> {
  const bearerToken = await getSetting('x_ads_bearer_token');
  const accountId = await getSetting('x_ads_account_id');

  if (!bearerToken || !accountId) {
    return { success: false, platform: 'x', synced: 0, error: 'X Ads credentials not configured' };
  }

  try {
    const { startDate, endDate } = getLast30Days();
    const url = `https://ads-api.twitter.com/12/stats/accounts/${accountId}?entity=CAMPAIGN&start_time=${startDate}T00:00:00Z&end_time=${endDate}T23:59:59Z&granularity=DAY&metric_groups=ENGAGEMENT,BILLING`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });

    if (!res.ok) {
      return { success: false, platform: 'x', synced: 0, error: `API error: ${res.status}` };
    }

    const data = await res.json();
    const campaigns: CampaignData[] = (data.data || []).map((r: Record<string, unknown>) => ({
      campaignId: (r.id as string) || 'unknown',
      campaignName: (r.name as string) || 'Unknown',
      date: new Date((r.start_time as string) || new Date()),
      impressions: Number((r as Record<string, number>).impressions || 0),
      clicks: Number((r as Record<string, number>).clicks || 0),
      spend: Number((r as Record<string, number>).billed_charge_local_micro || 0) / 1_000_000,
      conversions: Number((r as Record<string, number>).conversion_purchases || 0),
      currency: 'CAD',
    }));

    const synced = await upsertSnapshots('x', campaigns);
    return { success: true, platform: 'x', synced };
  } catch (error) {
    logger.error('[AdsSync] X error:', error);
    return { success: false, platform: 'x', synced: 0, error: error instanceof Error ? error.message : 'Sync failed' };
  }
}

// ---------------------------------------------------------------------------
// LinkedIn Ads
// ---------------------------------------------------------------------------

export async function syncLinkedInAds(): Promise<SyncResult> {
  const accessToken = await getSetting('linkedin_ads_access_token');
  const accountId = await getSetting('linkedin_ad_account_id');

  if (!accessToken || !accountId) {
    return { success: false, platform: 'linkedin', synced: 0, error: 'LinkedIn Ads credentials not configured' };
  }

  try {
    const { startDate, endDate } = getLast30Days();
    const url = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&dateRange.start.day=${new Date(startDate).getDate()}&dateRange.start.month=${new Date(startDate).getMonth() + 1}&dateRange.start.year=${new Date(startDate).getFullYear()}&dateRange.end.day=${new Date(endDate).getDate()}&dateRange.end.month=${new Date(endDate).getMonth() + 1}&dateRange.end.year=${new Date(endDate).getFullYear()}&timeGranularity=DAILY&pivot=CAMPAIGN&accounts=urn:li:sponsoredAccount:${accountId}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return { success: false, platform: 'linkedin', synced: 0, error: `API error: ${res.status}` };
    }

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const campaigns: CampaignData[] = (data.elements || []).map((r: any) => {
      const dr = r.dateRange?.start;
      return {
        campaignId: String(r.pivotValue || 'unknown').split(':').pop() || 'unknown',
        campaignName: `Campaign ${String(r.pivotValue || '').split(':').pop()}`,
        date: new Date(
          Number(dr?.year || 2026),
          Number(dr?.month || 1) - 1,
          Number(dr?.day || 1)
        ),
        impressions: Number(r.impressions || 0),
        clicks: Number(r.clicks || 0),
        spend: Number(r.costInLocalCurrency || 0),
        conversions: Number(r.externalWebsiteConversions || 0),
        currency: 'CAD',
      };
    });

    const synced = await upsertSnapshots('linkedin', campaigns);
    return { success: true, platform: 'linkedin', synced };
  } catch (error) {
    logger.error('[AdsSync] LinkedIn error:', error);
    return { success: false, platform: 'linkedin', synced: 0, error: error instanceof Error ? error.message : 'Sync failed' };
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const SYNC_MAP: Record<string, () => Promise<SyncResult>> = {
  youtube: syncYouTubeAds,
  'google-ads': syncGoogleAds,
  meta: syncMetaAds,
  tiktok: syncTikTokAds,
  x: syncXAds,
  linkedin: syncLinkedInAds,
};

/**
 * Sync a specific platform, or all platforms.
 */
export async function syncAds(platform?: string): Promise<SyncResult[]> {
  const syncFns = platform && SYNC_MAP[platform]
    ? [[platform, SYNC_MAP[platform]] as const]
    : Object.entries(SYNC_MAP);

  const results: SyncResult[] = [];
  for (const [name, fn] of syncFns) {
    logger.info(`[AdsSync] Starting sync for ${name}`);
    const result = await fn();
    results.push(result);
    logger.info(`[AdsSync] ${name}: ${result.success ? 'OK' : 'FAILED'} (${result.synced} records)`);
  }
  return results;
}
