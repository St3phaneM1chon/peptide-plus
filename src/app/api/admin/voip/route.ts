export const dynamic = 'force-dynamic';

/**
 * Admin VoIP Overview API
 * GET - Returns high-level VoIP system stats
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const [
      totalCalls,
      totalExtensions,
      activeExtensions,
      totalVoicemails,
      unreadVoicemails,
      totalRecordings,
      totalIvrMenus,
      totalPhoneNumbers,
    ] = await Promise.all([
      prisma.callLog.count(),
      prisma.sipExtension.count(),
      prisma.sipExtension.count({ where: { status: { in: ['ONLINE', 'BUSY'] } } }),
      prisma.voicemail.count(),
      prisma.voicemail.count({ where: { isRead: false } }),
      prisma.callRecording.count(),
      prisma.ivrMenu.count(),
      prisma.phoneNumber.count(),
    ]);

    return NextResponse.json({
      calls: { total: totalCalls },
      extensions: { total: totalExtensions, active: activeExtensions },
      voicemails: { total: totalVoicemails, unread: unreadVoicemails },
      recordings: totalRecordings,
      ivrMenus: totalIvrMenus,
      phoneNumbers: totalPhoneNumbers,
    });
  } catch (error) {
    logger.error('Admin VoIP overview GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
