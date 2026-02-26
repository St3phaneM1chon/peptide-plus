export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { generateInvoiceHtml } from '@/lib/accounting/invoice-pdf.service';

/**
 * GET /api/accounting/customer-invoices/[id]/pdf
 * Generate an HTML invoice page that can be printed / saved as PDF.
 */
export const GET = withAdminGuard(async (_request: NextRequest, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const invoice = await prisma.customerInvoice.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    const html = generateInvoiceHtml(invoice, { includePrintButton: true });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    logger.error('Generate invoice PDF error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la generation de la facture PDF' },
      { status: 500 }
    );
  }
});
