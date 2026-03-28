export const dynamic = 'force-dynamic';

/**
 * VoIP Health Check API
 * GET /api/admin/voip/health — Returns health info + auto-register eligibility
 * HEAD /api/admin/voip/health — Quick connectivity check
 *
 * Uses soft auth: returns graceful "unconfigured" defaults when the user is
 * not authenticated or VoIP is not set up, instead of 401/500 errors.
 * This prevents console noise during Playwright testing and normal page loads
 * where the softphone component polls this endpoint.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/** Default response when VoIP health cannot be determined */
const UNCONFIGURED_RESPONSE = {
  status: 'unconfigured',
  timestamp: new Date().toISOString(),
  canAutoRegister: false,
  database: 'unknown',
  sipExtension: { configured: false },
  pbx: { provider: null },
  message: 'VoIP not configured',
};

export async function GET() {
  try {
    // Soft auth — return defaults if not authenticated (non-sensitive health info)
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(UNCONFIGURED_RESPONSE);
    }

    // Check DB connectivity
    const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);

    // Check if user has a SIP extension
    const ext = await prisma.sipExtension.findFirst({
      where: { userId: session.user.id },
      select: { id: true, extension: true, sipDomain: true, status: true, isRegistered: true },
    });

    // Check VoIP connection config
    const connection = await prisma.voipConnection.findFirst({
      where: { isEnabled: true },
      select: { id: true, provider: true, pbxHost: true, syncStatus: true },
    });

    // Determine if auto-register is possible
    const canAutoRegister = dbOk && !!ext && !!connection;

    return NextResponse.json({
      status: canAutoRegister ? 'ok' : 'unconfigured',
      timestamp: new Date().toISOString(),
      canAutoRegister,
      database: dbOk ? 'connected' : 'error',
      sipExtension: ext ? {
        configured: true,
        extensionNumber: ext.extension,
        domain: ext.sipDomain,
        agentStatus: ext.status,
        registered: ext.isRegistered,
      } : { configured: false },
      pbx: connection ? {
        provider: connection.provider,
        host: connection.pbxHost,
        syncStatus: connection.syncStatus,
      } : { provider: null },
      user: {
        id: session.user.id,
        role: (session.user as Record<string, unknown>).role || 'UNKNOWN',
      },
    });
  } catch (error) {
    logger.error('[admin/voip/health] Health check failed', { error: error instanceof Error ? error.message : String(error) });
    // Return graceful defaults instead of 500 to avoid console noise from polling
    return NextResponse.json({
      ...UNCONFIGURED_RESPONSE,
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
