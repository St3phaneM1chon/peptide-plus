/**
 * Tax Compliance Service
 * Automatic TPS/TVQ calculations and form generation for Quebec/Canada
 */

import { db as prisma } from '@/lib/db';
import { TaxReport } from './types';

// Tax rates by province/territory
export const PROVINCIAL_TAX_RATES = {
  // Quebec - GST + QST
  QC: { GST: 0.05, QST: 0.09975, combined: 0.14975, name: 'TPS + TVQ' },
  
  // HST Provinces
  ON: { HST: 0.13, combined: 0.13, name: 'TVH 13%' },
  NB: { HST: 0.15, combined: 0.15, name: 'TVH 15%' },
  NL: { HST: 0.15, combined: 0.15, name: 'TVH 15%' },
  NS: { HST: 0.15, combined: 0.15, name: 'TVH 15%' },
  PE: { HST: 0.15, combined: 0.15, name: 'TVH 15%' },
  
  // GST + PST Provinces
  BC: { GST: 0.05, PST: 0.07, combined: 0.12, name: 'TPS + TVP' },
  SK: { GST: 0.05, PST: 0.06, combined: 0.11, name: 'TPS + TVP' },
  MB: { GST: 0.05, PST: 0.07, combined: 0.12, name: 'TPS + TVP' },
  
  // GST Only
  AB: { GST: 0.05, combined: 0.05, name: 'TPS 5%' },
  NT: { GST: 0.05, combined: 0.05, name: 'TPS 5%' },
  YT: { GST: 0.05, combined: 0.05, name: 'TPS 5%' },
  NU: { GST: 0.05, combined: 0.05, name: 'TPS 5%' },
};

/* For future tax processing
interface TaxableTransaction {
  id: string;
  date: Date;
  type: 'SALE' | 'PURCHASE';
  amount: number;
  gst: number;
  qst: number;
  hst: number;
  province: string;
  country: string;
  orderId?: string;
  invoiceNumber?: string;
}
*/

interface TaxSummary {
  period: string;
  
  // Sales (Output tax)
  totalSales: number;
  taxableSales: number;
  exemptSales: number;
  zeroRatedSales: number;
  
  // GST/TPS
  gstCollected: number;
  gstPaid: number;
  netGst: number;
  
  // QST/TVQ (Quebec only)
  qstCollected: number;
  qstPaid: number;
  netQst: number;
  
  // HST (for other provinces)
  hstCollected: number;
  hstPaid: number;
  netHst: number;
  
  // Total
  totalTaxCollected: number;
  totalTaxPaid: number;
  netTaxOwing: number;
  
  // Transaction counts
  salesCount: number;
  purchaseCount: number;
}

/**
 * Calculate taxes for a sale based on customer province
 */
export function calculateSalesTax(
  amount: number,
  customerProvince: string,
  customerCountry: string
): { gst: number; qst: number; hst: number; pst: number; total: number } {
  // No Canadian tax for non-Canadian customers
  if (customerCountry !== 'CA' && customerCountry !== 'Canada') {
    return { gst: 0, qst: 0, hst: 0, pst: 0, total: amount };
  }

  const rates = PROVINCIAL_TAX_RATES[customerProvince as keyof typeof PROVINCIAL_TAX_RATES];
  if (!rates) {
    // Default to GST only
    const gst = amount * 0.05;
    return { gst, qst: 0, hst: 0, pst: 0, total: amount + gst };
  }

  if ('HST' in rates) {
    const hst = amount * rates.HST;
    return { gst: 0, qst: 0, hst, pst: 0, total: amount + hst };
  }

  const gst = amount * (rates.GST || 0);
  const qst = 'QST' in rates ? amount * rates.QST : 0;
  const pst = 'PST' in rates ? amount * rates.PST : 0;

  return { gst, qst, hst: 0, pst, total: amount + gst + qst + pst };
}

/**
 * Generate tax summary for a period
 */
