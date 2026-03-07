export const dynamic = 'force-dynamic';

/**
 * Export Prospects as CSV
 * GET /api/admin/crm/lists/[id]/export?status=VALIDATED
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiError } from '@/lib/api-response';

export const GET = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: listId } = await context.params;
  const statusFilter = request.nextUrl.searchParams.get('status') || undefined;

  const list = await prisma.prospectList.findUnique({ where: { id: listId } });
  if (!list) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  const where: Record<string, unknown> = { listId };
  if (statusFilter) where.status = statusFilter;

  const prospects = await prisma.prospect.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  // Build CSV
  const headers = [
    'contactName', 'companyName', 'email', 'phone', 'website',
    'address', 'city', 'province', 'postalCode', 'country',
    'industry', 'googleRating', 'googleReviewCount', 'googleCategory',
    'firstName', 'lastName', 'jobTitle', 'linkedinUrl',
    'companySize', 'enrichmentScore', 'status',
  ];

  const csvRows = [headers.join(',')];
  for (const p of prospects) {
    const row = headers.map((h) => {
      const val = (p as Record<string, unknown>)[h];
      if (val === null || val === undefined) return '';
      let str = String(val);
      // Prevent CSV formula injection (Excel/Sheets)
      if (/^[=+\-@\t]/.test(str)) {
        str = `'${str}`;
      }
      // Escape CSV values
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(row.join(','));
  }

  const csvContent = csvRows.join('\n');
  const fileName = `prospects-${list.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
});
