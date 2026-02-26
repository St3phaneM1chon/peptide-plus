'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Play,
  Download,
  Trash2,
  Pencil,
  Copy,
  Settings2,
  ChevronDown,
  ChevronUp,
  LayoutTemplate,
  Table2,
  Loader2,
  X,
  ArrowUpDown,
  GripVertical,
  Eye,
  EyeOff,
  Calendar,
} from 'lucide-react';
import { PageHeader, Button, SectionCard, Modal } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'currency';
  sortable: boolean;
  defaultVisible: boolean;
}

interface FilterDef {
  field: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'select';
  options?: { label: string; value: string }[];
}

interface ReportFilter {
  field: string;
  operator: string;
  value: string | number;
}

interface ReportConfig {
  type: string;
  dateFrom?: string;
  dateTo?: string;
  columns: string[];
  filters: ReportFilter[];
  groupBy?: string[];
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  compareWith?: string;
  showTotals?: boolean;
  showPercentages?: boolean;
}

interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  type: string;
  config: ReportConfig;
  isTemplate: boolean;
  isPublic: boolean;
  createdBy: string | null;
  schedule: string | null;
  recipients: string[] | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReportResult {
  columns: ColumnDef[];
  rows: Record<string, string | number | null | undefined>[];
  totals?: Record<string, number>;
  percentages?: Record<string, number>;
  metadata: {
    type: string;
    dateFrom?: string;
    dateTo?: string;
    generatedAt: string;
    rowCount: number;
    executionTimeMs: number;
  };
  comparison?: {
    label: string;
    rows: Record<string, string | number | null | undefined>[];
    totals?: Record<string, number>;
  };
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  config: ReportConfig;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPORT_TYPES = [
  { value: 'INCOME_STATEMENT', label: 'Income Statement' },
  { value: 'BALANCE_SHEET', label: 'Balance Sheet' },
  { value: 'CASH_FLOW', label: 'Cash Flow' },
  { value: 'AR_AGING', label: 'AR Aging' },
  { value: 'AP_AGING', label: 'AP Aging' },
  { value: 'TAX_SUMMARY', label: 'Tax Summary' },
  { value: 'JOURNAL_DETAIL', label: 'Journal Detail' },
  { value: 'TRIAL_BALANCE', label: 'Trial Balance' },
  { value: 'CUSTOM', label: 'Custom' },
];

const OPERATOR_LABELS: Record<string, string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  contains: 'contains',
  in: 'in',
};

