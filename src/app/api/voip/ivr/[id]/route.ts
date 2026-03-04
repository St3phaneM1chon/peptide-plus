export const dynamic = 'force-dynamic';

/**
 * IVR Menu Detail API
 * GET    — Get single IVR menu
 * PUT    — Update IVR menu
 * DELETE — Deactivate IVR menu
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

  const menu = await prisma.ivrMenu.findUnique({
    where: { id },
    include: {
      options: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!menu) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ data: menu });
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

  const {
    name,
    description,
    greetingText,
    language,
    inputTimeout,
    maxRetries,
    timeoutAction,
    timeoutTarget,
    businessHoursStart,
    businessHoursEnd,
    afterHoursMenuId,
    isActive,
    options,
  } = body;

  // Update menu
  const menu = await prisma.ivrMenu.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(greetingText !== undefined ? { greetingText } : {}),
      ...(language !== undefined ? { language } : {}),
      ...(inputTimeout !== undefined ? { inputTimeout } : {}),
      ...(maxRetries !== undefined ? { maxRetries } : {}),
      ...(timeoutAction !== undefined ? { timeoutAction } : {}),
      ...(timeoutTarget !== undefined ? { timeoutTarget } : {}),
      ...(businessHoursStart !== undefined ? { businessHoursStart } : {}),
      ...(businessHoursEnd !== undefined ? { businessHoursEnd } : {}),
      ...(afterHoursMenuId !== undefined ? { afterHoursMenuId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  // Replace options if provided
  if (options) {
    await prisma.ivrMenuOption.deleteMany({ where: { menuId: id } });
    await prisma.ivrMenuOption.createMany({
      data: options.map((opt: {
        digit: string;
        label: string;
        action: string;
        target: string;
        announcement?: string;
        sortOrder?: number;
      }, idx: number) => ({
        menuId: id,
        digit: opt.digit,
        label: opt.label,
        action: opt.action,
        target: opt.target,
        announcement: opt.announcement,
        sortOrder: opt.sortOrder ?? idx,
      })),
    });
  }

  const updated = await prisma.ivrMenu.findUnique({
    where: { id },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });

  return NextResponse.json({ data: updated });
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

  await prisma.ivrMenu.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ status: 'deactivated' });
}
