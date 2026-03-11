'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { BarChart3, Download, Filter, Table } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Entity = 'leads' | 'deals' | 'calls' | 'agents';

interface ReportRow {
  [key: string]: string | number | null;
}

// ---------------------------------------------------------------------------
// Entity config
// ---------------------------------------------------------------------------

const ENTITY_CONFIG: Record<Entity, { label: string; metrics: string[] }> = {
  leads: {
    label: 'Leads',
    metrics: ['contactName', 'companyName', 'email', 'source', 'status', 'score', 'temperature', 'tags', 'createdAt'],
  },
  deals: {
    label: 'Deals',
    metrics: ['title', 'value', 'currency', 'pipeline', 'stage', 'probability', 'weightedValue', 'assignedTo', 'createdAt'],
  },
  calls: {
    label: 'Calls',
    metrics: ['callerNumber', 'calledNumber', 'direction', 'status', 'duration', 'agent', 'disposition', 'startedAt'],
  },
  agents: {
    label: 'Agents',
    metrics: ['date', 'agent', 'callsMade', 'callsReceived', 'callsAnswered', 'totalTalkTime', 'conversions', 'revenue'],
  },
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ReportBuilderPage() {
  const { t } = useI18n();
  const [entity, setEntity] = useState<Entity>('leads');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set(ENTITY_CONFIG.leads.metrics));
  const [results, setResults] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const handleEntityChange = (newEntity: Entity) => {
    setEntity(newEntity);
    setSelectedMetrics(new Set(ENTITY_CONFIG[newEntity].metrics));
    setResults([]);
    setHasRun(false);
  };

  const toggleMetric = (metric: string) => {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(metric)) {
        next.delete(metric);
      } else {
        next.add(metric);
      }
      return next;
    });
  };

  const runReport = async () => {
    setLoading(true);
    setHasRun(true);
    try {
      const params = new URLSearchParams({ type: entity });
      if (dateFrom) params.set('startDate', dateFrom);
      if (dateTo) params.set('endDate', dateTo);

      const res = await fetch(`/api/admin/crm/reports/export?${params}`);

      if (!res.ok) {
        throw new Error('Failed to fetch report data');
      }

      // The export endpoint returns CSV, so we parse it
      const csvText = await res.text();
      const lines = csvText.split('\n').filter((line) => line.trim());
      if (lines.length === 0) {
        setResults([]);
        return;
      }

      // Parse CSV header and rows
      const headers = parseCSVLine(lines[0]);
      const rows: ReportRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: ReportRow = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        rows.push(row);
      }

      setResults(rows);
      toast.success(
        (t('admin.crm.reports.resultsLoaded') || 'Report loaded') +
        ` - ${rows.length} ${t('admin.crm.reports.rows') || 'rows'}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run report');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams({ type: entity });
      if (dateFrom) params.set('startDate', dateFrom);
      if (dateTo) params.set('endDate', dateTo);

      const res = await fetch(`/api/admin/crm/reports/export?${params}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm-${entity}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('admin.crm.reports.exported') || 'CSV exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  // Get visible columns based on selected metrics
  const visibleColumns = results.length > 0
    ? Object.keys(results[0]).filter((key) => selectedMetrics.has(key) || key === 'id' || key === 'ID')
    : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-indigo-600" />
          {t('admin.crm.reports.builderTitle') || 'Custom Report Builder'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('admin.crm.reports.builderSubtitle') || 'Build and export custom CRM reports'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel: Filters */}
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4" />
              {t('admin.crm.reports.filters') || 'Report Filters'}
            </h2>

            {/* Entity selector */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.reports.entity') || 'Entity'}
              </label>
              <select
                value={entity}
                onChange={(e) => handleEntityChange(e.target.value as Entity)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {(Object.entries(ENTITY_CONFIG) as [Entity, typeof ENTITY_CONFIG[Entity]][]).map(([key, conf]) => (
                  <option key={key} value={key}>{conf.label}</option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.reports.dateFrom') || 'From'}
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.reports.dateTo') || 'To'}
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Metric checkboxes */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                {t('admin.crm.reports.columns') || 'Columns'}
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {ENTITY_CONFIG[entity].metrics.map((metric) => (
                  <label key={metric} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMetrics.has(metric)}
                      onChange={() => toggleMetric(metric)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-700">{metric}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={runReport}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Table className="h-4 w-4" />
                {loading
                  ? (t('admin.crm.reports.running') || 'Running...')
                  : (t('admin.crm.reports.runReport') || 'Run Report')}
              </button>
              <button
                onClick={exportCSV}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {t('admin.crm.reports.exportCSV') || 'Export CSV'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="lg:col-span-3">
          {!hasRun ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <BarChart3 className="h-16 w-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">
                {t('admin.crm.reports.noReportYet') || 'No report generated yet'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {t('admin.crm.reports.selectAndRun') || 'Select an entity and click "Run Report" to see results'}
              </p>
            </div>
          ) : loading ? (
            <div className="bg-white border border-gray-200 rounded-xl flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          ) : results.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Table className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {t('admin.crm.reports.noResults') || 'No results found'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {t('admin.crm.reports.adjustFilters') || 'Try adjusting your date range or filters'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {results.length} {t('admin.crm.reports.rows') || 'rows'} |{' '}
                  {visibleColumns.length} {t('admin.crm.reports.columns') || 'columns'}
                </p>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('admin.crm.reports.exportCSV') || 'Export CSV'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {visibleColumns.map((col) => (
                        <th
                          key={col}
                          className="text-start px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.slice(0, 100).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {visibleColumns.map((col) => (
                          <td key={col} className="px-4 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {results.length > 100 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-center text-xs text-gray-500">
                  {t('admin.crm.reports.showingFirst') || 'Showing first 100 of'} {results.length} {t('admin.crm.reports.rows') || 'rows'}.{' '}
                  {t('admin.crm.reports.exportForAll') || 'Export CSV for all data.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV parsing utility
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}
