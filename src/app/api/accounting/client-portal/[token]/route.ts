export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  validatePortalAccess,
  getClientOutstandingBalance,
  getClientInvoices,
  getClientPayments,
  revokePortalAccess,
} from '@/lib/accounting/client-portal.service';

// ---------------------------------------------------------------------------
// GET /api/accounting/client-portal/[token]
// Validate token and return portal dashboard data (public - no auth required)
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token || token.length < 10) {
      return NextResponse.json(
        { error: 'Token invalide' },
        { status: 400 }
      );
    }

    const access = await validatePortalAccess(token);

    if (!access) {
      return NextResponse.json(
        { error: 'Acces portail invalide, expire ou revoque' },
        { status: 404 }
      );
    }

    // Get dashboard summary data
    const [outstanding, recentInvoices, recentPayments] = await Promise.all([
      getClientOutstandingBalance(access.email),
      getClientInvoices(access.email).then((inv) => inv.slice(0, 5)),
      getClientPayments(access.email).then((pay) => pay.slice(0, 5)),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        access: {
          clientName: access.clientName,
          companyName: access.companyName,
          email: access.email,
          expiresAt: access.expiresAt,
        },
        outstanding,
        recentInvoices,
        recentPayments,
      },
    });
  } catch (error) {
    logger.error('Validate portal access error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la validation de l\'acces portail' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/accounting/client-portal/[token]
// Revoke portal access (admin only)
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(
  async (_request: NextRequest, { params }) => {
    try {
      const token = params?.token;

      if (!token) {
        return NextResponse.json(
          { error: 'Token requis' },
          { status: 400 }
        );
      }

      const revoked = await revokePortalAccess(token);

      if (!revoked) {
        return NextResponse.json(
          { error: 'Acces portail non trouve' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Acces portail revoque avec succes',
      });
    } catch (error) {
      logger.error('Revoke portal access error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Erreur lors de la revocation de l\'acces portail' },
        { status: 500 }
      );
    }
  }
);
