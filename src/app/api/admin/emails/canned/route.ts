export const dynamic = 'force-dynamic';

/**
 * Admin Canned Responses API
 * GET  - List canned responses
 * POST - Create canned response
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

export const GET = withAdminGuard(async (request, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const locale = searchParams.get('locale');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (locale) where.locale = locale;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const responses = await prisma.cannedResponse.findMany({
      where,
      orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
    });

    // Get unique categories
    const categories = await prisma.cannedResponse.findMany({
      distinct: ['category'],
      select: { category: true },
      where: { category: { not: null } },
    });

    return NextResponse.json({
      responses: responses.map(r => ({
        ...r,
        variables: r.variables ? JSON.parse(r.variables) : [],
      })),
      categories: categories.map(c => c.category).filter(Boolean),
    });
  } catch (error) {
    console.error('[Canned] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { title, content, variables, category, locale } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const response = await prisma.cannedResponse.create({
      data: {
        title,
        content,
        variables: variables ? JSON.stringify(variables) : null,
        category: category || null,
        locale: locale || 'fr',
        createdBy: session.user.id,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_CANNED_RESPONSE',
      targetType: 'CannedResponse',
      targetId: response.id,
      newValue: { title, category: category || null, locale: locale || 'fr' },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ response });
  } catch (error) {
    console.error('[Canned] Create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
