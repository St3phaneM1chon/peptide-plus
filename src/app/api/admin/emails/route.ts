export const dynamic = 'force-dynamic';

/**
 * Admin Email Templates API
 * GET  - List all email templates
 * POST - Create a new email template
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import DOMPurify from 'isomorphic-dompurify';
import { logger } from '@/lib/logger';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(500).optional(),
  htmlContent: z.string().min(1).optional(),
  textContent: z.string().nullable().optional(),
  variables: z.array(z.string().max(50).regex(/^[a-zA-Z0-9._]+$/)).max(20).optional(),
  isActive: z.boolean().optional(),
  locale: z.string().max(10).optional(),
  sourceId: z.string().optional(),
  preheader: z.string().max(200).optional(),
});

// GET /api/admin/emails - List all email templates
export const GET = withAdminGuard(async (request, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale');
    const active = searchParams.get('active');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const search = searchParams.get('search');
    const category = searchParams.get('category');

    const where: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    // Security: whitelist locale values to prevent injection
    const ALLOWED_LOCALES = ['fr', 'en'];
    if (locale) {
      where.locale = ALLOWED_LOCALES.includes(locale) ? locale : 'fr';
    }
    if (active !== null && active !== undefined && active !== '') {
      where.isActive = active === 'true';
    }
    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // Filter by category using name prefix convention
    // Categories: 'transactional', 'marketing', 'notification', 'system'
    const CATEGORY_PREFIXES: Record<string, string[]> = {
      transactional: ['order-', 'invoice-', 'payment-', 'shipping-', 'receipt-', 'refund-'],
      marketing: ['promo-', 'campaign-', 'newsletter-', 'welcome-', 'upsell-', 'winback-'],
      notification: ['alert-', 'notify-', 'reminder-', 'review-', 'stock-', 'loyalty-'],
      system: ['verify-', 'reset-', 'password-', 'auth-', 'admin-', 'system-', 'test-'],
    };
    if (category && CATEGORY_PREFIXES[category]) {
      andConditions.push({
        OR: CATEGORY_PREFIXES[category].map((prefix) => ({
          name: { startsWith: prefix },
        })),
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [templates, total] = await Promise.all([
      prisma.emailTemplate.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailTemplate.count({ where }),
    ]);

    return NextResponse.json({
      templates,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Admin emails GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/emails - Create a new email template (or clone from sourceId)
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/emails');
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
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { name, subject, htmlContent, textContent, variables, isActive, locale, sourceId } = parsed.data;

    // Clone mode: duplicate an existing template
    if (sourceId) {
      const source = await prisma.emailTemplate.findUnique({ where: { id: sourceId } });
      if (!source) {
        return NextResponse.json({ error: 'Source template not found' }, { status: 404 });
      }

      const clonedName = name || `${source.name} (Copy)`;

      // Ensure unique name
      const existingClone = await prisma.emailTemplate.findUnique({ where: { name: clonedName } });
      if (existingClone) {
        return NextResponse.json(
          { error: 'A template with this name already exists. Please provide a different name.' },
          { status: 409 }
        );
      }

      const cloned = await prisma.emailTemplate.create({
        data: {
          name: clonedName,
          subject: source.subject,
          htmlContent: source.htmlContent,
          textContent: source.textContent,
          variables: source.variables || [],
          isActive: false, // Clones start inactive to avoid accidental sends
          locale: source.locale,
        },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'CLONE_EMAIL_TEMPLATE',
        targetType: 'EmailTemplate',
        targetId: cloned.id,
        newValue: { name: clonedName, sourceId, status: 'cloned' },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({ template: cloned }, { status: 201 });
    }

    // Validate required fields
    if (!name || !subject || !htmlContent) {
      return NextResponse.json(
        { error: 'name, subject, and htmlContent are required' },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.emailTemplate.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A template with this name already exists' },
        { status: 409 }
      );
    }

    // Security #17: Validate variable names are alphanumeric + dot + underscore only
    if (variables !== undefined && variables !== null) {
      if (!Array.isArray(variables)) {
        return NextResponse.json(
          { error: 'variables must be an array of strings' },
          { status: 400 }
        );
      }
      // Security: limit variable count and name length to prevent abuse
      if (variables.length > 20) {
        return NextResponse.json(
          { error: 'Too many variables (max 20)' },
          { status: 400 }
        );
      }
      const validVarName = /^[a-zA-Z0-9._]+$/;
      for (const v of variables) {
        if (typeof v !== 'string' || !validVarName.test(v)) {
          return NextResponse.json(
            { error: `Invalid variable name: "${v}". Only alphanumeric, dot, and underscore are allowed.` },
            { status: 400 }
          );
        }
        if (v.length > 50) {
          return NextResponse.json(
            { error: `Variable name too long: "${v}" (max 50 chars)` },
            { status: 400 }
          );
        }
      }
    }

    // Security #16: Sanitize htmlContent to prevent stored XSS
    const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li',
        'a', 'img', 'strong', 'em', 'b', 'i', 'u', 'span', 'div', 'table', 'thead', 'tbody',
        'tr', 'th', 'td', 'blockquote', 'pre', 'code', 'sup', 'sub', 'center', 'font'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'width', 'height',
        'align', 'valign', 'bgcolor', 'color', 'border', 'cellpadding', 'cellspacing',
        'target', 'rel', 'id', 'colspan', 'rowspan', 'face', 'size'],
      ALLOW_DATA_ATTR: false,
    });

    const template = await prisma.emailTemplate.create({
      data: {
        name: name!,
        subject: subject!,
        htmlContent: sanitizedHtml,
        textContent: textContent || null,
        variables: variables || [],
        isActive: isActive ?? true,
        locale: locale || 'fr',
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_EMAIL_TEMPLATE',
      targetType: 'EmailTemplate',
      targetId: template.id,
      newValue: { name, subject, locale: locale || 'fr', isActive: isActive ?? true },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    // UX hints for subject/preheader optimization
    const hints: Record<string, unknown> = {};
    if (subject.length > 50) {
      hints.subjectLengthWarning = 'Subject line exceeds recommended 50 characters for optimal mobile display';
    }
    if (!parsed.data.preheader) {
      hints.preheaderMissing = true;
    }

    const response: Record<string, unknown> = { template };
    if (Object.keys(hints).length > 0) {
      response.hints = hints;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('Admin emails POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
