/**
 * Centralized tax rate constants for Quebec (default business province).
 *
 * Rates sourced from the Canadian Tax Engine (canadian-tax-engine.ts).
 * Use these constants instead of hardcoding 0.05 / 0.09975 in route files.
 */

/** GST / TPS rate: 5% */
export const GST_RATE = 0.05;

/** QST / TVQ rate: 9.975% */
export const QST_RATE = 0.09975;

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
