export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const createBankRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  priority: z.number().optional().default(0),
  isActive: z.boolean().optional().default(true),
  descriptionContains: z.string().nullable().optional(),
  descriptionStartsWith: z.string().nullable().optional(),
  descriptionExact: z.string().nullable().optional(),
  amountMin: z.number().nullable().optional(),
  amountMax: z.number().nullable().optional(),
  amountExact: z.number().nullable().optional(),
  transactionType: z.enum(['DEBIT', 'CREDIT']).nullable().optional(),
  accountId: z.string().nullable().optional(),
  categoryTag: z.string().nullable().optional(),
  taxCode: z.enum(['GST', 'QST', 'HST', 'EXEMPT', 'ZERO_RATED']).nullable().optional(),
  description: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
});

const updateBankRuleSchema = z.object({
  id: z.string().min(1, 'Rule id is required'),
  name: z.string().optional(),
  priority: z.number().optional(),
  isActive: z.boolean().optional(),
  descriptionContains: z.string().nullable().optional(),
  descriptionStartsWith: z.string().nullable().optional(),
  descriptionExact: z.string().nullable().optional(),
  amountMin: z.union([z.number(), z.null(), z.literal('')]).optional(),
  amountMax: z.union([z.number(), z.null(), z.literal('')]).optional(),
  amountExact: z.union([z.number(), z.null(), z.literal('')]).optional(),
  transactionType: z.enum(['DEBIT', 'CREDIT']).nullable().optional(),
  accountId: z.string().nullable().optional(),
  categoryTag: z.string().nullable().optional(),
  taxCode: z.enum(['GST', 'QST', 'HST', 'EXEMPT', 'ZERO_RATED']).nullable().optional(),
  description: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check that at least one condition field is set */
function hasCondition(data: Record<string, unknown>): boolean {
  return !!(
    data.descriptionContains ||
    data.descriptionStartsWith ||
    data.descriptionExact ||
    data.amountMin !== undefined && data.amountMin !== null ||
    data.amountMax !== undefined && data.amountMax !== null ||
    data.amountExact !== undefined && data.amountExact !== null ||
    data.transactionType
  );
}

/** Check that at least one action field is set */
function hasAction(data: Record<string, unknown>): boolean {
  return !!(data.accountId || data.categoryTag);
}

// ---------------------------------------------------------------------------
// GET /api/accounting/bank-rules
// List all bank rules ordered by priority (desc), isActive first
// ---------------------------------------------------------------------------
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: Record<string, unknown> = {};
    if (activeOnly) where.isActive = true;

    const rules = await prisma.bankRule.findMany({
      where,
      include: {
        account: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { priority: 'desc' },
        { name: 'asc' },
      ],
    });

    // Compute stats
    const total = rules.length;
    const active = rules.filter(r => r.isActive).length;
    const inactive = total - active;
    const totalApplied = rules.reduce((sum, r) => sum + r.timesApplied, 0);

    const mapped = rules.map(r => ({
      ...r,
      amountMin: r.amountMin ? Number(r.amountMin) : null,
      amountMax: r.amountMax ? Number(r.amountMax) : null,
      amountExact: r.amountExact ? Number(r.amountExact) : null,
    }));

    return NextResponse.json({
      rules: mapped,
      stats: { total, active, inactive, totalApplied },
    });
  } catch (error) {
    logger.error('GET /api/accounting/bank-rules error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/bank-rules
// Create a new bank rule
// ---------------------------------------------------------------------------
export const POST = withAdminGuard(async (request) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/bank-rules');
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
    const parsed = createBankRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    // Validate at least one condition
    if (!hasCondition(parsed.data as Record<string, unknown>)) {
      return NextResponse.json(
        { error: 'At least one condition must be set (description, amount, or transaction type)' },
        { status: 400 }
      );
    }

    // Validate at least one action
    if (!hasAction(parsed.data as Record<string, unknown>)) {
      return NextResponse.json(
        { error: 'At least one action must be set (account or category tag)' },
        { status: 400 }
      );
    }

    // Validate accountId exists if provided
    if (parsed.data.accountId) {
      const account = await prisma.chartOfAccount.findUnique({ where: { id: parsed.data.accountId } });
      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 400 });
      }
    }

    const data = parsed.data;
    const rule = await prisma.bankRule.create({
      data: {
        name: data.name.trim(),
        priority: data.priority,
        isActive: data.isActive,
        descriptionContains: data.descriptionContains?.trim() || null,
        descriptionStartsWith: data.descriptionStartsWith?.trim() || null,
        descriptionExact: data.descriptionExact?.trim() || null,
        amountMin: data.amountMin !== undefined && data.amountMin !== null ? data.amountMin : null,
        amountMax: data.amountMax !== undefined && data.amountMax !== null ? data.amountMax : null,
        amountExact: data.amountExact !== undefined && data.amountExact !== null ? data.amountExact : null,
        transactionType: data.transactionType || null,
        accountId: data.accountId || null,
        categoryTag: data.categoryTag?.trim() || null,
        taxCode: data.taxCode || null,
        description: data.description?.trim() || null,
        createdBy: data.createdBy || null,
      },
      include: {
        account: { select: { id: true, code: true, name: true } },
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/accounting/bank-rules error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/bank-rules
// Update an existing rule by id
// ---------------------------------------------------------------------------
export const PUT = withAdminGuard(async (request) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/bank-rules');
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
    const parsed = updateBankRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const validatedBody = parsed.data;

    // Check rule exists
    const existing = await prisma.bankRule.findUnique({ where: { id: validatedBody.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // If toggling isActive only, allow it without full validation
    if (Object.keys(body).length === 2 && 'id' in body && 'isActive' in body) {
      const updated = await prisma.bankRule.update({
        where: { id: validatedBody.id },
        data: { isActive: validatedBody.isActive },
        include: { account: { select: { id: true, code: true, name: true } } },
      });
      return NextResponse.json({ rule: updated });
    }

    // Full update - validate
    const merged = { ...existing, ...validatedBody };

    if (validatedBody.name !== undefined && !validatedBody.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!hasCondition(merged as Record<string, unknown>)) {
      return NextResponse.json(
        { error: 'At least one condition must be set' },
        { status: 400 }
      );
    }

    if (!hasAction(merged as Record<string, unknown>)) {
      return NextResponse.json(
        { error: 'At least one action must be set (account or category tag)' },
        { status: 400 }
      );
    }

    if (validatedBody.accountId) {
      const account = await prisma.chartOfAccount.findUnique({ where: { id: validatedBody.accountId } });
      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (validatedBody.name !== undefined) updateData.name = validatedBody.name.trim();
    if (validatedBody.priority !== undefined) updateData.priority = validatedBody.priority;
    if (validatedBody.isActive !== undefined) updateData.isActive = validatedBody.isActive;
    if (validatedBody.descriptionContains !== undefined) updateData.descriptionContains = validatedBody.descriptionContains?.trim() || null;
    if (validatedBody.descriptionStartsWith !== undefined) updateData.descriptionStartsWith = validatedBody.descriptionStartsWith?.trim() || null;
    if (validatedBody.descriptionExact !== undefined) updateData.descriptionExact = validatedBody.descriptionExact?.trim() || null;
    if (validatedBody.amountMin !== undefined) updateData.amountMin = validatedBody.amountMin !== null && validatedBody.amountMin !== '' ? validatedBody.amountMin : null;
    if (validatedBody.amountMax !== undefined) updateData.amountMax = validatedBody.amountMax !== null && validatedBody.amountMax !== '' ? validatedBody.amountMax : null;
    if (validatedBody.amountExact !== undefined) updateData.amountExact = validatedBody.amountExact !== null && validatedBody.amountExact !== '' ? validatedBody.amountExact : null;
    if (validatedBody.transactionType !== undefined) updateData.transactionType = validatedBody.transactionType || null;
    if (validatedBody.accountId !== undefined) updateData.accountId = validatedBody.accountId || null;
    if (validatedBody.categoryTag !== undefined) updateData.categoryTag = validatedBody.categoryTag?.trim() || null;
    if (validatedBody.taxCode !== undefined) updateData.taxCode = validatedBody.taxCode || null;
    if (validatedBody.description !== undefined) updateData.description = validatedBody.description?.trim() || null;

    const updated = await prisma.bankRule.update({
      where: { id: validatedBody.id },
      data: updateData,
      include: { account: { select: { id: true, code: true, name: true } } },
    });

    return NextResponse.json({
      rule: {
        ...updated,
        amountMin: updated.amountMin ? Number(updated.amountMin) : null,
        amountMax: updated.amountMax ? Number(updated.amountMax) : null,
        amountExact: updated.amountExact ? Number(updated.amountExact) : null,
      },
    });
  } catch (error) {
    logger.error('PUT /api/accounting/bank-rules error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/bank-rules
// Delete a rule by id
// ---------------------------------------------------------------------------
export const DELETE = withAdminGuard(async (request) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/bank-rules');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Rule id is required' }, { status: 400 });
    }

    const existing = await prisma.bankRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await prisma.bankRule.delete({ where: { id } });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    logger.error('DELETE /api/accounting/bank-rules error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
});
