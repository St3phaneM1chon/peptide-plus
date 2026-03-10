/**
 * Canadian Tax Engine
 * GST 5% + QST 9.975% (QC), HST by province, auto-apply by customer address
 */

export interface TaxResult {
  subtotal: number;
  gst: number;
  pst: number;
  hst: number;
  qst: number;
  totalTax: number;
  total: number;
  province: string;
  breakdown: TaxBreakdown[];
}

export interface TaxBreakdown {
  name: string;
  rate: number;
  amount: number;
  registrationNumber?: string;
}

// Canadian provincial tax rates (2026)
const PROVINCE_TAX: Record<string, { gst: number; pst: number; hst: number; qst: number; name: string }> = {
  AB: { gst: 5, pst: 0, hst: 0, qst: 0, name: 'Alberta' },
  BC: { gst: 5, pst: 7, hst: 0, qst: 0, name: 'Colombie-Britannique' },
  MB: { gst: 5, pst: 7, hst: 0, qst: 0, name: 'Manitoba' },
  NB: { gst: 0, pst: 0, hst: 15, qst: 0, name: 'Nouveau-Brunswick' },
  NL: { gst: 0, pst: 0, hst: 15, qst: 0, name: 'Terre-Neuve' },
  NS: { gst: 0, pst: 0, hst: 14, qst: 0, name: 'Nouvelle-Écosse' },
  NT: { gst: 5, pst: 0, hst: 0, qst: 0, name: 'Territoires du N.-O.' },
  NU: { gst: 5, pst: 0, hst: 0, qst: 0, name: 'Nunavut' },
  ON: { gst: 0, pst: 0, hst: 13, qst: 0, name: 'Ontario' },
  PE: { gst: 0, pst: 0, hst: 15, qst: 0, name: 'Île-du-Prince-Édouard' },
  QC: { gst: 5, pst: 0, hst: 0, qst: 9.975, name: 'Québec' },
  SK: { gst: 5, pst: 6, hst: 0, qst: 0, name: 'Saskatchewan' },
  YT: { gst: 5, pst: 0, hst: 0, qst: 0, name: 'Yukon' },
};

