export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// Period lock check: N/A - this operation is not date-specific (chart of accounts CRUD manages account structure, not accounting period transactions)

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const VALID_ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
const VALID_NORMAL_BALANCES = ['DEBIT', 'CREDIT'] as const;

const createAccountSchema = z.object({
  code: z.string().min(1).regex(/^\d{4}$/, 'Le code comptable doit être composé de 4 chiffres'),
  name: z.string().min(1),
  type: z.enum(VALID_ACCOUNT_TYPES),
  normalBalance: z.enum(VALID_NORMAL_BALANCES),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  isSystem: z.boolean().optional().default(false),
});

const updateAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  gifiCode: z.string().optional().nullable(),
  gifiName: z.string().optional().nullable(),
  ccaClass: z.union([z.number(), z.string(), z.null()]).optional(),
  ccaRate: z.union([z.number(), z.string(), z.null()]).optional(),
  deductiblePercent: z.union([z.number(), z.string(), z.null()]).optional(),
  isContra: z.boolean().optional(),
});

// FIX: F004 - In-memory cache is useless in serverless (each invocation gets a fresh
// module scope). Kept as a minor optimization for long-lived dev servers / non-serverless
// runtimes, but marked with a short TTL and a comment so no one relies on it for correctness.
// In production (Vercel / Azure serverless), this cache is effectively always cold.
const COA_CACHE_TTL_MS = 60 * 1000; // 1 minute (reduced from 5 min — serverless rarely benefits)
let coaCache: {
  data: unknown;
  timestamp: number;
  key: string; // Cache key based on query params
} | null = null;

