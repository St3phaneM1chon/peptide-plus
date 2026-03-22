export const dynamic = 'force-dynamic';

/**
 * INVOICE GENERATION - Download invoice PDF for an order
 *
 * GET /api/orders/[id]/invoice
 *
 * Returns a simple HTML invoice that can be printed/saved as PDF.
 * Authentication: requires the order to belong to the authenticated user,
 * or the request to include a valid order access token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Authentication: session required (token-based access removed — was a bypass vulnerability)
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Fetch order with items and currency
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        currency: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Authorization: user must own the order (or be owner/employee)
    if (order.userId !== session.user.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (user?.role !== 'OWNER' && user?.role !== 'EMPLOYEE') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Build invoice HTML
    const currencySymbol = order.currency?.symbol || '$';
    const currencyCode = order.currency?.code || 'CAD';
    const companyName = 'BioCycle Peptides Inc.';
    const companyAddress = '1234 Research Blvd, Montreal, QC H3A 1A1, Canada';
    const companyEmail = 'billing@biocyclepeptides.com';

    const invoiceDate = order.createdAt.toLocaleDateString('en-CA');
    const invoiceNumber = `INV-${order.orderNumber}`;

    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(item.productName)}${item.optionName ? ` (${escapeHtml(item.optionName)})` : ''}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${currencySymbol}${Number(item.unitPrice).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${currencySymbol}${Number(item.total).toFixed(2)}</td>
      </tr>
    `).join('');

    const taxLines: string[] = [];
    if (Number(order.taxTps) > 0) taxLines.push(`<tr><td colspan="3" style="padding:4px 8px;text-align:right;">TPS/GST (5%):</td><td style="padding:4px 8px;text-align:right;">${currencySymbol}${Number(order.taxTps).toFixed(2)}</td></tr>`);
    if (Number(order.taxTvq) > 0) taxLines.push(`<tr><td colspan="3" style="padding:4px 8px;text-align:right;">TVQ/QST (9.975%):</td><td style="padding:4px 8px;text-align:right;">${currencySymbol}${Number(order.taxTvq).toFixed(2)}</td></tr>`);
    if (Number(order.taxTvh) > 0) taxLines.push(`<tr><td colspan="3" style="padding:4px 8px;text-align:right;">TVH/HST:</td><td style="padding:4px 8px;text-align:right;">${currencySymbol}${Number(order.taxTvh).toFixed(2)}</td></tr>`);
    if (Number(order.taxPst) > 0) taxLines.push(`<tr><td colspan="3" style="padding:4px 8px;text-align:right;">PST:</td><td style="padding:4px 8px;text-align:right;">${currencySymbol}${Number(order.taxPst).toFixed(2)}</td></tr>`);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:right;margin-bottom:20px;">
    <button onclick="window.print()" style="padding:8px 16px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;">Print / Save as PDF</button>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;">
    <div>
      <h1 style="margin:0;font-size:28px;color:#7c3aed;">INVOICE</h1>
      <p style="margin:4px 0;color:#666;">${invoiceNumber}</p>
      <p style="margin:4px 0;color:#666;">Date: ${invoiceDate}</p>
      <p style="margin:4px 0;color:#666;">Order: ${escapeHtml(order.orderNumber)}</p>
      <p style="margin:4px 0;color:#666;">Status: ${order.paymentStatus === 'PAID' ? 'PAID' : order.paymentStatus}</p>
    </div>
    <div style="text-align:right;">
      <h2 style="margin:0;font-size:18px;">${companyName}</h2>
      <p style="margin:4px 0;color:#666;font-size:14px;">${companyAddress}</p>
      <p style="margin:4px 0;color:#666;font-size:14px;">${companyEmail}</p>
    </div>
  </div>

  <div style="margin-bottom:30px;padding:16px;background:#f9fafb;border-radius:8px;">
    <h3 style="margin:0 0 8px;">Bill To:</h3>
    <p style="margin:4px 0;">${escapeHtml(order.shippingName)}</p>
    <p style="margin:4px 0;">${escapeHtml(order.shippingAddress1)}${order.shippingAddress2 ? ', ' + escapeHtml(order.shippingAddress2) : ''}</p>
    <p style="margin:4px 0;">${escapeHtml(order.shippingCity)}, ${escapeHtml(order.shippingState)} ${escapeHtml(order.shippingPostal)}</p>
    <p style="margin:4px 0;">${escapeHtml(order.shippingCountry)}</p>
    ${order.user?.email ? `<p style="margin:4px 0;color:#666;">${escapeHtml(order.user.email)}</p>` : ''}
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:10px 8px;text-align:left;">Product</th>
        <th style="padding:10px 8px;text-align:center;">Qty</th>
        <th style="padding:10px 8px;text-align:right;">Unit Price</th>
        <th style="padding:10px 8px;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">Subtotal:</td>
        <td style="padding:8px;text-align:right;">${currencySymbol}${Number(order.subtotal).toFixed(2)}</td>
      </tr>
      ${Number(order.discount) > 0 ? `<tr><td colspan="3" style="padding:4px 8px;text-align:right;color:#059669;">Discount:</td><td style="padding:4px 8px;text-align:right;color:#059669;">-${currencySymbol}${Number(order.discount).toFixed(2)}</td></tr>` : ''}
      ${Number(order.shippingCost) > 0 ? `<tr><td colspan="3" style="padding:4px 8px;text-align:right;">Shipping:</td><td style="padding:4px 8px;text-align:right;">${currencySymbol}${Number(order.shippingCost).toFixed(2)}</td></tr>` : ''}
      ${taxLines.join('')}
      <tr style="font-size:18px;font-weight:bold;">
        <td colspan="3" style="padding:12px 8px;text-align:right;border-top:2px solid #333;">Total (${currencyCode}):</td>
        <td style="padding:12px 8px;text-align:right;border-top:2px solid #333;">${currencySymbol}${Number(order.total).toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #eee;color:#999;font-size:12px;text-align:center;">
    <p>Thank you for your order! | ${companyName} | ${companyEmail}</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${invoiceNumber}.html"`,
      },
    });
  } catch (error) {
    logger.error('[Invoice] Error generating invoice', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 });
  }
}

/** Escape HTML special characters to prevent XSS */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
