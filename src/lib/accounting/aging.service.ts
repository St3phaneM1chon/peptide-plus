/**
 * Aging Reports Service
 * Tracks accounts receivable and payable by age
 */

interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'RECEIVABLE' | 'PAYABLE';
  customerOrVendor: string;
  email?: string;
  invoiceDate: Date;
  dueDate: Date;
  amount: number;
  amountPaid: number;
  balance: number;
  status: string;
}

interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number;
  count: number;
  total: number;
  percentage: number;
  invoices: Invoice[];
}

interface AgingReport {
  type: 'RECEIVABLE' | 'PAYABLE';
  asOfDate: Date;
  totalOutstanding: number;
  totalOverdue: number;
  averageDaysOutstanding: number;
  buckets: AgingBucket[];
  byCustomer: CustomerAgingSummary[];
}

interface CustomerAgingSummary {
  name: string;
  email?: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
  oldestInvoiceDays: number;
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Generate aging report for accounts receivable or payable
 */
export function generateAgingReport(
  invoices: Invoice[],
  type: 'RECEIVABLE' | 'PAYABLE',
  asOfDate: Date = new Date()
): AgingReport {
  // Define aging buckets
  const buckets: AgingBucket[] = [
    { label: 'Courant', minDays: -9999, maxDays: 0, count: 0, total: 0, percentage: 0, invoices: [] },
    { label: '1-30 jours', minDays: 1, maxDays: 30, count: 0, total: 0, percentage: 0, invoices: [] },
    { label: '31-60 jours', minDays: 31, maxDays: 60, count: 0, total: 0, percentage: 0, invoices: [] },
    { label: '61-90 jours', minDays: 61, maxDays: 90, count: 0, total: 0, percentage: 0, invoices: [] },
    { label: '90+ jours', minDays: 91, maxDays: 9999, count: 0, total: 0, percentage: 0, invoices: [] },
  ];

  const customerMap = new Map<string, CustomerAgingSummary>();
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let totalDaysWeighted = 0;

  // Filter by type and unpaid
  const relevantInvoices = invoices.filter(inv => 
    inv.type === type && inv.balance > 0
  );

  for (const invoice of relevantInvoices) {
    const daysOverdue = daysBetween(new Date(invoice.dueDate), asOfDate);
    const daysOutstanding = daysBetween(new Date(invoice.invoiceDate), asOfDate);
    
    totalOutstanding += invoice.balance;
    totalDaysWeighted += invoice.balance * daysOutstanding;
    
    if (daysOverdue > 0) {
      totalOverdue += invoice.balance;
    }

    // Assign to bucket
    for (const bucket of buckets) {
      if (daysOverdue >= bucket.minDays && daysOverdue <= bucket.maxDays) {
        bucket.count++;
        bucket.total += invoice.balance;
        bucket.invoices.push(invoice);
        break;
      }
    }

    // Track by customer/vendor
    const key = invoice.customerOrVendor;
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        name: key,
        email: invoice.email,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        over90: 0,
        total: 0,
        oldestInvoiceDays: 0,
      });
    }

    const customer = customerMap.get(key)!;
    customer.total += invoice.balance;
    customer.oldestInvoiceDays = Math.max(customer.oldestInvoiceDays, daysOutstanding);

    if (daysOverdue <= 0) {
      customer.current += invoice.balance;
    } else if (daysOverdue <= 30) {
      customer.days1to30 += invoice.balance;
    } else if (daysOverdue <= 60) {
      customer.days31to60 += invoice.balance;
    } else if (daysOverdue <= 90) {
      customer.days61to90 += invoice.balance;
    } else {
      customer.over90 += invoice.balance;
    }
  }

  // Calculate percentages
  for (const bucket of buckets) {
    bucket.percentage = totalOutstanding > 0 
      ? (bucket.total / totalOutstanding) * 100 
      : 0;
  }

  // Sort customers by total (descending)
  const byCustomer = Array.from(customerMap.values())
    .sort((a, b) => b.total - a.total);

  return {
    type,
    asOfDate,
    totalOutstanding,
    totalOverdue,
    averageDaysOutstanding: totalOutstanding > 0 
      ? Math.round(totalDaysWeighted / totalOutstanding) 
      : 0,
    buckets,
    byCustomer,
  };
}

