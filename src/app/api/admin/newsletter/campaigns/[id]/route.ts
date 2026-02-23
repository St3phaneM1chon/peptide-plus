export const dynamic = 'force-dynamic';

/**
 * Admin Newsletter Campaign [id] API
 *
 * PATCH /api/admin/newsletter/campaigns/[id] - Update campaign status
 * GET   /api/admin/newsletter/campaigns/[id]/stats - (separate route file)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { updateCampaignSchema } from '@/lib/validations/newsletter';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
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
// Valid state transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SCHEDULED', 'SENT'],
  SCHEDULED: ['DRAFT', 'SENT'],
  SENT: [], // Terminal state - cannot change after sending
};

// ---------------------------------------------------------------------------
// Helpers to load/save campaigns from SiteSetting store
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// PATCH /api/admin/newsletter/campaigns/[id]
// Update campaign status (DRAFT -> SCHEDULED -> SENT) or content
// ---------------------------------------------------------------------------

export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const campaignId = params?.id;
    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate with Zod
    const parsed = updateCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { status: newStatus, subject, content, scheduledFor } = parsed.data;

    // Load existing campaigns
    const campaigns = await loadCampaigns();
    const campaignIndex = campaigns.findIndex((c) => c.id === campaignId);

    if (campaignIndex === -1) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const campaign = campaigns[campaignIndex];

    // Validate status transition if status is changing
    if (newStatus && newStatus !== campaign.status) {
      const allowed = VALID_TRANSITIONS[campaign.status] || [];
      if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          {
            error: `Invalid status transition: ${campaign.status} -> ${newStatus}. Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}`,
          },
          { status: 400 }
        );
      }
    }

    // Apply updates
    if (subject !== undefined) {
      campaign.subject = subject;
    }
    if (content !== undefined) {
      campaign.content = content;
    }
    if (scheduledFor !== undefined) {
      campaign.scheduledFor = scheduledFor || undefined;
    }

    if (newStatus) {
      campaign.status = newStatus;

      // If marking as SENT, record the sent timestamp and recipient count
      if (newStatus === 'SENT') {
        campaign.sentAt = new Date().toISOString();
        const recipientCount = await prisma.newsletterSubscriber.count({
          where: { isActive: true },
        });
        campaign.recipientCount = recipientCount;
      }
    }

    // Save back
    campaigns[campaignIndex] = campaign;
    await saveCampaigns(campaigns, session.user.id);

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_NEWSLETTER_CAMPAIGN',
      targetType: 'NewsletterCampaign',
      targetId: campaignId!,
      newValue: { status: campaign.status, subject: campaign.subject },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      campaign,
    });
  } catch (error) {
    logger.error('PATCH newsletter campaign error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error updating campaign' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/newsletter/campaigns/[id]
// Get a single campaign by ID
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

    return NextResponse.json({ campaign });
  } catch (error) {
    logger.error('GET newsletter campaign error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error fetching campaign' },
      { status: 500 }
    );
  }
});
