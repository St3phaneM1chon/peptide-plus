export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { enqueue } from '@/lib/translation';

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
export const POST = withAdminGuard(async (request, { session }) => {
  const body = await request.json();
  const { question, answer, category, sortOrder, isPublished } = body;

  if (!question || !answer) {
    return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 });
  }

  const faq = await prisma.faq.create({
    data: {
      question,
      answer,
      category: category || 'general',
      sortOrder: sortOrder ?? 0,
      isPublished: isPublished ?? true,
    },
  });

  // Auto-enqueue translation for all 21 locales
  enqueue.faq(faq.id);

  return NextResponse.json({ faq }, { status: 201 });
});

// PUT /api/admin/content/faqs - Update a FAQ
export const PUT = withAdminGuard(async (request, { session }) => {
  const body = await request.json();
  const { id, question, answer, category, sortOrder, isPublished } = body;

  if (!id) {
    return NextResponse.json({ error: 'FAQ ID is required' }, { status: 400 });
  }

  const faq = await prisma.faq.update({
    where: { id },
    data: {
      ...(question !== undefined && { question }),
      ...(answer !== undefined && { answer }),
      ...(category !== undefined && { category }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isPublished !== undefined && { isPublished }),
    },
  });

  // Auto-enqueue translation (force re-translate on update)
  enqueue.faq(faq.id, true);

  return NextResponse.json({ faq });
});

// DELETE /api/admin/content/faqs - Delete a FAQ
export const DELETE = withAdminGuard(async (request, { session }) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'FAQ ID is required' }, { status: 400 });
  }

  await prisma.faq.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
