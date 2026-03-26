export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * VOIP-F5 FIX: Debug endpoint removed (was exposing API key prefix + connection ID).
 * Original comment said "DELETE THIS after debugging is complete."
 */
export async function GET() {
  return NextResponse.json({ error: 'This endpoint has been disabled' }, { status: 404 });
}
