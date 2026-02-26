/**
 * Invoice PDF/HTML Generation Service
 *
 * Shared utility to generate printable invoice HTML.
 * Used by:
 *   - /api/accounting/customer-invoices/[id]/pdf (browser print/PDF)
 *   - /api/accounting/customer-invoices/[id]/send (email attachment)
 *   - /api/cron/aging-reminders (reminder email attachment)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoiceForPdf {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerAddress: string | null;
  invoiceDate: Date;
  dueDate: Date;
  paidAt: Date | null;
  status: string;
  subtotal: number | { toNumber?: () => number; toString: () => string };
  shippingCost: number | { toNumber?: () => number; toString: () => string };
  discount: number | { toNumber?: () => number; toString: () => string };
  taxTps: number | { toNumber?: () => number; toString: () => string };
  taxTvq: number | { toNumber?: () => number; toString: () => string };
  taxTvh: number | { toNumber?: () => number; toString: () => string };
  total: number | { toNumber?: () => number; toString: () => string };
  amountPaid: number | { toNumber?: () => number; toString: () => string };
  balance: number | { toNumber?: () => number; toString: () => string };
  notes: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number | { toNumber?: () => number; toString: () => string };
    total: number | { toNumber?: () => number; toString: () => string };
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely convert Prisma Decimal or number to JS number */
function toNum(val: number | { toNumber?: () => number; toString: () => string }): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && typeof val.toNumber === 'function') return val.toNumber();
  return Number(val);
}

/** Escape HTML entities to prevent XSS in the generated document. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const formatCAD = (n: number) => `$${n.toFixed(2)} CAD`;

const formatDate = (d: Date) =>
  d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'BROUILLON',
  SENT: 'ENVOYEE',
  PAID: 'PAYEE',
  PARTIAL: 'PARTIELLE',
  OVERDUE: 'EN RETARD',
  VOID: 'ANNULEE',
  CANCELLED: 'ANNULEE',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#6b7280',
  SENT: '#3b82f6',
  PAID: '#22c55e',
  PARTIAL: '#f59e0b',
  OVERDUE: '#ef4444',
  VOID: '#9ca3af',
  CANCELLED: '#9ca3af',
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate a complete HTML document for an invoice.
 * The output can be:
 *   - Served directly as text/html (for the /pdf route)
 *   - Converted to base64 and attached to an email
 *
 * @param invoice - The invoice data (directly from Prisma with items included)
 * @param options - Optional flags to control output
 */
