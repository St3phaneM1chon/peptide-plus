export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import {
  generateAgingReport,
  getCollectionPriority,
  getAgingSummaryStats,
  exportAgingToCSV,
} from '@/lib/accounting';

/**
 * GET /api/accounting/aging
 * Get aging report from real invoice data
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'RECEIVABLE') as 'RECEIVABLE' | 'PAYABLE';
    const format = searchParams.get('format') || 'json';

    // Fetch real invoices based on type
    let invoices: Array<{
      id: string;
      invoiceNumber: string;
      type: 'RECEIVABLE' | 'PAYABLE';
      customerOrVendor: string;
      email?: string;
      invoiceDate: Date;
      dueDate: Date;
      amount: number;
      amountPaid: number;
      balance: number;
      status: string;
    }> = [];

    if (type === 'RECEIVABLE') {
      const customerInvoices = await prisma.customerInvoice.findMany({
        where: { status: { not: 'CANCELLED' }, deletedAt: null, balance: { gt: 0 } },
        orderBy: { dueDate: 'asc' },
      });
      invoices = customerInvoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        type: 'RECEIVABLE' as const,
        customerOrVendor: i.customerName,
        email: i.customerEmail ?? undefined,
        invoiceDate: i.invoiceDate,
        dueDate: i.dueDate,
        amount: Number(i.total),
        amountPaid: Number(i.amountPaid),
        balance: Number(i.balance),
        status: i.status,
      }));
    } else {
      const supplierInvoices = await prisma.supplierInvoice.findMany({
        where: { status: { not: 'CANCELLED' }, deletedAt: null, balance: { gt: 0 } },
        orderBy: { dueDate: 'asc' },
      });
      invoices = supplierInvoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        type: 'PAYABLE' as const,
        customerOrVendor: i.supplierName,
        email: i.supplierEmail ?? undefined,
        invoiceDate: i.invoiceDate,
        dueDate: i.dueDate,
        amount: Number(i.total),
        amountPaid: Number(i.amountPaid),
        balance: Number(i.balance),
        status: i.status,
      }));
    }

    // Generate report using existing lib functions
    const report = generateAgingReport(invoices, type);
    const stats = getAgingSummaryStats(report);
    const priority = type === 'RECEIVABLE'
      ? getCollectionPriority(report)
      : null;

    // Return CSV if requested
    if (format === 'csv') {
      const csv = exportAgingToCSV(report);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="aging-${type.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      report,
      stats,
      priority,
    });
  } catch (error) {
    console.error('Get aging report error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du rapport d\'aging' },
      { status: 500 }
    );
  }
});
