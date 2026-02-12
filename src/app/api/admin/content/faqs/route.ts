import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

// GET /api/admin/content/faqs - List all FAQs
export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const faqs = await prisma.faq.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    include: {
      translations: {
        select: { locale: true },
      },
    },
  });

  return NextResponse.json({ faqs });
}

// POST /api/admin/content/faqs - Create a new FAQ
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

  return NextResponse.json({ faq }, { status: 201 });
}

// PUT /api/admin/content/faqs - Update a FAQ
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

  return NextResponse.json({ faq });
}

// DELETE /api/admin/content/faqs - Delete a FAQ
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden - Owner only' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'FAQ ID is required' }, { status: 400 });
  }

  await prisma.faq.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
