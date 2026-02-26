export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeEffectiveStatus(status: string, validUntil: Date): string {
  if (status === 'SENT' && new Date() > validUntil) {
    return 'EXPIRED';
  }
  return status;
}

function mapEstimateForClient(est: Record<string, unknown>) {
  return {
    estimateNumber: est.estimateNumber,
    customerName: est.customerName,
    customerAddress: est.customerAddress,
    customerPhone: est.customerPhone,
    status: computeEffectiveStatus(est.status as string, est.validUntil as Date),
    issueDate: est.issueDate,
    validUntil: est.validUntil,
    acceptedAt: est.acceptedAt,
    acceptedBy: est.acceptedBy,
    declinedAt: est.declinedAt,
    declineReason: est.declineReason,
    subtotal: Number(est.subtotal),
    discountAmount: Number(est.discountAmount),
    discountPercent: Number(est.discountPercent),
    taxGst: Number(est.taxGst),
    taxQst: Number(est.taxQst),
    taxTotal: Number(est.taxTotal),
    total: Number(est.total),
    currency: est.currency,
    notes: est.notes,
    termsConditions: est.termsConditions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: Array.isArray(est.items) ? (est.items as any[]).map((item: Record<string, unknown>) => ({
      productName: item.productName,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discountPercent: Number(item.discountPercent),
      lineTotal: Number(item.lineTotal),
      sortOrder: item.sortOrder,
    })) : [],
  };
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const clientActionSchema = z.object({
  action: z.enum(['accept', 'decline']),
  // For accept
  acceptedBy: z.string().min(1).optional(),
  signatureData: z.string().min(1).optional(),
  // For decline
  declineReason: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/estimates/[token] - Public: view estimate by viewToken
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 10) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 400 });
    }

    const estimate = await prisma.estimate.findFirst({
      where: { viewToken: token, deletedAt: null },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!estimate) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    // Mark as viewed if first time
    if (estimate.status === 'SENT' && !estimate.viewedAt) {
      await prisma.estimate.update({
        where: { id: estimate.id },
        data: {
          viewedAt: new Date(),
          status: 'VIEWED',
        },
      });
      estimate.status = 'VIEWED';
      estimate.viewedAt = new Date();
    }

    return NextResponse.json({ estimate: mapEstimateForClient(estimate) });
  } catch (error) {
    logger.error('View estimate by token error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du devis' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/estimates/[token] - Public: accept or decline
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 10) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = clientActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { action, acceptedBy, signatureData, declineReason } = parsed.data;

    const estimate = await prisma.estimate.findFirst({
      where: { viewToken: token, deletedAt: null },
    });

    if (!estimate) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    const effectiveStatus = computeEffectiveStatus(estimate.status, estimate.validUntil);

    // Check if already decided
    if (['ACCEPTED', 'DECLINED', 'CONVERTED'].includes(effectiveStatus)) {
      return NextResponse.json(
        { error: 'Ce devis a déjà été traité' },
        { status: 400 }
      );
    }

    // Check if expired
    if (effectiveStatus === 'EXPIRED') {
      return NextResponse.json(
        { error: 'Ce devis a expiré et ne peut plus être accepté' },
        { status: 400 }
      );
    }

    // Must be SENT or VIEWED to accept/decline
    if (!['SENT', 'VIEWED'].includes(estimate.status)) {
      return NextResponse.json(
        { error: `Impossible de ${action === 'accept' ? 'accepter' : 'refuser'} un devis avec le statut "${effectiveStatus}"` },
        { status: 400 }
      );
    }

    if (action === 'accept') {
      if (!acceptedBy) {
        return NextResponse.json(
          { error: 'Le nom du signataire est requis pour accepter le devis' },
          { status: 400 }
        );
      }
      if (!signatureData) {
        return NextResponse.json(
          { error: 'La signature est requise pour accepter le devis' },
          { status: 400 }
        );
      }

      // Validate signature data is a reasonable base64 string (not too large)
      if (signatureData.length > 500_000) {
        return NextResponse.json(
          { error: 'Données de signature trop volumineuses' },
          { status: 400 }
        );
      }

      const updatedEstimate = await prisma.estimate.update({
        where: { id: estimate.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedBy,
          signatureData,
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });

      logger.info('Estimate accepted by client', {
        estimateId: estimate.id,
        estimateNumber: estimate.estimateNumber,
        acceptedBy,
      });

      return NextResponse.json({
        success: true,
        message: 'Devis accepté avec succès',
        estimate: mapEstimateForClient(updatedEstimate),
      });
    }

    if (action === 'decline') {
      const updatedEstimate = await prisma.estimate.update({
        where: { id: estimate.id },
        data: {
          status: 'DECLINED',
          declinedAt: new Date(),
          declineReason: declineReason || null,
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });

      logger.info('Estimate declined by client', {
        estimateId: estimate.id,
        estimateNumber: estimate.estimateNumber,
        declineReason,
      });

      return NextResponse.json({
        success: true,
        message: 'Devis refusé',
        estimate: mapEstimateForClient(updatedEstimate),
      });
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  } catch (error) {
    logger.error('Client estimate action error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors du traitement' },
      { status: 500 }
    );
  }
}
