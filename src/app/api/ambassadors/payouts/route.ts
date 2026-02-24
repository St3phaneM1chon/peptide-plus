export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

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
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

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
}

/**
 * POST /api/ambassadors/payouts
 * Process a payout for an ambassador - marks all pending commissions as paid
 * Body: { ambassadorId: string, method?: string, reference?: string, notes?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/ambassadors/payouts');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

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
}
