export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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
    const body = await request.json();

    // Validate required field
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Validate at least one condition
    if (!hasCondition(body)) {
      return NextResponse.json(
        { error: 'At least one condition must be set (description, amount, or transaction type)' },
        { status: 400 }
      );
    }

    // Validate at least one action
    if (!hasAction(body)) {
      return NextResponse.json(
        { error: 'At least one action must be set (account or category tag)' },
        { status: 400 }
      );
    }

    // Validate accountId exists if provided
    if (body.accountId) {
      const account = await prisma.chartOfAccount.findUnique({ where: { id: body.accountId } });
      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 400 });
      }
    }

    // Validate transactionType
    if (body.transactionType && !['DEBIT', 'CREDIT'].includes(body.transactionType)) {
      return NextResponse.json(
        { error: 'transactionType must be DEBIT or CREDIT' },
        { status: 400 }
      );
    }

    // Validate taxCode
    const validTaxCodes = ['GST', 'QST', 'HST', 'EXEMPT', 'ZERO_RATED'];
    if (body.taxCode && !validTaxCodes.includes(body.taxCode)) {
      return NextResponse.json(
        { error: `taxCode must be one of: ${validTaxCodes.join(', ')}` },
        { status: 400 }
      );
    }

    const rule = await prisma.bankRule.create({
      data: {
        name: body.name.trim(),
        priority: typeof body.priority === 'number' ? body.priority : 0,
        isActive: body.isActive !== false,
        descriptionContains: body.descriptionContains?.trim() || null,
        descriptionStartsWith: body.descriptionStartsWith?.trim() || null,
        descriptionExact: body.descriptionExact?.trim() || null,
        amountMin: body.amountMin !== undefined && body.amountMin !== null && body.amountMin !== '' ? body.amountMin : null,
        amountMax: body.amountMax !== undefined && body.amountMax !== null && body.amountMax !== '' ? body.amountMax : null,
        amountExact: body.amountExact !== undefined && body.amountExact !== null && body.amountExact !== '' ? body.amountExact : null,
        transactionType: body.transactionType || null,
        accountId: body.accountId || null,
        categoryTag: body.categoryTag?.trim() || null,
        taxCode: body.taxCode || null,
        description: body.description?.trim() || null,
        createdBy: body.createdBy || null,
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
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Rule id is required' }, { status: 400 });
    }

    // Check rule exists
    const existing = await prisma.bankRule.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // If toggling isActive only, allow it without full validation
    if (Object.keys(body).length === 2 && 'id' in body && 'isActive' in body) {
      const updated = await prisma.bankRule.update({
        where: { id: body.id },
        data: { isActive: body.isActive },
        include: { account: { select: { id: true, code: true, name: true } } },
      });
      return NextResponse.json({ rule: updated });
    }

    // Full update - validate
    const merged = { ...existing, ...body };

    if (body.name !== undefined && !body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!hasCondition(merged)) {
      return NextResponse.json(
        { error: 'At least one condition must be set' },
        { status: 400 }
      );
    }

    if (!hasAction(merged)) {
      return NextResponse.json(
        { error: 'At least one action must be set (account or category tag)' },
        { status: 400 }
      );
    }

    if (body.accountId) {
      const account = await prisma.chartOfAccount.findUnique({ where: { id: body.accountId } });
      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 400 });
      }
    }

    if (body.transactionType && !['DEBIT', 'CREDIT'].includes(body.transactionType)) {
      return NextResponse.json(
        { error: 'transactionType must be DEBIT or CREDIT' },
        { status: 400 }
      );
    }

    const validTaxCodes = ['GST', 'QST', 'HST', 'EXEMPT', 'ZERO_RATED'];
    if (body.taxCode && !validTaxCodes.includes(body.taxCode)) {
      return NextResponse.json(
        { error: `taxCode must be one of: ${validTaxCodes.join(', ')}` },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.descriptionContains !== undefined) updateData.descriptionContains = body.descriptionContains?.trim() || null;
    if (body.descriptionStartsWith !== undefined) updateData.descriptionStartsWith = body.descriptionStartsWith?.trim() || null;
    if (body.descriptionExact !== undefined) updateData.descriptionExact = body.descriptionExact?.trim() || null;
    if (body.amountMin !== undefined) updateData.amountMin = body.amountMin !== null && body.amountMin !== '' ? body.amountMin : null;
    if (body.amountMax !== undefined) updateData.amountMax = body.amountMax !== null && body.amountMax !== '' ? body.amountMax : null;
    if (body.amountExact !== undefined) updateData.amountExact = body.amountExact !== null && body.amountExact !== '' ? body.amountExact : null;
    if (body.transactionType !== undefined) updateData.transactionType = body.transactionType || null;
    if (body.accountId !== undefined) updateData.accountId = body.accountId || null;
    if (body.categoryTag !== undefined) updateData.categoryTag = body.categoryTag?.trim() || null;
    if (body.taxCode !== undefined) updateData.taxCode = body.taxCode || null;
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;

    const updated = await prisma.bankRule.update({
      where: { id: body.id },
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
