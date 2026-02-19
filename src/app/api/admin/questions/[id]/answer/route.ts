export const dynamic = 'force-dynamic';
/**
 * API - Admin Answer a Product Question
 * POST: Submit or update answer to a question
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { stripHtml, stripControlChars } from '@/lib/sanitize';

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
        isPublished: true, // Auto-publish when answered
      },
    });

    return NextResponse.json({ question: updated });
  } catch (error) {
    console.error('Error answering question:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'ajout de la réponse' },
      { status: 500 }
    );
  }
});
