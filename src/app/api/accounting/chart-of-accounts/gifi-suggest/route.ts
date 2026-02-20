export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import {
  suggestGifiCode,
  getGifiCode,
  GIFI_CODES,
} from '@/lib/accounting/gifi-codes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoredSuggestion {
  code: string;
  nameEn: string;
  nameFr: string;
  category: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Internal helper: rank top N GIFI suggestions for a given account
// ---------------------------------------------------------------------------

function getTopSuggestions(
  accountName: string,
  accountType?: string,
  limit = 5
): ScoredSuggestion[] {
  const normalizedName = accountName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // We replicate the keyword matching logic from suggestGifiCode but collect
  // ALL matches (not just the best) so we can return ranked suggestions.
  const scored: Map<string, number> = new Map();

  // Dynamic import would be circular; instead access the keywords by running
  // the suggest function for known GIFI codes.  To avoid duplicating the
  // keyword table, we use a simple approach: run suggestGifiCode first for
  // the top match, then also do a lightweight name-similarity pass over all
  // GIFI codes.

  // Strategy 1: keyword-based top match
  const topMatch = suggestGifiCode(accountName, accountType);
  if (topMatch) {
    scored.set(topMatch.code, 100);
  }

  // Strategy 2: substring match on GIFI names (both EN and FR)
  for (const gifi of GIFI_CODES) {
    const nameEn = gifi.nameEn
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const nameFr = gifi.nameFr
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    let nameScore = 0;

    // Check if account name tokens appear in GIFI name or vice-versa
    const tokens = normalizedName.split(/[\s\-_/()]+/).filter((t) => t.length > 2);
    for (const token of tokens) {
      if (nameEn.includes(token)) nameScore += token.length * 2;
      if (nameFr.includes(token)) nameScore += token.length * 2;
    }

    // Check if GIFI name tokens appear in account name
    const gifiTokensEn = nameEn.split(/[\s\-_/()]+/).filter((t) => t.length > 2);
    for (const token of gifiTokensEn) {
      if (normalizedName.includes(token)) nameScore += token.length;
    }
    const gifiTokensFr = nameFr.split(/[\s\-_/()]+/).filter((t) => t.length > 2);
    for (const token of gifiTokensFr) {
      if (normalizedName.includes(token)) nameScore += token.length;
    }

    if (nameScore > 0) {
      const existing = scored.get(gifi.code) || 0;
      scored.set(gifi.code, existing + nameScore);
    }
  }

  // Sort by score descending and take top N
  const sorted = Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Normalize scores to 0-1 range
  const maxScore = sorted.length > 0 ? sorted[0][1] : 1;

  return sorted
    .map(([code, score]) => {
      const gifi = getGifiCode(code);
      if (!gifi) return null;
      return {
        code: gifi.code,
        nameEn: gifi.nameEn,
        nameFr: gifi.nameFr,
        category: gifi.category,
        score: Math.round((score / maxScore) * 100) / 100,
      };
    })
    .filter((s): s is ScoredSuggestion => s !== null);
}

// ---------------------------------------------------------------------------
// GET /api/accounting/chart-of-accounts/gifi-suggest
// Suggest GIFI codes for a single account
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const accountName = searchParams.get('accountName');
    const accountType = searchParams.get('accountType') || undefined;

    if (!accountName) {
      return NextResponse.json(
        { error: 'accountName query parameter is required' },
        { status: 400 }
      );
    }

    const suggestions = getTopSuggestions(accountName, accountType, 5);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('GIFI suggest error:', error);
    return NextResponse.json(
      { error: 'Error suggesting GIFI codes' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/chart-of-accounts/gifi-suggest
// Batch auto-assign GIFI codes to accounts that don't have one
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (_request, { session }) => {
  try {
    // Fetch all accounts without a GIFI code
    const accountsWithoutGifi = await prisma.chartOfAccount.findMany({
      where: {
        OR: [{ gifiCode: null }, { gifiCode: '' }],
      },
      orderBy: { code: 'asc' },
    });

    let assigned = 0;
    let skipped = 0;
    const suggestions: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      suggestedGifi: string | null;
      suggestedGifiName: string | null;
      score: number;
      autoAssigned: boolean;
    }> = [];

    for (const account of accountsWithoutGifi) {
      const topSuggestions = getTopSuggestions(account.name, account.type, 1);
      const top = topSuggestions[0];

      if (top && top.score > 0.7) {
        // Auto-assign: high confidence match
        await prisma.chartOfAccount.update({
          where: { id: account.id },
          data: {
            gifiCode: top.code,
            gifiName: top.nameEn,
          },
        });
        assigned++;
        suggestions.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          suggestedGifi: top.code,
          suggestedGifiName: top.nameEn,
          score: top.score,
          autoAssigned: true,
        });
      } else {
        skipped++;
        suggestions.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          suggestedGifi: top?.code || null,
          suggestedGifiName: top?.nameEn || null,
          score: top?.score || 0,
          autoAssigned: false,
        });
      }
    }

    // Audit log
    console.info('AUDIT: GIFI batch auto-assign', {
      assignedBy: session.user.id || session.user.email,
      assignedAt: new Date().toISOString(),
      totalProcessed: accountsWithoutGifi.length,
      assigned,
      skipped,
    });

    return NextResponse.json({
      assigned,
      skipped,
      total: accountsWithoutGifi.length,
      suggestions,
    });
  } catch (error) {
    console.error('GIFI batch assign error:', error);
    return NextResponse.json(
      { error: 'Error during batch GIFI assignment' },
      { status: 500 }
    );
  }
});
