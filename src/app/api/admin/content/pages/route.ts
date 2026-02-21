export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { sanitizeHtml, stripHtml } from '@/lib/validation';

// GET /api/admin/content/pages - List all pages
export const GET = withAdminGuard(async (_request, { session }) => {
  const pages = await prisma.page.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      translations: {
        select: { locale: true },
      },
    },
  });

  return NextResponse.json({ pages });
});

// POST /api/admin/content/pages - Create a new page
export const POST = withAdminGuard(async (request, { session }) => {
  const body = await request.json();
  const { title, slug, content, excerpt, metaTitle, metaDescription, template, isPublished } = body;

  if (!title || !slug || !content) {
    return NextResponse.json({ error: 'Title, slug, and content are required' }, { status: 400 });
  }

  // BE-SEC-06: Sanitize content to prevent stored XSS
  const safeTitle = typeof title === 'string' ? stripHtml(title) : title;
  const safeContent = typeof content === 'string' ? sanitizeHtml(content) : content;
  const safeExcerpt = typeof excerpt === 'string' ? stripHtml(excerpt) : excerpt;
  const safeMetaTitle = typeof metaTitle === 'string' ? stripHtml(metaTitle) : metaTitle;
  const safeMetaDesc = typeof metaDescription === 'string' ? stripHtml(metaDescription) : metaDescription;

  // Check slug uniqueness
  const existing = await prisma.page.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'A page with this slug already exists' }, { status: 409 });
  }

  const page = await prisma.page.create({
    data: {
      title: safeTitle,
      slug,
      content: safeContent,
      excerpt: safeExcerpt || null,
      metaTitle: safeMetaTitle || null,
      metaDescription: safeMetaDesc || null,
      template: template || 'default',
      isPublished: isPublished || false,
      publishedAt: isPublished ? new Date() : null,
      createdBy: session.user.id,
    },
  });

  logAdminAction({
    adminUserId: session.user.id,
    action: 'CREATE_PAGE',
    targetType: 'Page',
    targetId: page.id,
    newValue: { title, slug, template: template || 'default', isPublished: isPublished || false },
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
  }).catch(() => {});

  return NextResponse.json({ page }, { status: 201 });
});

// PUT /api/admin/content/pages - Update a page
export const PUT = withAdminGuard(async (request, { session }) => {
  const body = await request.json();
  const { id, title, slug, content, excerpt, metaTitle, metaDescription, template, isPublished } = body;

  if (!id) {
    return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
  }

  const existing = await prisma.page.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  // Check slug uniqueness (exclude current page)
  if (slug && slug !== existing.slug) {
    const slugConflict = await prisma.page.findUnique({ where: { slug } });
    if (slugConflict) {
      return NextResponse.json({ error: 'A page with this slug already exists' }, { status: 409 });
    }
  }

  const wasPublished = existing.isPublished;
  const nowPublished = isPublished ?? existing.isPublished;

  // BE-SEC-06: Sanitize content on update too
  const safeTitle2 = typeof title === 'string' ? stripHtml(title) : title;
  const safeContent2 = typeof content === 'string' ? sanitizeHtml(content) : content;
  const safeExcerpt2 = typeof excerpt === 'string' ? stripHtml(excerpt) : excerpt;
  const safeMetaTitle2 = typeof metaTitle === 'string' ? stripHtml(metaTitle) : metaTitle;
  const safeMetaDesc2 = typeof metaDescription === 'string' ? stripHtml(metaDescription) : metaDescription;

  const page = await prisma.page.update({
    where: { id },
    data: {
      title: safeTitle2 ?? existing.title,
      slug: slug ?? existing.slug,
      content: safeContent2 ?? existing.content,
      excerpt: safeExcerpt2 !== undefined ? safeExcerpt2 : existing.excerpt,
      metaTitle: safeMetaTitle2 !== undefined ? safeMetaTitle2 : existing.metaTitle,
      metaDescription: safeMetaDesc2 !== undefined ? safeMetaDesc2 : existing.metaDescription,
      template: template ?? existing.template,
      isPublished: nowPublished,
      publishedAt: !wasPublished && nowPublished ? new Date() : existing.publishedAt,
    },
  });

  logAdminAction({
    adminUserId: session.user.id,
    action: 'UPDATE_PAGE',
    targetType: 'Page',
    targetId: id,
    previousValue: { title: existing.title, slug: existing.slug, isPublished: existing.isPublished },
    newValue: { title, slug, isPublished: nowPublished },
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
  }).catch(() => {});

  return NextResponse.json({ page });
});

// DELETE /api/admin/content/pages - Delete a page
export const DELETE = withAdminGuard(async (request, { session }) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
  }

  await prisma.page.delete({ where: { id } });

  logAdminAction({
    adminUserId: session.user.id,
    action: 'DELETE_PAGE',
    targetType: 'Page',
    targetId: id,
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
  }).catch(() => {});

  return NextResponse.json({ success: true });
});
