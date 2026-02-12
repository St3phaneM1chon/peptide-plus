import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

// GET /api/admin/content/pages - List all pages
export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pages = await prisma.page.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      translations: {
        select: { locale: true },
      },
    },
  });

  return NextResponse.json({ pages });
}

// POST /api/admin/content/pages - Create a new page
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { title, slug, content, excerpt, metaTitle, metaDescription, template, isPublished } = body;

  if (!title || !slug || !content) {
    return NextResponse.json({ error: 'Title, slug, and content are required' }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await prisma.page.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'A page with this slug already exists' }, { status: 409 });
  }

  const page = await prisma.page.create({
    data: {
      title,
      slug,
      content,
      excerpt: excerpt || null,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      template: template || 'default',
      isPublished: isPublished || false,
      publishedAt: isPublished ? new Date() : null,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ page }, { status: 201 });
}

// PUT /api/admin/content/pages - Update a page
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

  const page = await prisma.page.update({
    where: { id },
    data: {
      title: title ?? existing.title,
      slug: slug ?? existing.slug,
      content: content ?? existing.content,
      excerpt: excerpt !== undefined ? excerpt : existing.excerpt,
      metaTitle: metaTitle !== undefined ? metaTitle : existing.metaTitle,
      metaDescription: metaDescription !== undefined ? metaDescription : existing.metaDescription,
      template: template ?? existing.template,
      isPublished: nowPublished,
      publishedAt: !wasPublished && nowPublished ? new Date() : existing.publishedAt,
    },
  });

  return NextResponse.json({ page });
}

// DELETE /api/admin/content/pages - Delete a page
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden - Owner only' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
  }

  await prisma.page.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