/**
 * GET /api/accounting/chart-of-accounts
 * List all accounts with optional type filter
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // #82 Audit: Check cache first for this specific query
    const cacheKey = `${type || 'all'}-${includeInactive}`;
    if (coaCache && coaCache.key === cacheKey && Date.now() - coaCache.timestamp < COA_CACHE_TTL_MS) {
      return NextResponse.json({ accounts: coaCache.data, cached: true });
    }

    const where: Record<string, unknown> = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    if (type) {
      where.type = type;
    }

    const accounts = await prisma.chartOfAccount.findMany({
      where,
      include: { children: true },
      orderBy: { code: 'asc' },
    });

    // Update cache
    coaCache = { data: accounts, timestamp: Date.now(), key: cacheKey };

    return NextResponse.json({ accounts });
  } catch (error) {
    logger.error('Get chart of accounts error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du plan comptable' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/chart-of-accounts
 * Create a new account
 */
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/chart-of-accounts');
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
    const parsed = createAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { code, name, type, normalBalance, description, parentId, isSystem } = parsed.data;

    // Validate account number pattern matches the account type
    // Convention: 1xxx = ASSET, 2xxx = LIABILITY, 3xxx = EQUITY, 4xxx = REVENUE, 5xxx-6xxx = EXPENSE
    const accountNumberPrefix = code.charAt(0);
    const expectedPrefixes: Record<string, string[]> = {
      'ASSET': ['1'],
      'LIABILITY': ['2'],
      'EQUITY': ['3'],
      'REVENUE': ['4'],
      'EXPENSE': ['5', '6', '7', '8'],
    };
    const validPrefixes = expectedPrefixes[type];
    if (validPrefixes && !validPrefixes.includes(accountNumberPrefix)) {
      return NextResponse.json(
        { error: `Le code comptable "${code}" ne correspond pas au type "${type}". Les comptes ${type} doivent commencer par ${validPrefixes.join(' ou ')}` },
        { status: 400 }
      );
    }

    const existing = await prisma.chartOfAccount.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: `Le code comptable ${code} existe déjà` },
        { status: 409 }
      );
    }

    const account = await prisma.chartOfAccount.create({
      data: {
        id: randomUUID(),
        code,
        name,
        type,
        normalBalance,
        description: description || null,
        parentId: parentId || null,
        isSystem: isSystem || false,
      },
      include: { children: true },
    });

    coaCache = null; // #82 Audit: Invalidate cache on mutation

    // #74 Compliance: Audit logging for CREATE operation
    logger.info('AUDIT: Chart of accounts CREATE', {
      accountId: account.id,
      accountCode: code,
      accountName: name,
      accountType: type,
      createdBy: session.user.id || session.user.email,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error) {
    logger.error('Create account error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création du compte' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/accounting/chart-of-accounts
 * Update an existing account
 */
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/chart-of-accounts');
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
    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { id, name, description, isActive, gifiCode, gifiName, ccaClass, ccaRate, deductiblePercent, isContra } = parsed.data;

    const existing = await prisma.chartOfAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Compte non trouvé' }, { status: 404 });
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'Les comptes système ne peuvent pas être modifiés' },
        { status: 403 }
      );
    }

    // #42 Prevent deactivating accounts with active children
    if (isActive === false) {
      const activeChildrenCount = await prisma.chartOfAccount.count({
        where: { parentId: id, isActive: true },
      });
      if (activeChildrenCount > 0) {
        return NextResponse.json(
          { error: `Impossible de désactiver ce compte: ${activeChildrenCount} sous-compte(s) actif(s). Désactivez les sous-comptes d'abord.` },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    // GIFI / Fiscal fields
    if (gifiCode !== undefined) updateData.gifiCode = gifiCode || null;
    if (gifiName !== undefined) updateData.gifiName = gifiName || null;
    if (ccaClass !== undefined) updateData.ccaClass = ccaClass !== null && ccaClass !== '' ? Number(ccaClass) : null;
    if (ccaRate !== undefined) updateData.ccaRate = ccaRate !== null && ccaRate !== '' ? Number(ccaRate) : null;
    if (deductiblePercent !== undefined) updateData.deductiblePercent = deductiblePercent !== null && deductiblePercent !== '' ? Number(deductiblePercent) : null;
    if (isContra !== undefined) updateData.isContra = Boolean(isContra);

    const account = await prisma.chartOfAccount.update({
      where: { id },
      data: updateData,
      include: { children: true },
    });

    coaCache = null; // #82 Audit: Invalidate cache on mutation

    // #74 Compliance: Audit logging for UPDATE operation
    logger.info('AUDIT: Chart of accounts UPDATE', {
      accountId: id,
      accountCode: existing.code,
      updatedBy: session.user.id || session.user.email,
      updatedAt: new Date().toISOString(),
      changes: {
        ...(name !== undefined && name !== existing.name && { name: { from: existing.name, to: name } }),
        ...(description !== undefined && description !== existing.description && { description: { from: existing.description, to: description } }),
        ...(isActive !== undefined && isActive !== existing.isActive && { isActive: { from: existing.isActive, to: isActive } }),
        ...(gifiCode !== undefined && gifiCode !== existing.gifiCode && { gifiCode: { from: existing.gifiCode, to: gifiCode } }),
        ...(gifiName !== undefined && gifiName !== existing.gifiName && { gifiName: { from: existing.gifiName, to: gifiName } }),
        ...(ccaClass !== undefined && { ccaClass: { from: existing.ccaClass, to: ccaClass } }),
        ...(ccaRate !== undefined && { ccaRate: { from: existing.ccaRate, to: ccaRate } }),
        ...(deductiblePercent !== undefined && { deductiblePercent: { from: existing.deductiblePercent, to: deductiblePercent } }),
        ...(isContra !== undefined && isContra !== existing.isContra && { isContra: { from: existing.isContra, to: isContra } }),
      },
    });

    return NextResponse.json({ success: true, account });
  } catch (error) {
    logger.error('Update account error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du compte' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/accounting/chart-of-accounts
 * Delete an account (only if no journal lines reference it)
 */
export const DELETE = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/chart-of-accounts');
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
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.chartOfAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Compte non trouvé' }, { status: 404 });
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'Les comptes système ne peuvent pas être supprimés' },
        { status: 403 }
      );
    }

    // Check for journal lines referencing this account
    const lineCount = await prisma.journalLine.count({ where: { accountId: id } });
    if (lineCount > 0) {
      return NextResponse.json(
        { error: `Ce compte est utilisé dans ${lineCount} ligne(s) de journal et ne peut pas être supprimé` },
        { status: 400 }
      );
    }

    // FIX (F025): Use soft-delete (isActive: false) instead of hard-delete
    // to preserve referential integrity and audit trail history
    await prisma.chartOfAccount.update({
      where: { id },
      data: { isActive: false },
    });

    coaCache = null; // #82 Audit: Invalidate cache on mutation

    // #74 Compliance: Audit logging for DELETE operation
    logger.info('AUDIT: Chart of accounts DELETE', {
      accountId: id,
      accountCode: existing.code,
      accountName: existing.name,
      deletedBy: session.user.id || session.user.email,
      deletedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'Compte supprimé' });
  } catch (error) {
    logger.error('Delete account error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du compte' },
      { status: 500 }
    );
  }
});
