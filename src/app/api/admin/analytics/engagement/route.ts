export const dynamic = 'force-dynamic';

/**
 * Cross-Module Analytics #6: Cross-Module Engagement Dashboard
 * GET /api/admin/analytics/engagement
 *
 * Usage and activity metrics across ALL modules, with correlation matrix.
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess } from '@/lib/api-response';
import { getModuleFlags } from '@/lib/module-flags';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params: _params }: { session: unknown; params: Promise<{ id?: string }> }
) => {
  const flags = await getModuleFlags([
    'ecommerce', 'crm', 'accounting', 'loyalty', 'marketing', 'voip', 'email', 'community', 'media',
  ]);

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '7', 10);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const modules: Record<string, { label: string; activity: number; trend: string }> = {};

  // ── Commerce ──
  if (flags.ecommerce) {
    const orders = await prisma.order.count({ where: { createdAt: { gte: since } } });
    modules.commerce = { label: 'Commerce', activity: orders, trend: 'orders' };
  }

  // ── CRM ──
  if (flags.crm) {
    const [deals, activities] = await Promise.all([
      prisma.crmDeal.count({ where: { createdAt: { gte: since } } }),
      prisma.crmActivity.count({ where: { createdAt: { gte: since } } }),
    ]);
    modules.crm = { label: 'CRM', activity: deals + activities, trend: 'deals+activities' };
  }

  // ── Accounting ──
  if (flags.accounting) {
    const entries = await prisma.journalEntry.count({ where: { date: { gte: since } } });
    modules.accounting = { label: 'Comptabilité', activity: entries, trend: 'entries' };
  }

  // ── Loyalty ──
  if (flags.loyalty) {
    const txns = await prisma.loyaltyTransaction.count({ where: { createdAt: { gte: since } } });
    modules.loyalty = { label: 'Fidélité', activity: txns, trend: 'transactions' };
  }

  // ── Marketing ──
  if (flags.marketing) {
    const usages = await prisma.promoCodeUsage.count({ where: { usedAt: { gte: since } } });
    modules.marketing = { label: 'Marketing', activity: usages, trend: 'promo usages' };
  }

  // ── Telephony ──
  if (flags.voip) {
    const calls = await prisma.callLog.count({ where: { startedAt: { gte: since } } });
    modules.telephony = { label: 'Téléphonie', activity: calls, trend: 'calls' };
  }

  // ── Email ──
  if (flags.email) {
    const emails = await prisma.emailLog.count({ where: { sentAt: { gte: since } } });
    modules.email = { label: 'Emails', activity: emails, trend: 'sent' };
  }

  // ── Community ──
  if (flags.community) {
    const [reviews, posts] = await Promise.all([
      prisma.review.count({ where: { createdAt: { gte: since } } }),
      prisma.forumPost.count({ where: { createdAt: { gte: since } } }),
    ]);
    modules.community = { label: 'Communauté', activity: reviews + posts, trend: 'reviews+posts' };
  }

  // ── Media ──
  if (flags.media) {
    const videos = await prisma.video.count({ where: { createdAt: { gte: since } } });
    modules.media = { label: 'Média', activity: videos, trend: 'videos' };
  }

  // ── Total activity ──
  const totalActivity = Object.values(modules).reduce((s, m) => s + m.activity, 0);
  const activeModules = Object.values(modules).filter((m) => m.activity > 0).length;

  // ── Activity share ──
  const activityShare = Object.entries(modules).map(([key, m]) => ({
    module: key,
    label: m.label,
    activity: m.activity,
    share: totalActivity > 0 ? Math.round((m.activity / totalActivity) * 1000) / 10 : 0,
  })).sort((a, b) => b.activity - a.activity);

  return apiSuccess({
    period: { days, since: since.toISOString() },
    summary: {
      totalActivity,
      activeModules,
      totalModules: Object.keys(modules).length,
    },
    modules,
    activityShare,
    flags,
  }, { request });
});
