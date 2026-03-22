export const dynamic = 'force-dynamic';

/**
 * Admin Order PDF Export
 * GET /api/admin/orders/[id]/pdf
 *
 * Returns a fully-styled HTML invoice page.
 * In the browser: File > Print > Save as PDF.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// ─── Helpers ────────────────────────────────────────────────────────────────

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: currency || 'CAD',
  }).format(n);
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PROCESSING: 'En traitement',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

// ─── HTML Invoice Generator ──────────────────────────────────────────────────

interface TaxRow {
  label: string;
  amount: number;
}

function buildInvoiceHTML(params: {
  orderNumber: string;
  createdAt: Date;
  status: string;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  shippingName: string;
  shippingAddress1: string;
  shippingAddress2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPostal: string;
  shippingCountry: string;
  billingName: string | null;
  billingAddress1: string | null;
  billingAddress2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostal: string | null;
  billingCountry: string | null;
  billingSameAsShipping: boolean;
  items: Array<{
    productName: string;
    optionName: string | null;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }>;
  subtotal: number;
  shippingCost: number;
  discount: number;
  promoCode: string | null;
  promoDiscount: number | null;
  taxes: TaxRow[];
  total: number;
  trackingNumber: string | null;
  carrier: string | null;
  companyName: string;
  companyAddress: string;
  tpsNumber: string | null;
  tvqNumber: string | null;
}): string {
  const c = params.currency || 'CAD';
  const f = (n: number) => fmt(n, c);

  const shippingAddr = [
    `<strong>${esc(params.shippingName)}</strong>`,
    esc(params.shippingAddress1),
    params.shippingAddress2 ? esc(params.shippingAddress2) : null,
    `${esc(params.shippingCity)}, ${esc(params.shippingState)}&nbsp;${esc(params.shippingPostal)}`,
    esc(params.shippingCountry),
  ]
    .filter(Boolean)
    .join('<br>');

  const billingAddr = params.billingSameAsShipping
    ? shippingAddr
    : [
        params.billingName
          ? `<strong>${esc(params.billingName)}</strong>`
          : null,
        params.billingAddress1 ? esc(params.billingAddress1) : null,
        params.billingAddress2 ? esc(params.billingAddress2) : null,
        params.billingCity
          ? `${esc(params.billingCity)}, ${esc(params.billingState ?? '')}&nbsp;${esc(params.billingPostal ?? '')}`
          : null,
        params.billingCountry ? esc(params.billingCountry) : null,
      ]
        .filter(Boolean)
        .join('<br>');

  const itemRows = params.items
    .map((item) => {
      const name = esc(item.productName) + (item.optionName ? ` <span style="color:#64748b">— ${esc(item.optionName)}</span>` : '');
      const lineDiscount = item.discount > 0
        ? `<br><span style="font-size:11px;color:#16a34a">−${f(item.discount)}</span>`
        : '';
      return `<tr>
        <td>${name}</td>
        <td style="color:#64748b">${esc(item.sku) || '—'}</td>
        <td class="text-right">${item.quantity}</td>
        <td class="text-right">${f(item.unitPrice)}${lineDiscount}</td>
        <td class="text-right"><strong>${f(item.total)}</strong></td>
      </tr>`;
    })
    .join('');

  const taxRows = params.taxes
    .filter((t) => t.amount > 0)
    .map((t) => `<tr><td>${esc(t.label)}</td><td class="text-right">${f(t.amount)}</td></tr>`)
    .join('');

  const trackingInfo =
    params.trackingNumber
      ? `<div style="margin-top:16px;padding:12px 16px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-size:12px;">
          <strong>Suivi:</strong> ${esc(params.carrier || '')} — ${esc(params.trackingNumber)}
        </div>`
      : '';

  const statusLabel = STATUS_LABELS[params.status] ?? esc(params.status);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Facture ${esc(params.orderNumber)} — ${esc(params.companyName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; font-size: 13px; line-height: 1.5; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0; }
  .company-name { font-size: 20px; font-weight: 700; color: #0f172a; }
  .company-details { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.6; }
  .invoice-title { font-size: 30px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
  .invoice-meta { text-align: right; color: #64748b; font-size: 12px; margin-top: 6px; line-height: 1.8; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: #f1f5f9; color: #475569; }
  .badge.shipped { background: #dcfce7; color: #166534; }
  .badge.delivered { background: #dcfce7; color: #166534; }
  .badge.cancelled { background: #fee2e2; color: #991b1b; }
  .badge.refunded { background: #fef3c7; color: #92400e; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
  .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 6px; }
  .address-block { font-size: 13px; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .text-right { text-align: right; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }
  .totals { width: 300px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .totals table { margin: 0; }
  .totals td { padding: 8px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .totals tr:last-child td { border-bottom: none; }
  .totals .grand-total td { font-size: 16px; font-weight: 700; background: #0f172a; color: #fff; }
  .totals .discount td { color: #16a34a; }
  .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 10px; line-height: 1.8; }
  .tax-reg { margin-top: 6px; font-size: 10px; color: #94a3b8; }
  @media print {
    body { padding: 20px; }
    @page { size: A4; margin: 1.5cm; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="company-name">${esc(params.companyName)}</div>
    <div class="company-details">${esc(params.companyAddress)}</div>
    ${params.tpsNumber ? `<div class="tax-reg">TPS / GST : ${esc(params.tpsNumber)}</div>` : ''}
    ${params.tvqNumber ? `<div class="tax-reg">TVQ / QST : ${esc(params.tvqNumber)}</div>` : ''}
  </div>
  <div style="text-align:right">
    <div class="invoice-title">FACTURE</div>
    <div class="invoice-meta">
      N° ${esc(params.orderNumber)}<br>
      ${fmtDate(params.createdAt)}<br>
      <span class="badge ${params.status.toLowerCase()}">${statusLabel}</span>
    </div>
  </div>
</div>

<div class="grid-2">
  <div>
    <div class="section-label">Client</div>
    <div class="address-block">
      <strong>${esc(params.customerName)}</strong><br>
      ${esc(params.customerEmail)}
      ${params.customerPhone ? `<br>${esc(params.customerPhone)}` : ''}
    </div>
  </div>
  <div>
    <!-- spacer -->
  </div>
</div>

<div class="grid-2" style="margin-bottom:28px">
  <div>
    <div class="section-label">Adresse de livraison</div>
    <div class="address-block">${shippingAddr}</div>
  </div>
  <div>
    <div class="section-label">Adresse de facturation</div>
    <div class="address-block">${billingAddr}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Article</th>
      <th>SKU</th>
      <th class="text-right">Qté</th>
      <th class="text-right">Prix unit.</th>
      <th class="text-right">Total</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<div class="totals-wrap">
  <div class="totals">
    <table>
      <tr><td>Sous-total</td><td class="text-right">${f(params.subtotal)}</td></tr>
      <tr><td>Livraison</td><td class="text-right">${f(params.shippingCost)}</td></tr>
      ${params.discount > 0 ? `<tr class="discount"><td>Réduction${params.promoCode ? ` (${esc(params.promoCode)})` : ''}</td><td class="text-right">−${f(params.discount)}</td></tr>` : ''}
      ${params.promoDiscount && params.promoDiscount > 0 ? `<tr class="discount"><td>Promo${params.promoCode ? ` (${esc(params.promoCode)})` : ''}</td><td class="text-right">−${f(params.promoDiscount)}</td></tr>` : ''}
      ${taxRows}
      <tr class="grand-total"><td>TOTAL (${esc(c)})</td><td class="text-right">${f(params.total)}</td></tr>
    </table>
  </div>
</div>

${trackingInfo}

<div class="footer">
  Merci pour votre commande !<br>
  ${esc(params.companyName)} &bull; attitudes.vip
  ${params.tpsNumber ? `<br>TPS/GST : ${esc(params.tpsNumber)}` : ''}
  ${params.tvqNumber ? ` &bull; TVQ/QST : ${esc(params.tvqNumber)}` : ''}
</div>

</body>
</html>`;
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params!.id as string;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        currency: { select: { code: true } },
        user: {
          select: { name: true, email: true, phone: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const settings = await prisma.accountingSettings.findFirst();

    // ── Assemble tax rows ────────────────────────────────────────────────────
    const taxes: TaxRow[] = [];
    const taxTps = Number(order.taxTps);
    const taxTvq = Number(order.taxTvq);
    const taxTvh = Number(order.taxTvh);
    const taxPst = Number((order as Record<string, unknown>).taxPst ?? 0);

    if (taxTps > 0) taxes.push({ label: 'TPS (5 %)', amount: taxTps });
    if (taxTvq > 0) taxes.push({ label: 'TVQ (9,975 %)', amount: taxTvq });
    if (taxTvh > 0) taxes.push({ label: 'TVH', amount: taxTvh });
    if (taxPst > 0) taxes.push({ label: 'PST', amount: taxPst });

    // ── Company info ─────────────────────────────────────────────────────────
    const companyName = settings?.companyName ?? 'BioCycle Peptides Inc.';
    const companyAddressParts = [
      settings?.companyAddress,
      settings?.companyCity && settings?.companyProvince
        ? `${settings.companyCity}, ${settings.companyProvince}`
        : settings?.companyCity ?? settings?.companyProvince,
      settings?.companyPostalCode,
    ].filter(Boolean);
    const companyAddress =
      companyAddressParts.length > 0
        ? companyAddressParts.join(' — ')
        : 'Montréal, QC, Canada';

    const html = buildInvoiceHTML({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      currency: order.currency?.code ?? 'CAD',
      customerName: order.user?.name ?? order.shippingName,
      customerEmail: order.user?.email ?? '',
      customerPhone: order.user?.phone ?? order.shippingPhone ?? null,
      shippingName: order.shippingName,
      shippingAddress1: order.shippingAddress1,
      shippingAddress2: order.shippingAddress2 ?? null,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingPostal: order.shippingPostal,
      shippingCountry: order.shippingCountry,
      billingName: order.billingName ?? null,
      billingAddress1: order.billingAddress1 ?? null,
      billingAddress2: order.billingAddress2 ?? null,
      billingCity: order.billingCity ?? null,
      billingState: order.billingState ?? null,
      billingPostal: order.billingPostal ?? null,
      billingCountry: order.billingCountry ?? null,
      billingSameAsShipping: order.billingSameAsShipping,
      items: order.items.map((item) => ({
        productName: item.productName,
        optionName: item.optionName ?? null,
        sku: item.sku ?? null,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
      })),
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shippingCost),
      discount: Number(order.discount),
      promoCode: order.promoCode ?? null,
      promoDiscount: order.promoDiscount ? Number(order.promoDiscount) : null,
      taxes,
      total: Number(order.total),
      trackingNumber: order.trackingNumber ?? null,
      carrier: order.carrier ?? null,
      companyName,
      companyAddress,
      tpsNumber: settings?.tpsNumber ?? null,
      tvqNumber: settings?.tvqNumber ?? null,
    });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="facture-${order.orderNumber}.html"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('Admin order PDF GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
