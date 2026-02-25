/**
 * PDF Generator for invoices and packing slips
 * Generates HTML-based PDFs that can be printed via browser
 */

interface InvoiceData {
  orderNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postal: string;
    country: string;
  };
  items: Array<{
    name: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  shipping: number;
  taxTps: number;
  taxTvq: number;
  discount: number;
  total: number;
  currency: string;
  companyName?: string;
  companyAddress?: string;
  tpsNumber?: string;
  tvqNumber?: string;
}

export function generateInvoiceHTML(data: InvoiceData): string {
  const fmt = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: data.currency || 'CAD' }).format(n);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Facture ${data.orderNumber}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px; color: #1e293b; font-size: 13px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .company { font-size: 18px; font-weight: 700; color: #0f172a; }
  .company-details { font-size: 11px; color: #64748b; margin-top: 4px; }
  .invoice-title { font-size: 28px; font-weight: 700; color: #0f172a; text-align: right; }
  .invoice-meta { text-align: right; color: #64748b; font-size: 12px; margin-top: 4px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
  .text-right { text-align: right; }
  .totals { margin-top: 24px; margin-left: auto; width: 300px; }
  .totals tr td { padding: 6px 12px; }
  .totals .total-row { font-weight: 700; font-size: 16px; border-top: 2px solid #0f172a; }
  .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  .tax-numbers { margin-top: 4px; font-size: 10px; color: #94a3b8; }
  @media print { body { padding: 20px; } @page { margin: 1cm; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="company">${data.companyName || 'BioCycle Peptides Inc.'}</div>
    <div class="company-details">${data.companyAddress || 'Montr\u00e9al, QC, Canada'}</div>
    ${data.tpsNumber ? `<div class="tax-numbers">TPS: ${data.tpsNumber}</div>` : ''}
    ${data.tvqNumber ? `<div class="tax-numbers">TVQ: ${data.tvqNumber}</div>` : ''}
  </div>
  <div>
    <div class="invoice-title">FACTURE</div>
    <div class="invoice-meta">${data.orderNumber}<br>${data.date}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Factur\u00e9 \u00e0</div>
  <div><strong>${data.customerName}</strong></div>
  <div>${data.customerEmail}</div>
  <div>${data.shippingAddress.address1}</div>
  ${data.shippingAddress.address2 ? `<div>${data.shippingAddress.address2}</div>` : ''}
  <div>${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.postal}</div>
  <div>${data.shippingAddress.country}</div>
</div>

<table>
  <thead>
    <tr>
      <th>Article</th>
      <th>SKU</th>
      <th class="text-right">Qt\u00e9</th>
      <th class="text-right">Prix unit.</th>
      <th class="text-right">Total</th>
    </tr>
  </thead>
  <tbody>
    ${data.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.sku || '-'}</td>
      <td class="text-right">${item.quantity}</td>
      <td class="text-right">${fmt(item.unitPrice)}</td>
      <td class="text-right">${fmt(item.total)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<table class="totals">
  <tr><td>Sous-total</td><td class="text-right">${fmt(data.subtotal)}</td></tr>
  <tr><td>Livraison</td><td class="text-right">${fmt(data.shipping)}</td></tr>
  ${data.discount > 0 ? `<tr><td>R\u00e9duction</td><td class="text-right">-${fmt(data.discount)}</td></tr>` : ''}
  ${data.taxTps > 0 ? `<tr><td>TPS (5%)</td><td class="text-right">${fmt(data.taxTps)}</td></tr>` : ''}
  ${data.taxTvq > 0 ? `<tr><td>TVQ (9.975%)</td><td class="text-right">${fmt(data.taxTvq)}</td></tr>` : ''}
  <tr class="total-row"><td>Total</td><td class="text-right">${fmt(data.total)}</td></tr>
</table>

<div class="footer">
  Merci pour votre commande! | ${data.companyName || 'BioCycle Peptides Inc.'} | biocyclepeptides.com
</div>
</body>
</html>`;
}

export function generatePackingSlipHTML(data: Omit<InvoiceData, 'taxTps' | 'taxTvq' | 'discount'>): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Bon de livraison ${data.orderNumber}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px; color: #1e293b; font-size: 13px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
  .title { font-size: 22px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #f8fafc; padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
  .check { width: 24px; height: 24px; border: 2px solid #cbd5e1; display: inline-block; }
  @media print { @page { margin: 1cm; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="title">BON DE LIVRAISON</div>
    <div style="color:#64748b">Commande ${data.orderNumber} \u2014 ${data.date}</div>
  </div>
  <div style="text-align:right">
    <strong>${data.customerName}</strong><br>
    ${data.shippingAddress.address1}<br>
    ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.postal}
  </div>
</div>
<table>
  <thead><tr><th style="width:40px">\u2713</th><th>Article</th><th>SKU</th><th style="text-align:right">Qt\u00e9</th></tr></thead>
  <tbody>
    ${data.items.map(item => `<tr><td><span class="check"></span></td><td>${item.name}</td><td>${item.sku || '-'}</td><td style="text-align:right">${item.quantity}</td></tr>`).join('')}
  </tbody>
</table>
<div style="margin-top:40px;color:#64748b;font-size:11px;text-align:center">V\u00e9rifi\u00e9 par: __________ Date: __________</div>
</body>
</html>`;
}
