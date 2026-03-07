export const dynamic = 'force-dynamic';

/**
 * VoIP Health Check API
 * GET /api/admin/voip/health — Returns health info + auto-register eligibility
 * HEAD /api/admin/voip/health — Quick connectivity check
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

export const GET = withAdminGuard(async (_request: NextRequest, { session }) => {
  try {
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
      status: 'ok',
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
    return NextResponse.json({
      status: 'error',
      canAutoRegister: false,
      error: error instanceof Error ? error.message : 'Health check failed',
    }, { status: 500 });
  }
});

export const HEAD = withAdminGuard(async () => {
  return new NextResponse(null, { status: 200 });
});
