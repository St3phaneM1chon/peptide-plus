export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import {
  getAuditHistory,
  generateAuditReport,
  exportAuditToCSV,
  type EntityType,
  type AuditAction,
} from '@/lib/accounting';

/**
 * GET /api/accounting/audit-trail
 * Query audit trail entries with filtering.
 *
 * Query params:
 *   entityType: EntityType (e.g. JOURNAL_ENTRY, TAX_REPORT)
 *   entityId: string (optional, filter to a specific entity)
 *   startDate: ISO date string (optional)
 *   endDate: ISO date string (optional)
 *   action: AuditAction (optional filter)
 *   userId: string (optional filter)
 *   limit: number (default 100)
 *   format: 'json' | 'csv' (default json)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType') as EntityType | null;
    const entityId = searchParams.get('entityId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const action = searchParams.get('action') as AuditAction | null;
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const format = searchParams.get('format') || 'json';

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    // If requesting history for a specific entity
    if (entityType && entityId) {
      const entries = await getAuditHistory(entityType, entityId, {
        limit,
        startDate,
        endDate,
      });

      if (format === 'csv') {
        const csv = exportAuditToCSV(entries);
        const bom = '\uFEFF';
        return new NextResponse(bom + csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="audit-${entityType}-${entityId}.csv"`,
          },
        });
      }

      return NextResponse.json({
        entries,
        total: entries.length,
      });
    }

    // Full audit report for a period
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate et endDate sont requis pour un rapport complet, ou spécifiez entityType + entityId pour un historique spécifique' },
        { status: 400 }
      );
    }

    const report = await generateAuditReport(startDate, endDate, {
      entityTypes: entityType ? [entityType] : undefined,
      actions: action ? [action] : undefined,
      userIds: userId ? [userId] : undefined,
    });

    if (format === 'csv') {
      const csv = exportAuditToCSV(report.entries);
      const bom = '\uFEFF';
      const dateStr = new Date().toISOString().split('T')[0];
      return new NextResponse(bom + csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="piste-audit-${dateStr}.csv"`,
        },
      });
    }

    return NextResponse.json({
      summary: report.summary,
      entries: report.entries,
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Audit trail error:', error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la piste d'audit" },
      { status: 500 }
    );
  }
}
