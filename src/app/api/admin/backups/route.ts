import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getBackupStatus } from '@/lib/backup-storage';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const status = await getBackupStatus();
    return NextResponse.json(status);
  } catch (error) {
    logger.error('[Admin Backups] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch backup status' }, { status: 500 });
  }
}, { requiredPermission: 'admin.backups' });
