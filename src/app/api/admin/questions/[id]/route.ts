export const dynamic = 'force-dynamic';

/**
 * Admin Question Detail API
 * DELETE - Delete a product question
 * PATCH  - Update question (toggle visibility, edit answer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

const patchQuestionSchema = z.object({
  isPublic: z.boolean().optional(),
  answer: z.string().max(5000).nullable().optional(),
});

// DELETE /api/admin/questions/[id] - Delete a question
export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/questions/[id]');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const id = params!.id;

    const existing = await prisma.productQuestion.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    await prisma.productQuestion.delete({
      where: { id },
    });

    logger.info('question_deleted', {
        questionId: id,
        deletedBy: session.user.id,
      });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_QUESTION',
      targetType: 'ProductQuestion',
      targetId: id,
      previousValue: { productId: existing.productId, question: existing.question?.substring(0, 200) },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Admin question DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/questions/[id] - Update question (toggle public, update answer)
export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/questions/[id]');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const id = params!.id;
    const body = await request.json();
    const parsed = patchQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const existing = await prisma.productQuestion.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (parsed.data.isPublic !== undefined) {
      updateData.isPublished = parsed.data.isPublic;
    }

    if (parsed.data.answer !== undefined) {
      // G4-FLAW-01: Sanitize admin answer to prevent stored XSS
      updateData.answer = parsed.data.answer ? stripControlChars(stripHtml(String(parsed.data.answer))).substring(0, 5000) : null;
      updateData.answeredBy = session.user.name || session.user.email || 'Admin';
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await prisma.productQuestion.update({
      where: { id },
      data: updateData,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_QUESTION',
      targetType: 'ProductQuestion',
      targetId: id,
      previousValue: { isPublished: existing.isPublished, answer: existing.answer?.substring(0, 200) },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      question: {
        id: updated.id,
        isPublic: updated.isPublished,
        answer: updated.answer,
        answeredBy: updated.answeredBy,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Admin question PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
