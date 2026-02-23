export const dynamic = 'force-dynamic';
/**
 * API - Admin Answer a Product Question
 * POST: Submit or update answer to a question
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { prisma } from '@/lib/db';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const { answer: rawAnswer } = body;

    if (!rawAnswer || !String(rawAnswer).trim()) {
      return NextResponse.json(
        { error: 'La réponse ne peut pas être vide' },
        { status: 400 }
      );
    }

    // BE-SEC-03: Sanitize answer text - strip HTML and control characters
    const answer = stripControlChars(stripHtml(String(rawAnswer))).trim();

    // BE-SEC-05: Enforce max length on answer text
    if (answer.length > 5000) {
      return NextResponse.json(
        { error: 'La réponse ne doit pas dépasser 5000 caractères' },
        { status: 400 }
      );
    }

    // Check question exists
    const existing = await prisma.productQuestion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Question introuvable' }, { status: 404 });
    }

    const updated = await prisma.productQuestion.update({
      where: { id },
      data: {
        answer: answer.trim(),
        answeredBy: session.user.name || session.user.email || 'Admin',
        // FIX: F-063 - Allow admin to control publication; default to true for backward compat
        isPublished: body.isPublished !== undefined ? !!body.isPublished : true,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'ANSWER_QUESTION',
      targetType: 'ProductQuestion',
      targetId: id,
      newValue: { answer: answer.substring(0, 200) },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ question: updated });
  } catch (error) {
    logger.error('Error answering question', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de l\'ajout de la réponse' },
      { status: 500 }
    );
  }
});
