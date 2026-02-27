export const dynamic = 'force-dynamic';

/**
 * Popular Search Queries
 * GET /api/search/popular
 *
 * Returns popular/fallback search terms for the search modal.
 */

import { NextResponse } from 'next/server';

// Static popular searches — sufficient for now, can be replaced with analytics-driven data later
const POPULAR_QUERIES = [
  { query: 'BPC-157' },
  { query: 'TB-500' },
  { query: 'GHK-Cu' },
  { query: 'Semaglutide' },
  { query: 'NAD+' },
  { query: 'Peptides' },
];

export async function GET() {
  return NextResponse.json(
    { queries: POPULAR_QUERIES },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } },
  );
}
