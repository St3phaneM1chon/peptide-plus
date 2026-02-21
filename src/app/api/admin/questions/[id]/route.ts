export const dynamic = 'force-dynamic';

/**
 * Admin Question Detail API
 * DELETE - Delete a product question
 * PATCH  - Update question (toggle visibility, edit answer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

// DELETE /api/admin/questions/[id] - Delete a question
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
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

    console.log(
      JSON.stringify({
        event: 'question_deleted',
        timestamp: new Date().toISOString(),
        questionId: id,
        deletedBy: session.user.id,
      })
    );

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_QUESTION',
      targetType: 'ProductQuestion',
      targetId: id,
      previousValue: { productId: existing.productId, question: existing.question?.substring(0, 200) },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin question DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/questions/[id] - Update question (toggle public, update answer)
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    const existing = await prisma.productQuestion.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.isPublic !== undefined) {
      updateData.isPublished = body.isPublic;
    }

    if (body.answer !== undefined) {
      updateData.answer = body.answer;
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
    console.error('Admin question PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
