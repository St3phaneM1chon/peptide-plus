export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/bank-accounts
 * List all bank accounts
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const accounts = await prisma.bankAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const mapped = accounts.map((a) => ({
      ...a,
      currentBalance: Number(a.currentBalance),
    }));

    return NextResponse.json({ accounts: mapped });
  } catch (error) {
    console.error('Get bank accounts error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des comptes bancaires' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/bank-accounts
 * Create a new bank account
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { name, accountNumber, institution, type, currency, chartAccountId } = body;

    if (!name || !institution) {
      return NextResponse.json(
        { error: 'Nom et institution sont requis' },
        { status: 400 }
      );
    }

    const account = await prisma.bankAccount.create({
      data: {
        name,
        accountNumber: accountNumber || null,
        institution,
        type: type || 'CHECKING',
        currency: currency || 'CAD',
        chartAccountId: chartAccountId || null,
      },
    });

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error) {
    console.error('Create bank account error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du compte bancaire' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounting/bank-accounts
 * Update a bank account
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, currentBalance, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Compte bancaire non trouvé' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (currentBalance !== undefined) updateData.currentBalance = currentBalance;
    if (isActive !== undefined) updateData.isActive = isActive;

    const account = await prisma.bankAccount.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, account });
  } catch (error) {
    console.error('Update bank account error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du compte bancaire' },
      { status: 500 }
    );
  }
}
