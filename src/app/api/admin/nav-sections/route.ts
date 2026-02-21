import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { createNavSectionSchema } from '@/lib/validations/admin-nav';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

// GET /api/admin/nav-sections - List all sections
export const GET = withAdminGuard(async () => {
  const sections = await prisma.adminNavSection.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      subSections: {
        orderBy: { sortOrder: 'asc' },
        include: {
          pages: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  });
  return NextResponse.json(sections);
});

// POST /api/admin/nav-sections - Create section
export const POST = withAdminGuard(async (request, { session }) => {
  const body = await request.json();
  const parsed = createNavSectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const section = await prisma.adminNavSection.create({ data: parsed.data });

  logAdminAction({
    adminUserId: session.user.id,
    action: 'CREATE_NAV_SECTION',
    targetType: 'AdminNavSection',
    targetId: section.id,
    newValue: parsed.data,
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
  }).catch(() => {});

  return NextResponse.json(section, { status: 201 });
});
