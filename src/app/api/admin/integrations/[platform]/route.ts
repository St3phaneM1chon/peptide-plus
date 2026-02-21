export const dynamic = 'force-dynamic';

/**
 * Unified Integration Configuration API
 * GET  - Retrieve integration config for a platform
 * PUT  - Save integration config
 * POST - Test connection / perform actions
 *
 * Configs are stored as SiteSetting entries with module='integrations'
 * Keys: "integration.<platform>.<field>" (e.g., "integration.zoom.enabled")
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

const VALID_PLATFORMS = [
  'zoom', 'whatsapp', 'teams', 'youtube', 'x', 'tiktok', 'google', 'meta', 'linkedin',
] as const;

type Platform = typeof VALID_PLATFORMS[number];

// Platform-specific field definitions (non-secret fields storable in DB)
const PLATFORM_FIELDS: Record<Platform, string[]> = {
  zoom: ['enabled', 'accountId', 'clientId'],
  whatsapp: ['enabled', 'phoneNumberId', 'businessAccountId'],
  teams: ['enabled', 'tenantId', 'clientId', 'webhookUrl'],
  youtube: ['enabled', 'channelId', 'apiKey'],
  x: ['enabled', 'username', 'apiKeyId'],
  tiktok: ['enabled', 'advertiserId', 'appId'],
  google: ['enabled', 'customerId', 'merchantId'],
  meta: ['enabled', 'appId', 'pixelId', 'pageId', 'igAccountId'],
  linkedin: ['enabled', 'companyId', 'appId'],
};

// Secret field names (stored in env vars, not DB — only indicate presence)
const SECRET_FIELDS: Record<Platform, string[]> = {
  zoom: ['clientSecret'],
  whatsapp: ['accessToken'],
  teams: ['clientSecret'],
  youtube: ['clientSecret'],
  x: ['apiKeySecret', 'accessToken', 'accessTokenSecret'],
  tiktok: ['appSecret', 'accessToken'],
  google: ['developerToken', 'clientSecret', 'refreshToken'],
  meta: ['accessToken', 'appSecret'],
  linkedin: ['clientSecret', 'accessToken'],
};

// Env var name for secrets: INTEGRATION_<PLATFORM>_<FIELD>
function getEnvVarName(platform: string, field: string): string {
  return `INTEGRATION_${platform.toUpperCase()}_${field.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
}

function hasSecret(platform: string, field: string): boolean {
  const envName = getEnvVarName(platform, field);
  return !!process.env[envName];
}

// Webhook URL generator
function getWebhookUrl(platform: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  return `${baseUrl}/api/webhooks/${platform}`;
}

// GET /api/admin/integrations/[platform]
export const GET = withAdminGuard(async (request, { session }) => {
  const url = new URL(request.url);
  const platform = url.pathname.split('/').pop() as string;

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: `Invalid platform: ${platform}` }, { status: 400 });
  }

  const prefix = `integration.${platform}.`;
  const settings = await prisma.siteSetting.findMany({
    where: { key: { startsWith: prefix } },
  });

  // Build response from stored settings
  const config: Record<string, string | boolean> = {};
  for (const s of settings) {
    const field = s.key.replace(prefix, '');
    config[field] = s.value === 'true' ? true : s.value === 'false' ? false : s.value;
  }

  // Add secret presence indicators
  const secrets = SECRET_FIELDS[platform as Platform] || [];
  for (const secret of secrets) {
    config[`has${secret.charAt(0).toUpperCase()}${secret.slice(1)}`] = hasSecret(platform, secret);
  }

  // Add webhook URL
  config.webhookUrl = getWebhookUrl(platform);

  return NextResponse.json(config);
});

// PUT /api/admin/integrations/[platform] - Save config
export const PUT = withAdminGuard(async (request, { session }) => {
  const url = new URL(request.url);
  const platform = url.pathname.split('/').pop() as string;

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: `Invalid platform: ${platform}` }, { status: 400 });
  }

  const body = await request.json();
  const allowedFields = PLATFORM_FIELDS[platform as Platform] || [];
  const prefix = `integration.${platform}.`;

  await prisma.$transaction(async (tx) => {
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const key = `${prefix}${field}`;
        const value = String(body[field]);

        await tx.siteSetting.upsert({
          where: { key },
          update: { value, updatedBy: session.user.id },
          create: {
            key,
            value,
            type: field === 'enabled' ? 'boolean' : 'text',
            module: 'integrations',
            description: `${platform} integration: ${field}`,
            updatedBy: session.user.id,
          },
        });
      }
    }
  });

  logAdminAction({
    adminUserId: session.user.id,
    action: 'UPDATE_INTEGRATION',
    targetType: 'Integration',
    targetId: platform,
    newValue: { platform, fields: Object.keys(body).filter(k => allowedFields.includes(k)) },
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
  }).catch(() => {});

  return NextResponse.json({ success: true });
});

// POST /api/admin/integrations/[platform] - Test connection / actions
export const POST = withAdminGuard(async (request, { session }) => {
  const url = new URL(request.url);
  const platform = url.pathname.split('/').pop() as string;

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: `Invalid platform: ${platform}` }, { status: 400 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === 'test') {
    // Test connection for each platform
    try {
      switch (platform) {
        case 'zoom': {
          const accountId = process.env.INTEGRATION_ZOOM_ACCOUNT_ID;
          const clientId = process.env.INTEGRATION_ZOOM_CLIENT_ID;
          const clientSecret = process.env.INTEGRATION_ZOOM_CLIENT_SECRET;
          if (!accountId || !clientId || !clientSecret) {
            return NextResponse.json({ success: false, error: 'Missing Zoom credentials in environment variables' });
          }
          // Server-to-Server OAuth token
          const tokenRes = await fetch('https://zoom.us/oauth/token', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `grant_type=account_credentials&account_id=${accountId}`,
          });
          if (!tokenRes.ok) {
            return NextResponse.json({ success: false, error: 'Failed to authenticate with Zoom' });
          }
          const tokenData = await tokenRes.json();
          // Verify with user info
          const userRes = await fetch('https://api.zoom.us/v2/users/me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const userData = await userRes.json();
          return NextResponse.json({ success: true, user: userData.email || userData.id });
        }

        case 'whatsapp': {
          const accessToken = process.env.INTEGRATION_WHATSAPP_ACCESS_TOKEN;
          const phoneNumberId = process.env.INTEGRATION_WHATSAPP_PHONE_NUMBER_ID;
          if (!accessToken) {
            return NextResponse.json({ success: false, error: 'Missing WhatsApp access token in environment variables' });
          }
          const waRes = await fetch(
            `https://graph.facebook.com/v21.0/${phoneNumberId || 'me'}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const waData = await waRes.json();
          if (waData.error) {
            return NextResponse.json({ success: false, error: waData.error.message });
          }
          return NextResponse.json({ success: true, phone: waData.display_phone_number || waData.id });
        }

        case 'teams': {
          // Test Teams webhook
          const prefix = 'integration.teams.';
          const webhookSetting = await prisma.siteSetting.findUnique({
            where: { key: `${prefix}webhookUrl` },
          });
          const webhookUrl = webhookSetting?.value;
          if (!webhookUrl) {
            return NextResponse.json({ success: false, error: 'No webhook URL configured' });
          }
          // Send test card
          const testRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              '@type': 'MessageCard',
              summary: 'BioCycle Peptides - Test',
              sections: [{ activityTitle: 'Connection test successful', activitySubtitle: new Date().toISOString() }],
            }),
          });
          return NextResponse.json({ success: testRes.ok, org: testRes.ok ? 'Webhook active' : 'Webhook failed' });
        }

        case 'youtube': {
          const apiKey = process.env.INTEGRATION_YOUTUBE_API_KEY;
          if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Missing YouTube API key' });
          }
          const channelSetting = await prisma.siteSetting.findUnique({
            where: { key: 'integration.youtube.channelId' },
          });
          const channelId = channelSetting?.value;
          const ytUrl = channelId
            ? `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${apiKey}`
            : `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&key=${apiKey}`;
          const ytRes = await fetch(ytUrl);
          const ytData = await ytRes.json();
          if (ytData.error) {
            return NextResponse.json({ success: false, error: ytData.error.message });
          }
          const channel = ytData.items?.[0];
          return NextResponse.json({ success: true, detail: channel?.snippet?.title || 'API Key valid' });
        }

        case 'meta': {
          const metaToken = process.env.INTEGRATION_META_ACCESS_TOKEN;
          if (!metaToken) {
            return NextResponse.json({ success: false, error: 'Missing Meta access token' });
          }
          const metaRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${metaToken}`);
          const metaData = await metaRes.json();
          if (metaData.error) {
            return NextResponse.json({ success: false, error: metaData.error.message });
          }
          return NextResponse.json({ success: true, detail: metaData.name || metaData.id });
        }

        default:
          return NextResponse.json({
            success: false,
            error: `Connection test not yet implemented for ${platform}. Configure your API credentials and check the documentation.`,
          });
      }
    } catch (error) {
      console.error(`Integration test error (${platform}):`, error);
      return NextResponse.json({ success: false, error: 'Connection test failed' });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
});
