export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting/audit-trail.service';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email/email-service';
import { baseTemplate } from '@/lib/email/templates/base-template';
import { escapeHtml } from '@/lib/email/templates/base-template';

/**
 * POST /api/accounting/purchase-orders/[id]/send
 * Send PO to supplier via email, update status to SENT
 */
export const POST = withAdminGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });

    if (!po) {
      return NextResponse.json({ error: 'Bon de commande non trouve' }, { status: 404 });
    }

    // Only DRAFT POs can be sent
    if (po.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Impossible d'envoyer un bon de commande avec le statut "${po.status}". Seuls les brouillons peuvent etre envoyes.` },
        { status: 400 }
      );
    }

    // Validate supplier email
    if (!po.supplierEmail) {
      return NextResponse.json(
        { error: 'Aucune adresse email fournisseur associee a ce bon de commande. Veuillez ajouter une adresse email avant d\'envoyer.' },
        { status: 400 }
      );
    }

    // Build PO email content
    const total = Number(po.total);
    const subtotal = Number(po.subtotal);
    const taxTps = Number(po.taxTps);
    const taxTvq = Number(po.taxTvq);
    const formatCAD = (n: number) => `$${n.toFixed(2)} CAD`;
    const formatDate = (d: Date) =>
      d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

    const itemsHtml = po.items.map((item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;">${escapeHtml(item.productName || item.description)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.sku || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;">${Number(item.quantity)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;">${formatCAD(Number(item.unitCost))}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;font-weight:600;">${formatCAD(Number(item.total))}</td>
      </tr>
    `).join('');

    const emailBody = baseTemplate({
      locale: 'fr',
      preheader: `Bon de commande ${po.poNumber} - ${formatCAD(total)}`,
      content: `
        <h1 style="font-size:24px;font-weight:700;color:#1e293b;margin-bottom:16px;">
          Bon de commande ${escapeHtml(po.poNumber)}
        </h1>
        <p style="font-size:14px;color:#475569;margin-bottom:24px;">
          Bonjour,<br/>Veuillez trouver ci-dessous notre bon de commande.
        </p>
        ${po.expectedDate ? `
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          <strong>Date de livraison souhaitee:</strong> ${formatDate(po.expectedDate)}
        </p>` : ''}
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:8px;text-align:left;font-size:12px;color:#64748b;">Produit</th>
              <th style="padding:8px;text-align:left;font-size:12px;color:#64748b;">SKU</th>
              <th style="padding:8px;text-align:right;font-size:12px;color:#64748b;">Quantite</th>
              <th style="padding:8px;text-align:right;font-size:12px;color:#64748b;">Prix unitaire</th>
              <th style="padding:8px;text-align:right;font-size:12px;color:#64748b;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <table style="width:300px;margin-left:auto;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#64748b;">Sous-total</td>
            <td style="padding:6px 0;font-size:14px;text-align:right;">${formatCAD(subtotal)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#64748b;">TPS (5%)</td>
            <td style="padding:6px 0;font-size:14px;text-align:right;">${formatCAD(taxTps)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#64748b;">TVQ (9.975%)</td>
            <td style="padding:6px 0;font-size:14px;text-align:right;">${formatCAD(taxTvq)}</td>
          </tr>
          <tr style="border-top:2px solid #e2e8f0;">
            <td style="padding:12px 0;font-size:18px;font-weight:700;color:#4f46e5;">Total</td>
            <td style="padding:12px 0;font-size:18px;font-weight:700;color:#4f46e5;text-align:right;">${formatCAD(total)}</td>
          </tr>
        </table>
        ${po.notes ? `
        <div style="background:#f8fafc;padding:12px 16px;border-radius:8px;margin-bottom:24px;">
          <p style="font-size:12px;color:#64748b;margin-bottom:4px;">Notes:</p>
          <p style="font-size:14px;color:#475569;">${escapeHtml(po.notes)}</p>
        </div>` : ''}
        <p style="font-size:14px;color:#475569;">
          Merci de confirmer la reception de ce bon de commande.<br/>
          BioCycle Peptides Inc.
        </p>
      `,
    });

    // Send email
    const emailResult = await sendEmail({
      to: { email: po.supplierEmail, name: po.supplierName },
      subject: `Bon de commande ${po.poNumber} - BioCycle Peptides - ${formatCAD(total)}`,
      html: emailBody,
      tags: ['purchase-order', 'transactional'],
      emailType: 'transactional',
    });

    if (!emailResult.success) {
      logger.error('Failed to send PO email', {
        poId: id,
        poNumber: po.poNumber,
        supplierEmail: po.supplierEmail,
        error: emailResult.error,
      });
      return NextResponse.json(
        { error: `Le bon de commande n'a pas pu etre envoye par email: ${emailResult.error || 'erreur inconnue'}` },
        { status: 502 }
      );
    }

    // Update status to SENT
    const now = new Date();
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: now,
      },
      include: { items: true },
    });

    // Audit trail
    logAuditTrail({
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      oldValue: 'DRAFT',
      newValue: 'SENT',
      userId: session?.user?.id || session?.user?.email || 'unknown',
      userName: session?.user?.name || undefined,
      metadata: {
        poNumber: po.poNumber,
        supplierEmail: po.supplierEmail,
        emailMessageId: emailResult.messageId,
        sentAt: now.toISOString(),
      },
    }).catch(() => { /* non-blocking */ });

    // Log to EmailLog (non-blocking)
    try {
      await prisma.emailLog.create({
        data: {
          to: po.supplierEmail,
          subject: `Bon de commande ${po.poNumber} - BioCycle Peptides`,
          templateId: 'purchase-order-send',
          status: 'sent',
          messageId: emailResult.messageId || undefined,
        },
      });
    } catch (logError) {
      logger.warn('Failed to log PO email to EmailLog', {
        poId: id,
        error: logError instanceof Error ? logError.message : String(logError),
      });
    }

    logger.info('Purchase order sent via email', {
      poNumber: po.poNumber,
      supplierEmail: po.supplierEmail,
      messageId: emailResult.messageId,
    });

    return NextResponse.json({
      success: true,
      order: {
        ...updated,
        subtotal: Number(updated.subtotal),
        taxTps: Number(updated.taxTps),
        taxTvq: Number(updated.taxTvq),
        total: Number(updated.total),
        items: updated.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          quantityReceived: Number(item.quantityReceived),
          unitCost: Number(item.unitCost),
          taxRate: Number(item.taxRate),
          total: Number(item.total),
        })),
      },
      email: {
        sent: true,
        to: po.supplierEmail,
        messageId: emailResult.messageId,
      },
      message: 'Bon de commande envoye avec succes par email',
    });
  } catch (error) {
    logger.error('Send purchase order error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du bon de commande" },
      { status: 500 }
    );
  }
});