export function calculateTax(
  subtotal: number,
  province: string,
  tpsNumber?: string,
  tvqNumber?: string
): TaxResult {
  const prov = province.toUpperCase();
  const rates = PROVINCE_TAX[prov] || PROVINCE_TAX.QC; // Default to QC

  const breakdown: TaxBreakdown[] = [];
  let gst = 0, pst = 0, hst = 0, qst = 0;

  if (rates.hst > 0) {
    hst = round(subtotal * rates.hst / 100);
    breakdown.push({ name: 'TVH / HST', rate: rates.hst, amount: hst, registrationNumber: tpsNumber });
  } else {
    if (rates.gst > 0) {
      gst = round(subtotal * rates.gst / 100);
      breakdown.push({ name: 'TPS / GST', rate: rates.gst, amount: gst, registrationNumber: tpsNumber });
    }
    if (rates.qst > 0) {
      qst = round(subtotal * rates.qst / 100);
      breakdown.push({ name: 'TVQ / QST', rate: rates.qst, amount: qst, registrationNumber: tvqNumber });
    }
    if (rates.pst > 0) {
      pst = round(subtotal * rates.pst / 100);
      breakdown.push({ name: 'TVP / PST', rate: rates.pst, amount: pst });
    }
  }

  const totalTax = round(gst + pst + hst + qst);
  const total = round(subtotal + totalTax);

  return { subtotal, gst, pst, hst, qst, totalTax, total, province: prov, breakdown };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getProvinces(): Array<{ code: string; name: string; taxSummary: string }> {
  return Object.entries(PROVINCE_TAX).map(([code, info]) => {
    let summary = '';
    if (info.hst > 0) summary = `TVH ${info.hst}%`;
    else {
      const parts: string[] = [];
      if (info.gst > 0) parts.push(`TPS ${info.gst}%`);
      if (info.qst > 0) parts.push(`TVQ ${info.qst}%`);
      if (info.pst > 0) parts.push(`TVP ${info.pst}%`);
      summary = parts.join(' + ');
    }
    return { code, name: info.name, taxSummary: summary };
  });
}

export function getTotalTaxRate(province: string): number {
  const prov = province.toUpperCase();
  const rates = PROVINCE_TAX[prov] || PROVINCE_TAX.QC;
  if (rates.hst > 0) return rates.hst;
  return rates.gst + rates.pst + rates.qst;
}

// I-TAX-2: International VAT support (stub — extend as needed)
export function calculateInternationalTax(
  subtotal: number,
  country: string,
  _region?: string
): TaxResult {
  // For non-Canadian orders, no tax is charged (export)
  // Exception: US orders may require state tax (future implementation)
  if (country === 'CA') {
    return calculateTax(subtotal, _region || 'QC');
  }
  return {
    subtotal,
    gst: 0, pst: 0, hst: 0, qst: 0,
    totalTax: 0,
    total: subtotal,
    province: country,
    breakdown: [],
  };
}

// I-TAX-10: Tax-inclusive pricing helper
export function calculateTaxInclusive(
  priceInclTax: number,
  province: string
): { priceExclTax: number; tax: number } {
  const rate = getTotalTaxRate(province) / 100;
  const priceExclTax = round(priceInclTax / (1 + rate));
  const tax = round(priceInclTax - priceExclTax);
  return { priceExclTax, tax };
}

// ---------------------------------------------------------------------------
// I-TAX: International VAT support
// ---------------------------------------------------------------------------

export interface VATResult {
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  countryCode: string;
  countryName: string;
  breakdown: TaxBreakdown[];
}

/**
 * Standard VAT rates by country code (ISO 3166-1 alpha-2).
 * These are the standard rates as of 2026 — reduced rates for specific
 * goods categories are not included (would need product-level classification).
 */
const INTERNATIONAL_VAT_RATES: Record<string, { rate: number; name: string }> = {
  // Europe
  GB: { rate: 20, name: 'United Kingdom' },
  DE: { rate: 19, name: 'Germany' },
  FR: { rate: 20, name: 'France' },
  IT: { rate: 22, name: 'Italy' },
  ES: { rate: 21, name: 'Spain' },
  NL: { rate: 21, name: 'Netherlands' },
  BE: { rate: 21, name: 'Belgium' },
  AT: { rate: 20, name: 'Austria' },
  SE: { rate: 25, name: 'Sweden' },
  DK: { rate: 25, name: 'Denmark' },
  FI: { rate: 25.5, name: 'Finland' },
  PT: { rate: 23, name: 'Portugal' },
  IE: { rate: 23, name: 'Ireland' },
  PL: { rate: 23, name: 'Poland' },
  CZ: { rate: 21, name: 'Czech Republic' },
  GR: { rate: 24, name: 'Greece' },
  HU: { rate: 27, name: 'Hungary' },
  RO: { rate: 19, name: 'Romania' },
  CH: { rate: 8.1, name: 'Switzerland' },
  NO: { rate: 25, name: 'Norway' },
  // Asia-Pacific
  AU: { rate: 10, name: 'Australia' },
  NZ: { rate: 15, name: 'New Zealand' },
  JP: { rate: 10, name: 'Japan' },
  KR: { rate: 10, name: 'South Korea' },
  SG: { rate: 9, name: 'Singapore' },
  IN: { rate: 18, name: 'India' },
  // Americas (non-CA/US)
  MX: { rate: 16, name: 'Mexico' },
  BR: { rate: 17, name: 'Brazil' },
  AR: { rate: 21, name: 'Argentina' },
  CL: { rate: 19, name: 'Chile' },
  CO: { rate: 19, name: 'Colombia' },
  // Middle East / Africa
  ZA: { rate: 15, name: 'South Africa' },
  AE: { rate: 5, name: 'United Arab Emirates' },
  SA: { rate: 15, name: 'Saudi Arabia' },
  IL: { rate: 17, name: 'Israel' },
};

/**
 * I-TAX: Calculate VAT for international orders.
 * This extends calculateInternationalTax() with actual VAT rates for major countries.
 *
 * Note: BioCycle Peptides ships from Canada. For most B2C international sales,
 * the customer's country VAT applies. For B2B with valid VAT numbers, VAT is
 * typically reverse-charged (rate = 0). VAT number validation is not implemented here.
 */
export function calculateVAT(
  subtotal: number,
  countryCode: string
): VATResult {
  const code = countryCode.toUpperCase();

  // Canada and US are handled by their own tax systems
  if (code === 'CA' || code === 'US') {
    return {
      subtotal,
      vatRate: 0,
      vatAmount: 0,
      total: subtotal,
      countryCode: code,
      countryName: code === 'CA' ? 'Canada' : 'United States',
      breakdown: [],
    };
  }

  const vatInfo = INTERNATIONAL_VAT_RATES[code];

  if (!vatInfo) {
    // Country not in our VAT table — no VAT charged (export zero-rated)
    return {
      subtotal,
      vatRate: 0,
      vatAmount: 0,
      total: subtotal,
      countryCode: code,
      countryName: code,
      breakdown: [],
    };
  }

  const vatAmount = round(subtotal * vatInfo.rate / 100);

  return {
    subtotal,
    vatRate: vatInfo.rate,
    vatAmount,
    total: round(subtotal + vatAmount),
    countryCode: code,
    countryName: vatInfo.name,
    breakdown: [
      {
        name: `VAT (${vatInfo.name})`,
        rate: vatInfo.rate,
        amount: vatAmount,
      },
    ],
  };
}

/**
 * Get list of supported VAT countries with their rates.
 */
export function getVATCountries(): Array<{ code: string; name: string; rate: number }> {
  return Object.entries(INTERNATIONAL_VAT_RATES).map(([code, info]) => ({
    code,
    name: info.name,
    rate: info.rate,
  }));
}

// ---------------------------------------------------------------------------
// I-TAX: Digital goods tax rules
// ---------------------------------------------------------------------------

/**
 * Provinces where PST does NOT apply to digital goods.
 * In these provinces, digital goods/services are exempt from provincial sales tax
 * but still subject to GST (or HST where applicable).
 *
 * As of 2026:
 * - BC: PST applies to digital goods (since 2022)
 * - SK: PST applies to digital goods (since 2020)
 * - MB: PST applies to digital goods
 * - QC: QST applies to digital goods
 * - AB, NT, NU, YT: No PST (only GST)
 * - HST provinces (ON, NB, NL, NS, PE): HST applies fully
 *
 * No province currently exempts digital goods from PST if PST applies to them.
 * This function is prepared for future legislative changes.
 */
const DIGITAL_GOODS_PST_EXEMPT_PROVINCES = new Set<string>([
  // Currently no province exempts digital goods from PST.
  // When a province adds an exemption, add it here (e.g., 'SK').
]);

export interface DigitalGoodsTaxResult {
  subtotal: number;
  gst: number;
  pst: number;
  hst: number;
  qst: number;
  totalTax: number;
  total: number;
  province: string;
  isPstExempt: boolean;
  breakdown: TaxBreakdown[];
}

/**
 * I-TAX: Calculate tax for digital goods.
 * Digital goods may be PST-exempt in some provinces. This function applies
 * the standard provincial tax rates but zeroes out PST for exempt provinces.
 *
 * Use this instead of calculateTax() when selling digital products
 * (e-books, digital subscriptions, online courses, etc.)
 */
export function calculateDigitalGoodsTax(
  subtotal: number,
  province: string
): DigitalGoodsTaxResult {
  const prov = province.toUpperCase();
  const rates = PROVINCE_TAX[prov] || PROVINCE_TAX.QC;
  const isPstExempt = DIGITAL_GOODS_PST_EXEMPT_PROVINCES.has(prov);

  const breakdown: TaxBreakdown[] = [];
  let gst = 0, pst = 0, hst = 0, qst = 0;

  if (rates.hst > 0) {
    // HST provinces: HST always applies to digital goods (no exemption)
    hst = round(subtotal * rates.hst / 100);
    breakdown.push({ name: 'TVH / HST', rate: rates.hst, amount: hst });
  } else {
    // GST always applies
    if (rates.gst > 0) {
      gst = round(subtotal * rates.gst / 100);
      breakdown.push({ name: 'TPS / GST', rate: rates.gst, amount: gst });
    }

    // QST applies to digital goods in Quebec
    if (rates.qst > 0) {
      qst = round(subtotal * rates.qst / 100);
      breakdown.push({ name: 'TVQ / QST', rate: rates.qst, amount: qst });
    }

    // PST: may be exempt for digital goods in some provinces
    if (rates.pst > 0 && !isPstExempt) {
      pst = round(subtotal * rates.pst / 100);
      breakdown.push({ name: 'TVP / PST', rate: rates.pst, amount: pst });
    } else if (rates.pst > 0 && isPstExempt) {
      breakdown.push({ name: 'TVP / PST (digital exempt)', rate: 0, amount: 0 });
    }
  }

  const totalTax = round(gst + pst + hst + qst);
  const total = round(subtotal + totalTax);

  return {
    subtotal,
    gst,
    pst,
    hst,
    qst,
    totalTax,
    total,
    province: prov,
    isPstExempt,
    breakdown,
  };
}