export async function generateTaxSummary(
  year: number,
  month?: number,
  quarter?: number
): Promise<TaxSummary> {
  let startDate: Date;
  let endDate: Date;
  let period: string;

  if (month) {
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0);
    period = `${year}-${String(month).padStart(2, '0')}`;
  } else if (quarter) {
    const startMonth = (quarter - 1) * 3;
    startDate = new Date(year, startMonth, 1);
    endDate = new Date(year, startMonth + 3, 0);
    period = `Q${quarter}-${year}`;
  } else {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31);
    period = `${year}`;
  }

  // Fetch sales from orders
  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      paymentStatus: 'PAID',
    },
  });

  // Fetch purchases from supplier invoices
  const purchases = await prisma.supplierInvoice.findMany({
    where: {
      invoiceDate: {
        gte: startDate,
        lte: endDate,
      },
      status: { in: ['PAID', 'PARTIAL'] },
    },
  });

  // Calculate totals
  let totalSales = 0;
  let taxableSales = 0;
  let gstCollected = 0;
  let qstCollected = 0;
  let hstCollected = 0;

  for (const order of orders) {
    totalSales += Number(order.subtotal);
    
    // Determine if taxable based on shipping location
    const isCanadian = order.shippingCountry === 'CA';
    if (isCanadian) {
      taxableSales += Number(order.subtotal);
      
      // Split tax based on province
      const province = order.shippingState;
      const rates = PROVINCIAL_TAX_RATES[province as keyof typeof PROVINCIAL_TAX_RATES];
      
      if (rates && 'HST' in rates) {
        hstCollected += Number(order.tax);
      } else if (province === 'QC') {
        // Approximate split for QC
        gstCollected += Number(order.tax) * 0.333;
        qstCollected += Number(order.tax) * 0.667;
      } else {
        gstCollected += Number(order.tax);
      }
    }
  }

  // Calculate ITCs from purchases
  let gstPaid = 0;
  let qstPaid = 0;
  const hstPaid = 0;

  for (const purchase of purchases) {
    gstPaid += Number(purchase.taxTps);
    qstPaid += Number(purchase.taxTvq);
    // HST would be included in taxTps for simplicity
  }

  return {
    period,
    totalSales,
    taxableSales,
    exemptSales: 0,
    zeroRatedSales: totalSales - taxableSales,
    gstCollected: Math.round(gstCollected * 100) / 100,
    gstPaid: Math.round(gstPaid * 100) / 100,
    netGst: Math.round((gstCollected - gstPaid) * 100) / 100,
    qstCollected: Math.round(qstCollected * 100) / 100,
    qstPaid: Math.round(qstPaid * 100) / 100,
    netQst: Math.round((qstCollected - qstPaid) * 100) / 100,
    hstCollected: Math.round(hstCollected * 100) / 100,
    hstPaid: Math.round(hstPaid * 100) / 100,
    netHst: Math.round((hstCollected - hstPaid) * 100) / 100,
    totalTaxCollected: Math.round((gstCollected + qstCollected + hstCollected) * 100) / 100,
    totalTaxPaid: Math.round((gstPaid + qstPaid + hstPaid) * 100) / 100,
    netTaxOwing: Math.round((gstCollected + qstCollected + hstCollected - gstPaid - qstPaid - hstPaid) * 100) / 100,
    salesCount: orders.length,
    purchaseCount: purchases.length,
  };
}

/**
 * Generate TPS/TVQ form data (FPZ-500 style)
 */
export function generateFPZ500Data(summary: TaxSummary): {
  section1: { // Taxable supplies
    line101: number; // Total taxable supplies
    line102: number; // GST/HST collected
    line103: number; // Adjustments
    line104: number; // Total GST/HST and adjustments
  };
  section2: { // ITCs
    line106: number; // ITCs claimed
    line107: number; // Adjustments
    line108: number; // Total ITCs
  };
  section3: { // Net tax
    line109: number; // Net GST/HST (104 - 108)
    line110: number; // Installments paid
    line111: number; // Rebates claimed
    line112: number; // Net GST/HST owing or refund
  };
  qst: { // QST section (Quebec only)
    line201: number; // Total taxable supplies for QST
    line202: number; // QST collected
    line205: number; // ITCs (RTI)
    line209: number; // Net QST owing or refund
  };
} {
  return {
    section1: {
      line101: summary.taxableSales,
      line102: summary.gstCollected + summary.hstCollected,
      line103: 0,
      line104: summary.gstCollected + summary.hstCollected,
    },
    section2: {
      line106: summary.gstPaid + summary.hstPaid,
      line107: 0,
      line108: summary.gstPaid + summary.hstPaid,
    },
    section3: {
      line109: summary.netGst + summary.netHst,
      line110: 0,
      line111: 0,
      line112: summary.netGst + summary.netHst,
    },
    qst: {
      line201: summary.taxableSales,
      line202: summary.qstCollected,
      line205: summary.qstPaid,
      line209: summary.netQst,
    },
  };
}

