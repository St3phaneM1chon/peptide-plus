/**
 * Shared Canadian province tax rates
 * Single source of truth for GST/HST/PST/QST/RST rates used across payment routes.
 */

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
 * Calculate tax amount for a given subtotal and province.
 */
export function calculateTaxAmount(subtotal: number, province: string): number {
  const rates = getProvinceTaxRates(province);
  if (rates.hst) {
    return subtotal * rates.hst;
  }
  return subtotal * rates.gst + subtotal * (rates.qst || rates.pst || rates.rst || 0);
}
