export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email/email-service';
import { baseTemplate } from '@/lib/email/templates/base-template';
import { generateInvoiceHtml } from '@/lib/accounting/invoice-pdf.service';

/**
 * POST /api/accounting/customer-invoices/[id]/send
 * Send a customer invoice via email: transitions DRAFT -> SENT.
 *
 * 1. Validates invoice exists and is in DRAFT status
 * 2. Generates PDF-ready HTML of the invoice
 * 3. Sends email to customer with the invoice HTML as attachment
 * 4. Updates status to SENT and records the timestamp
 * 5. Logs the audit trail with email delivery details
 */
export const POST = withAdminGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.customerInvoice.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
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

    // Validate customer email
    if (!existing.customerEmail) {
      return NextResponse.json(
        { error: 'Aucune adresse email client associée à cette facture. Veuillez ajouter une adresse email avant d\'envoyer.' },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------
    // 1. Generate invoice HTML for PDF attachment
    // ---------------------------------------------------------------
    const invoiceHtml = generateInvoiceHtml(existing);

    // Convert HTML to base64 for email attachment
    const htmlBase64 = Buffer.from(invoiceHtml, 'utf-8').toString('base64');

    // ---------------------------------------------------------------
    // 2. Build email content
    // ---------------------------------------------------------------
    const total = Number(existing.total);
    const formatCAD = (n: number) => `$${n.toFixed(2)} CAD`;
    const formatDate = (d: Date) =>
      d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

    const emailBody = baseTemplate({
      locale: 'fr',
      preheader: `Facture ${existing.invoiceNumber} - ${formatCAD(total)}`,
      content: `
        <h1 style="font-size:24px;font-weight:700;color:#1e293b;margin-bottom:16px;">
          Facture ${escapeHtml(existing.invoiceNumber)}
        </h1>
        <p style="font-size:16px;color:#475569;margin-bottom:24px;">
          Bonjour ${escapeHtml(existing.customerName)},
        </p>
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          Veuillez trouver ci-joint votre facture <strong>${escapeHtml(existing.invoiceNumber)}</strong>.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:8px 0;font-size:14px;color:#64748b;">Date de facturation</td>
            <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${formatDate(existing.invoiceDate)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:14px;color:#64748b;">Date d'echeance</td>
            <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${formatDate(existing.dueDate)}</td>
          </tr>
          <tr style="border-top:2px solid #e2e8f0;">
            <td style="padding:12px 0;font-size:18px;font-weight:700;color:#4f46e5;">Total</td>
            <td style="padding:12px 0;font-size:18px;font-weight:700;color:#4f46e5;text-align:right;">${formatCAD(total)}</td>
          </tr>
        </table>
        <p style="font-size:14px;color:#475569;margin-bottom:24px;">
          Merci de proceder au paiement avant la date d'echeance indiquee.
          Pour toute question, n'hesitez pas a nous contacter.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <span style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;font-weight:600;font-size:14px;">
            La facture est jointe en piece attachee (HTML)
          </span>
        </div>
      `,
    });

    // ---------------------------------------------------------------
    // 3. Send email with invoice attachment
    // ---------------------------------------------------------------
    const emailResult = await sendEmail({
      to: { email: existing.customerEmail, name: existing.customerName },
      subject: `Facture ${existing.invoiceNumber} - BioCycle Peptides - ${formatCAD(total)}`,
      html: emailBody,
      attachments: [
        {
          filename: `facture-${existing.invoiceNumber}.html`,
          content: htmlBase64,
          contentType: 'text/html',
        },
      ],
      tags: ['invoice', 'transactional'],
      emailType: 'transactional',
    });

    if (!emailResult.success) {
      logger.error('Failed to send invoice email', {
        invoiceId: id,
        invoiceNumber: existing.invoiceNumber,
        customerEmail: existing.customerEmail,
        error: emailResult.error,
      });

      // Still update status but note the email failure
      // The admin can retry sending later
      return NextResponse.json(
        {
          error: `La facture n'a pas pu être envoyée par email: ${emailResult.error || 'erreur inconnue'}. Le statut n'a pas été modifié.`,
        },
        { status: 502 }
      );
    }

    // ---------------------------------------------------------------
    // 4. Update invoice status to SENT
    // ---------------------------------------------------------------
    const now = new Date();
    const invoice = await prisma.customerInvoice.update({
      where: { id },
      data: {
        status: 'SENT',
        // Record when sent in lastReminderAt (closest available date field)
        lastReminderAt: now,
      },
      include: { items: true },
    });

    // ---------------------------------------------------------------
    // 5. Audit trail with email delivery details
    // ---------------------------------------------------------------
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
        customerEmail: existing.customerEmail,
        emailMessageId: emailResult.messageId,
        sentAt: now.toISOString(),
        note: 'Invoice sent via email with HTML attachment',
      },
    });

    // ---------------------------------------------------------------
    // 6. Log to EmailLog if available (non-blocking)
    // ---------------------------------------------------------------
    try {
      await prisma.emailLog.create({
        data: {
          to: existing.customerEmail,
          subject: `Facture ${existing.invoiceNumber} - BioCycle Peptides`,
          templateId: 'invoice-send',
          status: 'sent',
          messageId: emailResult.messageId || undefined,
        },
      });
    } catch (logError) {
      // Non-fatal: don't fail the send if EmailLog write fails
      logger.warn('Failed to log invoice email to EmailLog', {
        invoiceId: id,
        error: logError instanceof Error ? logError.message : String(logError),
      });
    }

    logger.info('Invoice sent successfully via email', {
      invoiceId: id,
      invoiceNumber: existing.invoiceNumber,
      customerEmail: existing.customerEmail,
      messageId: emailResult.messageId,
    });

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
      email: {
        sent: true,
        to: existing.customerEmail,
        messageId: emailResult.messageId,
      },
      message: 'Facture envoyée avec succès par email',
    });
  } catch (error) {
    logger.error('Send customer invoice error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de la facture" },
      { status: 500 }
    );
  }
});

/** Escape HTML entities to prevent XSS in email templates */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