/**
 * Calculate filing due date
 */
export function calculateFilingDueDate(
  year: number,
  month: number,
  filingFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
): Date {
  switch (filingFrequency) {
    case 'MONTHLY':
      // Due by end of following month
      return new Date(year, month + 1, 0);
      
    case 'QUARTERLY':
      // Due one month after quarter end
      const quarterEnd = Math.ceil(month / 3) * 3;
      return new Date(year, quarterEnd + 1, 0);
      
    case 'ANNUAL':
      // Due by June 15 of following year (for most businesses)
      return new Date(year + 1, 5, 15);
  }
}

/**
 * Create tax report record
 */
export async function createTaxReport(
  summary: TaxSummary,
  year: number,
  month?: number,
  quarter?: number
): Promise<TaxReport> {
  const periodType = month ? 'MONTHLY' : quarter ? 'QUARTERLY' : 'ANNUAL';
  const dueDate = calculateFilingDueDate(
    year,
    month || (quarter ? quarter * 3 : 12),
    periodType
  );

  const report = await prisma.taxReport.create({
    data: {
      period: summary.period,
      periodType,
      year,
      month,
      quarter,
      region: 'Québec',
      regionCode: 'QC',
      tpsCollected: summary.gstCollected,
      tvqCollected: summary.qstCollected,
      tvhCollected: summary.hstCollected,
      otherTaxCollected: 0,
      tpsPaid: summary.gstPaid,
      tvqPaid: summary.qstPaid,
      tvhPaid: summary.hstPaid,
      otherTaxPaid: 0,
      netTps: summary.netGst,
      netTvq: summary.netQst,
      netTvh: summary.netHst,
      netTotal: summary.netTaxOwing,
      salesCount: summary.salesCount,
      totalSales: summary.totalSales,
      status: 'DRAFT',
      dueDate,
    },
  });

  return report as unknown as TaxReport;
}

/**
 * Get tax filing reminders
 */
export function getTaxFilingReminders(
  filingFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
): { period: string; dueDate: Date; daysRemaining: number }[] {
  const reminders: { period: string; dueDate: Date; daysRemaining: number }[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  switch (filingFrequency) {
    case 'MONTHLY':
      // Current month and next 2
      for (let i = 0; i < 3; i++) {
        const month = currentMonth - 1 + i;
        const year = currentYear + Math.floor((currentMonth - 1 + i) / 12);
        const adjustedMonth = ((month - 1) % 12) + 1;
        
        const dueDate = calculateFilingDueDate(year, adjustedMonth, 'MONTHLY');
        const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining > -30) {
          reminders.push({
            period: `${year}-${String(adjustedMonth).padStart(2, '0')}`,
            dueDate,
            daysRemaining,
          });
        }
      }
      break;

    case 'QUARTERLY':
      const currentQuarter = Math.ceil(currentMonth / 3);
      for (let q = currentQuarter; q <= currentQuarter + 2; q++) {
        const adjustedQ = ((q - 1) % 4) + 1;
        const year = currentYear + Math.floor((q - 1) / 4);
        
        const dueDate = calculateFilingDueDate(year, adjustedQ * 3, 'QUARTERLY');
        const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining > -30) {
          reminders.push({
            period: `Q${adjustedQ}-${year}`,
            dueDate,
            daysRemaining,
          });
        }
      }
      break;

    case 'ANNUAL':
      const dueDate = calculateFilingDueDate(currentYear - 1, 12, 'ANNUAL');
      const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      reminders.push({
        period: `${currentYear - 1}`,
        dueDate,
        daysRemaining,
      });
      break;
  }

  return reminders.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Validate tax numbers format
 */
export function validateTaxNumbers(tpsNumber: string, tvqNumber: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // GST/HST number format: 9 digits + RT + 4 digits
  // Example: 123456789RT0001
  const gstRegex = /^\d{9}RT\d{4}$/;
  if (tpsNumber && !gstRegex.test(tpsNumber)) {
    errors.push('Format TPS invalide. Format attendu: 123456789RT0001');
  }

  // QST number format: 10 digits + TQ + 4 digits
  // Example: 1234567890TQ0001
  const qstRegex = /^\d{10}TQ\d{4}$/;
  if (tvqNumber && !qstRegex.test(tvqNumber)) {
    errors.push('Format TVQ invalide. Format attendu: 1234567890TQ0001');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
