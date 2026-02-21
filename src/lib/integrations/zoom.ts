/**
 * Zoom API Integration - BioCycle Peptides
 * Used for: customer support calls, product demos, webinars
 */

import { prisma } from '@/lib/db';

export interface ZoomConfig {
  enabled: boolean;
  accountId: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
}

// Lazy-initialized config from SiteSetting
let _config: ZoomConfig | null = null;

export async function getZoomConfig(): Promise<ZoomConfig> {
  if (_config) return _config;

  const settings = await prisma.siteSetting.findMany({
    where: { module: 'integrations', key: { startsWith: 'zoom.' } },
  });

  const get = (key: string) => settings.find(s => s.key === `zoom.${key}`)?.value || '';

  _config = {
    enabled: get('enabled') === 'true',
    accountId: process.env.ZOOM_ACCOUNT_ID || get('account_id'),
    clientId: process.env.ZOOM_CLIENT_ID || get('client_id'),
    clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
    webhookSecret: process.env.ZOOM_WEBHOOK_SECRET || '',
  };
  return _config;
}

export function clearZoomConfigCache() {
  _config = null;
}

// Get OAuth token using Server-to-Server OAuth
async function getAccessToken(): Promise<string> {
  const config = await getZoomConfig();
  if (!config.accountId || !config.clientId || !config.clientSecret) {
    throw new Error('Zoom credentials not configured');
  }

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=account_credentials&account_id=${config.accountId}`,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom OAuth failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function testZoomConnection(): Promise<{ success: boolean; user?: string; error?: string }> {
  try {
    const token = await getAccessToken();
    const res = await fetch('https://api.zoom.us/v2/users/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) {
      return { success: false, error: `API returned ${res.status}` };
    }

    const data = await res.json();
    return { success: true, user: data.email || data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function createMeeting(topic: string, startTime: string, duration: number = 30) {
  const token = await getAccessToken();
  const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic,
      type: 2, // Scheduled
      start_time: startTime,
      duration,
      settings: {
        join_before_host: false,
        waiting_room: true,
        auto_recording: 'none',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Create meeting failed: ${res.status} ${err}`);
  }

  return res.json();
}

export async function listMeetings() {
  const token = await getAccessToken();
  const res = await fetch('https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=10', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`List meetings failed: ${res.status}`);
  return res.json();
}
