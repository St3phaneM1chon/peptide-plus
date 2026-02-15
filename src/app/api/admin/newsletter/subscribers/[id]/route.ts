export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/admin/newsletter/subscribers/[id]
 * Update a subscriber (toggle isActive, change locale, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Subscriber not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
      if (!body.isActive) {
        updateData.unsubscribedAt = new Date();
      } else {
        updateData.unsubscribedAt = null;
      }
    }

    if (body.name !== undefined) updateData.name = body.name;
    if (body.locale !== undefined) updateData.locale = body.locale;
    if (body.source !== undefined) updateData.source = body.source;

    const subscriber = await prisma.newsletterSubscriber.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, subscriber });
  } catch (error) {
    console.error('Update newsletter subscriber error:', error);
    return NextResponse.json(
      { error: 'Error updating subscriber' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/newsletter/subscribers/[id]
 * Remove a subscriber permanently
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Subscriber not found' },
        { status: 404 }
      );
    }

    await prisma.newsletterSubscriber.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete newsletter subscriber error:', error);
    return NextResponse.json(
      { error: 'Error deleting subscriber' },
      { status: 500 }
    );
  }
}
