export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

// H5/I-CRM-5: Customer Notes API

// GET: List notes for a customer
export const GET = withAdminGuard(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const notes = await prisma.customerNote.findMany({
    where: { userId: id },
    include: { author: { select: { name: true, image: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(notes);
});

// POST: Create a new note for a customer
export const POST = withAdminGuard(async (
  request: NextRequest,
  { params, session }: { params: Promise<{ id: string }>; session: { user: { id: string } } }
) => {
  const { id } = await params;
  const { content } = await request.json();

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  const note = await prisma.customerNote.create({
    data: {
      userId: id,
      authorId: session.user.id,
      content,
    },
    include: { author: { select: { name: true, image: true } } },
  });

  return NextResponse.json(note, { status: 201 });
});
