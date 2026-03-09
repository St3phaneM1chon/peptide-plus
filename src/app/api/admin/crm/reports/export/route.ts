export const dynamic = 'force-dynamic';

/**
 * CRM Report Export API
 * GET: Export CRM data as CSV
 */

import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { csvResponse } from '@/lib/crm/export-utils';

export const GET = withAdminGuard(async (request) => {
  const url = new URL(request.url);
  const reportType = url.searchParams.get('type'); // leads, deals, calls, campaigns, agents
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  const dateFilter = {
    ...(startDate ? { gte: new Date(startDate) } : {}),
    ...(endDate ? { lte: new Date(endDate) } : {}),
  };
  const hasDateFilter = startDate || endDate;

  switch (reportType) {
    case 'leads': {
      const leads = await prisma.crmLead.findMany({
        where: hasDateFilter ? { createdAt: dateFilter } : undefined,
        include: { assignedTo: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });

      return csvResponse(
        leads.map(l => ({
          id: l.id,
          contactName: l.contactName,
          companyName: l.companyName || '',
          email: l.email || '',
          phone: l.phone || '',
          source: l.source,
          status: l.status,
          score: l.score,
          temperature: l.temperature,
          assignedTo: l.assignedTo?.name || '',
          dncStatus: l.dncStatus,
          tags: l.tags.join(';'),
          createdAt: l.createdAt.toISOString(),
          lastContactedAt: l.lastContactedAt?.toISOString() || '',
        })),
        `crm-leads-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          { key: 'id', label: 'ID' },
          { key: 'contactName', label: 'Contact Name' },
          { key: 'companyName', label: 'Company' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'source', label: 'Source' },
          { key: 'status', label: 'Status' },
          { key: 'score', label: 'Score' },
          { key: 'temperature', label: 'Temperature' },
          { key: 'assignedTo', label: 'Assigned To' },
          { key: 'dncStatus', label: 'DNC Status' },
          { key: 'tags', label: 'Tags' },
          { key: 'createdAt', label: 'Created At' },
          { key: 'lastContactedAt', label: 'Last Contacted' },
        ],
      );
    }

    case 'deals': {
      const deals = await prisma.crmDeal.findMany({
        where: hasDateFilter ? { createdAt: dateFilter } : undefined,
        include: {
          stage: { select: { name: true, probability: true } },
          pipeline: { select: { name: true } },
          assignedTo: { select: { name: true } },
          lead: { select: { contactName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });

      return csvResponse(
        deals.map(d => ({
          id: d.id,
          title: d.title,
          value: Number(d.value),
          currency: d.currency,
          pipeline: d.pipeline.name,
          stage: d.stage.name,
          probability: d.stage.probability,
          weightedValue: Number(d.value) * d.stage.probability,
          assignedTo: d.assignedTo.name || '',
          lead: d.lead?.contactName || '',
          expectedCloseDate: d.expectedCloseDate?.toISOString() || '',
          actualCloseDate: d.actualCloseDate?.toISOString() || '',
          createdAt: d.createdAt.toISOString(),
        })),
        `crm-deals-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          { key: 'id', label: 'ID' },
          { key: 'title', label: 'Title' },
          { key: 'value', label: 'Value' },
          { key: 'currency', label: 'Currency' },
          { key: 'pipeline', label: 'Pipeline' },
          { key: 'stage', label: 'Stage' },
          { key: 'probability', label: 'Probability' },
          { key: 'weightedValue', label: 'Weighted Value' },
          { key: 'assignedTo', label: 'Assigned To' },
          { key: 'lead', label: 'Lead' },
          { key: 'expectedCloseDate', label: 'Expected Close' },
          { key: 'actualCloseDate', label: 'Actual Close' },
          { key: 'createdAt', label: 'Created At' },
        ],
      );
    }

    case 'calls': {
      const calls = await prisma.callLog.findMany({
        where: hasDateFilter ? { startedAt: dateFilter } : undefined,
        include: {
          agent: { select: { user: { select: { name: true } } } },
        },
        orderBy: { startedAt: 'desc' },
        take: 10000,
      });

      return csvResponse(
        calls.map(c => ({
          id: c.id,
          callerNumber: c.callerNumber,
          calledNumber: c.calledNumber,
          direction: c.direction,
          status: c.status,
          duration: c.duration || 0,
          agent: c.agent?.user?.name || '',
          disposition: c.disposition || '',
          startedAt: c.startedAt.toISOString(),
          endedAt: c.endedAt?.toISOString() || '',
        })),
        `crm-calls-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          { key: 'id', label: 'ID' },
          { key: 'callerNumber', label: 'Caller' },
          { key: 'calledNumber', label: 'Called' },
          { key: 'direction', label: 'Direction' },
          { key: 'status', label: 'Status' },
          { key: 'duration', label: 'Duration (s)' },
          { key: 'agent', label: 'Agent' },
          { key: 'disposition', label: 'Disposition' },
          { key: 'startedAt', label: 'Started' },
          { key: 'endedAt', label: 'Ended' },
        ],
      );
    }

    case 'agents': {
      const stats = await prisma.agentDailyStats.findMany({
        where: hasDateFilter ? { date: dateFilter } : undefined,
        include: { agent: { select: { name: true, email: true } } },
        orderBy: [{ date: 'desc' }, { agentId: 'asc' }],
        take: 10000,
      });

      return csvResponse(
        stats.map(s => ({
          date: s.date.toISOString().slice(0, 10),
          agent: s.agent.name || '',
          email: s.agent.email,
          callsMade: s.callsMade,
          callsReceived: s.callsReceived,
          callsAnswered: s.callsAnswered,
          totalTalkTime: s.totalTalkTime,
          avgHandleTime: s.avgHandleTime,
          conversions: s.conversions,
          revenue: Number(s.revenue),
        })),
        `crm-agent-stats-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          { key: 'date', label: 'Date' },
          { key: 'agent', label: 'Agent' },
          { key: 'email', label: 'Email' },
          { key: 'callsMade', label: 'Calls Made' },
          { key: 'callsReceived', label: 'Calls Received' },
          { key: 'callsAnswered', label: 'Calls Answered' },
          { key: 'totalTalkTime', label: 'Talk Time (s)' },
          { key: 'avgHandleTime', label: 'AHT (s)' },
          { key: 'conversions', label: 'Conversions' },
          { key: 'revenue', label: 'Revenue' },
        ],
      );
    }

    default:
      return apiError('Invalid report type. Use: leads, deals, calls, agents', 'VALIDATION_ERROR', { status: 400 });
  }
}, { requiredPermission: 'crm.reports.view' });
