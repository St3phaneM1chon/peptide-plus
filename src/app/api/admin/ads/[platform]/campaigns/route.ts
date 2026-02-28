export const dynamic = 'force-dynamic';

/**
 * Ads Campaigns by Platform
 * GET - List campaigns with aggregated stats for a specific platform
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

type RouteParams = { params: Promise<{ platform: string }> };

export const GET = withAdminGuard(async (request: NextRequest, context: RouteParams) => {
  const { platform } = await context.params;
  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));

  const since = new Date();
  since.setDate(since.getDate() - days);

  const campaignRaw = await prisma.adCampaignSnapshot.groupBy({
    by: ['campaignId', 'campaignName'],
    where: {
      platform,
      date: { gte: since },
    },
    _sum: {
      impressions: true,
      clicks: true,
      spend: true,
      conversions: true,
    },
    orderBy: { _sum: { spend: 'desc' } },
  });

  const campaigns = campaignRaw.map(c => ({
    campaignId: c.campaignId,
    campaignName: c.campaignName,
    impressions: c._sum.impressions || 0,
    clicks: c._sum.clicks || 0,
    spend: Number(c._sum.spend || 0),
    conversions: c._sum.conversions || 0,
    ctr: (c._sum.impressions || 0) > 0
      ? Math.round(((c._sum.clicks || 0) / (c._sum.impressions || 0)) * 10000) / 100
      : 0,
  }));

  return NextResponse.json({ platform, period: { days }, campaigns });
});
