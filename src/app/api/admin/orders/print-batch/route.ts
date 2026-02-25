import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { generateInvoiceHTML } from '@/lib/pdf-generator';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'OWNER' && session.user.role !== 'EMPLOYEE')) {
      return NextResponse.json({ error: 'Non autoris\u00e9' }, { status: 401 });
    }

    const body = await request.json();
    const { orderIds, type = 'invoice' } = body as { orderIds: string[]; type?: 'invoice' | 'packing_slip' };

    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 50) {
      return NextResponse.json({ error: 'S\u00e9lectionnez entre 1 et 50 commandes' }, { status: 400 });
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
        customerName: order.user.name || order.shippingName,
        customerEmail: order.user.email,
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
    console.error('Print batch error:', error);
    return NextResponse.json({ error: 'Erreur lors de la g\u00e9n\u00e9ration' }, { status: 500 });
  }
}
