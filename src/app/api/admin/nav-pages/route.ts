import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { createNavPageSchema } from '@/lib/validations/admin-nav';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET /api/admin/nav-pages
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const subSectionId = searchParams.get('subSectionId');
    const where = subSectionId ? { subSectionId } : {};
    const pages = await prisma.adminNavPage.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(pages);
  } catch (error) {
    logger.error('Admin nav-pages GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/nav-pages
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createNavPageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const page = await prisma.adminNavPage.create({ data: parsed.data });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_NAV_PAGE',
      targetType: 'AdminNavPage',
      targetId: page.id,
      newValue: parsed.data,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(page, { status: 201 });
  } catch (error) {
    logger.error('Admin nav-pages POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
