export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { fullStripeSync, getStripeBalance } from '@/lib/accounting';

/**
 * POST /api/accounting/stripe-sync
 * Synchronize Stripe transactions with accounting
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate et endDate sont requis' },
        { status: 400 }
      );
    }

    // Perform sync
    const result = await fullStripeSync(
      new Date(startDate),
      new Date(endDate)
    );

    return NextResponse.json({
      success: result.success,
      summary: {
        entriesCreated: result.entriesCreated,
        transactionsImported: result.transactionsImported,
        errors: result.errors.length,
      },
      entries: result.entries,
      transactions: result.transactions,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Stripe sync error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la synchronisation Stripe' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/accounting/stripe-sync
 * Get Stripe balance
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

    const balance = await getStripeBalance();

    return NextResponse.json({
      balance,
      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stripe balance error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du solde Stripe' },
      { status: 500 }
    );
  }
}
