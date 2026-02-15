export const dynamic = 'force-dynamic';

/**
 * CSRF Token API
 * GET - Issue a new CSRF token (set as cookie + return in body)
 */

import { NextResponse } from 'next/server';
import { setCSRFCookie } from '@/lib/csrf';

export async function GET() {
  try {
    const token = await setCSRFCookie();

    return NextResponse.json({ token });
  } catch (error) {
    console.error('CSRF token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
