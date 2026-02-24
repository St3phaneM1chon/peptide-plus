export const dynamic = 'force-dynamic';

// FIX: F-080 - Migrated to withAdminGuard for consistent auth + CSRF + rate limiting

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const createPayoutSchema = z.object({
  ambassadorId: z.string().min(1, 'ambassadorId is required'),
  method: z.string().max(100).optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

/**
 * GET /api/ambassadors/payouts
 * List payout history for all ambassadors (or filtered by ambassadorId)
 */
export const GET = withAdminGuard(async (request: NextRequest, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const ambassadorId = searchParams.get('ambassadorId');

    const where: Record<string, unknown> = {};
    if (ambassadorId) where.ambassadorId = ambassadorId;

    const take = Math.min(Number(searchParams.get('limit') || 100), 200);
    const skip = Number(searchParams.get('offset') || 0);

    const payouts = await prisma.ambassadorPayout.findMany({
      where,
      include: {
        ambassador: {
          select: { name: true, referralCode: true },
        },
        commissions: {
          select: {
            id: true,
            orderNumber: true,
            orderTotal: true,
            commissionAmount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    const formatted = payouts.map((p) => ({
      id: p.id,
      ambassadorId: p.ambassadorId,
      ambassadorName: p.ambassador.name,
      referralCode: p.ambassador.referralCode,
      amount: Number(p.amount),
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      commissionsCount: p.commissions.length,
      commissions: p.commissions.map((c) => ({
        id: c.id,
        orderNumber: c.orderNumber,
        orderTotal: Number(c.orderTotal),
        commissionAmount: Number(c.commissionAmount),
      })),
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json({ payouts: formatted });
  } catch (error) {
    logger.error('Payouts GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
});

/**
 * POST /api/ambassadors/payouts
 * Process a payout for an ambassador - marks all pending commissions as paid
 * Body: { ambassadorId: string, method?: string, reference?: string, notes?: string }
 */
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createPayoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { ambassadorId, method, reference, notes } = parsed.data;

    // Verify ambassador exists
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: ambassadorId },
    });

    if (!ambassador) {
      return NextResponse.json({ error: 'Ambassadeur non trouvé' }, { status: 404 });
    }

    // Get all unpaid commissions for this ambassador
    const pendingCommissions = await prisma.ambassadorCommission.findMany({
      where: { ambassadorId, paidOut: false },
    });

    if (pendingCommissions.length === 0) {
      return NextResponse.json({ error: 'Aucune commission en attente' }, { status: 400 });
    }

    // Calculate total payout amount
    const totalAmount = pendingCommissions.reduce(
      (sum, c) => sum + Number(c.commissionAmount),
      0
    );

    // FIX FLAW-041: Enforce minimum payout amount to avoid micro-payouts and banking fees
    const MIN_PAYOUT_AMOUNT = 25.00; // $25 minimum
    if (totalAmount < MIN_PAYOUT_AMOUNT) {
      return NextResponse.json(
        { error: `Montant minimum de paiement: $${MIN_PAYOUT_AMOUNT}. Montant actuel: $${totalAmount.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Create payout and mark all commissions as paid in a transaction
    const payout = await prisma.$transaction(async (tx) => {
      // Create the payout record
      const newPayout = await tx.ambassadorPayout.create({
        data: {
          ambassadorId,
          amount: totalAmount,
          method: method || null,
          reference: reference || null,
          notes: notes || null,
          processedById: session.user?.id || null,
        },
      });

      // Mark all pending commissions as paid
      const now = new Date();
      await tx.ambassadorCommission.updateMany({
        where: {
          ambassadorId,
          paidOut: false,
        },
        data: {
          paidOut: true,
          paidOutAt: now,
          payoutId: newPayout.id,
        },
      });

      return newPayout;
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'PROCESS_AMBASSADOR_PAYOUT',
      targetType: 'AmbassadorPayout',
      targetId: payout.id,
      newValue: { ambassadorId, amount: Number(payout.amount), commissionsCount: pendingCommissions.length },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      payout: {
        id: payout.id,
        amount: Number(payout.amount),
        commissionsCount: pendingCommissions.length,
        createdAt: payout.createdAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Payout processing error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur lors du traitement du paiement' }, { status: 500 });
  }
});
