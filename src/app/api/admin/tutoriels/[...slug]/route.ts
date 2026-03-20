import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const slugPath = slug.join('/');

  // Sanitize: only allow alphanumeric, hyphens, and slashes
  if (!/^[\w\-/]+$/.test(slugPath)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'docs', 'user-guide', `${slugPath}.md`);

  try {
    const content = await readFile(filePath, 'utf-8');
    return NextResponse.json({ content, slug: slugPath });
  } catch {
    return NextResponse.json(
      { error: 'Guide not found', slug: slugPath },
      { status: 404 }
    );
  }
}
