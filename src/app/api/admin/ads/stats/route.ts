export const dynamic = 'force-dynamic';

/**
 * Ads Stats API
 * GET - Aggregated stats (all platforms or filtered, by period)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

export const GET = withAdminGuard(async (request: NextRequest) => {
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform');
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));

  const since = new Date();
  since.setDate(since.getDate() - days);

  const where: Record<string, unknown> = {
    date: { gte: since },
  };
  if (platform) where.platform = platform;

  // Aggregated totals
  const aggregated = await prisma.adCampaignSnapshot.aggregate({
    where,
    _sum: {
      impressions: true,
      clicks: true,
      spend: true,
      conversions: true,
    },
  });

  // Daily breakdown
  const dailyRaw = await prisma.adCampaignSnapshot.groupBy({
    by: ['date'],
    where,
    _sum: {
      impressions: true,
      clicks: true,
      spend: true,
      conversions: true,
    },
    orderBy: { date: 'asc' },
  });

  const daily = dailyRaw.map(d => ({
    date: d.date.toISOString().split('T')[0],
    impressions: d._sum.impressions || 0,
    clicks: d._sum.clicks || 0,
    spend: Number(d._sum.spend || 0),
    conversions: d._sum.conversions || 0,
  }));

  // Per-platform breakdown
  const platformRaw = await prisma.adCampaignSnapshot.groupBy({
    by: ['platform'],
    where,
    _sum: {
      impressions: true,
      clicks: true,
      spend: true,
      conversions: true,
    },
  });

  const platforms = platformRaw.map(p => ({
    platform: p.platform,
    impressions: p._sum.impressions || 0,
    clicks: p._sum.clicks || 0,
    spend: Number(p._sum.spend || 0),
    conversions: p._sum.conversions || 0,
  }));

  const totalImpressions = aggregated._sum.impressions || 0;
  const totalClicks = aggregated._sum.clicks || 0;
  const totalSpend = Number(aggregated._sum.spend || 0);
  const totalConversions = aggregated._sum.conversions || 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    totals: {
      impressions: totalImpressions,
      clicks: totalClicks,
      spend: totalSpend,
      conversions: totalConversions,
      ctr: Math.round(ctr * 100) / 100,
      cpa: Math.round(cpa * 100) / 100,
    },
    daily,
    platforms,
  });
});
