export const dynamic = 'force-dynamic';

/**
 * Voicemail Detail API
 * GET    — Get voicemail details
 * PUT    — Mark as read/archive
 * DELETE — Delete voicemail
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const voicemail = await prisma.voicemail.findUnique({
    where: { id },
    include: {
      extension: {
        select: { extension: true, user: { select: { name: true } } },
      },
      client: {
        select: { id: true, name: true, phone: true },
      },
    },
  });

  if (!voicemail) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ data: voicemail });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { isRead, isArchived } = body;

  const voicemail = await prisma.voicemail.update({
    where: { id },
    data: {
      ...(isRead !== undefined ? { isRead } : {}),
      ...(isArchived !== undefined ? { isArchived } : {}),
    },
  });

  return NextResponse.json({ data: voicemail });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  await prisma.voicemail.delete({ where: { id } });

  return NextResponse.json({ status: 'deleted' });
}
