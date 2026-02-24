export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { enqueue } from '@/lib/translation';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { sanitizeSimpleHtml, stripHtml } from '@/lib/validation';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

const createFaqSchema = z.object({
  question: z.string().min(1).max(1000),
  answer: z.string().min(1).max(10000),
  category: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

const updateFaqSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1).max(1000).optional(),
  answer: z.string().min(1).max(10000).optional(),
  category: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

// GET /api/admin/content/faqs - List all FAQs
export const GET = withAdminGuard(async (_request, { session }) => {
  const faqs = await prisma.faq.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    include: {
      translations: {
        select: { locale: true },
      },
    },
  });

  return NextResponse.json({ faqs });
});

// POST /api/admin/content/faqs - Create a new FAQ
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip') || '127.0.0.1';
  const rl = await rateLimitMiddleware(ip, '/api/admin/content/faqs');
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
  const parsed = createFaqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
  }
  const { question, answer, category, sortOrder, isPublished } = parsed.data;

  // BE-SEC-06: Sanitize FAQ text content
  const safeQuestion = typeof question === 'string' ? stripHtml(question) : question;
  const safeAnswer = typeof answer === 'string' ? sanitizeSimpleHtml(answer) : answer;

  const faq = await prisma.faq.create({
    data: {
      question: safeQuestion,
      answer: safeAnswer,
      category: category || 'general',
      sortOrder: sortOrder ?? 0,
      isPublished: isPublished ?? true,
    },
  });

  // Auto-enqueue translation for all 21 locales
  enqueue.faq(faq.id);

  logAdminAction({
    adminUserId: session.user.id,
    action: 'CREATE_FAQ',
    targetType: 'Faq',
    targetId: faq.id,
    newValue: { question: question.substring(0, 200), category: category || 'general', isPublished: isPublished ?? true },
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
  }).catch(() => {});

  return NextResponse.json({ faq }, { status: 201 });
});

// PUT /api/admin/content/faqs - Update a FAQ
export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip') || '127.0.0.1';
  const rl = await rateLimitMiddleware(ip, '/api/admin/content/faqs');
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
  const parsed = updateFaqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
  }
  const { id, question, answer, category, sortOrder, isPublished } = parsed.data;

  // BE-SEC-06: Sanitize on update too
  const safeQ = typeof question === 'string' ? stripHtml(question) : question;
  const safeA = typeof answer === 'string' ? sanitizeSimpleHtml(answer) : answer;

  const faq = await prisma.faq.update({
    where: { id },
    data: {
      ...(safeQ !== undefined && { question: safeQ }),
      ...(safeA !== undefined && { answer: safeA }),
      ...(category !== undefined && { category }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isPublished !== undefined && { isPublished }),
    },
  });

  // Auto-enqueue translation (force re-translate on update)
  enqueue.faq(faq.id, true);

  logAdminAction({
    adminUserId: session.user.id,
    action: 'UPDATE_FAQ',
    targetType: 'Faq',
    targetId: id,
    newValue: { question: question?.substring(0, 200), category, isPublished },
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
  }).catch(() => {});

  return NextResponse.json({ faq });
});

// DELETE /api/admin/content/faqs - Delete a FAQ
export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip') || '127.0.0.1';
  const rl = await rateLimitMiddleware(ip, '/api/admin/content/faqs');
  if (!rl.success) {
    const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
    Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'FAQ ID is required' }, { status: 400 });
  }

  await prisma.faq.delete({ where: { id } });

  logAdminAction({
    adminUserId: session.user.id,
    action: 'DELETE_FAQ',
    targetType: 'Faq',
    targetId: id,
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
  }).catch(() => {});

  return NextResponse.json({ success: true });
});
