/**
 * Shared Canadian province tax rates
 * A8-P2-006 FIX: Derives rates from the canonical PROVINCIAL_TAX_RATES in
 * canadian-tax-config.ts instead of maintaining a separate hardcoded table.
 *
 * All calculations use Decimal.js for financial precision.
 */

import { applyRate, add } from '@/lib/decimal-calculator';
import { PROVINCIAL_TAX_RATES } from '@/lib/accounting/canadian-tax-config';

export interface ProvinceTaxRates {
  gst: number;
  pst?: number;
  hst?: number;
  qst?: number;
  rst?: number;
}

/**
 * A8-P2-006 FIX: Derive TAX_RATES from the canonical PROVINCIAL_TAX_RATES
 * (single source of truth in canadian-tax-config.ts). Rates are converted
 * from percentages to decimal fractions (e.g. 5 -> 0.05).
 */
const TAX_RATES: Record<string, ProvinceTaxRates> = (() => {
  const rates: Record<string, ProvinceTaxRates> = {};
  // Deduplicate by province code (take latest effective date)
  const seen = new Set<string>();
  for (let i = PROVINCIAL_TAX_RATES.length - 1; i >= 0; i--) {
    const p = PROVINCIAL_TAX_RATES[i];
    if (seen.has(p.provinceCode)) continue;
    seen.add(p.provinceCode);
    const entry: ProvinceTaxRates = { gst: p.gstRate / 100 };
    if (p.hstRate > 0) {
      entry.gst = 0;
      entry.hst = p.hstRate / 100;
    } else if (p.pstName === 'QST') {
      entry.qst = p.pstRate / 100;
    } else if (p.pstName === 'RST') {
      entry.rst = p.pstRate / 100;
    } else if (p.pstRate > 0) {
      entry.pst = p.pstRate / 100;
    }
    rates[p.provinceCode] = entry;
  }
  return rates;
})();

/**
 * Get tax rates for a Canadian province.
 * A8-P2-001 FIX: Returns 0% provincial tax for unknown provinces instead of
 * defaulting to QC (9.975% QST). Only federal GST (5%) applies as a safe default.
 */
export function getProvinceTaxRates(province: string): ProvinceTaxRates {
  const key = province.toUpperCase();
  const rates = TAX_RATES[key];
  if (!rates) {
    console.warn(`[tax-rates] Unknown province code "${province}" — using 0% provincial tax (GST-only fallback)`);
    return { gst: 0.05 }; // Federal GST only, no provincial tax
  }
  return rates;
}

/**
 * Calculate tax amount for a given subtotal, province and country.
 * Uses Decimal.js for safe financial arithmetic.
 *
 * - For Canadian orders (`country` is "CA" or omitted): applies the
 *   province-specific GST/HST/PST/QST/RST rates.
 * - For international orders (`country` is anything other than "CA"):
 *   returns 0 (taxes are handled by customs/import duties).
 * - If `province` is unknown, applies GST-only (5%) with 0% provincial tax.
 */
export function calculateTaxAmount(subtotal: number, province: string, country?: string): number {
  // International orders: 0% tax (customs/import duties apply separately)
  if (country && country.toUpperCase() !== 'CA') {
    return 0;
  }

  const rates = getProvinceTaxRates(province);
  if (rates.hst) {
    return applyRate(subtotal, rates.hst);
  }
  const gst = applyRate(subtotal, rates.gst);
  const provincial = applyRate(subtotal, rates.qst || rates.pst || rates.rst || 0);
  return add(gst, provincial);
}

/**
 * Tax breakdown with individual components for Order record storage.
 * Returns { taxTps (GST), taxTvq (QST), taxTvh (HST), taxPst (PST/RST), total }.
 */
export interface TaxBreakdown {
  taxTps: number;
  taxTvq: number;
  taxTvh: number;
  taxPst: number;
  total: number;
}

export function calculateTaxBreakdown(subtotal: number, province: string, country?: string): TaxBreakdown {
  if (country && country.toUpperCase() !== 'CA') {
    return { taxTps: 0, taxTvq: 0, taxTvh: 0, taxPst: 0, total: 0 };
  }

  const rates = getProvinceTaxRates(province);
  let taxTps = 0, taxTvq = 0, taxTvh = 0, taxPst = 0;

  if (rates.hst) {
    taxTvh = applyRate(subtotal, rates.hst);
  } else if (rates.qst) {
    taxTps = applyRate(subtotal, rates.gst);
    taxTvq = applyRate(subtotal, rates.qst);
  } else if (rates.pst || rates.rst) {
    taxTps = applyRate(subtotal, rates.gst);
    taxPst = applyRate(subtotal, rates.pst || rates.rst || 0);
  } else {
    taxTps = applyRate(subtotal, rates.gst);
  }

  return { taxTps, taxTvq, taxTvh, taxPst, total: add(taxTps, taxTvq, taxTvh, taxPst) };
}
