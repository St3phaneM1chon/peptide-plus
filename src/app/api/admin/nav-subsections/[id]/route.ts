import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { patchNavSubSectionSchema } from '@/lib/validations/admin-nav';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET /api/admin/nav-subsections/:id
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const sub = await prisma.adminNavSubSection.findUnique({
      where: { id: params?.id },
      include: { pages: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(sub);
  } catch (error) {
    logger.error('[admin/nav-subsections/id] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH /api/admin/nav-subsections/:id
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const body = await request.json();
    const parsed = patchNavSubSectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const sub = await prisma.adminNavSubSection.update({
      where: { id: params?.id },
      data: parsed.data,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_NAV_SUBSECTION',
      targetType: 'AdminNavSubSection',
      targetId: params?.id || sub.id,
      newValue: parsed.data,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(sub);
  } catch (error) {
    logger.error('[admin/nav-subsections/id] PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/nav-subsections/:id
export const DELETE = withAdminGuard(async (request, { session, params }) => {
  try {
    await prisma.adminNavSubSection.delete({ where: { id: params?.id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_NAV_SUBSECTION',
      targetType: 'AdminNavSubSection',
      targetId: params?.id || 'unknown',
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error('[admin/nav-subsections/id] DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
