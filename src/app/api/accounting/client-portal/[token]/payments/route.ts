export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  validatePortalAccess,
  getClientPayments,
} from '@/lib/accounting/client-portal.service';

// ---------------------------------------------------------------------------
// GET /api/accounting/client-portal/[token]/payments
// Get all payments for the client (public - token-based access)
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const access = await validatePortalAccess(token);
    if (!access) {
      return NextResponse.json(
        { error: 'Acces portail invalide, expire ou revoque' },
        { status: 404 }
      );
    }

    const payments = await getClientPayments(access.email);

    return NextResponse.json({
      success: true,
      data: payments,
      total: payments.length,
    });
  } catch (error) {
    logger.error('Get client portal payments error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des paiements' },
      { status: 500 }
    );
  }
}
