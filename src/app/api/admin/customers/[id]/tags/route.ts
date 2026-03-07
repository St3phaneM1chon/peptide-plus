export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

// H4/I-CRM-4: Customer Tags API

// GET: Get tags for a customer
export const GET = withAdminGuard(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { tags: true },
  });
  return NextResponse.json({ tags: user?.tags ?? [] });
});

// PUT: Update tags for a customer
export const PUT = withAdminGuard(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const { tags } = await request.json();

  if (!Array.isArray(tags) || !tags.every((t: unknown) => typeof t === 'string')) {
    return NextResponse.json({ error: 'Tags must be an array of strings' }, { status: 400 });
  }

  // Normalize tags: lowercase, trim, dedupe
  const normalizedTags = [...new Set(tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean))];

  const user = await prisma.user.update({
    where: { id },
    data: { tags: normalizedTags },
    select: { id: true, tags: true },
  });

  return NextResponse.json({ tags: user.tags });
});
