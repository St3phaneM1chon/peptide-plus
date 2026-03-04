export const dynamic = 'force-dynamic';

/**
 * IVR Menu Management API
 * GET  — List IVR menus
 * POST — Create IVR menu with options
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const companyId = searchParams.get('companyId');

  const menus = await prisma.ivrMenu.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      isActive: true,
    },
    include: {
      options: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: menus });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    companyId,
    name,
    description,
    greetingText,
    language = 'fr-CA',
    inputTimeout = 5,
    maxRetries = 3,
    timeoutAction = 'replay',
    timeoutTarget,
    businessHoursStart,
    businessHoursEnd,
    afterHoursMenuId,
    options = [],
  } = body;

  if (!companyId || !name) {
    return NextResponse.json(
      { error: 'companyId and name are required' },
      { status: 400 }
    );
  }

  const menu = await prisma.ivrMenu.create({
    data: {
      companyId,
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
      options: {
        create: options.map((opt: {
          digit: string;
          label: string;
          action: string;
          target: string;
          announcement?: string;
          sortOrder?: number;
        }, idx: number) => ({
          digit: opt.digit,
          label: opt.label,
          action: opt.action,
          target: opt.target,
          announcement: opt.announcement,
          sortOrder: opt.sortOrder ?? idx,
        })),
      },
    },
    include: {
      options: { orderBy: { sortOrder: 'asc' } },
    },
  });

  return NextResponse.json({ data: menu }, { status: 201 });
}
