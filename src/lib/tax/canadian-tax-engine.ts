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
  NS: { gst: 0, pst: 0, hst: 15, qst: 0, name: 'Nouvelle-Écosse' },
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
