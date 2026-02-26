// SEC-FIX: Migrated to withAdminGuard for consistent auth + CSRF + rate limiting
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { generateInvoiceHTML } from '@/lib/pdf-generator';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { orderIds, type = 'invoice' } = body as { orderIds: string[]; type?: 'invoice' | 'packing_slip' };

    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 50) {
      return NextResponse.json({ error: 'Selectionnez entre 1 et 50 commandes' }, { status: 400 });
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        items: true,
        user: { select: { name: true, email: true } },
      },
    });

    const settings = await prisma.accountingSettings.findFirst();

    const htmlPages = orders.map((order) => {
      const invoiceData = {
        orderNumber: order.orderNumber,
        date: new Intl.DateTimeFormat('fr-CA').format(order.createdAt),
        customerName: order.user?.name || order.shippingName,
        customerEmail: order.user?.email || '',
        shippingAddress: {
          address1: order.shippingAddress1,
          address2: order.shippingAddress2 || undefined,
          city: order.shippingCity,
          state: order.shippingState,
          postal: order.shippingPostal,
          country: order.shippingCountry,
        },
        items: order.items.map((item) => ({
          name: item.name,
          sku: item.sku || undefined,
          quantity: item.quantity,
          unitPrice: Number(item.price),
          total: Number(item.price) * item.quantity,
        })),
        subtotal: Number(order.subtotal),
        shipping: Number(order.shippingCost),
        taxTps: Number(order.taxTps),
        taxTvq: Number(order.taxTvq),
        discount: Number(order.discount),
        total: Number(order.total),
        currency: 'CAD',
        companyName: settings?.companyName || 'BioCycle Peptides Inc.',
        companyAddress: settings?.companyAddress || undefined,
        tpsNumber: settings?.tpsNumber || undefined,
        tvqNumber: settings?.tvqNumber || undefined,
      };

      return generateInvoiceHTML(invoiceData);
    });

    // Combine into single HTML with page breaks
    const combinedHTML = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Impression lot - ${type}</title>
<style>@media print { .page-break { page-break-after: always; } }</style></head><body>
${htmlPages.map((html, i) => `<div class="${i < htmlPages.length - 1 ? 'page-break' : ''}">${html}</div>`).join('\n')}
</body></html>`;

    return new NextResponse(combinedHTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    logger.error('Print batch error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
