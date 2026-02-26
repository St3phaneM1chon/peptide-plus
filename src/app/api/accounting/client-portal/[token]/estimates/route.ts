export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  validatePortalAccess,
  getClientEstimates,
} from '@/lib/accounting/client-portal.service';

// ---------------------------------------------------------------------------
// GET /api/accounting/client-portal/[token]/estimates
// Get all estimates for the client (public - token-based access)
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let estimates = await getClientEstimates(access.email);

    // Optional status filter
    if (status) {
      estimates = estimates.filter((est) => est.status === status);
    }

    return NextResponse.json({
      success: true,
      data: estimates,
      total: estimates.length,
    });
  } catch (error) {
    logger.error('Get client portal estimates error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des devis' },
      { status: 500 }
    );
  }
}
