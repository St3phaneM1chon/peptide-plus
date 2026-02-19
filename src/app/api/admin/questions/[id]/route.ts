export const dynamic = 'force-dynamic';
/**
 * API - Admin Question Actions
 * PATCH: Update question (publish/unpublish, edit answer)
 * DELETE: Delete a question
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const { answer, isPublished } = body;

    // Check question exists
    const existing = await prisma.productQuestion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Question introuvable' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (answer !== undefined) {
      updateData.answer = answer;
      updateData.answeredBy = session.user.name || session.user.email || 'Admin';
    }

    if (isPublished !== undefined) {
      updateData.isPublished = isPublished;
    }

    const updated = await prisma.productQuestion.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ question: updated });
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la question' },
      { status: 500 }
    );
  }
});

export const DELETE = withAdminGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;

    // Check question exists
    const existing = await prisma.productQuestion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Question introuvable' }, { status: 404 });
    }

    await prisma.productQuestion.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la question' },
      { status: 500 }
    );
  }
});
