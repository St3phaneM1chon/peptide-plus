/**
 * Centralized tax rate constants for Quebec (default business province).
 *
 * A8-P2-006 FIX: Derived from the canonical PROVINCIAL_TAX_RATES in
 * canadian-tax-config.ts (single source of truth) instead of hardcoded values.
 * Use these constants instead of hardcoding 0.05 / 0.09975 in route files.
 */

import { getTaxRateForProvince } from '@/lib/accounting/canadian-tax-config';

const _qcRate = getTaxRateForProvince('QC');

/** GST / TPS rate: 5% (derived from canonical source) */
export const GST_RATE = _qcRate ? _qcRate.gstRate / 100 : 0.05;

/** QST / TVQ rate: 9.975% (derived from canonical source) */
export const QST_RATE = _qcRate ? _qcRate.pstRate / 100 : 0.09975;

/** Combined GST + QST rate for Quebec */
export const QC_COMBINED_RATE = GST_RATE + QST_RATE;

/**
 * Calculate Quebec taxes (GST + QST) from a subtotal.
 * Returns rounded values suitable for financial documents.
 */
export function calculateQuebecTaxes(subtotal: number): {
  taxTps: number;
  taxTvq: number;
  total: number;
} {
  const taxTps = Math.round(subtotal * GST_RATE * 100) / 100;
  const taxTvq = Math.round(subtotal * QST_RATE * 100) / 100;
  const total = Math.round((subtotal + taxTps + taxTvq) * 100) / 100;
  return { taxTps, taxTvq, total };
}
