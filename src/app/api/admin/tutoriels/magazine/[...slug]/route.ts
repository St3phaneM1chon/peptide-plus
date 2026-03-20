export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { auth } from '@/lib/auth-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  // Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const slugPath = slug.join('/');
  // Sanitize
  const safe = slugPath.replace(/\.\./g, '').replace(/[^a-zA-Z0-9_\-\/\.]/g, '');
  const filePath = path.join(process.cwd(), 'docs', 'user-guide', 'magazine', `${safe}.html`);

  try {
    const content = await readFile(filePath, 'utf-8');
    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
