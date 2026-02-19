export const dynamic = 'force-dynamic';
/**
 * API - Admin Review Actions
 * PATCH: Approve/reject a review, update fields
 * DELETE: Delete a review
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
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

    // Item 2: HTTP 204 No Content for DELETE operations
    return apiNoContent();
  } catch (error) {
    console.error('Error deleting review:', error);
    return apiError('Erreur lors de la suppression de l\'avis', ErrorCode.INTERNAL_ERROR);
  }
});
