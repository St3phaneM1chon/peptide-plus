export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { fetchExchangeRates } from '@/lib/crm/exchange-rates';

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    await fetchExchangeRates('CAD');
    logger.info('[crm/exchange-rates/sync] Rates synced successfully');
    return apiSuccess({ synced: true }, { request });
  } catch (error) {
    logger.error('[crm/exchange-rates/sync] Sync error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to sync exchange rates', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.settings' });
