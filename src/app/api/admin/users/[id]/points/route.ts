export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

export const POST = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const { amount, reason } = body;

    if (!amount || !reason) {
      return NextResponse.json({ error: 'Montant et raison requis' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const newPoints = user.loyaltyPoints + amount;
    if (newPoints < 0) {
      return NextResponse.json({ error: 'Points insuffisants' }, { status: 400 });
    }

    // Update user points, create transaction, and audit log in a single transaction
    const [updatedUser, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          loyaltyPoints: newPoints,
          ...(amount > 0 ? { lifetimePoints: { increment: amount } } : {}),
        },
      }),
      prisma.loyaltyTransaction.create({
        data: {
          userId: id,
          type: amount > 0 ? 'EARN_BONUS' : 'ADJUST',
          points: amount,
          description: `[Admin adjustment] ${reason}`,
          balanceAfter: newPoints,
        },
      }),
      prisma.auditLog.create({
        data: {
          id: `audit_points_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
          userId: session.user.id,
          action: 'ADMIN_POINTS_ADJUSTMENT',
          entityType: 'User',
          entityId: id,
          details: JSON.stringify({ amount, reason, newBalance: newPoints }),
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        },
      }),
    ]);

    return NextResponse.json({
      user: updatedUser,
      transaction,
      newBalance: newPoints,
    });
  } catch (error) {
    console.error('Admin points adjustment error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
});
