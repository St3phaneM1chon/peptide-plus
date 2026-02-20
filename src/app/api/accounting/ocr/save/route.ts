export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';

/**
 * POST /api/accounting/ocr/save
 * Save extracted OCR invoice data as a SupplierInvoice
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const {
      invoiceNumber,
      supplierName,
      invoiceDate,
      dueDate,
      subtotal,
      taxTps,
      taxTvq,
      total,
      items,
    } = body;

    if (!total || total <= 0) {
      return NextResponse.json({ error: 'Le total est requis' }, { status: 400 });
    }

    // Create supplier invoice
    const invoice = await prisma.supplierInvoice.create({
      data: {
        id: randomUUID(),
        invoiceNumber: invoiceNumber || `OCR-${Date.now()}`,
        supplierName: supplierName || 'Fournisseur inconnu',
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: subtotal || 0,
        taxTps: taxTps || 0,
        taxTvq: taxTvq || 0,
        taxOther: 0,
        total: total,
        balance: total,
        currency: 'CAD',
        status: 'DRAFT',
        updatedAt: new Date(),
        notes: `Importé via OCR. ${items?.length || 0} article(s) détecté(s).`,
      },
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    console.error('OCR save error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde de la facture' },
      { status: 500 }
    );
  }
});
