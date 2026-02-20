export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting';

/**
 * POST /api/accounting/customer-invoices/[id]/send
 * Send a customer invoice: transitions DRAFT -> SENT.
 *
 * TODO: Integrate actual email sending (SendGrid / Resend / SMTP).
 * For now this only updates the status and records the timestamp.
 */
export const POST = withAdminGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.customerInvoice.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    // Only DRAFT invoices can be sent
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        {
          error: `Impossible d'envoyer une facture avec le statut "${existing.status}". Seules les factures en brouillon peuvent être envoyées.`,
        },
        { status: 400 }
      );
    }

    const invoice = await prisma.customerInvoice.update({
      where: { id },
      data: {
        status: 'SENT',
        // TODO: Set sentAt once the field exists in the schema.
        // For now we record this in the audit trail.
      },
      include: { items: true },
    });

    // Audit trail
    logAuditTrail({
      entityType: 'CustomerInvoice',
      entityId: id,
      action: 'STATUS_CHANGE',
      field: 'status',
      oldValue: 'DRAFT',
      newValue: 'SENT',
      userId: session.user.id || session.user.email || 'unknown',
      userName: session.user.name || undefined,
      metadata: {
        invoiceNumber: existing.invoiceNumber,
        note: 'Invoice sent (email integration pending)',
      },
    });

    // TODO: Send email to customer with PDF attachment.
    // 1. Generate PDF (reuse the /[id]/pdf route logic)
    // 2. Call email provider (SendGrid / Resend)
    // 3. Record email status and message ID
    // Example:
    // const emailResult = await sendInvoiceEmail({
    //   to: existing.customerEmail,
    //   invoiceNumber: existing.invoiceNumber,
    //   pdfBuffer: await generateInvoicePdf(id),
    // });

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        subtotal: Number(invoice.subtotal),
        shippingCost: Number(invoice.shippingCost),
        discount: Number(invoice.discount),
        taxTps: Number(invoice.taxTps),
        taxTvq: Number(invoice.taxTvq),
        taxTvh: Number(invoice.taxTvh),
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        balance: Number(invoice.balance),
        items: invoice.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          total: Number(item.total),
        })),
      },
      message: 'Facture envoyée avec succès (statut mis à jour)',
    });
  } catch (error) {
    console.error('Send customer invoice error:', error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de la facture" },
      { status: 500 }
    );
  }
});
