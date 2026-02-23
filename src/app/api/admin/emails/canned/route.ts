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
import { safeParseJson } from '@/lib/email/utils';
import { logger } from '@/lib/logger';

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
        variables: safeParseJson(r.variables, []),
      })),
      categories: categories.map(c => c.category).filter(Boolean),
    });
  } catch (error) {
    logger.error('[Canned] Error', { error: error instanceof Error ? error.message : String(error) });
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
    logger.error('[Canned] Create error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * PATCH - Increment usageCount for a canned response (called when one is used)
 * Body: { id: string }
 */
export const PATCH = withAdminGuard(async (request, { session: _session }) => {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await prisma.cannedResponse.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Canned response not found' }, { status: 404 });
    }

    const updated = await prisma.cannedResponse.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });

    return NextResponse.json({
      response: { ...updated, variables: safeParseJson(updated.variables, []) },
    });
  } catch (error) {
    logger.error('[Canned] Usage increment error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
