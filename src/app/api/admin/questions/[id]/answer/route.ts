export const dynamic = 'force-dynamic';
/**
 * API - Admin Answer a Product Question
 * POST: Submit or update answer to a question
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { answer } = body;

    if (!answer || !answer.trim()) {
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
}