/**
 * Get collection priority list based on amount and age
 */
export function getCollectionPriority(
  report: AgingReport,
  options: {
    minAmount?: number;
    minDaysOverdue?: number;
    maxResults?: number;
  } = {}
): {
  highPriority: Invoice[];
  mediumPriority: Invoice[];
  lowPriority: Invoice[];
  totalToCollect: number;
} {
  const { minAmount = 0, minDaysOverdue = 0, maxResults = 50 } = options;
  const now = new Date();

  const allOverdue = report.buckets
    .flatMap(b => b.invoices)
    .filter(inv => {
      const daysOverdue = daysBetween(new Date(inv.dueDate), now);
      return daysOverdue >= minDaysOverdue && inv.balance >= minAmount;
    })
    .sort((a, b) => {
      // Sort by priority score: combination of amount and age
      const scoreA = a.balance * (1 + daysBetween(new Date(a.dueDate), now) / 30);
      const scoreB = b.balance * (1 + daysBetween(new Date(b.dueDate), now) / 30);
      return scoreB - scoreA;
    })
    .slice(0, maxResults);

  // Categorize by priority
  const highPriority: Invoice[] = [];
  const mediumPriority: Invoice[] = [];
  const lowPriority: Invoice[] = [];

  for (const inv of allOverdue) {
    const daysOverdue = daysBetween(new Date(inv.dueDate), now);
    
    // High priority: >60 days OR >$500
    if (daysOverdue > 60 || inv.balance > 500) {
      highPriority.push(inv);
    }
    // Medium priority: 30-60 days OR >$200
    else if (daysOverdue > 30 || inv.balance > 200) {
      mediumPriority.push(inv);
    }
    // Low priority: rest
    else {
      lowPriority.push(inv);
    }
  }

  return {
    highPriority,
    mediumPriority,
    lowPriority,
    totalToCollect: allOverdue.reduce((sum, inv) => sum + inv.balance, 0),
  };
}

/**
 * Generate aging summary statistics
 */
export function getAgingSummaryStats(report: AgingReport): {
  currentPercentage: number;
  overduePercentage: number;
  criticalPercentage: number; // >90 days
  healthScore: number; // 0-100, higher is better
  trend: 'IMPROVING' | 'STABLE' | 'WORSENING';
  recommendations: string[];
} {
  const currentBucket = report.buckets.find(b => b.label === 'Courant');
  const criticalBucket = report.buckets.find(b => b.label === '90+ jours');

  const currentPercentage = currentBucket?.percentage || 0;
  const overduePercentage = 100 - currentPercentage;
  const criticalPercentage = criticalBucket?.percentage || 0;

  // Health score calculation
  // 100 = all current, decreases with more overdue
  let healthScore = 100;
  healthScore -= (report.buckets[1]?.percentage || 0) * 0.1; // 1-30 days: -10% weight
  healthScore -= (report.buckets[2]?.percentage || 0) * 0.3; // 31-60 days: -30% weight
  healthScore -= (report.buckets[3]?.percentage || 0) * 0.5; // 61-90 days: -50% weight
  healthScore -= (report.buckets[4]?.percentage || 0) * 1.0; // 90+: -100% weight
  healthScore = Math.max(0, Math.min(100, healthScore));

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (criticalPercentage > 10) {
    recommendations.push('Prioriser le recouvrement des comptes de plus de 90 jours');
  }
  if (overduePercentage > 30) {
    recommendations.push('Revoir les conditions de paiement ou resserrer les politiques de crédit');
  }
  if (report.averageDaysOutstanding > 45) {
    recommendations.push('Envoyer des rappels de paiement plus tôt');
  }
  if (report.byCustomer.some(c => c.over90 > 1000)) {
    recommendations.push('Considérer une agence de recouvrement pour les gros montants en souffrance');
  }

  return {
    currentPercentage,
    overduePercentage,
    criticalPercentage,
    healthScore: Math.round(healthScore),
    trend: 'STABLE', // Would need historical data to determine
    recommendations,
  };
}

