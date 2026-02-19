export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/ocr/history
 * List recent supplier invoices created via OCR
 */
export const GET = withAdminGuard(async () => {
  try {
    // Fetch recent supplier invoices that were created via OCR
    const invoices = await prisma.supplierInvoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { startsWith: 'OCR-' } },
          { notes: { contains: 'OCR' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const scans = invoices.map((inv) => ({
      id: inv.id,
      fileName: `scan-${inv.invoiceNumber}`,
      supplierName: inv.supplierName,
      total: Number(inv.totalAmount),
      status: inv.status === 'DRAFT' ? 'NEEDS_REVIEW' : 'SUCCESS',
      createdAt: inv.createdAt,
    }));

    return NextResponse.json({ scans });
  } catch (error) {
    console.error('OCR history error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique OCR' },
      { status: 500 }
    );
  }
});
