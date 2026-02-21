export const dynamic = 'force-dynamic';
/**
 * API - Admin Review Response
 * POST: Add or update admin response to a review
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { prisma } from '@/lib/db';
import { stripHtml, stripControlChars } from '@/lib/sanitize';

export const POST = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const { response: rawResponse } = body;

    if (!rawResponse || !String(rawResponse).trim()) {
      return NextResponse.json(
        { error: 'La réponse ne peut pas être vide' },
        { status: 400 }
      );
    }

    // BE-SEC-03: Sanitize response text - strip HTML and control characters
    const response = stripControlChars(stripHtml(String(rawResponse))).trim();

    // BE-SEC-05: Enforce max length on response text
    if (response.length > 5000) {
      return NextResponse.json(
        { error: 'La réponse ne doit pas dépasser 5000 caractères' },
        { status: 400 }
      );
    }

    // Check review exists
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Avis introuvable' }, { status: 404 });
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        reply: response.trim(),
        repliedAt: new Date(),
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'RESPOND_TO_REVIEW',
      targetType: 'Review',
      targetId: id,
      newValue: { reply: response.substring(0, 200) },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ review: updated });
  } catch (error) {
    console.error('Error responding to review:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'ajout de la réponse' },
      { status: 500 }
    );
  }
});
