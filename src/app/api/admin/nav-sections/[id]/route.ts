import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { patchNavSectionSchema } from '@/lib/validations/admin-nav';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET /api/admin/nav-sections/:id
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const section = await prisma.adminNavSection.findUnique({
      where: { id: params?.id },
      include: {
        subSections: {
          orderBy: { sortOrder: 'asc' },
          include: { pages: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!section) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(section);
  } catch (error) {
    logger.error('[admin/nav-sections/id] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH /api/admin/nav-sections/:id
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const body = await request.json();
    const parsed = patchNavSectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const section = await prisma.adminNavSection.update({
      where: { id: params?.id },
      data: parsed.data,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_NAV_SECTION',
      targetType: 'AdminNavSection',
      targetId: params?.id || section.id,
      newValue: parsed.data,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(section);
  } catch (error) {
    logger.error('[admin/nav-sections/id] PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/nav-sections/:id
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    await prisma.adminNavSection.delete({ where: { id: params?.id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_NAV_SECTION',
      targetType: 'AdminNavSection',
      targetId: params?.id || '',
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error('[admin/nav-sections/id] DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
