export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/security';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const createBankAccountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  accountNumber: z.string().optional(),
  institution: z.string().min(1, 'Institution is required'),
  type: z.enum(['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'OTHER']).optional().default('CHECKING'),
  currency: z.string().optional().default('CAD'),
  chartAccountId: z.string().nullable().optional(),
  apiCredentials: z.record(z.unknown()).nullable().optional(),
});

const updateBankAccountSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().optional(),
  currentBalance: z.number().optional(),
  isActive: z.boolean().optional(),
  accountNumber: z.string().nullable().optional(),
  apiCredentials: z.record(z.unknown()).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Helpers for encrypted fields
// ---------------------------------------------------------------------------

/** Try to decrypt a value; if it fails (legacy plaintext), return as-is */
async function safeDecrypt(value: string | null): Promise<string | null> {
  if (!value) return null;
  try {
    return await decrypt(value);
  } catch (error) {
    logger.error('[BankAccounts] Decryption failed, returning plaintext', { error: error instanceof Error ? error.message : String(error) });
    // Legacy plaintext value - return as-is
    return value;
  }
}

/** Mask an account number: "****1234" */
function maskAccountNumber(accountNumber: string | null): string | null {
  if (!accountNumber) return null;
  if (accountNumber.length <= 4) return '****';
  return `****${accountNumber.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// GET /api/accounting/bank-accounts - List all bank accounts (masked)
// ---------------------------------------------------------------------------
export const GET = withAdminGuard(async (_request, _ctx) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Decrypt and mask sensitive fields
    const mapped = await Promise.all(
      accounts.map(async (a) => {
        const decryptedNumber = await safeDecrypt(a.accountNumber);
        return {
          ...a,
          currentBalance: Number(a.currentBalance),
          accountNumber: maskAccountNumber(decryptedNumber),
          accountNumberLast4: decryptedNumber ? decryptedNumber.slice(-4) : null,
          // NEVER expose apiCredentials to the client
          apiCredentials: a.apiCredentials ? '***CONFIGURED***' : null,
        };
      })
    );

    return NextResponse.json({ accounts: mapped });
  } catch (error) {
    logger.error('Get bank accounts error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des comptes bancaires' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/bank-accounts - Create a new bank account
// ---------------------------------------------------------------------------
export const POST = withAdminGuard(async (request, _ctx) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/bank-accounts');
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
    const parsed = createBankAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { name, accountNumber, institution, type, currency, chartAccountId, apiCredentials } = parsed.data;

    // Encrypt sensitive fields before storage
    const encryptedAccountNumber = accountNumber ? await encrypt(accountNumber) : null;
    const encryptedApiCredentials = apiCredentials ? await encrypt(JSON.stringify(apiCredentials)) : null;

    const account = await prisma.bankAccount.create({
      data: {
        name,
        accountNumber: encryptedAccountNumber,
        institution,
        type: type || 'CHECKING',
        currency: currency || 'CAD',
        chartAccountId: chartAccountId || null,
        apiCredentials: encryptedApiCredentials,
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        ...account,
        currentBalance: Number(account.currentBalance),
        accountNumber: maskAccountNumber(accountNumber ?? null),
        apiCredentials: encryptedApiCredentials ? '***CONFIGURED***' : null,
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('Create bank account error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création du compte bancaire' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/bank-accounts - Update a bank account
// ---------------------------------------------------------------------------
export const PUT = withAdminGuard(async (request, _ctx) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/bank-accounts');
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
    const parsed = updateBankAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { id, name, currentBalance, isActive, accountNumber, apiCredentials } = parsed.data;

    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Compte bancaire non trouvé' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (currentBalance !== undefined) updateData.currentBalance = currentBalance;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Encrypt sensitive fields if provided
    if (accountNumber !== undefined) {
      updateData.accountNumber = accountNumber ? await encrypt(accountNumber) : null;
    }
    if (apiCredentials !== undefined) {
      updateData.apiCredentials = apiCredentials ? await encrypt(JSON.stringify(apiCredentials)) : null;
    }

    const account = await prisma.bankAccount.update({
      where: { id },
      data: updateData,
    });

    // Decrypt for masked response
    const decryptedNumber = await safeDecrypt(account.accountNumber);

    return NextResponse.json({
      success: true,
      account: {
        ...account,
        currentBalance: Number(account.currentBalance),
        accountNumber: maskAccountNumber(decryptedNumber),
        apiCredentials: account.apiCredentials ? '***CONFIGURED***' : null,
      },
    });
  } catch (error) {
    logger.error('Update bank account error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du compte bancaire' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/bank-accounts - Soft-delete a bank account
// ---------------------------------------------------------------------------
export const DELETE = withAdminGuard(async (request, _ctx) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/bank-accounts');
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

    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Compte bancaire non trouvé' }, { status: 404 });
    }

    // FIX (F027): Soft-delete by deactivating and setting updatedAt.
    // NOTE: BankAccount model uses isActive (not deletedAt) for soft-delete.
    // This is consistent with the schema definition. Other entities use deletedAt.
    // TODO: Consider adding deletedAt to BankAccount schema for full consistency.
    await prisma.bankAccount.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: 'Compte bancaire désactivé' });
  } catch (error) {
    logger.error('Delete bank account error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du compte bancaire' },
      { status: 500 }
    );
  }
});