export function generateInvoiceHtml(
  invoice: InvoiceForPdf,
  options?: { includePrintButton?: boolean }
): string {
  const { includePrintButton = true } = options ?? {};

  const subtotal = toNum(invoice.subtotal);
  const taxTps = toNum(invoice.taxTps);
  const taxTvq = toNum(invoice.taxTvq);
  const taxTvh = toNum(invoice.taxTvh);
  const total = toNum(invoice.total);
  const amountPaid = toNum(invoice.amountPaid);
  const balance = toNum(invoice.balance);

  const itemsHtml = invoice.items
    .map(
      (item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.description)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatCAD(toNum(item.unitPrice))}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatCAD(toNum(item.total))}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facture ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
      @page { margin: 20mm; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      background: #fff;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .company-name { font-size: 24px; font-weight: 700; color: #4f46e5; }
    .company-info { font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.6; }
    .invoice-title { font-size: 28px; font-weight: 700; text-align: right; color: #1e293b; }
    .invoice-number { font-size: 14px; color: #64748b; text-align: right; margin-top: 4px; }
    .status-badge {
      display: inline-block; padding: 4px 12px; border-radius: 9999px;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      color: #fff; margin-top: 8px;
    }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
    .meta-section h4 { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; letter-spacing: 0.05em; }
    .meta-section p { font-size: 14px; line-height: 1.6; }
    .meta-section .label { font-size: 12px; color: #64748b; }
    .meta-section .value { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead th {
      padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600;
      text-transform: uppercase; color: #64748b; background: #f8fafc;
      border-bottom: 2px solid #e2e8f0; letter-spacing: 0.05em;
    }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 30px; }
    .totals-table { width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .totals-row.total { font-size: 18px; font-weight: 700; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 4px; color: #4f46e5; }
    .totals-row.paid { color: #22c55e; }
    .totals-row.balance { font-size: 16px; font-weight: 700; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    .notes { padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
    .notes h4 { font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 6px; }
    .notes p { font-size: 13px; color: #475569; white-space: pre-wrap; }
    .footer { text-align: center; padding-top: 30px; border-top: 1px solid #e2e8f0; }
    .footer p { font-size: 13px; color: #94a3b8; }
    .footer .thanks { font-size: 16px; color: #4f46e5; font-weight: 600; margin-bottom: 8px; }
    .print-btn {
      position: fixed; bottom: 20px; right: 20px; padding: 10px 20px;
      background: #4f46e5; color: #fff; border: none; border-radius: 8px;
      cursor: pointer; font-size: 14px; font-weight: 600;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .print-btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  ${includePrintButton ? '<button class="print-btn no-print" onclick="window.print()">Imprimer / PDF</button>' : ''}

  <div class="header">
    <div>
      <div class="company-name">BioCycle Peptides Inc.</div>
      <div class="company-info">
        Research-Grade Peptides<br>
        Montreal, QC, Canada<br>
        info@biocyclepeptides.com<br>
        TPS: 123456789 RT0001<br>
        TVQ: 1234567890 TQ0001
      </div>
    </div>
    <div>
      <div class="invoice-title">FACTURE</div>
      <div class="invoice-number">${escapeHtml(invoice.invoiceNumber)}</div>
      <div style="text-align:right">
        <span class="status-badge" style="background:${STATUS_COLOR[invoice.status] || '#6b7280'}">
          ${STATUS_LABEL[invoice.status] || invoice.status}
        </span>
      </div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-section">
      <h4>Facturer a</h4>
      <p><strong>${escapeHtml(invoice.customerName)}</strong></p>
      ${invoice.customerEmail ? `<p>${escapeHtml(invoice.customerEmail)}</p>` : ''}
      ${invoice.customerAddress ? `<p>${escapeHtml(invoice.customerAddress)}</p>` : ''}
    </div>
    <div class="meta-section" style="text-align:right;">
      <p><span class="label">Date de facturation:</span><br><span class="value">${formatDate(invoice.invoiceDate)}</span></p>
      <p style="margin-top:8px"><span class="label">Date d'echeance:</span><br><span class="value">${formatDate(invoice.dueDate)}</span></p>
      ${invoice.paidAt ? `<p style="margin-top:8px;color:#22c55e"><span class="label">Payee le:</span><br><span class="value">${formatDate(invoice.paidAt)}</span></p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center;width:80px">Qte</th>
        <th style="text-align:right;width:120px">Prix unitaire</th>
        <th style="text-align:right;width:120px">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="totals-row">
        <span>Sous-total</span>
        <span>${formatCAD(subtotal)}</span>
      </div>
      ${taxTps > 0 ? `<div class="totals-row"><span>TPS (5%)</span><span>${formatCAD(taxTps)}</span></div>` : ''}
      ${taxTvq > 0 ? `<div class="totals-row"><span>TVQ (9,975%)</span><span>${formatCAD(taxTvq)}</span></div>` : ''}
      ${taxTvh > 0 ? `<div class="totals-row"><span>TVH</span><span>${formatCAD(taxTvh)}</span></div>` : ''}
      <div class="totals-row total">
        <span>Total</span>
        <span>${formatCAD(total)}</span>
      </div>
      ${amountPaid > 0 ? `
      <div class="totals-row paid">
        <span>Montant paye</span>
        <span>-${formatCAD(amountPaid)}</span>
      </div>
      <div class="totals-row balance">
        <span>Solde du</span>
        <span>${formatCAD(balance)}</span>
      </div>` : ''}
    </div>
  </div>

  ${invoice.notes ? `
  <div class="notes">
    <h4>Notes</h4>
    <p>${escapeHtml(invoice.notes)}</p>
  </div>` : ''}

  <div class="footer">
    <p class="thanks">Merci pour votre confiance!</p>
    <p>BioCycle Peptides Inc. &mdash; Montreal, QC, Canada</p>
  </div>
</body>
</html>`;
}
