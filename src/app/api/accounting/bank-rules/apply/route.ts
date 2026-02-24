export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import type { BankRule, BankTransaction } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const applyRulesSchema = z.object({
  transactionIds: z.array(z.string()).optional(),
  applyAll: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Rule matching logic
// ---------------------------------------------------------------------------

/**
 * Check if a single rule matches a transaction.
 * A rule matches when ALL its non-null conditions match the transaction.
 */
function ruleMatchesTransaction(rule: BankRule, tx: BankTransaction): boolean {
  // Description contains (case-insensitive)
  if (rule.descriptionContains) {
    if (!tx.description.toLowerCase().includes(rule.descriptionContains.toLowerCase())) {
      return false;
    }
  }

  // Description starts with (case-insensitive)
  if (rule.descriptionStartsWith) {
    if (!tx.description.toLowerCase().startsWith(rule.descriptionStartsWith.toLowerCase())) {
      return false;
    }
  }

  // Description exact match (case-insensitive)
  if (rule.descriptionExact) {
    if (tx.description.toLowerCase().trim() !== rule.descriptionExact.toLowerCase().trim()) {
      return false;
    }
  }

  // Amount minimum
  if (rule.amountMin !== null) {
    const txAbs = tx.amount.abs();
    if (txAbs.lessThan(rule.amountMin as Decimal)) {
      return false;
    }
  }

  // Amount maximum
  if (rule.amountMax !== null) {
    const txAbs = tx.amount.abs();
    if (txAbs.greaterThan(rule.amountMax as Decimal)) {
      return false;
    }
  }

  // Amount exact
  if (rule.amountExact !== null) {
    const txAbs = tx.amount.abs();
    if (!txAbs.equals(rule.amountExact as Decimal)) {
      return false;
    }
  }

  // Transaction type (DEBIT/CREDIT)
  if (rule.transactionType) {
    if (tx.type.toUpperCase() !== rule.transactionType.toUpperCase()) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// POST /api/accounting/bank-rules/apply
// Apply rules to unmatched bank transactions
// ---------------------------------------------------------------------------
export const POST = withAdminGuard(async (request) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/bank-rules/apply');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = applyRulesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { transactionIds, applyAll } = parsed.data;

    if (!applyAll && (!Array.isArray(transactionIds) || transactionIds.length === 0)) {
      return NextResponse.json(
        { error: 'Provide transactionIds array or set applyAll: true' },
        { status: 400 }
      );
    }

    // Fetch active rules, ordered by priority desc
    const rules = await prisma.bankRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    if (rules.length === 0) {
      return NextResponse.json({
        matched: 0,
        unmatched: 0,
        results: [],
        message: 'No active rules found',
      });
    }

    // Fetch transactions to process
    // "Unmatched" = no category assigned and reconciliation still PENDING
    const txWhere: Record<string, unknown> = {
      deletedAt: null,
      category: null,
    };

    if (!applyAll && transactionIds) {
      txWhere.id = { in: transactionIds };
    }

    const transactions = await prisma.bankTransaction.findMany({
      where: txWhere,
    });

    const results: Array<{ transactionId: string; ruleId: string; ruleName: string }> = [];
    const ruleUpdateMap = new Map<string, number>(); // ruleId -> count of matches

    for (const tx of transactions) {
      // Try each rule in priority order - first match wins
      for (const rule of rules) {
        if (ruleMatchesTransaction(rule, tx)) {
          // Build update data from rule actions
          const updateData: Record<string, unknown> = {};

          if (rule.categoryTag) {
            updateData.category = rule.categoryTag;
          }

          // If the rule has an override description, apply it
          if (rule.description) {
            updateData.description = rule.description;
          }

          // Only update if there's something to change
          if (Object.keys(updateData).length > 0) {
            await prisma.bankTransaction.update({
              where: { id: tx.id },
              data: updateData,
            });
          }

          // Track rule application stats
          ruleUpdateMap.set(rule.id, (ruleUpdateMap.get(rule.id) || 0) + 1);

          results.push({
            transactionId: tx.id,
            ruleId: rule.id,
            ruleName: rule.name,
          });

          break; // First matching rule wins
        }
      }
    }

    // Batch-update rule stats (timesApplied, lastAppliedAt)
    const now = new Date();
    await Promise.all(
      Array.from(ruleUpdateMap.entries()).map(([ruleId, count]) =>
        prisma.bankRule.update({
          where: { id: ruleId },
          data: {
            timesApplied: { increment: count },
            lastAppliedAt: now,
          },
        })
      )
    );

    return NextResponse.json({
      matched: results.length,
      unmatched: transactions.length - results.length,
      totalProcessed: transactions.length,
      results,
    });
  } catch (error) {
    logger.error('POST /api/accounting/bank-rules/apply error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
});
