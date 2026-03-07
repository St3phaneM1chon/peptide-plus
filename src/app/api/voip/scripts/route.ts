export const dynamic = 'force-dynamic';

/**
 * Dialer Scripts API
 * GET  — List scripts (optionally by company/category)
 * POST — Create a new script
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

const scriptCreateSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  name: z.string().min(1, 'name is required'),
  content: z.string().min(1, 'content is required'),
  category: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const companyId = searchParams.get('companyId');
    const category = searchParams.get('category');

    const scripts = await prisma.dialerScript.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(category ? { category } : {}),
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ data: scripts });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = scriptCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { companyId, name, content, category } = parsed.data;

    const script = await prisma.dialerScript.create({
      data: {
        companyId,
        name,
        content,
        category: category || 'general',
      },
    });

    return NextResponse.json({ data: script }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
