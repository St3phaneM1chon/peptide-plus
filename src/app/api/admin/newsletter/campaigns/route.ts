export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { createCampaignSchema } from '@/lib/validations/newsletter';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const CAMPAIGNS_KEY = 'newsletter_campaigns';

interface Campaign {
  id: string;
  subject: string;
  content: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENT';
  scheduledFor?: string;
  sentAt?: string;
  recipientCount: number;
  openRate?: number;
  clickRate?: number;
  createdAt: string;
}

/**
 * Helper to load campaigns from the SiteSetting key-value store.
 * This is a temporary solution until a dedicated NewsletterCampaign model is added.
 */
async function loadCampaigns(): Promise<Campaign[]> {
  const entry = await prisma.siteSetting.findUnique({
    where: { key: CAMPAIGNS_KEY },
  });
  if (!entry) return [];
  try {
    return JSON.parse(entry.value) as Campaign[];
  } catch {
    return [];
  }
}

async function saveCampaigns(campaigns: Campaign[], userId: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: CAMPAIGNS_KEY },
    update: {
      value: JSON.stringify(campaigns),
      updatedBy: userId,
    },
    create: {
      key: CAMPAIGNS_KEY,
      value: JSON.stringify(campaigns),
      type: 'json',
      module: 'newsletter',
      updatedBy: userId,
    },
  });
}

/**
 * GET /api/admin/newsletter/campaigns
 * List newsletter campaigns
 */
export const GET = withAdminGuard(async (_request, { session: _session }) => {
  try {
    const [campaigns, totalActive] = await Promise.all([
      loadCampaigns(),
      prisma.newsletterSubscriber.count({
        where: { isActive: true },
      }),
    ]);

    return NextResponse.json({
      campaigns,
      meta: {
        totalActiveSubscribers: totalActive,
      },
    });
  } catch (error) {
    logger.error('Get newsletter campaigns error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error fetching campaigns' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/newsletter/campaigns
 * Create a new campaign (draft, scheduled, or send now)
 */
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { subject, content, status, scheduledFor } = parsed.data;
    const campaignStatus = status;

    // Count active subscribers for recipientCount
    const recipientCount = await prisma.newsletterSubscriber.count({
      where: { isActive: true },
    });

    const now = new Date().toISOString();
    const newCampaign: Campaign = {
      // AMELIORATION: Use crypto.randomUUID instead of Math.random for campaign IDs
      id: `campaign-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      subject,
      content,
      status: campaignStatus,
      scheduledFor: scheduledFor || undefined,
      sentAt: campaignStatus === 'SENT' ? now : undefined,
      recipientCount: campaignStatus === 'SENT' ? recipientCount : 0,
      createdAt: now,
    };

    const campaigns = await loadCampaigns();
    campaigns.unshift(newCampaign);
    await saveCampaigns(campaigns, session.user.id);

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_NEWSLETTER_CAMPAIGN',
      targetType: 'NewsletterCampaign',
      targetId: newCampaign.id,
      newValue: { subject, status: campaignStatus, recipientCount: newCampaign.recipientCount },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(
      { success: true, campaign: newCampaign },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Create newsletter campaign error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error creating campaign' },
      { status: 500 }
    );
  }
});
