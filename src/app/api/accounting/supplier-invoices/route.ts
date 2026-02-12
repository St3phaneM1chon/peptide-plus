import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/supplier-invoices
 * List supplier invoices with filters
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
    const supplierId = searchParams.get('supplierId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const [invoices, total] = await Promise.all([
      prisma.supplierInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supplierInvoice.count({ where }),
    ]);

    const mapped = invoices.map((inv) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      taxTps: Number(inv.taxTps),
      taxTvq: Number(inv.taxTvq),
      taxOther: Number(inv.taxOther),
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      balance: Number(inv.balance),
    }));

    return NextResponse.json({
      invoices: mapped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get supplier invoices error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des factures fournisseurs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/supplier-invoices
 * Create a supplier invoice
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
    const {
      invoiceNumber, supplierName, supplierEmail,
      subtotal, taxTps, taxTvq, total,
      invoiceDate, dueDate, expenseCategory,
    } = body;

    if (!invoiceNumber || !supplierName || !subtotal || !total || !invoiceDate || !dueDate) {
      return NextResponse.json(
        { error: 'invoiceNumber, supplierName, subtotal, total, invoiceDate et dueDate sont requis' },
        { status: 400 }
      );
    }

    const invoice = await prisma.supplierInvoice.create({
      data: {
        invoiceNumber,
        supplierName,
        supplierEmail: supplierEmail || null,
        subtotal,
        taxTps: taxTps || 0,
        taxTvq: taxTvq || 0,
        total,
        balance: total,
        invoiceDate: new Date(invoiceDate),
        dueDate: new Date(dueDate),
        expenseCategory: expenseCategory || null,
        status: 'DRAFT',
      },
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error) {
    console.error('Create supplier invoice error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la facture fournisseur' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounting/supplier-invoices
 * Update a supplier invoice
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
    const { id, status, amountPaid, paidAt } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.supplierInvoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Facture fournisseur non trouvée' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (paidAt) updateData.paidAt = new Date(paidAt);
    if (amountPaid !== undefined) {
      updateData.amountPaid = amountPaid;
      updateData.balance = Number(existing.total) - amountPaid;
    }

    const invoice = await prisma.supplierInvoice.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    console.error('Update supplier invoice error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la facture fournisseur' },
      { status: 500 }
    );
  }
}
