export const dynamic = 'force-dynamic';
/**
 * API - Admin Answer a Product Question
 * POST: Submit or update answer to a question
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { prisma } from '@/lib/db';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { logger } from '@/lib/logger';

const answerQuestionSchema = z.object({
  answer: z.string().min(1, 'La réponse ne peut pas être vide').max(5000, 'La réponse ne doit pas dépasser 5000 caractères'),
  isPublished: z.boolean().optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    const parsed = answerQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // BE-SEC-03: Sanitize answer text - strip HTML and control characters
    const answer = stripControlChars(stripHtml(data.answer)).trim();

    // BE-SEC-05: Enforce max length on sanitized answer text
    if (answer.length > 5000) {
      return NextResponse.json(
        { error: 'La réponse ne doit pas dépasser 5000 caractères' },
        { status: 400 }
      );
    }

    if (!answer) {
      return NextResponse.json(
        { error: 'La réponse ne peut pas être vide' },
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
        isPublished: data.isPublished !== undefined ? !!data.isPublished : true,
      },
    });

    // IMP-025: Log admin modifications with who, when, and previous state for audit trail
    logAdminAction({
      adminUserId: session.user.id,
      action: 'ANSWER_QUESTION',
      targetType: 'ProductQuestion',
      targetId: id,
      previousValue: existing.answer ? { answer: existing.answer.substring(0, 200), answeredBy: existing.answeredBy } : null,
      newValue: { answer: answer.substring(0, 200), answeredBy: session.user.name || session.user.email || 'Admin' },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => logger.error('IMP-025: Audit log failed for ANSWER_QUESTION', { error: err instanceof Error ? err.message : String(err) }));

    return NextResponse.json({ question: updated });
  } catch (error) {
    logger.error('Error answering question', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de l\'ajout de la réponse' },
      { status: 500 }
    );
  }
});
