export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  advancedSearch,
  getSearchSuggestions,
  getFilterOptions,
  getPopularSearchTerms,
} from '@/lib/accounting/search.service';

/**
 * GET /api/accounting/search
 * Perform advanced search across accounting entities
 * Query params:
 *   - q (string) - search text
 *   - types (comma-separated) - entity types: ENTRY,INVOICE,SUPPLIER,TRANSACTION
 *   - dateFrom / dateTo (ISO date)
 *   - amountMin / amountMax (number)
 *   - statuses (comma-separated)
 *   - sortBy (date|amount|relevance)
 *   - sortOrder (asc|desc)
 *   - page / limit
 *   - action (suggest|filters|popular) - special sub-actions
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Sub-actions
    if (action === 'suggest') {
      const partial = searchParams.get('q') || '';
      const suggestions = await getSearchSuggestions(partial);
      return NextResponse.json({ suggestions });
    }

    if (action === 'filters') {
      const options = await getFilterOptions();
      return NextResponse.json({ filters: options });
    }

    if (action === 'popular') {
      const terms = getPopularSearchTerms();
      return NextResponse.json({ terms });
    }

    // Main search
    const query = searchParams.get('q') || undefined;
    const types = searchParams.get('types')?.split(',') as
      | ('ENTRY' | 'INVOICE' | 'SUPPLIER' | 'CUSTOMER' | 'TRANSACTION')[]
      | undefined;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const amountMin = searchParams.get('amountMin');
    const amountMax = searchParams.get('amountMax');
    const statuses = searchParams.get('statuses')?.split(',');
    const sortBy = (searchParams.get('sortBy') || 'date') as 'date' | 'amount' | 'relevance';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const results = await advancedSearch({
      query,
      entityTypes: types,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      amountMin: amountMin ? parseFloat(amountMin) : undefined,
      amountMax: amountMax ? parseFloat(amountMax) : undefined,
      statuses,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('Erreur lors de la recherche comptable:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la recherche comptable' },
      { status: 500 }
    );
  }
});
