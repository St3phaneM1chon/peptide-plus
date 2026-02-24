export const dynamic = 'force-dynamic';

/**
 * Admin Newsletter Campaign Stats API
 *
 * GET /api/admin/newsletter/campaigns/[id]/stats
 * Returns campaign analytics: sentCount, openRate, clickRate, bounceRate, unsubscribeRate
 *
 * NOTE: Until a dedicated email tracking system is implemented, stats are
 * derived from the Campaign record stored in SiteSetting. Once a proper
 * email delivery provider (SendGrid/SES) is integrated, these can be replaced
 * with real-time webhook data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const CAMPAIGNS_KEY = 'newsletter_campaigns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadCampaigns(): Promise<Campaign[]> {
  const entry = await prisma.siteSetting.findUnique({
    where: { key: CAMPAIGNS_KEY },
  });
  if (!entry) return [];
  try {
    return JSON.parse(entry.value) as Campaign[];
  } catch (error) {
    console.error('[NewsletterCampaignStats] Failed to parse campaigns JSON:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/newsletter/campaigns/[id]/stats
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request: NextRequest, { session: _session, params }) => {
  try {
    const campaignId = params?.id;
    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    const campaigns = await loadCampaigns();
    const campaign = campaigns.find((c) => c.id === campaignId);

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (campaign.status !== 'SENT') {
      return NextResponse.json(
        { error: 'Stats are only available for sent campaigns' },
        { status: 400 }
      );
    }

    // Get current subscriber counts for context
    const [totalActive, totalUnsubscribed] = await Promise.all([
      prisma.newsletterSubscriber.count({ where: { isActive: true } }),
      prisma.newsletterSubscriber.count({ where: { isActive: false } }),
    ]);

    // Build stats from campaign data
    // NOTE: openRate and clickRate come from campaign record if set;
    // bounceRate and unsubscribeRate are estimated until real tracking is wired.
    const sentCount = campaign.recipientCount || 0;
    const openRate = campaign.openRate ?? 0;
    const clickRate = campaign.clickRate ?? 0;

    // Estimated bounce/unsub rates - placeholder until real email provider webhooks
    const bounceRate = 0;
    const unsubscribeRate = 0;

    return NextResponse.json({
      campaignId: campaign.id,
      subject: campaign.subject,
      sentAt: campaign.sentAt,
      stats: {
        sentCount,
        openRate,
        clickRate,
        bounceRate,
        unsubscribeRate,
        // Computed counts (from rates)
        openCount: Math.round((sentCount * openRate) / 100),
        clickCount: Math.round((sentCount * clickRate) / 100),
        bounceCount: Math.round((sentCount * bounceRate) / 100),
        unsubscribeCount: Math.round((sentCount * unsubscribeRate) / 100),
      },
      subscriberContext: {
        totalActive,
        totalUnsubscribed,
      },
    });
  } catch (error) {
    logger.error('GET newsletter campaign stats error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error fetching campaign stats' },
      { status: 500 }
    );
  }
});
