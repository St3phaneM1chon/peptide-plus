export const dynamic = 'force-dynamic';

/**
 * Stock Photo Search API
 * GET /api/admin/page-builder/photos?q=QUERY&page=1
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { searchStockPhotos, getTrendingPhotos } from '@/lib/puck/stock-photos';

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1', 10);

  const photos = query
    ? await searchStockPhotos(query, page, 20)
    : await getTrendingPhotos(20);

  return NextResponse.json({ photos, query: query || 'trending', page });
});
