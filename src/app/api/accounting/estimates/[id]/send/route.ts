export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email/email-service';
import { baseTemplate, escapeHtml } from '@/lib/email/templates/base-template';

// ---------------------------------------------------------------------------
// POST /api/accounting/estimates/[id]/send
// Send estimate to customer via email with a client portal link.
// Transitions: DRAFT -> SENT
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.estimate.findFirst({
      where: { id, deletedAt: null },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    // Only DRAFT estimates can be sent
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Impossible d'envoyer un devis avec le statut "${existing.status}". Seuls les devis en brouillon peuvent être envoyés.` },
        { status: 400 }
      );
    }

    // Validate customer email
    if (!existing.customerEmail) {
      return NextResponse.json(
        { error: "Aucune adresse email client associée à ce devis. Veuillez ajouter une adresse email avant d'envoyer." },
        { status: 400 }
      );
    }

    if (!existing.viewToken) {
      return NextResponse.json(
        { error: 'Erreur interne: viewToken manquant' },
        { status: 500 }
      );
    }

    // Build client portal URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com';
    const portalUrl = `${baseUrl}/estimate/${existing.viewToken}`;

    // Build email
    const total = Number(existing.total);
    const formatCAD = (n: number) => `$${n.toFixed(2)} CAD`;
    const formatDate = (d: Date) =>
      d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

    const emailBody = baseTemplate({
      locale: 'fr',
      preheader: `Devis ${existing.estimateNumber} - ${formatCAD(total)}`,
      content: `
        <h1 style="font-size:24px;font-weight:700;color:#1e293b;margin-bottom:16px;">
          Devis ${escapeHtml(existing.estimateNumber)}
        </h1>
        <p style="font-size:16px;color:#475569;margin-bottom:24px;">
          Bonjour ${escapeHtml(existing.customerName)},
        </p>
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          Nous avons le plaisir de vous transmettre le devis <strong>${escapeHtml(existing.estimateNumber)}</strong>.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:8px 0;font-size:14px;color:#64748b;">Date d'émission</td>
            <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${formatDate(existing.issueDate)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:14px;color:#64748b;">Valide jusqu'au</td>
            <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${formatDate(existing.validUntil)}</td>
          </tr>
          <tr style="border-top:2px solid #e2e8f0;">
            <td style="padding:12px 0;font-size:18px;font-weight:700;color:#4f46e5;">Total</td>
            <td style="padding:12px 0;font-size:18px;font-weight:700;color:#4f46e5;text-align:right;">${formatCAD(total)}</td>
          </tr>
        </table>
        <p style="font-size:14px;color:#475569;margin-bottom:24px;">
          Consultez votre devis en ligne et acceptez-le directement en cliquant sur le bouton ci-dessous.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;background:#4f46e5;color:#fff;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">
            Consulter mon devis
          </a>
        </div>
        <p style="font-size:12px;color:#94a3b8;margin-top:24px;">
          Ce devis est valide jusqu'au ${formatDate(existing.validUntil)}. Passé cette date, les prix et conditions pourront être révisés.
        </p>
      `,
    });

    // Send email
    const emailResult = await sendEmail({
      to: { email: existing.customerEmail, name: existing.customerName },
      subject: `Devis ${existing.estimateNumber} - BioCycle Peptides - ${formatCAD(total)}`,
      html: emailBody,
      tags: ['estimate', 'transactional'],
      emailType: 'transactional',
    });

    if (!emailResult.success) {
      logger.error('Failed to send estimate email', {
        estimateId: id,
        estimateNumber: existing.estimateNumber,
        customerEmail: existing.customerEmail,
        error: emailResult.error,
      });

      return NextResponse.json(
        { error: `Le devis n'a pas pu être envoyé par email: ${emailResult.error || 'erreur inconnue'}` },
        { status: 502 }
      );
    }

    // Update status to SENT
    const now = new Date();
    const estimate = await prisma.estimate.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: now,
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    // Audit trail
    logAuditTrail({
      entityType: 'Estimate',
      entityId: id,
      action: 'STATUS_CHANGE',
      field: 'status',
      oldValue: 'DRAFT',
      newValue: 'SENT',
      userId: session.user.id || session.user.email || 'unknown',
      userName: session.user.name || undefined,
      metadata: {
        estimateNumber: existing.estimateNumber,
        customerEmail: existing.customerEmail,
        emailMessageId: emailResult.messageId,
        portalUrl,
        sentAt: now.toISOString(),
      },
    });

    // Log to EmailLog (non-blocking)
    try {
      await prisma.emailLog.create({
        data: {
          to: existing.customerEmail,
          subject: `Devis ${existing.estimateNumber} - BioCycle Peptides`,
          templateId: 'estimate-send',
          status: 'sent',
          messageId: emailResult.messageId || undefined,
        },
      });
    } catch (logError) {
      logger.warn('Failed to log estimate email to EmailLog', {
        estimateId: id,
        error: logError instanceof Error ? logError.message : String(logError),
      });
    }

    logger.info('Estimate sent successfully via email', {
      estimateId: id,
      estimateNumber: existing.estimateNumber,
      customerEmail: existing.customerEmail,
      messageId: emailResult.messageId,
    });

    return NextResponse.json({
      success: true,
      estimate: {
        ...estimate,
        subtotal: Number(estimate.subtotal),
        discountAmount: Number(estimate.discountAmount),
        discountPercent: Number(estimate.discountPercent),
        taxGst: Number(estimate.taxGst),
        taxQst: Number(estimate.taxQst),
        taxTotal: Number(estimate.taxTotal),
        total: Number(estimate.total),
        items: estimate.items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discountPercent: Number(item.discountPercent),
          taxRate: Number(item.taxRate),
          lineTotal: Number(item.lineTotal),
        })),
      },
      email: {
        sent: true,
        to: existing.customerEmail,
        messageId: emailResult.messageId,
      },
      portalUrl,
      message: 'Devis envoyé avec succès par email',
    });
  } catch (error) {
    logger.error('Send estimate error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du devis" },
      { status: 500 }
    );
  }
});
