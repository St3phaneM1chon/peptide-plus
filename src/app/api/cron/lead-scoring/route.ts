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

function computeScore(lead: {
  email: string | null;
  phone: string | null;
  companyName: string | null;
  lastContactedAt: Date | null;
  updatedAt: Date;
  source: string;
}): number {
  let score = 0;
  if (lead.email) score += 15;
  if (lead.phone) score += 15;
  if (lead.companyName) score += 10;
  if (lead.lastContactedAt) score += 20;

  const now = Date.now();
  if (now - lead.updatedAt.getTime() < SEVEN_DAYS_MS) score += 20;

  if (BONUS_SOURCES.has(lead.source)) score += 10;

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

    // Compute new scores and collect only leads that need updating
    const leadsToUpdate: Array<{ id: string; score: number; temperature: 'HOT' | 'WARM' | 'COLD' }> = [];
    for (const lead of leads) {
      const newScore = computeScore(lead);
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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
