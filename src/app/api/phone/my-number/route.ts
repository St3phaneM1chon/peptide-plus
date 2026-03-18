export const dynamic = 'force-dynamic';

/**
 * Mobile Phone My-Number API
 * GET /api/phone/my-number — Get the Telnyx phone number and extension
 */

import { NextResponse } from 'next/server';
import { withMobileGuard } from '@/lib/mobile-guard';

const DEFAULT_CALLER_ID = process.env.TELNYX_DEFAULT_CALLER_ID || '+14388030370';

export const GET = withMobileGuard(async () => {
  return NextResponse.json({
    number: DEFAULT_CALLER_ID,
    extensionNumber: null,
  });
});
