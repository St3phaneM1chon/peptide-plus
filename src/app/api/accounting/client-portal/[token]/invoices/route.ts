export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  validatePortalAccess,
  getClientInvoices,
} from '@/lib/accounting/client-portal.service';

// ---------------------------------------------------------------------------
// GET /api/accounting/client-portal/[token]/invoices
// Get all invoices for the client (public - token-based access)
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

    let invoices = await getClientInvoices(access.email);

    // Optional status filter
    if (status) {
      invoices = invoices.filter((inv) => inv.status === status);
    }

    return NextResponse.json({
      success: true,
      data: invoices,
      total: invoices.length,
    });
  } catch (error) {
    logger.error('Get client portal invoices error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des factures' },
      { status: 500 }
    );
  }
}
