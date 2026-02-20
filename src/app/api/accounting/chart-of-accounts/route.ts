export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

// #82 Audit: In-memory cache for chart of accounts (rarely changes)
const COA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
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
    console.error('Get chart of accounts error:', error);
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
    const body = await request.json();
    const { code, name, type, normalBalance, description, parentId, isSystem } = body;

    if (!code || !name || !type || !normalBalance) {
      return NextResponse.json(
        { error: 'Code, nom, type et solde normal sont requis' },
        { status: 400 }
      );
    }

    // Validate account type
    const VALID_ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
    if (!VALID_ACCOUNT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Type de compte invalide: "${type}". Types valides: ${VALID_ACCOUNT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate normal balance
    const VALID_NORMAL_BALANCES = ['DEBIT', 'CREDIT'];
    if (!VALID_NORMAL_BALANCES.includes(normalBalance)) {
      return NextResponse.json(
        { error: `Solde normal invalide: "${normalBalance}". Valeurs valides: DEBIT, CREDIT` },
        { status: 400 }
      );
    }

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

    // Validate account code format (numeric, 4 digits)
    if (!/^\d{4}$/.test(code)) {
      return NextResponse.json(
        { error: 'Le code comptable doit être composé de 4 chiffres (ex: 1000, 2100, 4010)' },
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
    console.info('AUDIT: Chart of accounts CREATE', {
      accountId: account.id,
      accountCode: code,
      accountName: name,
      accountType: type,
      createdBy: session.user.id || session.user.email,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error) {
    console.error('Create account error:', error);
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
    const body = await request.json();
    const { id, name, description, isActive, gifiCode, gifiName, ccaClass, ccaRate, deductiblePercent, isContra } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

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
    console.info('AUDIT: Chart of accounts UPDATE', {
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
    console.error('Update account error:', error);
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

    await prisma.chartOfAccount.delete({ where: { id } });

    coaCache = null; // #82 Audit: Invalidate cache on mutation

    // #74 Compliance: Audit logging for DELETE operation
    console.info('AUDIT: Chart of accounts DELETE', {
      accountId: id,
      accountCode: existing.code,
      accountName: existing.name,
      deletedBy: session.user.id || session.user.email,
      deletedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'Compte supprimé' });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du compte' },
      { status: 500 }
    );
  }
});
