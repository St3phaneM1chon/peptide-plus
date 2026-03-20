export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function DELETE(request: NextRequest) {
  // Token is stateless JWT -- no server-side invalidation needed
  // Log the logout event for audit trail
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    logger.info('[Auth] User logged out');
  }
  return NextResponse.json({ success: true });
}
