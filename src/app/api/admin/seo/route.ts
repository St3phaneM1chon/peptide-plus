export const dynamic = 'force-dynamic';

/**
 * Admin SEO Settings API
 * GET - Get all SEO settings (from SiteSetting where module = 'seo')
 * PUT - Save SEO settings (upsert each key)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

// GET /api/admin/seo - Get all SEO settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.siteSetting.findMany({
      where: { module: 'seo' },
      orderBy: { key: 'asc' },
    });

    // Convert array of key-value records into a flat object for convenience
    const seoMap: Record<string, string> = {};
    for (const setting of settings) {
      seoMap[setting.key] = setting.value;
    }

    return NextResponse.json({ settings, seoMap });
  } catch (error) {
    console.error('Admin SEO GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/seo - Save SEO settings (bulk upsert)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { settings } = body;

    // settings should be an object like:
    // { "seo_site_name": "BioCycle", "seo_site_url": "https://...", ... }
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'settings object is required' },
        { status: 400 }
      );
    }

    const upsertedSettings = [];

    for (const [key, value] of Object.entries(settings)) {
      const upserted = await prisma.siteSetting.upsert({
        where: { key },
        update: {
          value: String(value),
          updatedBy: session.user.id,
        },
        create: {
          key,
          value: String(value),
          type: 'text',
          module: 'seo',
          description: `SEO setting: ${key}`,
          updatedBy: session.user.id,
        },
      });
      upsertedSettings.push(upserted);
    }

    return NextResponse.json({
      success: true,
      settings: upsertedSettings,
      count: upsertedSettings.length,
    });
  } catch (error) {
    console.error('Admin SEO PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
