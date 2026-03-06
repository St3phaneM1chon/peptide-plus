export const dynamic = 'force-dynamic';

/**
 * Dialer Scripts API
 * GET  — List scripts (optionally by company/category)
 * POST — Create a new script
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

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
    const body = await request.json();
    const { companyId, name, content, category } = body;

    if (!companyId || !name || !content) {
      return NextResponse.json(
        { error: 'companyId, name, and content required' },
        { status: 400 }
      );
    }

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
