import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/chart-of-accounts
 * List all accounts with optional type filter
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};
    if (type) {
      where.type = type;
    }

    const accounts = await prisma.chartOfAccount.findMany({
      where,
      include: { children: true },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Get chart of accounts error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du plan comptable' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/chart-of-accounts
 * Create a new account
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
    const { code, name, type, normalBalance, description, parentId, isSystem } = body;

    if (!code || !name || !type || !normalBalance) {
      return NextResponse.json(
        { error: 'Code, nom, type et solde normal sont requis' },
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

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error) {
    console.error('Create account error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du compte' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounting/chart-of-accounts
 * Update an existing account
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
    const { id, name, description, isActive } = body;

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

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const account = await prisma.chartOfAccount.update({
      where: { id },
      data: updateData,
      include: { children: true },
    });

    return NextResponse.json({ success: true, account });
  } catch (error) {
    console.error('Update account error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du compte' },
      { status: 500 }
    );
  }
}
