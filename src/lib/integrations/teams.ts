/**
 * Microsoft Teams Integration - BioCycle Peptides
 * Used for: internal notifications, order alerts, team collaboration
 */

import { prisma } from '@/lib/db';

export interface TeamsConfig {
  enabled: boolean;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  webhookUrl: string;
}

let _config: TeamsConfig | null = null;

export async function getTeamsConfig(): Promise<TeamsConfig> {
  if (_config) return _config;

  const settings = await prisma.siteSetting.findMany({
    where: { module: 'integrations', key: { startsWith: 'teams.' } },
  });

  const get = (key: string) => settings.find(s => s.key === `teams.${key}`)?.value || '';

  _config = {
    enabled: get('enabled') === 'true',
    tenantId: process.env.TEAMS_TENANT_ID || get('tenant_id'),
    clientId: process.env.TEAMS_CLIENT_ID || get('client_id'),
    clientSecret: process.env.TEAMS_CLIENT_SECRET || '',
    webhookUrl: process.env.TEAMS_WEBHOOK_URL || get('webhook_url'),
  };
  return _config;
}

export function clearTeamsConfigCache() {
  _config = null;
}

// Get OAuth token via client credentials flow (Microsoft Graph)
async function getAccessToken(): Promise<string> {
  const config = await getTeamsConfig();
  if (!config.tenantId || !config.clientId || !config.clientSecret) {
    throw new Error('Teams credentials not configured');
  }

  const res = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Teams OAuth failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function testTeamsConnection(): Promise<{ success: boolean; org?: string; error?: string }> {
  try {
    // Method 1: Test via incoming webhook (simpler setup)
    const config = await getTeamsConfig();
    if (config.webhookUrl) {
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: '0076D7',
          summary: 'BioCycle Peptides - Connection Test',
          sections: [{
            activityTitle: 'Connection Test',
            activitySubtitle: new Date().toISOString(),
            facts: [{ name: 'Status', value: 'Connected' }],
          }],
        }),
      });
      if (res.ok) return { success: true, org: 'Webhook connected' };
      return { success: false, error: `Webhook returned ${res.status}` };
    }

    // Method 2: Test via Graph API (requires app registration)
    const token = await getAccessToken();
    const res = await fetch('https://graph.microsoft.com/v1.0/organization', {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) return { success: false, error: `Graph API returned ${res.status}` };

    const data = await res.json();
    const orgName = data.value?.[0]?.displayName || 'Connected';
    return { success: true, org: orgName };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Send message via incoming webhook (simplest integration)
export async function sendWebhookMessage(title: string, text: string, themeColor = '0076D7') {
  const config = await getTeamsConfig();
  if (!config.webhookUrl) throw new Error('Teams webhook URL not configured');

  const res = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor,
      summary: title,
      sections: [{
        activityTitle: title,
        activitySubtitle: new Date().toISOString(),
        text,
      }],
    }),
  });

  if (!res.ok) throw new Error(`Teams webhook failed: ${res.status}`);
  return { success: true };
}

// Send notification for order events
export async function notifyOrderEvent(orderId: string, event: string, details: string) {
  const colors: Record<string, string> = {
    new_order: '28A745',
    payment_received: '0076D7',
    shipped: '17A2B8',
    cancelled: 'DC3545',
    refunded: 'FFC107',
  };

  return sendWebhookMessage(
    `Order ${event.replace('_', ' ').toUpperCase()}: #${orderId.slice(0, 8)}`,
    details,
    colors[event] || '6C757D'
  );
}
