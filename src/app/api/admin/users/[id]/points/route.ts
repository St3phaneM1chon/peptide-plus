export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// G1-FLAW-10 FIX: Safety cap for admin point adjustments
const MAX_ADMIN_POINTS_ADJUSTMENT = 1_000_000;

// Zod schema for POST /api/admin/users/[id]/points (adjust loyalty points)
const adjustPointsSchema = z.object({
  amount: z.number().int()
    .refine((v) => v !== 0, 'Amount must be non-zero')
    .refine((v) => Math.abs(v) <= MAX_ADMIN_POINTS_ADJUSTMENT, `Amount cannot exceed ${MAX_ADMIN_POINTS_ADJUSTMENT.toLocaleString()} points`),
  reason: z.string().min(1, 'Reason is required'),
}).strict();

export const POST = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    // Validate with Zod
    const parsed = adjustPointsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { amount, reason } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const newPoints = user.loyaltyPoints + amount;
    if (newPoints < 0) {
      return NextResponse.json({ error: 'Points insuffisants' }, { status: 400 });
    }

    // G1-FLAW-10 FIX: Cap maximum balance to prevent unbounded point accumulation
    const MAX_POINTS_BALANCE = 10_000_000;
    if (newPoints > MAX_POINTS_BALANCE) {
      return NextResponse.json(
        { error: `Resulting balance (${newPoints.toLocaleString()}) would exceed maximum allowed (${MAX_POINTS_BALANCE.toLocaleString()})` },
        { status: 400 }
      );
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
          description: `[Admin adjustment] ${reason}`,
          balanceAfter: newPoints,
        },
      }),
    ]);

    // Audit log for points adjustment (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'ADJUST_USER_POINTS',
      targetType: 'User',
      targetId: id,
      previousValue: { loyaltyPoints: user.loyaltyPoints },
      newValue: { loyaltyPoints: newPoints, amount, reason },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      user: updatedUser,
      transaction,
      newBalance: newPoints,
    });
  } catch (error) {
    logger.error('Admin points adjustment error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
});
