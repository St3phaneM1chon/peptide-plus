export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  validatePortalAccess,
  getClientStatement,
} from '@/lib/accounting/client-portal.service';

// ---------------------------------------------------------------------------
// GET /api/accounting/client-portal/[token]/statement
// Get account statement for the client (public - token-based access)
//
// Query Parameters:
//   - dateFrom (required): ISO date YYYY-MM-DD
//   - dateTo (required): ISO date YYYY-MM-DD
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
    const dateFromStr = searchParams.get('dateFrom');
    const dateToStr = searchParams.get('dateTo');

    if (!dateFromStr || !dateToStr) {
      return NextResponse.json(
        { error: 'Parametres dateFrom et dateTo requis (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const dateFrom = new Date(dateFromStr);
    const dateTo = new Date(dateToStr);

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide. Utilisez le format ISO (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    if (dateFrom > dateTo) {
      return NextResponse.json(
        { error: 'La date de debut doit etre anterieure a la date de fin' },
        { status: 400 }
      );
    }

    // Max range: 2 years
    const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
    if (dateTo.getTime() - dateFrom.getTime() > twoYearsMs) {
      return NextResponse.json(
        { error: 'La plage de dates ne peut pas depasser 2 ans' },
        { status: 400 }
      );
    }

    const statement = await getClientStatement(
      access.email,
      dateFrom,
      dateTo,
      access.companyName
    );

    return NextResponse.json({
      success: true,
      data: statement,
    });
  } catch (error) {
    logger.error('Get client portal statement error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la generation du releve de compte' },
      { status: 500 }
    );
  }
}
