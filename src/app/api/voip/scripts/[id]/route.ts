export const dynamic = 'force-dynamic';

/**
 * Single Dialer Script API
 * GET    — Script detail
 * PUT    — Update script
 * DELETE — Soft-delete (deactivate)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

const scriptUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
    const { id } = await params;

    const script = await prisma.dialerScript.findUnique({
      where: { id },
    });

    if (!script) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    return NextResponse.json({ data: script });
  } catch (error) {
    logger.error('[voip/scripts GET] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
    const { id } = await params;
    const raw = await request.json();
    const parsed = scriptUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, content, category, isActive } = parsed.data;

    const script = await prisma.dialerScript.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return NextResponse.json({ data: script });
  } catch (error) {
    logger.error('[voip/scripts PUT] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
    const { id } = await params;

    await prisma.dialerScript.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ status: 'deactivated' });
  } catch (error) {
    logger.error('[voip/scripts DELETE] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
