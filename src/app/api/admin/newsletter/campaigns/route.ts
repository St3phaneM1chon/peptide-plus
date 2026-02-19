export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

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
    console.error('Get newsletter campaigns error:', error);
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
    const { subject, content, status } = body;

    if (!subject || !content) {
      return NextResponse.json(
        { error: 'Subject and content are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['DRAFT', 'SCHEDULED', 'SENT'];
    const campaignStatus = validStatuses.includes(status) ? status : 'DRAFT';

    // Count active subscribers for recipientCount
    const recipientCount = await prisma.newsletterSubscriber.count({
      where: { isActive: true },
    });

    const now = new Date().toISOString();
    const newCampaign: Campaign = {
      id: `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      subject,
      content,
      status: campaignStatus,
      scheduledFor: body.scheduledFor || undefined,
      sentAt: campaignStatus === 'SENT' ? now : undefined,
      recipientCount: campaignStatus === 'SENT' ? recipientCount : 0,
      createdAt: now,
    };

    const campaigns = await loadCampaigns();
    campaigns.unshift(newCampaign);
    await saveCampaigns(campaigns, session.user.id);

    return NextResponse.json(
      { success: true, campaign: newCampaign },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create newsletter campaign error:', error);
    return NextResponse.json(
      { error: 'Error creating campaign' },
      { status: 500 }
    );
  }
});