const theme = sectionThemes.reports;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RapportsPersonnalisesPage() {
  const { t, formatCurrency } = useI18n();

  // Tabs
  const [activeTab, setActiveTab] = useState<'saved' | 'builder' | 'templates'>('saved');

  // Saved reports state
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  // Builder state
  const [builderType, setBuilderType] = useState('INCOME_STATEMENT');
  const [builderName, setBuilderName] = useState('');
  const [builderDescription, setBuilderDescription] = useState('');
  const [builderDateFrom, setBuilderDateFrom] = useState('');
  const [builderDateTo, setBuilderDateTo] = useState('');
  const [availableColumns, setAvailableColumns] = useState<ColumnDef[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [availableFilters, setAvailableFilters] = useState<FilterDef[]>([]);
  const [activeFilters, setActiveFilters] = useState<ReportFilter[]>([]);
  const [groupByFields, setGroupByFields] = useState<string[]>([]);
  const [orderByFields, setOrderByFields] = useState<{ field: string; direction: 'asc' | 'desc' }[]>([]);
  const [compareWith, setCompareWith] = useState<string>('');
  const [showTotals, setShowTotals] = useState(true);
  const [showPercentages, setShowPercentages] = useState(false);
  const [isTemplate, setIsTemplate] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);

  // Results state
  const [result, setResult] = useState<ReportResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Running/saving state
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Save modal
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Column config expanded
  const [showColumnConfig, setShowColumnConfig] = useState(true);
  const [showFilterConfig, setShowFilterConfig] = useState(true);

  // ---------------------------------------------------------------------------
  // Fetch saved reports
  // ---------------------------------------------------------------------------

  const fetchSavedReports = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const res = await fetch('/api/accounting/reports/custom');
      if (!res.ok) throw new Error('Failed to fetch reports');
      const data = await res.json();
      setSavedReports(data.reports || []);
    } catch (err) {
      toast.error(t('admin.customReports.errorLoadReports'));
    } finally {
      setLoadingSaved(false);
    }
  }, [t]);

  // ---------------------------------------------------------------------------
  // Fetch columns/filters for selected type
  // ---------------------------------------------------------------------------

  const fetchColumnsAndFilters = useCallback(async (type: string) => {
    try {
      const res = await fetch(`/api/accounting/reports/columns?type=${type}`);
      if (!res.ok) throw new Error('Failed to fetch columns');
      const data = await res.json();
      setAvailableColumns(data.columns || []);
      setAvailableFilters(data.filters || []);
      setTemplates(data.templates || []);
      // Default: select all default visible columns
      const defaultCols = (data.columns || [])
        .filter((c: ColumnDef) => c.defaultVisible)
        .map((c: ColumnDef) => c.key);
      setSelectedColumns(defaultCols);
    } catch {
      toast.error(t('admin.customReports.errorLoadColumns'));
    }
  }, [t]);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchSavedReports();
  }, [fetchSavedReports]);

  useEffect(() => {
    if (activeTab === 'builder' || activeTab === 'templates') {
      fetchColumnsAndFilters(builderType);
    }
  }, [builderType, activeTab, fetchColumnsAndFilters]);

  // ---------------------------------------------------------------------------
  // Builder: Run report preview
  // ---------------------------------------------------------------------------

  const buildConfig = (): ReportConfig => ({
    type: builderType,
    dateFrom: builderDateFrom || undefined,
    dateTo: builderDateTo || undefined,
    columns: selectedColumns.length > 0 ? selectedColumns : availableColumns.filter((c) => c.defaultVisible).map((c) => c.key),
    filters: activeFilters,
    groupBy: groupByFields.length > 0 ? groupByFields : undefined,
    orderBy: orderByFields.length > 0 ? orderByFields : undefined,
    compareWith: compareWith || undefined,
    showTotals,
    showPercentages,
  });

  const handlePreview = async () => {
    setRunning(true);
    try {
      // First save as temp, then run
      const config = buildConfig();
      // Create a temporary report to run
      const createRes = await fetch('/api/accounting/reports/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: builderName || `Preview - ${builderType}`,
          description: builderDescription || null,
          type: builderType,
          config,
          isTemplate: false,
          isPublic: false,
        }),
      });
      if (!createRes.ok) throw new Error('Failed to create report');
      const created = await createRes.json();

      // Run the report
      const runRes = await fetch(`/api/accounting/reports/custom/${created.id}/run`, {
        method: 'POST',
      });
      if (!runRes.ok) throw new Error('Failed to run report');
      const runData = await runRes.json();
      setResult(runData.result);
      setEditingId(created.id);
      setShowResults(true);

      // Refresh saved list
      fetchSavedReports();

      toast.success(t('admin.customReports.reportExecuted'));
    } catch {
      toast.error(t('admin.customReports.errorRunReport'));
    } finally {
      setRunning(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Save report
  // ---------------------------------------------------------------------------

  const handleSaveReport = async () => {
    if (!builderName.trim()) {
      toast.error(t('admin.customReports.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      const config = buildConfig();
      const payload = {
        name: builderName,
        description: builderDescription || null,
        type: builderType,
        config,
        isTemplate,
        isPublic,
      };

      if (editingId) {
        const res = await fetch(`/api/accounting/reports/custom/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update');
        toast.success(t('admin.customReports.reportUpdated'));
      } else {
        const res = await fetch('/api/accounting/reports/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to save');
        const data = await res.json();
        setEditingId(data.id);
        toast.success(t('admin.customReports.reportSaved'));
      }
      setShowSaveModal(false);
      fetchSavedReports();
    } catch {
      toast.error(t('admin.customReports.errorSaveReport'));
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Run saved report
  // ---------------------------------------------------------------------------

  const handleRunSaved = async (report: SavedReport) => {
    setRunning(true);
    try {
      const res = await fetch(`/api/accounting/reports/custom/${report.id}/run`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to run');
      const data = await res.json();
      setResult(data.result);
      setShowResults(true);
      setEditingId(report.id);
      toast.success(data.cached
        ? t('admin.customReports.cachedResults')
        : t('admin.customReports.reportExecuted'),
      );
    } catch {
      toast.error(t('admin.customReports.errorRunReport'));
    } finally {
      setRunning(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Export report
  // ---------------------------------------------------------------------------

  const handleExport = async (reportId: string, format: 'csv' | 'pdf') => {
    try {
      const res = await fetch(`/api/accounting/reports/custom/${reportId}/export?format=${format}`);
      if (!res.ok) throw new Error('Failed to export');

      if (format === 'csv') {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const html = await res.text();
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
        }
      }
      toast.success(t('admin.customReports.exported'));
    } catch {
      toast.error(t('admin.customReports.errorExport'));
    }
  };

  // ---------------------------------------------------------------------------
  // Delete report
  // ---------------------------------------------------------------------------

  const handleDeleteReport = async (id: string) => {
    if (!confirm(t('admin.customReports.confirmDelete'))) return;
    try {
      const res = await fetch(`/api/accounting/reports/custom/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success(t('admin.customReports.reportDeleted'));
      fetchSavedReports();
    } catch {
      toast.error(t('admin.customReports.errorDelete'));
    }
  };

  // ---------------------------------------------------------------------------
  // Load report into builder
  // ---------------------------------------------------------------------------

  const loadReportIntoBuilder = (report: SavedReport) => {
    setBuilderName(report.name);
    setBuilderDescription(report.description || '');
    setBuilderType(report.config.type);
    setBuilderDateFrom(report.config.dateFrom || '');
    setBuilderDateTo(report.config.dateTo || '');
    setSelectedColumns(report.config.columns);
    setActiveFilters(report.config.filters || []);
    setGroupByFields(report.config.groupBy || []);
    setOrderByFields(report.config.orderBy || []);
    setCompareWith(report.config.compareWith || '');
    setShowTotals(report.config.showTotals ?? true);
    setShowPercentages(report.config.showPercentages ?? false);
    setIsTemplate(report.isTemplate);
    setIsPublic(report.isPublic);
    setEditingId(report.id);
    setActiveTab('builder');
  };

  // ---------------------------------------------------------------------------
  // Clone template into builder
  // ---------------------------------------------------------------------------

  const cloneTemplate = (tpl: ReportTemplate) => {
    setBuilderName(`${tpl.name} (Copy)`);
    setBuilderDescription(tpl.description);
    setBuilderType(tpl.config.type);
    setBuilderDateFrom(tpl.config.dateFrom || '');
    setBuilderDateTo(tpl.config.dateTo || '');
    setSelectedColumns(tpl.config.columns);
    setActiveFilters(tpl.config.filters || []);
    setGroupByFields(tpl.config.groupBy || []);
    setOrderByFields(tpl.config.orderBy || []);
    setCompareWith(tpl.config.compareWith || '');
    setShowTotals(tpl.config.showTotals ?? true);
    setShowPercentages(tpl.config.showPercentages ?? false);
    setEditingId(null);
    setActiveTab('builder');
  };

  // ---------------------------------------------------------------------------
  // Add/remove filter
  // ---------------------------------------------------------------------------

  const addFilter = () => {
    if (availableFilters.length === 0) return;
    const firstField = availableFilters[0];
    setActiveFilters([...activeFilters, { field: firstField.field, operator: 'eq', value: '' }]);
  };

  const removeFilter = (index: number) => {
    setActiveFilters(activeFilters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<ReportFilter>) => {
    setActiveFilters(activeFilters.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  // ---------------------------------------------------------------------------
  // Toggle column
  // ---------------------------------------------------------------------------

  const toggleColumn = (key: string) => {
    if (selectedColumns.includes(key)) {
      setSelectedColumns(selectedColumns.filter((c) => c !== key));
    } else {
      setSelectedColumns([...selectedColumns, key]);
    }
  };

  // ---------------------------------------------------------------------------
  // Add orderBy
  // ---------------------------------------------------------------------------

  const addOrderBy = (field: string) => {
    if (orderByFields.some((o) => o.field === field)) return;
    setOrderByFields([...orderByFields, { field, direction: 'asc' }]);
  };

  const removeOrderBy = (field: string) => {
    setOrderByFields(orderByFields.filter((o) => o.field !== field));
  };

  const toggleOrderDirection = (field: string) => {
    setOrderByFields(orderByFields.map((o) =>
      o.field === field ? { ...o, direction: o.direction === 'asc' ? 'desc' : 'asc' } : o,
    ));
  };

  // ---------------------------------------------------------------------------
  // Format cell value for display
  // ---------------------------------------------------------------------------

  const formatCellValue = (col: ColumnDef, value: string | number | null | undefined) => {
    if (value == null || value === '') return '-';
    if (col.type === 'currency') return formatCurrency(Number(value));
    if (col.type === 'number') return typeof value === 'number' ? value.toLocaleString() : String(value);
    return String(value);
  };

  // ---------------------------------------------------------------------------
  // Reset builder
  // ---------------------------------------------------------------------------

  const resetBuilder = () => {
    setBuilderName('');
    setBuilderDescription('');
    setBuilderDateFrom('');
    setBuilderDateTo('');
    setActiveFilters([]);
    setGroupByFields([]);
    setOrderByFields([]);
    setCompareWith('');
    setShowTotals(true);
    setShowPercentages(false);
    setIsTemplate(false);
    setIsPublic(false);
    setEditingId(null);
    setResult(null);
    setShowResults(false);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <PageHeader
        title={t('admin.customReports.title')}
        subtitle={t('admin.customReports.description')}
        theme={theme}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'saved' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          {t('admin.customReports.savedReports')}
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'builder' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          {t('admin.customReports.builder')}
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'templates' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <LayoutTemplate className="w-4 h-4" />
          {t('admin.customReports.templates')}
        </button>
      </div>

      {/* ============================================================ */}
      {/* SAVED REPORTS TAB */}
      {/* ============================================================ */}
      {activeTab === 'saved' && (
        <SectionCard
          title={t('admin.customReports.savedReports')}
          headerAction={
            <Button size="sm" onClick={() => { resetBuilder(); setActiveTab('builder'); }}>
              <Plus className="w-4 h-4 mr-1" />
              {t('admin.customReports.newReport')}
            </Button>
          }
        >
          {loadingSaved ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : savedReports.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">{t('admin.customReports.noReports')}</p>
              <p className="text-sm mt-1">{t('admin.customReports.noReportsHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedReports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">{report.name}</h3>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        {report.type.replace(/_/g, ' ')}
                      </span>
                      {report.isTemplate && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                          {t('admin.customReports.template')}
                        </span>
                      )}
                      {report.isPublic && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                          {t('admin.customReports.public')}
                        </span>
                      )}
                    </div>
                    {report.description && (
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{report.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {report.lastRunAt
                        ? `${t('admin.customReports.lastRun')}: ${new Date(report.lastRunAt).toLocaleString()}`
                        : t('admin.customReports.neverRun')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleRunSaved(report)}
                      disabled={running}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                      title={t('admin.customReports.run')}
                    >
                      {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => loadReportIntoBuilder(report)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title={t('admin.customReports.edit')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleExport(report.id, 'csv')}
                      className="p-2 text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                      title={t('admin.customReports.exportCSV')}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title={t('admin.customReports.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ============================================================ */}
      {/* BUILDER TAB */}
      {/* ============================================================ */}
      {activeTab === 'builder' && (
        <div className="space-y-6">
          {/* Report Type & Name */}
          <SectionCard title={t('admin.customReports.reportConfig')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.customReports.reportType')}
                </label>
                <select
                  value={builderType}
                  onChange={(e) => { setBuilderType(e.target.value); resetBuilder(); setBuilderType(e.target.value); }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {REPORT_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>{rt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.customReports.reportName')}
                </label>
                <input
                  type="text"
                  value={builderName}
                  onChange={(e) => setBuilderName(e.target.value)}
                  placeholder={t('admin.customReports.reportNamePlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.customReports.reportDescription')}
              </label>
              <textarea
                value={builderDescription}
                onChange={(e) => setBuilderDescription(e.target.value)}
                rows={2}
                placeholder={t('admin.customReports.reportDescriptionPlaceholder')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </SectionCard>

          {/* Date Range */}
          <SectionCard title={t('admin.customReports.dateRange')}>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />
                  {t('admin.customReports.from')}
                </label>
                <input
                  type="date"
                  value={builderDateFrom}
                  onChange={(e) => setBuilderDateFrom(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />
                  {t('admin.customReports.to')}
                </label>
                <input
                  type="date"
                  value={builderDateTo}
                  onChange={(e) => setBuilderDateTo(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </SectionCard>

          {/* Column Selector */}
          <SectionCard
            title={`${t('admin.customReports.columns')} (${selectedColumns.length}/${availableColumns.length})`}
            headerAction={
              <button onClick={() => setShowColumnConfig(!showColumnConfig)} className="text-gray-500 hover:text-gray-700">
                {showColumnConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            }
          >
            {showColumnConfig && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
                {availableColumns.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => toggleColumn(col.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors border ${
                      selectedColumns.includes(col.key)
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {selectedColumns.includes(col.key) ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span className="truncate">{col.label}</span>
                    {col.type === 'currency' && <span className="text-xs text-gray-400">$</span>}
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Filter Builder */}
          <SectionCard
            title={`${t('admin.customReports.filters')} (${activeFilters.length})`}
            headerAction={
              <button onClick={() => setShowFilterConfig(!showFilterConfig)} className="text-gray-500 hover:text-gray-700">
                {showFilterConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            }
          >
            {showFilterConfig && (
              <div className="space-y-3 mt-3">
                {activeFilters.map((filter, idx) => {
                  const filterDef = availableFilters.find((f) => f.field === filter.field);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={filter.field}
                        onChange={(e) => updateFilter(idx, { field: e.target.value, value: '' })}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        {availableFilters.map((af) => (
                          <option key={af.field} value={af.field}>{af.label}</option>
                        ))}
                      </select>
                      <select
                        value={filter.operator}
                        onChange={(e) => updateFilter(idx, { operator: e.target.value })}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm w-24"
                      >
                        {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
                          <option key={op} value={op}>{label}</option>
                        ))}
                      </select>
                      {filterDef?.type === 'select' && filterDef.options ? (
                        <select
                          value={filter.value as string}
                          onChange={(e) => updateFilter(idx, { value: e.target.value })}
                          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">-- Select --</option>
                          {filterDef.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={filterDef?.type === 'number' ? 'number' : 'text'}
                          value={filter.value as string}
                          onChange={(e) => updateFilter(idx, { value: filterDef?.type === 'number' ? Number(e.target.value) : e.target.value })}
                          placeholder={t('admin.customReports.filterValue')}
                          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      )}
                      <button onClick={() => removeFilter(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={addFilter}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('admin.customReports.addFilter')}
                </button>
              </div>
            )}
          </SectionCard>

          {/* Sort & Group Options */}
          <SectionCard title={t('admin.customReports.sortAndGroup')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sort */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5" /> {t('admin.customReports.sortBy')}
                </h4>
                <div className="space-y-2">
                  {orderByFields.map((ob) => (
                    <div key={ob.field} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-1.5">
                      <GripVertical className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm flex-1">{ob.field}</span>
                      <button
                        onClick={() => toggleOrderDirection(ob.field)}
                        className="text-xs px-2 py-0.5 rounded bg-white border border-gray-200"
                      >
                        {ob.direction === 'asc' ? 'ASC' : 'DESC'}
                      </button>
                      <button onClick={() => removeOrderBy(ob.field)} className="text-red-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <select
                    onChange={(e) => { if (e.target.value) addOrderBy(e.target.value); e.target.value = ''; }}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-500"
                    defaultValue=""
                  >
                    <option value="">{t('admin.customReports.addSortField')}</option>
                    {selectedColumns
                      .filter((c) => !orderByFields.some((o) => o.field === c))
                      .map((c) => {
                        const col = availableColumns.find((ac) => ac.key === c);
                        return col?.sortable ? <option key={c} value={c}>{col.label}</option> : null;
                      })}
                  </select>
                </div>
              </div>

              {/* Group By */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Table2 className="w-3.5 h-3.5" /> {t('admin.customReports.groupBy')}
                </h4>
                <div className="space-y-2">
                  {groupByFields.map((field) => (
                    <div key={field} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-1.5">
                      <span className="text-sm flex-1">{field}</span>
                      <button
                        onClick={() => setGroupByFields(groupByFields.filter((f) => f !== field))}
                        className="text-red-400 hover:text-red-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <select
                    onChange={(e) => { if (e.target.value) setGroupByFields([...groupByFields, e.target.value]); e.target.value = ''; }}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-500"
                    defaultValue=""
                  >
                    <option value="">{t('admin.customReports.addGroupField')}</option>
                    {selectedColumns
                      .filter((c) => !groupByFields.includes(c))
                      .map((c) => {
                        const col = availableColumns.find((ac) => ac.key === c);
                        return <option key={c} value={c}>{col?.label || c}</option>;
                      })}
                  </select>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Comparison & Options */}
          <SectionCard title={t('admin.customReports.options')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.customReports.compareWith')}
                </label>
                <select
                  value={compareWith}
                  onChange={(e) => setCompareWith(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t('admin.customReports.noComparison')}</option>
                  <option value="previous_period">{t('admin.customReports.previousPeriod')}</option>
                  <option value="previous_year">{t('admin.customReports.previousYear')}</option>
                </select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTotals}
                    onChange={(e) => setShowTotals(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{t('admin.customReports.showTotals')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPercentages}
                    onChange={(e) => setShowPercentages(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{t('admin.customReports.showPercentages')}</span>
                </label>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTemplate}
                    onChange={(e) => setIsTemplate(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{t('admin.customReports.saveAsTemplate')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{t('admin.customReports.makePublic')}</span>
                </label>
              </div>
            </div>
          </SectionCard>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 sticky bottom-0 bg-white py-4 border-t border-gray-200 -mx-6 px-6">
            <Button onClick={handlePreview} disabled={running}>
              {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
              {t('admin.customReports.preview')}
            </Button>
            <Button variant="secondary" onClick={() => setShowSaveModal(true)}>
              <FileText className="w-4 h-4 mr-1" />
              {editingId ? t('admin.customReports.updateReport') : t('admin.customReports.saveReport')}
            </Button>
            <Button variant="secondary" onClick={resetBuilder}>
              {t('admin.customReports.reset')}
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TEMPLATES TAB */}
      {/* ============================================================ */}
      {activeTab === 'templates' && (
        <SectionCard title={t('admin.customReports.templateGallery')}>
          {/* Type filter for templates */}
          <div className="mb-4">
            <select
              value={builderType}
              onChange={(e) => setBuilderType(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {REPORT_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <LayoutTemplate className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>{t('admin.customReports.noTemplates')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((tpl) => (
                <div key={tpl.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                  <h3 className="font-medium text-gray-900">{tpl.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{tpl.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                      {tpl.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400">{tpl.config.columns.length} columns</span>
                  </div>
                  <button
                    onClick={() => cloneTemplate(tpl)}
                    className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Copy className="w-3.5 h-3.5" /> {t('admin.customReports.useTemplate')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Also show saved templates */}
          {savedReports.filter((r) => r.isTemplate).length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t('admin.customReports.savedTemplates')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedReports.filter((r) => r.isTemplate).map((report) => (
                  <div key={report.id} className="p-4 border border-purple-200 rounded-lg hover:border-purple-300 bg-purple-50/30 transition-colors">
                    <h3 className="font-medium text-gray-900">{report.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                        {report.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <button
                      onClick={() => loadReportIntoBuilder(report)}
                      className="mt-3 flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      <Copy className="w-3.5 h-3.5" /> {t('admin.customReports.useTemplate')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* ============================================================ */}
      {/* RESULTS VIEW */}
      {/* ============================================================ */}
      {showResults && result && (
        <div className="mt-6">
          <SectionCard
            title={`${t('admin.customReports.results')} (${result.metadata.rowCount} ${t('admin.customReports.rows')}, ${result.metadata.executionTimeMs}ms)`}
            headerAction={
              <div className="flex items-center gap-2">
                {editingId && (
                  <>
                    <button
                      onClick={() => handleExport(editingId, 'csv')}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button
                      onClick={() => handleExport(editingId, 'pdf')}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setShowResults(false); setResult(null); }}
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {result.columns.map((col) => (
                      <th
                        key={col.key}
                        className={`px-4 py-3 font-medium text-gray-700 whitespace-nowrap ${
                          col.type === 'currency' || col.type === 'number' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 500).map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      {result.columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-2 whitespace-nowrap ${
                            col.type === 'currency' || col.type === 'number' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {formatCellValue(col, row[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Totals row */}
                  {result.totals && (
                    <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                      {result.columns.map((col, i) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 whitespace-nowrap ${
                            col.type === 'currency' || col.type === 'number' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {i === 0 && !result.totals![col.key] ? 'TOTALS' : result.totals![col.key] != null ? formatCurrency(result.totals![col.key]) : ''}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
              {result.rows.length > 500 && (
                <p className="text-center text-sm text-gray-500 py-3">
                  {t('admin.customReports.showingFirst500', { total: result.metadata.rowCount })}
                </p>
              )}
            </div>

            {/* Comparison table */}
            {result.comparison && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  {result.comparison.label}
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-amber-50">
                        {result.columns.map((col) => (
                          <th
                            key={col.key}
                            className={`px-4 py-3 font-medium text-gray-700 whitespace-nowrap ${
                              col.type === 'currency' || col.type === 'number' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.comparison.rows.slice(0, 500).map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}>
                          {result.columns.map((col) => (
                            <td
                              key={col.key}
                              className={`px-4 py-2 whitespace-nowrap ${
                                col.type === 'currency' || col.type === 'number' ? 'text-right' : 'text-left'
                              }`}
                            >
                              {formatCellValue(col, row[col.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {result.comparison.totals && (
                        <tr className="bg-amber-100 font-semibold border-t-2 border-amber-300">
                          {result.columns.map((col, i) => (
                            <td
                              key={col.key}
                              className={`px-4 py-3 whitespace-nowrap ${
                                col.type === 'currency' || col.type === 'number' ? 'text-right' : 'text-left'
                              }`}
                            >
                              {i === 0 && !result.comparison!.totals![col.key] ? 'TOTALS' : result.comparison!.totals![col.key] != null ? formatCurrency(result.comparison!.totals![col.key]) : ''}
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ============================================================ */}
      {/* SAVE MODAL */}
      {/* ============================================================ */}
      <Modal
          isOpen={showSaveModal}
          title={editingId ? t('admin.customReports.updateReport') : t('admin.customReports.saveReport')}
          onClose={() => setShowSaveModal(false)}
        >
          <div className="space-y-4 p-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.customReports.reportName')} *
              </label>
              <input
                type="text"
                value={builderName}
                onChange={(e) => setBuilderName(e.target.value)}
                placeholder={t('admin.customReports.reportNamePlaceholder')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.customReports.reportDescription')}
              </label>
              <textarea
                value={builderDescription}
                onChange={(e) => setBuilderDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTemplate}
                  onChange={(e) => setIsTemplate(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{t('admin.customReports.saveAsTemplate')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{t('admin.customReports.makePublic')}</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowSaveModal(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveReport} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
                {editingId ? t('admin.customReports.update') : t('admin.customReports.save')}
              </Button>
            </div>
          </div>
        </Modal>
    </div>
  );
}
