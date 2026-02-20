export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/chart-of-accounts/gifi-export
 * Export all accounts with their GIFI mappings as CSV.
 * Includes BOM for Excel UTF-8 compatibility.
 */
export const GET = withAdminGuard(async (_request, { session }) => {
  try {
    const accounts = await prisma.chartOfAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    // CSV header row
    const headers = [
      'Account Code',
      'Account Name',
      'Account Type',
      'GIFI Code',
      'GIFI Name',
      'CCA Class',
      'CCA Rate (%)',
      'Deductible (%)',
      'Is Contra',
    ];

    // Escape a CSV field: wrap in quotes if it contains comma, quote, or newline
    const escapeField = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = accounts.map((a) =>
      [
        escapeField(a.code),
        escapeField(a.name),
        escapeField(a.type),
        escapeField(a.gifiCode),
        escapeField(a.gifiName),
        escapeField(a.ccaClass),
        escapeField(a.ccaRate),
        escapeField(a.deductiblePercent),
        escapeField(a.isContra ? 'Yes' : 'No'),
      ].join(',')
    );

    // BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows].join('\n');

    const date = new Date().toISOString().split('T')[0];
    const filename = `gifi-mapping-${date}.csv`;

    // Audit log
    console.info('AUDIT: GIFI export', {
      exportedBy: session.user.id || session.user.email,
      exportedAt: new Date().toISOString(),
      accountCount: accounts.length,
    });

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('GIFI export error:', error);
    return NextResponse.json(
      { error: 'Error exporting GIFI mappings' },
      { status: 500 }
    );
  }
});
