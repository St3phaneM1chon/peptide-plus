export const dynamic = 'force-dynamic';

/**
 * Customer Order Receipt
 * GET /api/account/orders/[id]/receipt
 *
 * Returns a printable HTML receipt for the authenticated customer's order.
 * The customer can use browser Print > Save as PDF.
 * Only returns the receipt if the order belongs to the logged-in user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';
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

// ─── HTML Receipt Generator ──────────────────────────────────────────────────

interface TaxRow {
  label: string;
  amount: number;
}

function buildReceiptHTML(params: {
  orderNumber: string;
  createdAt: Date;
  status: string;
  currency: string;
  customerName: string;
  customerEmail: string;
  shippingName: string;
  shippingAddress1: string;
  shippingAddress2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPostal: string;
  shippingCountry: string;
  items: Array<{
    productName: string;
    formatName: string | null;
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
}): string {
  const c = params.currency || 'CAD';
  const f = (n: number) => fmt(n, c);

  const statusLabel = STATUS_LABELS[params.status] ?? esc(params.status);
  const statusClass =
    params.status === 'DELIVERED' || params.status === 'SHIPPED'
      ? 'green'
      : params.status === 'CANCELLED' || params.status === 'REFUNDED'
      ? 'red'
      : 'gray';

  const itemRows = params.items
    .map((item) => {
      const name =
        esc(item.productName) +
        (item.formatName
          ? ` <span style="color:#6b7280;font-size:12px">— ${esc(item.formatName)}</span>`
          : '');
      return `<tr>
        <td>${name}</td>
        <td class="text-right">${item.quantity}</td>
        <td class="text-right">${f(item.unitPrice)}</td>
        <td class="text-right"><strong>${f(item.total)}</strong></td>
      </tr>`;
    })
    .join('');

  const taxRows = params.taxes
    .filter((t) => t.amount > 0)
    .map(
      (t) =>
        `<tr><td class="label">${esc(t.label)}</td><td class="text-right">${f(t.amount)}</td></tr>`
    )
    .join('');

  const shippingLine = `
    ${esc(params.shippingName)}<br>
    ${esc(params.shippingAddress1)}<br>
    ${params.shippingAddress2 ? `${esc(params.shippingAddress2)}<br>` : ''}
    ${esc(params.shippingCity)}, ${esc(params.shippingState)}&nbsp;${esc(params.shippingPostal)}<br>
    ${esc(params.shippingCountry)}
  `;

  const trackingBlock = params.trackingNumber
    ? `<div class="tracking-box">
        <span class="tracking-label">Suivi de colis</span><br>
        ${params.carrier ? `${esc(params.carrier)} — ` : ''}${esc(params.trackingNumber)}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reçu ${esc(params.orderNumber)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f9fafb; color: #111827; font-size: 14px; line-height: 1.5; }
  .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; box-shadow: 0 1px 8px rgba(0,0,0,.08); overflow: hidden; }
  .top-bar { background: #0f172a; color: #fff; padding: 24px 32px; }
  .top-bar h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
  .top-bar p { font-size: 13px; color: #94a3b8; margin-top: 4px; }
  .body { padding: 28px 32px; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; }
  .col { flex: 1; }
  .col-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 6px; }
  .col-value { font-size: 13px; line-height: 1.7; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .badge.green { background: #dcfce7; color: #166534; }
  .badge.red { background: #fee2e2; color: #991b1b; }
  .badge.gray { background: #f1f5f9; color: #475569; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  th { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; background: #f9fafb; padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
  td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .text-right { text-align: right; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  .totals { width: 260px; margin-left: auto; }
  .totals td { padding: 6px 0; border: none; font-size: 13px; }
  .totals td.label { color: #6b7280; }
  .totals .grand-total td { font-size: 16px; font-weight: 700; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 10px; margin-top: 6px; }
  .totals .discount td { color: #16a34a; }
  .tracking-box { margin-top: 20px; padding: 12px 16px; background: #f0fdf4; border-left: 3px solid #16a34a; border-radius: 4px; font-size: 13px; }
  .tracking-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #16a34a; }
  .footer { background: #f9fafb; padding: 20px 32px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; line-height: 1.8; }
  @media print {
    body { background: #fff; }
    .wrapper { box-shadow: none; border-radius: 0; max-width: 100%; margin: 0; }
    @page { size: A4; margin: 1.5cm; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="wrapper">

  <div class="top-bar">
    <h1>${esc(params.companyName)}</h1>
    <p>Reçu de commande</p>
  </div>

  <div class="body">

    <div class="row">
      <div class="col">
        <div class="col-label">Commande</div>
        <div class="col-value"><strong>${esc(params.orderNumber)}</strong></div>
      </div>
      <div class="col">
        <div class="col-label">Date</div>
        <div class="col-value">${fmtDate(params.createdAt)}</div>
      </div>
      <div class="col" style="text-align:right">
        <div class="col-label">Statut</div>
        <div class="col-value"><span class="badge ${statusClass}">${statusLabel}</span></div>
      </div>
    </div>

    <div class="row">
      <div class="col">
        <div class="col-label">Client</div>
        <div class="col-value">
          <strong>${esc(params.customerName)}</strong><br>
          ${esc(params.customerEmail)}
        </div>
      </div>
      <div class="col">
        <div class="col-label">Livraison</div>
        <div class="col-value">${shippingLine}</div>
      </div>
    </div>

    <hr class="divider">

    <table>
      <thead>
        <tr>
          <th>Article</th>
          <th class="text-right">Qté</th>
          <th class="text-right">Prix unit.</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <hr class="divider">

    <table class="totals">
      <tr><td class="label">Sous-total</td><td class="text-right">${f(params.subtotal)}</td></tr>
      <tr><td class="label">Livraison</td><td class="text-right">${f(params.shippingCost)}</td></tr>
      ${
        params.discount > 0
          ? `<tr class="discount"><td class="label">Réduction${params.promoCode ? ` (${esc(params.promoCode)})` : ''}</td><td class="text-right">−${f(params.discount)}</td></tr>`
          : ''
      }
      ${
        params.promoDiscount && params.promoDiscount > 0
          ? `<tr class="discount"><td class="label">Code promo${params.promoCode ? ` (${esc(params.promoCode)})` : ''}</td><td class="text-right">−${f(params.promoDiscount)}</td></tr>`
          : ''
      }
      ${taxRows}
      <tr class="grand-total"><td>Total (${esc(c)})</td><td class="text-right">${f(params.total)}</td></tr>
    </table>

    ${trackingBlock}

  </div>

  <div class="footer">
    Merci pour votre confiance !<br>
    ${esc(params.companyName)} &bull; biocyclepeptides.com<br>
    Pour toute question, contactez notre service client.
  </div>

</div>
</body>
</html>`;
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export const GET = withUserGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const orderId = params?.id;

    // Resolve authenticated user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch order — userId guard ensures customers can only access their own orders
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      include: {
        items: true,
        currency: { select: { code: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const settings = await prisma.accountingSettings.findFirst({
      select: { companyName: true },
    });

    // ── Tax rows ─────────────────────────────────────────────────────────────
    const taxes: TaxRow[] = [];
    const taxTps = Number(order.taxTps);
    const taxTvq = Number(order.taxTvq);
    const taxTvh = Number(order.taxTvh);
    const taxPst = Number((order as Record<string, unknown>).taxPst ?? 0);

    if (taxTps > 0) taxes.push({ label: 'TPS (5 %)', amount: taxTps });
    if (taxTvq > 0) taxes.push({ label: 'TVQ (9,975 %)', amount: taxTvq });
    if (taxTvh > 0) taxes.push({ label: 'TVH', amount: taxTvh });
    if (taxPst > 0) taxes.push({ label: 'PST', amount: taxPst });

    const html = buildReceiptHTML({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      currency: order.currency?.code ?? 'CAD',
      customerName: user.name ?? order.shippingName,
      customerEmail: user.email,
      shippingName: order.shippingName,
      shippingAddress1: order.shippingAddress1,
      shippingAddress2: order.shippingAddress2 ?? null,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingPostal: order.shippingPostal,
      shippingCountry: order.shippingCountry,
      items: order.items.map((item) => ({
        productName: item.productName,
        formatName: item.formatName ?? null,
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
      companyName: settings?.companyName ?? 'BioCycle Peptides Inc.',
    });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="recu-${order.orderNumber}.html"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('Account order receipt GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { skipCsrf: true });
