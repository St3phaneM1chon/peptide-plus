export const dynamic = 'force-dynamic';

/**
 * Brand Kit API
 * GET  - Get active brand kit
 * PUT  - Update brand kit
 * Chantier 4.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getActiveBrandKit, updateBrandKit } from '@/lib/media/brand-kit';
import { brandKitSchema } from '@/lib/validations/media';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const brandKit = await getActiveBrandKit();
    return NextResponse.json({ brandKit });
  } catch (error) {
    logger.error('[BrandKit API] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to load brand kit' }, { status: 500 });
  }
});

export const PUT = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = brandKitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const brandKit = await updateBrandKit(parsed.data);
    return NextResponse.json({ brandKit });
  } catch (error) {
    logger.error('[BrandKit API] PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to update brand kit' }, { status: 500 });
  }
});
