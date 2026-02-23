export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { calculateSalesTax, getTaxRateForProvince } from '@/lib/accounting/canadian-tax-config';
import { logger } from '@/lib/logger';

/**
 * GET /api/accounting/tax-calculator
 *
 * Calculate destination-based Canadian sales tax using the place-of-supply
 * rules defined in canadian-tax-config.ts.
 *
 * Query parameters:
 *   - amount      (required) Pre-tax amount in CAD
 *   - toProvince  (required) Two-letter destination province code (e.g. ON, BC)
 *   - fromProvince (optional) Two-letter origin province code (default: QC)
 *
 * Returns:
 *   { fromProvince, toProvince, amount, gst, pst, hst, total, provinceName, taxName }
 */
export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const amountStr = searchParams.get('amount');
    const toProvince = searchParams.get('toProvince');
    const fromProvince = searchParams.get('fromProvince') || 'QC';

    // ---- Validation ----
    if (!amountStr || !toProvince) {
      return NextResponse.json(
        { error: 'Les paramètres amount et toProvince sont requis' },
        { status: 400 }
      );
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount < 0) {
      return NextResponse.json(
        { error: 'Le montant doit être un nombre positif' },
        { status: 400 }
      );
    }

    const toCode = toProvince.toUpperCase();
    const fromCode = fromProvince.toUpperCase();

    const toRate = getTaxRateForProvince(toCode);
    if (!toRate) {
      return NextResponse.json(
        { error: `Province de destination inconnue: ${toCode}` },
        { status: 400 }
      );
    }

    // ---- Calculation ----
    const result = calculateSalesTax(amount, fromCode, toCode);

    return NextResponse.json({
      fromProvince: fromCode,
      toProvince: toCode,
      amount,
      gst: result.gst,
      pst: result.pst,
      hst: result.hst,
      total: result.total,
      provinceName: toRate.provinceName,
      taxName: toRate.pstName,
      totalRate: toRate.totalRate,
    });
  } catch (error) {
    logger.error('Tax calculator error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors du calcul des taxes' },
      { status: 500 }
    );
  }
});
