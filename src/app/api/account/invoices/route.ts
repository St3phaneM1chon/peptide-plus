/**
 * API Factures client
 * GET /api/account/invoices - Liste les factures du client connecté
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const invoices = await db.customerInvoice.findMany({
      where: { customerId: user.id },
      include: {
        items: true,
      },
      orderBy: { invoiceDate: 'desc' },
    });

    return NextResponse.json({
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        orderId: inv.orderId,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        subtotal: Number(inv.subtotal),
        shippingCost: Number(inv.shippingCost),
        discount: Number(inv.discount),
        taxTps: Number(inv.taxTps),
        taxTvq: Number(inv.taxTvq),
        taxTvh: Number(inv.taxTvh),
        taxPst: Number(inv.taxPst),
        total: Number(inv.total),
        amountPaid: Number(inv.amountPaid),
        balance: Number(inv.balance),
        currency: inv.currency,
        invoiceDate: inv.invoiceDate.toISOString(),
        dueDate: inv.dueDate.toISOString(),
        paidAt: inv.paidAt?.toISOString() || null,
        status: inv.status,
        pdfUrl: inv.pdfUrl,
        notes: inv.notes,
        items: inv.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          total: Number(item.total),
          productId: item.productId,
          productSku: item.productSku,
        })),
      })),
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des factures' },
      { status: 500 }
    );
  }
}
