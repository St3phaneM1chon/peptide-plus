export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

export async function POST(
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

    // Update user points and create transaction in a single transaction
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
          description: `[Admin: ${session.user.name || session.user.email}] ${reason}`,
          balanceAfter: newPoints,
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
}
