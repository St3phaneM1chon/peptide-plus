import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/customer-invoices
 * List customer invoices with filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (from || to) {
      where.invoiceDate = {};
      if (from) (where.invoiceDate as Record<string, unknown>).gte = new Date(from);
      if (to) (where.invoiceDate as Record<string, unknown>).lte = new Date(to);
    }

    const [invoices, total] = await Promise.all([
      prisma.customerInvoice.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customerInvoice.count({ where }),
    ]);

    const mapped = invoices.map((inv) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      shippingCost: Number(inv.shippingCost),
      discount: Number(inv.discount),
      taxTps: Number(inv.taxTps),
      taxTvq: Number(inv.taxTvq),
      taxTvh: Number(inv.taxTvh),
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      balance: Number(inv.balance),
      items: inv.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
      })),
    }));

    return NextResponse.json({
      invoices: mapped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get customer invoices error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des factures clients' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/customer-invoices
 * Create a manual customer invoice
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { customerName, customerEmail, items, taxTps, taxTvq, taxTvh, dueDate } = body;

    if (!customerName || !items || !Array.isArray(items) || items.length === 0 || !dueDate) {
      return NextResponse.json(
        { error: 'customerName, items et dueDate sont requis' },
        { status: 400 }
      );
    }

    // Calculate subtotal from items
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) =>
        sum + item.quantity * item.unitPrice,
      0
    );

    const tps = taxTps || 0;
    const tvq = taxTvq || 0;
    const tvh = taxTvh || 0;
    const total = subtotal + tps + tvq + tvh;

    // Generate invoice number
    const lastInvoice = await prisma.customerInvoice.findFirst({
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
    const nextNum = lastInvoice
      ? parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0') + 1
      : 1;
    const invoiceNumber = `FACT-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

    const invoice = await prisma.customerInvoice.create({
      data: {
        invoiceNumber,
        customerName,
        customerEmail: customerEmail || null,
        subtotal,
        taxTps: tps,
        taxTvq: tvq,
        taxTvh: tvh,
        total,
        balance: total,
        invoiceDate: new Date(),
        dueDate: new Date(dueDate),
        status: 'SENT',
        items: {
          create: items.map((item: { description: string; quantity: number; unitPrice: number }) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error) {
    console.error('Create customer invoice error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la facture' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounting/customer-invoices
 * Update invoice status
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, paidAt, amountPaid } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.customerInvoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (paidAt) updateData.paidAt = new Date(paidAt);
    if (amountPaid !== undefined) {
      updateData.amountPaid = amountPaid;
      updateData.balance = Number(existing.total) - amountPaid;
    }

    const invoice = await prisma.customerInvoice.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    console.error('Update customer invoice error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la facture' },
      { status: 500 }
    );
  }
}