/**
 * Format aging report as HTML table
 */
export function formatAgingReportHTML(report: AgingReport): string {
  const title = report.type === 'RECEIVABLE' 
    ? 'Aging des comptes clients' 
    : 'Aging des comptes fournisseurs';

  return `
<div class="aging-report">
  <h2>${title}</h2>
  <p>Au ${report.asOfDate.toLocaleDateString('fr-CA')}</p>
  
  <div class="summary">
    <div class="stat">
      <span class="label">Total en souffrance</span>
      <span class="value">${report.totalOutstanding.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
    </div>
    <div class="stat">
      <span class="label">Total en retard</span>
      <span class="value">${report.totalOverdue.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
    </div>
    <div class="stat">
      <span class="label">Jours moyens</span>
      <span class="value">${report.averageDaysOutstanding} jours</span>
    </div>
  </div>

  <table class="aging-table">
    <thead>
      <tr>
        <th>Période</th>
        <th>Nb factures</th>
        <th>Montant</th>
        <th>%</th>
      </tr>
    </thead>
    <tbody>
      ${report.buckets.map(bucket => `
        <tr class="${bucket.minDays > 60 ? 'critical' : bucket.minDays > 0 ? 'warning' : ''}">
          <td>${bucket.label}</td>
          <td>${bucket.count}</td>
          <td>${bucket.total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</td>
          <td>${bucket.percentage.toFixed(1)}%</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td><strong>Total</strong></td>
        <td><strong>${report.buckets.reduce((sum, b) => sum + b.count, 0)}</strong></td>
        <td><strong>${report.totalOutstanding.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</strong></td>
        <td><strong>100%</strong></td>
      </tr>
    </tfoot>
  </table>

  <h3>Par ${report.type === 'RECEIVABLE' ? 'client' : 'fournisseur'}</h3>
  <table class="customer-table">
    <thead>
      <tr>
        <th>Nom</th>
        <th>Courant</th>
        <th>1-30j</th>
        <th>31-60j</th>
        <th>61-90j</th>
        <th>90j+</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${report.byCustomer.slice(0, 20).map(customer => `
        <tr>
          <td>${customer.name}</td>
          <td>${customer.current > 0 ? customer.current.toFixed(2) + ' $' : '-'}</td>
          <td>${customer.days1to30 > 0 ? customer.days1to30.toFixed(2) + ' $' : '-'}</td>
          <td>${customer.days31to60 > 0 ? customer.days31to60.toFixed(2) + ' $' : '-'}</td>
          <td>${customer.days61to90 > 0 ? customer.days61to90.toFixed(2) + ' $' : '-'}</td>
          <td class="${customer.over90 > 0 ? 'critical' : ''}">${customer.over90 > 0 ? customer.over90.toFixed(2) + ' $' : '-'}</td>
          <td><strong>${customer.total.toFixed(2)} $</strong></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>
  `;
}

/**
 * Export aging data to CSV
 */
export function exportAgingToCSV(report: AgingReport): string {
  const headers = ['Client/Fournisseur', 'Email', 'Courant', '1-30 jours', '31-60 jours', '61-90 jours', '90+ jours', 'Total', 'Plus vieille facture (jours)'];
  
  const rows = report.byCustomer.map(c => [
    `"${c.name}"`,
    c.email || '',
    c.current.toFixed(2),
    c.days1to30.toFixed(2),
    c.days31to60.toFixed(2),
    c.days61to90.toFixed(2),
    c.over90.toFixed(2),
    c.total.toFixed(2),
    c.oldestInvoiceDays.toString(),
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
