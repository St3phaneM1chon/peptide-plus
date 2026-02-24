import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { patchNavPageSchema } from '@/lib/validations/admin-nav';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET /api/admin/nav-pages/:id
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const page = await prisma.adminNavPage.findUnique({
      where: { id: params?.id },
    });
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(page);
  } catch (error) {
    logger.error('[admin/nav-pages/id] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH /api/admin/nav-pages/:id
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const body = await request.json();
    const parsed = patchNavPageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const page = await prisma.adminNavPage.update({
      where: { id: params?.id },
      data: parsed.data,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_NAV_PAGE',
      targetType: 'AdminNavPage',
      targetId: params?.id || page.id,
      newValue: parsed.data,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(page);
  } catch (error) {
    logger.error('[admin/nav-pages/id] PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/nav-pages/:id
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    await prisma.adminNavPage.delete({ where: { id: params?.id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_NAV_PAGE',
      targetType: 'AdminNavPage',
      targetId: params?.id || '',
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error('[admin/nav-pages/id] DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
