import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { createNavSubSectionSchema } from '@/lib/validations/admin-nav';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

// GET /api/admin/nav-subsections
export const GET = withAdminGuard(async (request) => {
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get('sectionId');
  const where = sectionId ? { sectionId } : {};
  const subSections = await prisma.adminNavSubSection.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    include: { pages: { orderBy: { sortOrder: 'asc' } } },
  });
  return NextResponse.json(subSections);
});

// POST /api/admin/nav-subsections
export const POST = withAdminGuard(async (request, { session }) => {
  const body = await request.json();
  const parsed = createNavSubSectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const subSection = await prisma.adminNavSubSection.create({ data: parsed.data });

  logAdminAction({
    adminUserId: session.user.id,
    action: 'CREATE_NAV_SUBSECTION',
    targetType: 'AdminNavSubSection',
    targetId: subSection.id,
    newValue: parsed.data,
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
  }).catch(() => {});

  return NextResponse.json(subSection, { status: 201 });
});
