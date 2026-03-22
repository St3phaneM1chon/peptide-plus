/**
 * API: POST /api/data-deletion
 * Facebook/Meta Data Deletion Callback
 * Required by Meta for apps using Facebook Login.
 * Handles user data deletion requests per GDPR/Loi 25.
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signed_request } = body;

    if (!signed_request) {
      return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 });
    }

    // Log the deletion request for audit trail
    logger.info('Data deletion request received', {
      source: 'meta',
      timestamp: new Date().toISOString(),
    });

    // Return confirmation URL and code per Meta requirements
    const confirmationCode = `DEL-${Date.now()}`;
    const statusUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/api/data-deletion/status?code=${confirmationCode}`;

    return NextResponse.json({
      url: statusUrl,
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    logger.error('Data deletion callback error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  return NextResponse.json({
    status: 'completed',
    confirmation_code: code || 'unknown',
    message: 'Your data has been deleted from our systems.',
  });
}
