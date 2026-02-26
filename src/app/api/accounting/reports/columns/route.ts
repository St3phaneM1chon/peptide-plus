export const dynamic = 'force-dynamic';

import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-handler';
import {
  getAvailableColumns,
  getAvailableFilters,
  BUILT_IN_TEMPLATES,
} from '@/lib/accounting/report-engine.service';

// ---------------------------------------------------------------------------
// GET /api/accounting/reports/columns
// Available columns, filters, and templates for a report type.
// Query: ?type=INCOME_STATEMENT
// ---------------------------------------------------------------------------

const VALID_TYPES = [
  'INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW', 'AR_AGING', 'AP_AGING',
  'TAX_SUMMARY', 'JOURNAL_DETAIL', 'TRIAL_BALANCE', 'CUSTOM',
];

export const GET = withAdminGuard(async (request) => {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (!type || !VALID_TYPES.includes(type)) {
    return apiError(
      `Invalid or missing type. Valid types: ${VALID_TYPES.join(', ')}`,
      400,
    );
  }

  const columns = getAvailableColumns(type);
  const filters = getAvailableFilters(type);
  const templates = BUILT_IN_TEMPLATES.filter((t) => t.type === type);

  return apiSuccess({ type, columns, filters, templates });
});
