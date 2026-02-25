/**
 * Shared Canadian province tax rates
 * Single source of truth for GST/HST/PST/QST/RST rates used across payment routes.
 *
 * All calculations use Decimal.js for financial precision.
 */

import { applyRate, add } from '@/lib/decimal-calculator';

export interface ProvinceTaxRates {
  gst: number;
  pst?: number;
  hst?: number;
  qst?: number;
  rst?: number;
}

const TAX_RATES: Record<string, ProvinceTaxRates> = {
  'AB': { gst: 0.05 }, 'BC': { gst: 0.05, pst: 0.07 }, 'MB': { gst: 0.05, rst: 0.07 },
  'NB': { gst: 0, hst: 0.15 }, 'NL': { gst: 0, hst: 0.15 }, 'NS': { gst: 0, hst: 0.14 },
  'NT': { gst: 0.05 }, 'NU': { gst: 0.05 }, 'ON': { gst: 0, hst: 0.13 },
  'PE': { gst: 0, hst: 0.15 }, 'QC': { gst: 0.05, qst: 0.09975 },
  'SK': { gst: 0.05, pst: 0.06 }, 'YT': { gst: 0.05 },
};

const DEFAULT_PROVINCE = 'QC';

/**
 * Get tax rates for a Canadian province.
 * Falls back to QC rates if province is unknown.
 */
export function getProvinceTaxRates(province: string): ProvinceTaxRates {
  const key = province.toUpperCase();
  return TAX_RATES[key] || TAX_RATES[DEFAULT_PROVINCE];
}

/**
 * Calculate tax amount for a given subtotal, province and country.
 * Uses Decimal.js for safe financial arithmetic.
 *
 * - For Canadian orders (`country` is "CA" or omitted): applies the
 *   province-specific GST/HST/PST/QST/RST rates.
 * - For international orders (`country` is anything other than "CA"):
 *   returns 0 (taxes are handled by customs/import duties).
 * - If `province` is unknown, falls back to Quebec rates (most customers are local).
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
