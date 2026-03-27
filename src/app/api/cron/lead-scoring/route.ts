export const dynamic = 'force-dynamic';

/**
 * CRON Job - Lead Scoring
 * GET /api/cron/lead-scoring - Recalculate scores for all active leads
 *
 * Scoring rules:
 *   +15 has email
 *   +15 has phone
 *   +10 has company name
 *   +20 was contacted (lastContactedAt is set)
 *   +20 recent activity (updatedAt within last 7 days)
 *   +10 source bonus (WEB, REFERRAL, CAMPAIGN)
 *
 * Temperature mapping:
 *   score >= 70 -> HOT
 *   score >= 40 -> WARM
 *   otherwise   -> COLD
 *
 * Protected by CRON_SECRET env var (Authorization: Bearer <CRON_SECRET>)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { withJobLock } from '@/lib/cron-lock';

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Scoring constants
// ---------------------------------------------------------------------------

const BONUS_SOURCES = new Set(['WEB', 'REFERRAL', 'CAMPAIGN']);
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface BehavioralSignals {
  emailOpens: number;    // from EmailLog opened emails linked to this contact
  pageViews: number;     // from ProductView
  formSubmissions: number; // from CrmActivity type=FORM_SUBMIT
  orderCount: number;    // from Order
  orderTotal: number;    // total revenue from orders
  activityCount: number; // from CrmActivity (any type)
}

function computeScore(
  lead: {
    email: string | null;
    phone: string | null;
    companyName: string | null;
    lastContactedAt: Date | null;
    updatedAt: Date;
    source: string;
  },
  signals: BehavioralSignals
): number {
  let score = 0;

  // ── Profile completeness (max 40) ──
  if (lead.email) score += 10;
  if (lead.phone) score += 10;
  if (lead.companyName) score += 10;
  if (lead.lastContactedAt) score += 10;

  // ── Recency (max 15) ──
  const now = Date.now();
  if (now - lead.updatedAt.getTime() < SEVEN_DAYS_MS) score += 15;
  else if (now - lead.updatedAt.getTime() < THIRTY_DAYS_MS) score += 5;

  // ── Source bonus (max 5) ──
  if (BONUS_SOURCES.has(lead.source)) score += 5;

  // ── Behavioral signals (max 40) ──
  // Email engagement: each open = +2, cap at +10
  score += Math.min(signals.emailOpens * 2, 10);

  // Page views: each view = +1, cap at +5
  score += Math.min(signals.pageViews, 5);

  // Form submissions: each = +5, cap at +10
  score += Math.min(signals.formSubmissions * 5, 10);

  // Order history: having orders is a strong signal
  if (signals.orderCount > 0) score += 10;
  if (signals.orderTotal > 500) score += 5;

  return Math.min(score, 100);
}

function scoreToTemperature(score: number): 'HOT' | 'WARM' | 'COLD' {
  if (score >= 70) return 'HOT';
  if (score >= 40) return 'WARM';
  return 'COLD';
}

// ---------------------------------------------------------------------------
// GET: Recalculate lead scores
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('lead-scoring', async () => {
    try {
      // Fetch all active leads (exclude CONVERTED and LOST)
      const leads = await prisma.crmLead.findMany({
        where: {
          status: { notIn: ['CONVERTED', 'LOST'] },
        },
        select: {
          id: true,
          email: true,
          phone: true,
          companyName: true,
          lastContactedAt: true,
          updatedAt: true,
          source: true,
          score: true,
          temperature: true,
        },
      });

      const processed = leads.length;

      // Batch-fetch behavioral signals for all leads with email
      const leadEmails = leads.map((l) => l.email).filter((e): e is string => !!e);

      // Resolve lead emails to user IDs for order/view lookups
      const emailToUserId = new Map<string, string>();
      if (leadEmails.length > 0) {
        const users = await prisma.user.findMany({
          where: { email: { in: leadEmails } },
          select: { id: true, email: true },
        });
        for (const u of users) emailToUserId.set(u.email, u.id);
      }
      const resolvedUserIds = [...emailToUserId.values()];

      // Email opens: count EmailLog entries with openedAt not null
      const emailOpenCounts = new Map<string, number>();
      if (leadEmails.length > 0) {
        const openLogs = await prisma.emailLog.groupBy({
          by: ['to'],
          where: { to: { in: leadEmails }, openedAt: { not: null } },
          _count: { id: true },
        });
        for (const log of openLogs) {
          emailOpenCounts.set(log.to, log._count.id);
        }
      }

      // Page views: count ProductView per userId (resolved from lead email)
      const pageViewCounts = new Map<string, number>();
      if (resolvedUserIds.length > 0) {
        const views = await prisma.productView.groupBy({
          by: ['userId'],
          where: { userId: { in: resolvedUserIds } },
          _count: { id: true },
        });
        for (const v of views) {
          if (v.userId) pageViewCounts.set(v.userId, v._count.id);
        }
      }

      // CRM activities per lead (form submissions + general activity)
      const activityCounts = new Map<string, { total: number; forms: number }>();
      if (leads.length > 0) {
        const leadIds = leads.map((l) => l.id);
        const activities = await prisma.crmActivity.groupBy({
          by: ['leadId', 'type'],
          where: { leadId: { in: leadIds } },
          _count: { id: true },
        });
        for (const a of activities) {
          if (!a.leadId) continue;
          const existing = activityCounts.get(a.leadId) || { total: 0, forms: 0 };
          existing.total += a._count.id;
          if (a.type === 'NOTE' && a._count.id > 0) existing.forms += a._count.id; // Approximate
          activityCounts.set(a.leadId, existing);
        }
      }

      // Orders per resolved user (from lead email -> User -> Order)
      const orderStats = new Map<string, { count: number; total: number }>();
      if (resolvedUserIds.length > 0) {
        const orders = await prisma.order.groupBy({
          by: ['userId'],
          where: { userId: { in: resolvedUserIds }, paymentStatus: 'PAID' },
          _count: { id: true },
          _sum: { total: true },
        });
        for (const o of orders) {
          if (o.userId) {
            orderStats.set(o.userId, {
              count: o._count.id,
              total: Number(o._sum.total || 0),
            });
          }
        }
      }

      // Compute new scores with behavioral signals
      const leadsToUpdate: Array<{ id: string; score: number; temperature: 'HOT' | 'WARM' | 'COLD' }> = [];
      for (const lead of leads) {
        const resolvedUserId = lead.email ? emailToUserId.get(lead.email) : undefined;
        const signals: BehavioralSignals = {
          emailOpens: lead.email ? (emailOpenCounts.get(lead.email) || 0) : 0,
          pageViews: resolvedUserId ? (pageViewCounts.get(resolvedUserId) || 0) : 0,
          formSubmissions: activityCounts.get(lead.id)?.forms || 0,
          orderCount: resolvedUserId ? (orderStats.get(resolvedUserId)?.count || 0) : 0,
          orderTotal: resolvedUserId ? (orderStats.get(resolvedUserId)?.total || 0) : 0,
          activityCount: activityCounts.get(lead.id)?.total || 0,
        };

        const newScore = computeScore(lead, signals);
        const newTemp = scoreToTemperature(newScore);

        if (newScore !== lead.score || newTemp !== lead.temperature) {
          leadsToUpdate.push({ id: lead.id, score: newScore, temperature: newTemp });
        }
      }

      // Batch updates using $transaction instead of N sequential updates
      if (leadsToUpdate.length > 0) {
        await prisma.$transaction(
          leadsToUpdate.map((lead) =>
            prisma.crmLead.update({
              where: { id: lead.id },
              data: {
                score: lead.score,
                temperature: lead.temperature,
              },
            })
          )
        );
      }

      return NextResponse.json({
        success: true,
        processed,
        updated: leadsToUpdate.length,
        signalsUsed: ['emailOpens', 'pageViews', 'formSubmissions', 'orderHistory', 'activityCount'],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
