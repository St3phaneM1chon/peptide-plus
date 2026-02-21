export const dynamic = 'force-dynamic';
/**
 * API - Admin Review Actions
 * PATCH: Approve/reject a review, update fields
 * DELETE: Delete a review
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiNoContent } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const { status, reply } = body;

    // Check review exists
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
      return apiError('Avis introuvable', ErrorCode.NOT_FOUND, { request });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (status === 'APPROVED') {
      updateData.isApproved = true;
      updateData.isPublished = true;
    } else if (status === 'REJECTED') {
      updateData.isApproved = false;
      updateData.isPublished = false;
    }

    if (reply !== undefined) {
      updateData.reply = reply;
      updateData.repliedAt = new Date();
    }

    const updated = await prisma.review.update({
      where: { id },
      data: updateData,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_REVIEW',
      targetType: 'Review',
      targetId: id,
      previousValue: { isApproved: existing.isApproved, isPublished: existing.isPublished },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return apiSuccess({ review: updated }, { request });
  } catch (error) {
    console.error('Error updating review:', error);
    return apiError('Erreur lors de la mise à jour de l\'avis', ErrorCode.INTERNAL_ERROR, { request });
  }
});

// Status codes: 204 No Content, 404 Not Found, 500 Internal Error
export const DELETE = withAdminGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;

    // Check review exists
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
      return apiError('Avis introuvable', ErrorCode.NOT_FOUND);
    }

    await prisma.review.delete({ where: { id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_REVIEW',
      targetType: 'Review',
      targetId: id,
      previousValue: { rating: existing.rating, productId: existing.productId },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    // Item 2: HTTP 204 No Content for DELETE operations
    return apiNoContent();
  } catch (error) {
    console.error('Error deleting review:', error);
    return apiError('Erreur lors de la suppression de l\'avis', ErrorCode.INTERNAL_ERROR);
  }
});
