export const dynamic = 'force-dynamic';
/**
 * API - Admin Review Actions
 * PATCH: Approve/reject a review, update fields
 * DELETE: Delete a review
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiNoContent } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

const patchReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']).optional(),
  reply: z.string().max(5000).nullable().optional(),
});

export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/reviews/[id]');
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
    const parsed = patchReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { status, reply } = parsed.data;

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
      // G4-FLAW-01: Sanitize admin reply to prevent stored XSS
      updateData.reply = reply ? stripControlChars(stripHtml(String(reply))).substring(0, 5000) : null;
      updateData.repliedAt = new Date();
    }

    const updated = await prisma.review.update({
      where: { id },
      data: updateData,
    });

    // FIX F-050: Log audit errors instead of silently ignoring
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_REVIEW',
      targetType: 'Review',
      targetId: id,
      previousValue: { isApproved: existing.isApproved, isPublished: existing.isPublished },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => logger.error('Audit log failed for UPDATE_REVIEW', { error: err instanceof Error ? err.message : String(err) }));

    return apiSuccess({ review: updated }, { request });
  } catch (error) {
    logger.error('Error updating review', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la mise à jour de l\'avis', ErrorCode.INTERNAL_ERROR, { request });
  }
});

// Status codes: 204 No Content, 404 Not Found, 500 Internal Error
export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/reviews/[id]');
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

    // Check review exists (include images for cleanup)
    const existing = await prisma.review.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!existing) {
      return apiError('Avis introuvable', ErrorCode.NOT_FOUND);
    }

    // F-047 FIX: Delete associated review images from storage
    if (existing.images?.length) {
      try {
        const { storage } = await import('@/lib/storage');
        await Promise.all(existing.images.map((img) => storage.delete(img.url).catch(() => {})));
      } catch { /* Storage cleanup is best-effort */ }
    }

    await prisma.review.delete({ where: { id } });

    // FIX F-050: Log audit errors instead of silently ignoring
    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_REVIEW',
      targetType: 'Review',
      targetId: id,
      previousValue: { rating: existing.rating, productId: existing.productId },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => logger.error('Audit log failed for DELETE_REVIEW', { error: err instanceof Error ? err.message : String(err) }));

    // Item 2: HTTP 204 No Content for DELETE operations
    return apiNoContent();
  } catch (error) {
    logger.error('Error deleting review', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la suppression de l\'avis', ErrorCode.INTERNAL_ERROR);
  }
});
