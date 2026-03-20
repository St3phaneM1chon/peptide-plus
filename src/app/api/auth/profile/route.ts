export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withMobileGuard } from '@/lib/mobile-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const GET = withMobileGuard(async (request, { session }) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, role: true, image: true, phone: true, locale: true, mfaEnabled: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    logger.error('[auth/profile] GET failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
});

export const PUT = withMobileGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = z.object({
      name: z.string().min(1).max(100).optional(),
      phone: z.string().max(20).optional(),
    }).safeParse(body);

    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: parsed.data,
      select: { id: true, email: true, name: true, role: true, image: true, phone: true, locale: true, mfaEnabled: true },
    });
    return NextResponse.json(user);
  } catch (error) {
    logger.error('[auth/profile] PUT failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
});
