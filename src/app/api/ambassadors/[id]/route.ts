export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING', 'INACTIVE'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;

    const ambassador = await prisma.ambassador.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        commissions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!ambassador) {
      return NextResponse.json({ error: 'Ambassadeur non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ ambassador });
  } catch (error) {
    console.error('Get ambassador error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check ambassador exists
    const existing = await prisma.ambassador.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Ambassadeur non trouvé' }, { status: 404 });
    }

    // Build update data from allowed fields
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: `Statut invalide. Valeurs acceptées: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
      }
      updateData.status = body.status;
    }

    if (body.tier !== undefined) {
      updateData.tier = body.tier;
    }

    if (body.commissionRate !== undefined) {
      const rate = Number(body.commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return NextResponse.json({ error: 'Taux de commission invalide (0-100)' }, { status: 400 });
      }
      updateData.commissionRate = rate;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 });
    }

    const ambassador = await prisma.ambassador.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_AMBASSADOR',
        entityType: 'Ambassador',
        entityId: id,
        details: JSON.stringify({ changes: updateData }),
      },
    }).catch(() => {});

    return NextResponse.json({ ambassador });
  } catch (error) {
    console.error('Update ambassador error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.ambassador.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Ambassadeur non trouvé' }, { status: 404 });
    }

    // Soft delete: set status to INACTIVE
    await prisma.ambassador.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_AMBASSADOR',
        entityType: 'Ambassador',
        entityId: id,
        details: JSON.stringify({ name: existing.name }),
      },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete ambassador error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
