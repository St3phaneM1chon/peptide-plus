/**
 * PDF Reports Service
 * Generates PDF reports for financial statements and tax reports
 */

import { TaxReport, JournalEntry } from './types';

interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  email: string;
  tpsNumber: string;
  tvqNumber: string;
  neq: string;
}

const DEFAULT_COMPANY: CompanyInfo = {
  name: process.env.BUSINESS_NAME || 'BioCycle Peptides Inc.',
  address: process.env.BUSINESS_STREET || '',
  city: process.env.BUSINESS_CITY || 'Montréal',
  province: process.env.BUSINESS_PROVINCE || 'QC',
  postalCode: process.env.BUSINESS_POSTAL_CODE || '',
  phone: process.env.BUSINESS_PHONE || '',
  email: process.env.NEXT_PUBLIC_INFO_EMAIL || 'info@biocyclepeptides.com',
  tpsNumber: process.env.TPS_NUMBER || '',
  tvqNumber: process.env.TVQ_NUMBER || '',
  neq: process.env.NEQ_NUMBER || '',
};

/**
 * Generate HTML for TPS/TVQ tax report (FPZ-500 style)
 */
export function generateTaxReportHTML(report: TaxReport, company: CompanyInfo = DEFAULT_COMPANY): string {
  const netTps = report.tpsCollected - report.tpsPaid;
  const netTvq = report.tvqCollected - report.tvqPaid;
  const totalRemittance = netTps + netTvq;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Rapport TPS/TVQ - ${report.period}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; color: #333; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a5f7a; padding-bottom: 20px; }
    .header h1 { font-size: 18px; color: #1a5f7a; margin-bottom: 5px; }
    .header h2 { font-size: 14px; color: #666; font-weight: normal; }
    .company-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .company-box, .period-box { background: #f8f9fa; padding: 15px; border-radius: 4px; width: 48%; }
    .company-box h3, .period-box h3 { font-size: 12px; color: #1a5f7a; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    .info-row { display: flex; margin-bottom: 5px; }
    .info-label { width: 120px; color: #666; }
    .info-value { font-weight: bold; }
    .section { margin-bottom: 25px; }
    .section-title { background: #1a5f7a; color: white; padding: 8px 15px; font-size: 12px; font-weight: bold; margin-bottom: 1px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 15px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f0f0f0; font-weight: bold; color: #333; }
    td.amount { text-align: right; font-family: 'Courier New', monospace; }
    tr.total { background: #e8f4f8; font-weight: bold; }
    tr.total td { border-top: 2px solid #1a5f7a; }
    .summary-box { background: #1a5f7a; color: white; padding: 20px; border-radius: 4px; margin-top: 20px; }
    .summary-box h3 { font-size: 14px; margin-bottom: 15px; }
    .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .summary-total { font-size: 18px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 10px; margin-top: 10px; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 10px; border-top: 1px solid #ddd; padding-top: 20px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 3px; font-size: 10px; font-weight: bold; }
    .status-generated { background: #e3f2fd; color: #1565c0; }
    .status-filed { background: #fff3e0; color: #ef6c00; }
    .status-paid { background: #e8f5e9; color: #2e7d32; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RAPPORT DE TAXES TPS/TVQ</h1>
    <h2>Période: ${report.period}</h2>
  </div>

  <div class="company-info">
    <div class="company-box">
      <h3>INFORMATIONS DE L'ENTREPRISE</h3>
      <div class="info-row"><span class="info-label">Raison sociale:</span><span class="info-value">${company.name}</span></div>
      <div class="info-row"><span class="info-label">Adresse:</span><span class="info-value">${company.address}</span></div>
      <div class="info-row"><span class="info-label">Ville:</span><span class="info-value">${company.city}, ${company.province} ${company.postalCode}</span></div>
      <div class="info-row"><span class="info-label">N° TPS:</span><span class="info-value">${company.tpsNumber}</span></div>
      <div class="info-row"><span class="info-label">N° TVQ:</span><span class="info-value">${company.tvqNumber}</span></div>
    </div>
    <div class="period-box">
      <h3>PÉRIODE DE DÉCLARATION</h3>
      <div class="info-row"><span class="info-label">Type:</span><span class="info-value">${report.periodType === 'MONTHLY' ? 'Mensuelle' : report.periodType === 'QUARTERLY' ? 'Trimestrielle' : 'Annuelle'}</span></div>
      <div class="info-row"><span class="info-label">Année:</span><span class="info-value">${report.year}</span></div>
      <div class="info-row"><span class="info-label">Période:</span><span class="info-value">${report.period}</span></div>
      <div class="info-row"><span class="info-label">Date limite:</span><span class="info-value">${new Date(report.dueDate).toLocaleDateString('fr-CA')}</span></div>
      <div class="info-row"><span class="info-label">Statut:</span><span class="status-badge status-${report.status.toLowerCase()}">${report.status}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">VENTES ET TAXES PERÇUES</div>
    <table>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Montant</th>
      </tr>
      <tr>
        <td>Ventes totales (${report.salesCount} transactions)</td>
        <td class="amount">${report.totalSales.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
      </tr>
      <tr>
        <td>TPS perçue (5%)</td>
        <td class="amount">${report.tpsCollected.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
      </tr>
      <tr>
        <td>TVQ perçue (9.975%)</td>
        <td class="amount">${report.tvqCollected.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
      </tr>
      <tr class="total">
        <td>Total taxes perçues</td>
        <td class="amount">${(report.tpsCollected + report.tvqCollected).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">CRÉDITS DE TAXE SUR INTRANTS (CTI/RTI)</div>
    <table>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Montant</th>
      </tr>
      <tr>
        <td>TPS payée sur achats (CTI)</td>
        <td class="amount">${report.tpsPaid.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
      </tr>
      <tr>
        <td>TVQ payée sur achats (RTI)</td>
        <td class="amount">${report.tvqPaid.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
      </tr>
      <tr class="total">
        <td>Total crédits réclamés</td>
        <td class="amount">${(report.tpsPaid + report.tvqPaid).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
      </tr>
    </table>
  </div>

  <div class="summary-box">
    <h3>RÉSUMÉ - MONTANTS À REMETTRE</h3>
    <div class="summary-row">
      <span>TPS nette (perçue - CTI)</span>
      <span>${netTps.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</span>
    </div>
    <div class="summary-row">
      <span>TVQ nette (perçue - RTI)</span>
      <span>${netTvq.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</span>
    </div>
    <div class="summary-row summary-total">
      <span>TOTAL À REMETTRE</span>
      <span style="font-size: 20px;">${totalRemittance.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</span>
    </div>
  </div>

  <div class="footer">
    <p>Ce document a été généré automatiquement par le système comptable BioCycle Peptides.</p>
    <p>Date de génération: ${new Date().toLocaleDateString('fr-CA')} ${new Date().toLocaleTimeString('fr-CA')}</p>
    <p>Pour toute question, contactez votre comptable ou Revenu Québec.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate HTML for Income Statement
 */
export function generateIncomeStatementHTML(
  data: {
    revenue: Record<string, number>;
    cogs: Record<string, number>;
    expenses: Record<string, number>;
    other: Record<string, number>;
  },
  period: string,
  company: CompanyInfo = DEFAULT_COMPANY
): string {
  const totalRevenue = Object.values(data.revenue).reduce((a, b) => a + b, 0);
  const totalCogs = Object.values(data.cogs).reduce((a, b) => a + b, 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = Object.values(data.expenses).reduce((a, b) => a + b, 0);
  const operatingProfit = grossProfit - totalExpenses;
  const totalOther = Object.values(data.other).reduce((a, b) => a + b, 0);
  const netProfit = operatingProfit + totalOther;

  const revenueLabels: Record<string, string> = {
    salesCanada: 'Ventes Canada',
    salesUSA: 'Ventes USA',
    salesEurope: 'Ventes Europe',
    salesOther: 'Ventes autres pays',
    shippingCharged: 'Frais de livraison facturés',
    discounts: 'Remises et retours',
  };

  const cogsLabels: Record<string, string> = {
    purchases: 'Achats de marchandises',
    customs: 'Frais de douane et importation',
    inboundShipping: 'Frais de transport entrant',
  };

  const expenseLabels: Record<string, string> = {
    shipping: 'Frais de livraison',
    paymentFees: 'Frais bancaires et paiement',
    marketing: 'Marketing et publicité',
    hosting: 'Hébergement et tech',
    professional: 'Frais professionnels',
    depreciation: 'Amortissement',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>État des résultats - ${period}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; color: #333; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { font-size: 18px; color: #1a5f7a; margin-bottom: 5px; }
    .header h2 { font-size: 14px; color: #666; font-weight: normal; }
    .header h3 { font-size: 12px; color: #888; font-weight: normal; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 8px 15px; text-align: left; }
    th { background: #1a5f7a; color: white; font-weight: bold; }
    td.amount { text-align: right; font-family: 'Courier New', monospace; }
    td.indent { padding-left: 30px; }
    tr.subtotal { background: #f0f0f0; font-weight: bold; }
    tr.total { background: #1a5f7a; color: white; font-weight: bold; }
    tr.section-header td { background: #e8f4f8; font-weight: bold; color: #1a5f7a; padding-top: 15px; }
    .negative { color: #c62828; }
    .positive { color: #2e7d32; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${company.name}</h1>
    <h2>ÉTAT DES RÉSULTATS</h2>
    <h3>Période: ${period}</h3>
  </div>

  <table>
    <tr class="section-header"><td colspan="2">REVENUS</td></tr>
    ${Object.entries(data.revenue).map(([key, value]) => `
      <tr>
        <td class="indent">${revenueLabels[key] || key}</td>
        <td class="amount ${value < 0 ? 'negative' : ''}">${value.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
      </tr>
    `).join('')}
    <tr class="subtotal">
      <td>Total revenus</td>
      <td class="amount">${totalRevenue.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
    </tr>

    <tr class="section-header"><td colspan="2">COÛT DES MARCHANDISES VENDUES</td></tr>
    ${Object.entries(data.cogs).map(([key, value]) => `
      <tr>
        <td class="indent">${cogsLabels[key] || key}</td>
        <td class="amount">${value.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
      </tr>
    `).join('')}
    <tr class="subtotal">
      <td>Total CMV</td>
      <td class="amount">(${totalCogs.toLocaleString('fr-CA', { minimumFractionDigits: 2 })}) $</td>
    </tr>

    <tr class="subtotal" style="background: #d4edda;">
      <td>MARGE BRUTE</td>
      <td class="amount positive">${grossProfit.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $ (${((grossProfit/totalRevenue)*100).toFixed(1)}%)</td>
    </tr>

    <tr class="section-header"><td colspan="2">DÉPENSES D'EXPLOITATION</td></tr>
    ${Object.entries(data.expenses).map(([key, value]) => `
      <tr>
        <td class="indent">${expenseLabels[key] || key}</td>
        <td class="amount">${value.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
      </tr>
    `).join('')}
    <tr class="subtotal">
      <td>Total dépenses</td>
      <td class="amount">(${totalExpenses.toLocaleString('fr-CA', { minimumFractionDigits: 2 })}) $</td>
    </tr>

    <tr class="subtotal" style="background: #e3f2fd;">
      <td>BÉNÉFICE D'EXPLOITATION</td>
      <td class="amount">${operatingProfit.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
    </tr>

    ${Object.keys(data.other).length > 0 ? `
      <tr class="section-header"><td colspan="2">AUTRES PRODUITS / CHARGES</td></tr>
      ${Object.entries(data.other).map(([key, value]) => `
        <tr>
          <td class="indent">${key}</td>
          <td class="amount ${value < 0 ? 'negative' : ''}">${value.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
        </tr>
      `).join('')}
    ` : ''}

    <tr class="total">
      <td>BÉNÉFICE NET</td>
      <td class="amount">${netProfit.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
    </tr>
  </table>

  <div class="footer">
    <p>Document généré le ${new Date().toLocaleDateString('fr-CA')}</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate HTML for Balance Sheet
 */
export function generateBalanceSheetHTML(
  data: {
    assets: { current: Record<string, number>; nonCurrent: Record<string, number> };
    liabilities: { current: Record<string, number> };
    equity: Record<string, number>;
  },
  asOfDate: string,
  company: CompanyInfo = DEFAULT_COMPANY
): string {
  const totalCurrentAssets = Object.values(data.assets.current).reduce((a, b) => a + b, 0);
  const totalNonCurrentAssets = Object.values(data.assets.nonCurrent).reduce((a, b) => a + b, 0);
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
  const totalLiabilities = Object.values(data.liabilities.current).reduce((a, b) => a + b, 0);
  const totalEquity = Object.values(data.equity).reduce((a, b) => a + b, 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bilan - ${asOfDate}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; color: #333; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { font-size: 18px; color: #1a5f7a; margin-bottom: 5px; }
    .header h2 { font-size: 14px; color: #666; font-weight: normal; }
    .columns { display: flex; gap: 30px; }
    .column { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 8px 12px; text-align: left; }
    th { background: #1a5f7a; color: white; font-weight: bold; }
    td.amount { text-align: right; font-family: 'Courier New', monospace; }
    td.indent { padding-left: 25px; }
    tr.subtotal { background: #f0f0f0; font-weight: bold; }
    tr.total { background: #1a5f7a; color: white; font-weight: bold; }
    .section-title { background: #e8f4f8; padding: 8px 12px; font-weight: bold; color: #1a5f7a; margin-top: 15px; }
    .negative { color: #c62828; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${company.name}</h1>
    <h2>BILAN</h2>
    <h3>Au ${asOfDate}</h3>
  </div>

  <div class="columns">
    <div class="column">
      <table>
        <tr><th colspan="2">ACTIFS</th></tr>
        <tr><td colspan="2" class="section-title">Actifs courants</td></tr>
        ${Object.entries(data.assets.current).map(([key, value]) => `
          <tr>
            <td class="indent">${key}</td>
            <td class="amount ${value < 0 ? 'negative' : ''}">${value.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
          </tr>
        `).join('')}
        <tr class="subtotal">
          <td>Total actifs courants</td>
          <td class="amount">${totalCurrentAssets.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
        </tr>
        
        <tr><td colspan="2" class="section-title">Actifs non courants</td></tr>
        ${Object.entries(data.assets.nonCurrent).map(([key, value]) => `
          <tr>
            <td class="indent">${key}</td>
            <td class="amount ${value < 0 ? 'negative' : ''}">${value.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
          </tr>
        `).join('')}
        <tr class="subtotal">
          <td>Total actifs non courants</td>
          <td class="amount">${totalNonCurrentAssets.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
        </tr>
        
        <tr class="total">
          <td>TOTAL ACTIFS</td>
          <td class="amount">${totalAssets.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
        </tr>
      </table>
    </div>

    <div class="column">
      <table>
        <tr><th colspan="2">PASSIFS & CAPITAUX PROPRES</th></tr>
        <tr><td colspan="2" class="section-title">Passifs courants</td></tr>
        ${Object.entries(data.liabilities.current).map(([key, value]) => `
          <tr>
            <td class="indent">${key}</td>
            <td class="amount">${value.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
          </tr>
        `).join('')}
        <tr class="subtotal">
          <td>Total passifs</td>
          <td class="amount">${totalLiabilities.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
        </tr>
        
        <tr><td colspan="2" class="section-title">Capitaux propres</td></tr>
        ${Object.entries(data.equity).map(([key, value]) => `
          <tr>
            <td class="indent">${key}</td>
            <td class="amount">${value.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
          </tr>
        `).join('')}
        <tr class="subtotal">
          <td>Total capitaux propres</td>
          <td class="amount">${totalEquity.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
        </tr>
        
        <tr class="total">
          <td>TOTAL PASSIFS & CAPITAUX</td>
          <td class="amount">${(totalLiabilities + totalEquity).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</td>
        </tr>
      </table>
    </div>
  </div>

  <div class="footer">
    <p>Document généré le ${new Date().toLocaleDateString('fr-CA')}</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate HTML for Journal Entry
 */
export function generateJournalEntryHTML(entry: JournalEntry, _company: CompanyInfo = DEFAULT_COMPANY): string {
  const totalDebits = entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = entry.lines.reduce((sum, l) => sum + l.credit, 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Écriture ${entry.entryNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; padding: 30px; }
    .header { margin-bottom: 20px; }
    .header h1 { font-size: 16px; color: #1a5f7a; }
    .meta { display: flex; gap: 30px; margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
    .meta-item { }
    .meta-label { color: #666; font-size: 10px; }
    .meta-value { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
    th { background: #1a5f7a; color: white; }
    td.amount { text-align: right; font-family: 'Courier New', monospace; }
    tr.total { background: #f0f0f0; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ÉCRITURE DE JOURNAL</h1>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">N° Écriture</div>
      <div class="meta-value">${entry.entryNumber}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Date</div>
      <div class="meta-value">${new Date(entry.date).toLocaleDateString('fr-CA')}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Type</div>
      <div class="meta-value">${entry.type}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Statut</div>
      <div class="meta-value">${entry.status}</div>
    </div>
    ${entry.reference ? `
    <div class="meta-item">
      <div class="meta-label">Référence</div>
      <div class="meta-value">${entry.reference}</div>
    </div>
    ` : ''}
  </div>

  <p style="margin: 10px 0;"><strong>Description:</strong> ${entry.description}</p>

  <table>
    <tr>
      <th>Compte</th>
      <th>Description</th>
      <th style="text-align: right;">Débit</th>
      <th style="text-align: right;">Crédit</th>
    </tr>
    ${entry.lines.map(line => `
      <tr>
        <td>${line.accountCode} - ${line.accountName}</td>
        <td>${line.description || '-'}</td>
        <td class="amount">${line.debit > 0 ? line.debit.toFixed(2) + ' $' : ''}</td>
        <td class="amount">${line.credit > 0 ? line.credit.toFixed(2) + ' $' : ''}</td>
      </tr>
    `).join('')}
    <tr class="total">
      <td colspan="2">TOTAL</td>
      <td class="amount">${totalDebits.toFixed(2)} $</td>
      <td class="amount">${totalCredits.toFixed(2)} $</td>
    </tr>
  </table>

  <p style="margin-top: 20px; color: #666; font-size: 10px;">
    Créé par: ${entry.createdBy} | ${new Date(entry.createdAt).toLocaleString('fr-CA')}
  </p>
</body>
</html>
  `;
}
