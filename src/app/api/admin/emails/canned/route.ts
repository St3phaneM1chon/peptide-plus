export const dynamic = 'force-dynamic';

/**
 * Admin Canned Responses API
 * GET  - List canned responses
 * POST - Create canned response
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { safeParseJson } from '@/lib/email/utils';
import { logger } from '@/lib/logger';

const createCannedSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  variables: z.unknown().optional(),
  category: z.string().max(100).nullable().optional(),
  locale: z.string().max(10).optional(),
});

const patchCannedSchema = z.object({
  id: z.string().min(1),
});

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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/emails/canned');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createCannedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { title, content, variables, category, locale } = parsed.data;

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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/emails/canned');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = patchCannedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { id } = parsed.data;

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
