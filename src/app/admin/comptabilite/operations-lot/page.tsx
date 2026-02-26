'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layers,
  Upload,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Eye,
  RefreshCw,
  AlertTriangle,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  StatusBadge,
  StatCard,
  DataTable,
  type Column,
  SectionCard,
  type BadgeVariant,
} from '@/components/admin';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BatchJob {
  id: string;
  type: string;
  status: string;
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  createdBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface BatchJobDetail extends BatchJob {
  inputData: unknown;
  resultData: BatchItemResult[] | null;
  errorLog: Array<{ index: number; error: string }> | null;
  updatedAt: string;
  durationMs: number | null;
}

interface BatchItemResult {
  index: number;
  success: boolean;
  id?: string;
  error?: string;
  data?: Record<string, unknown>;
}

interface ImportPreview {
  importType: string;
  batchType: string;
  recordCount: number;
  itemCount: number;
  preview: unknown[];
  headers: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_TYPE_LABELS: Record<string, string> = {
  BATCH_JOURNAL_ENTRIES: 'Ecritures comptables',
  BATCH_INVOICES: 'Factures',
  BATCH_PAYMENTS: 'Paiements',
  BATCH_EXPENSES: 'Depenses',
  BATCH_STATUS_UPDATE: 'Mise a jour statut',
  BATCH_EXPORT: 'Export',
  BATCH_DELETE: 'Suppression',
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: 'neutral',
  PROCESSING: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
  CANCELLED: 'warning',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  COMPLETED: 'Termine',
  FAILED: 'Echoue',
  CANCELLED: 'Annule',
};

const theme = sectionThemes.entry;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BatchOperationsPage() {
  // State
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [stats, setStats] = useState<{ byStatus: Record<string, number>; byType: Record<string, number> }>({ byStatus: {}, byType: {} });

  // Import wizard state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<string>('expenses');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Job detail modal
  const [selectedJob, setSelectedJob] = useState<BatchJobDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/accounting/batch?page=${page}&limit=${pageSize}`);
      const json = await res.json();

      if (json.success && json.data) {
        setJobs(json.data);
        setTotalCount(json.pagination?.total || 0);
      } else if (Array.isArray(json.data)) {
        setJobs(json.data);
      }

      // Parse stats from header
      const statsHeader = res.headers.get('X-Batch-Stats');
      if (statsHeader) {
        try {
          setStats(JSON.parse(statsHeader));
        } catch { /* ignore */ }
      }
    } catch {
      toast.error('Erreur lors du chargement des operations');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const fetchJobDetail = async (jobId: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/accounting/batch/${jobId}`);
      const json = await res.json();

      if (json.success && json.data) {
        setSelectedJob(json.data);
        setShowDetailModal(true);
      } else {
        toast.error('Job introuvable');
      }
    } catch {
      toast.error('Erreur lors du chargement des details');
    } finally {
      setLoadingDetail(false);
    }
  };

  // -----------------------------------------------------------------------
  // Import wizard handlers
  // -----------------------------------------------------------------------

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportPreview(null);
      setImportStep('upload');
    }
  };

  const handlePreview = async () => {
    if (!importFile) return;

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('type', importType);

      const res = await fetch('/api/accounting/batch/import?preview=true', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (json.success && json.data) {
        setImportPreview(json.data);
        setImportStep('preview');
      } else {
        toast.error(json.error?.message || 'Erreur de preview');
      }
    } catch {
      toast.error('Erreur lors du preview');
    } finally {
      setImporting(false);
    }
  };

  const handleImportExecute = async () => {
    if (!importFile) return;

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('type', importType);

      const res = await fetch('/api/accounting/batch/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (json.success && json.data) {
        const summary = json.data;
        toast.success(
          `Import termine: ${summary.successItems} reussis, ${summary.failedItems} echoues sur ${summary.totalItems}`
        );
        setImportStep('result');
        fetchJobs();
      } else {
        toast.error(json.error?.message || "Erreur d'import");
      }
    } catch {
      toast.error("Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportPreview(null);
    setImportStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // -----------------------------------------------------------------------
  // Template download
  // -----------------------------------------------------------------------

  const downloadTemplate = async (type: string) => {
    try {
      const res = await fetch(`/api/accounting/batch/templates?type=${type}`);
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template-${type}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Template ${type} telecharge`);
    } catch {
      toast.error('Erreur lors du telechargement du template');
    }
  };

  // -----------------------------------------------------------------------
  // Quick batch actions
  // -----------------------------------------------------------------------

  const handleQuickExport = async (entityType: string, format: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      addCSRFHeader(headers);

      const res = await fetch('/api/accounting/batch', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'BATCH_EXPORT',
          items: [{ entityType, format }],
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const summary = json.data;
        if (summary.results?.[0]?.success && summary.results[0].data?.exportData) {
          const exportData = summary.results[0].data.exportData as string;
          const blob = new Blob([exportData], {
            type: format === 'CSV' ? 'text/csv;charset=utf-8' : 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `export-${entityType.toLowerCase()}-${new Date().toISOString().split('T')[0]}.${format.toLowerCase()}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          toast.success(`Export ${entityType} termine (${summary.results[0].data.recordCount} enregistrements)`);
        } else {
          toast.warning('Export termine mais aucune donnee');
        }
        fetchJobs();
      } else {
        toast.error(json.error?.message || "Erreur d'export");
      }
    } catch {
      toast.error("Erreur lors de l'export");
    }
  };

  // -----------------------------------------------------------------------
  // Table columns
  // -----------------------------------------------------------------------

  const columns: Column<BatchJob>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (job) => (
        <span className="text-xs font-medium">{BATCH_TYPE_LABELS[job.type] || job.type}</span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (job) => (
        <StatusBadge variant={STATUS_VARIANT[job.status] || 'neutral'}>
          {STATUS_LABEL[job.status] || job.status}
        </StatusBadge>
      ),
    },
    {
      key: 'totalItems',
      header: 'Total',
      render: (job) => <span className="text-xs tabular-nums">{job.totalItems}</span>,
    },
    {
      key: 'successItems',
      header: 'Reussis',
      render: (job) => (
        <span className="text-xs tabular-nums text-green-600">{job.successItems}</span>
      ),
    },
    {
      key: 'failedItems',
      header: 'Echoues',
      render: (job) => (
        <span className={`text-xs tabular-nums ${job.failedItems > 0 ? 'text-red-600' : 'text-slate-400'}`}>
          {job.failedItems}
        </span>
      ),
    },
    {
      key: 'createdBy',
      header: 'Par',
      render: (job) => (
        <span className="text-xs text-slate-500 truncate max-w-[120px] block">
          {job.createdBy || '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (job) => (
        <span className="text-xs text-slate-500 tabular-nums">
          {new Date(job.createdAt).toLocaleDateString('fr-CA')}{' '}
          {new Date(job.createdAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (job) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchJobDetail(job.id)}
          disabled={loadingDetail}
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ];

  // -----------------------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------------------

  const totalPages = Math.ceil(totalCount / pageSize);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations en lot"
        subtitle="Importation, exportation et operations groupees sur les donnees comptables"
        theme={theme}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total jobs"
          value={totalCount}
          icon={Layers}
          theme={theme}
        />
        <StatCard
          label="Termines"
          value={stats.byStatus?.COMPLETED || 0}
          icon={CheckCircle}
        />
        <StatCard
          label="En cours"
          value={stats.byStatus?.PROCESSING || 0}
          icon={Clock}
        />
        <StatCard
          label="Echoues"
          value={stats.byStatus?.FAILED || 0}
          icon={XCircle}
        />
      </div>

      {/* Quick Actions */}
      <SectionCard title="Actions rapides">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => { setImportType('expenses'); setShowImportModal(true); resetImport(); }}
          >
            <Upload className="w-5 h-5 text-orange-500" />
            <span className="text-xs">Importer depenses</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => { setImportType('journal_entries'); setShowImportModal(true); resetImport(); }}
          >
            <Upload className="w-5 h-5 text-blue-500" />
            <span className="text-xs">Importer ecritures</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => handleQuickExport('EXPENSE', 'CSV')}
          >
            <Download className="w-5 h-5 text-green-500" />
            <span className="text-xs">Exporter depenses</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => handleQuickExport('JOURNAL_ENTRY', 'CSV')}
          >
            <Download className="w-5 h-5 text-indigo-500" />
            <span className="text-xs">Exporter ecritures</span>
          </Button>
        </div>
      </SectionCard>

      {/* CSV Templates */}
      <SectionCard title="Templates CSV">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate('expenses')}>
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Template depenses
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadTemplate('journal_entries')}>
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Template ecritures
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadTemplate('invoices')}>
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Template statut factures
          </Button>
        </div>
      </SectionCard>

      {/* Job History */}
      <SectionCard
        title="Historique des operations"
        headerAction={
          <Button variant="ghost" size="sm" onClick={fetchJobs} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        <DataTable
          columns={columns}
          data={jobs}
          keyExtractor={(job) => job.id}
          loading={loading}
          emptyTitle="Aucune operation en lot"
          emptyDescription="Les operations en lot apparaitront ici."
        />
        {/* Simple pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Page {page} sur {totalPages} ({totalCount} resultats)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Precedent
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Import Wizard Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => { setShowImportModal(false); resetImport(); }}
        title={`Import CSV - ${importType === 'expenses' ? 'Depenses' : importType === 'journal_entries' ? 'Ecritures' : 'Factures'}`}
        size="lg"
      >
        <div className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-1 rounded ${importStep === 'upload' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
              1. Fichier
            </span>
            <span className="text-slate-300">&rarr;</span>
            <span className={`px-2 py-1 rounded ${importStep === 'preview' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
              2. Apercu
            </span>
            <span className="text-slate-300">&rarr;</span>
            <span className={`px-2 py-1 rounded ${importStep === 'result' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
              3. Resultat
            </span>
          </div>

          {/* Step 1: File Upload */}
          {importStep === 'upload' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type d&apos;import</label>
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="expenses">Depenses</option>
                  <option value="journal_entries">Ecritures comptables</option>
                  <option value="invoices">Mise a jour statut factures</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fichier CSV</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {importFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-green-500" />
                      <span className="text-sm font-medium">{importFile.name}</span>
                      <span className="text-xs text-slate-400">
                        ({(importFile.size / 1024).toFixed(1)} Ko)
                      </span>
                      <button onClick={() => { setImportFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-slate-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      <Upload className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      Cliquer pour selectionner un fichier CSV
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={() => downloadTemplate(importType)}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Telecharger template
                </Button>
                <Button
                  onClick={handlePreview}
                  disabled={!importFile || importing}
                >
                  {importing ? (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Apercu
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {importStep === 'preview' && importPreview && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="font-medium">{importPreview.recordCount} enregistrements detectes</span>
                  <span className="text-blue-500">
                    ({importPreview.itemCount} elements a traiter)
                  </span>
                </div>
              </div>

              {/* Preview table */}
              <div className="max-h-[300px] overflow-auto border rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-500">#</th>
                      {importPreview.headers.slice(0, 6).map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 truncate max-w-[120px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importPreview.preview.slice(0, 10).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 text-slate-400">{idx + 1}</td>
                        {importPreview.headers.slice(0, 6).map((h) => (
                          <td key={h} className="px-3 py-1.5 truncate max-w-[120px]">
                            {String((item as Record<string, unknown>)[h] ?? (item as Record<string, unknown>)[h.charAt(0).toLowerCase() + h.slice(1)] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setImportStep('upload')}>
                  Retour
                </Button>
                <Button onClick={handleImportExecute} disabled={importing}>
                  {importing ? (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Lancer l&apos;import ({importPreview.itemCount} elements)
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {importStep === 'result' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm font-medium text-green-700">Import termine</p>
                <p className="text-xs text-green-500 mt-1">
                  Consultez l&apos;historique pour les details du resultat.
                </p>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { setShowImportModal(false); resetImport(); }}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Job Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedJob(null); }}
        title={`Detail du job ${selectedJob?.id?.slice(0, 8) || ''}`}
        size="lg"
      >
        {selectedJob && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Type</p>
                <p className="text-sm font-medium">{BATCH_TYPE_LABELS[selectedJob.type] || selectedJob.type}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Statut</p>
                <StatusBadge variant={STATUS_VARIANT[selectedJob.status] || 'neutral'}>
                  {STATUS_LABEL[selectedJob.status] || selectedJob.status}
                </StatusBadge>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Progres</p>
                <p className="text-sm font-medium">
                  {selectedJob.processedItems}/{selectedJob.totalItems}
                  {selectedJob.totalItems > 0 && (
                    <span className="text-xs text-slate-400 ml-1">
                      ({Math.round((selectedJob.processedItems / selectedJob.totalItems) * 100)}%)
                    </span>
                  )}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Duree</p>
                <p className="text-sm font-medium">
                  {selectedJob.durationMs != null
                    ? selectedJob.durationMs < 1000
                      ? `${selectedJob.durationMs}ms`
                      : `${(selectedJob.durationMs / 1000).toFixed(1)}s`
                    : '-'}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  selectedJob.failedItems > 0 && selectedJob.successItems === 0
                    ? 'bg-red-500'
                    : selectedJob.failedItems > 0
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{
                  width: `${selectedJob.totalItems > 0 ? (selectedJob.processedItems / selectedJob.totalItems) * 100 : 0}%`,
                }}
              />
            </div>

            <div className="flex gap-4 text-xs">
              <span className="text-green-600">
                <CheckCircle className="w-3 h-3 inline mr-1" />
                {selectedJob.successItems} reussis
              </span>
              <span className="text-red-600">
                <XCircle className="w-3 h-3 inline mr-1" />
                {selectedJob.failedItems} echoues
              </span>
            </div>

            {/* Error details */}
            {selectedJob.errorLog && selectedJob.errorLog.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Erreurs ({selectedJob.errorLog.length})
                </h4>
                <div className="max-h-[200px] overflow-auto border border-red-200 rounded-lg divide-y divide-red-100">
                  {selectedJob.errorLog.map((err, idx) => (
                    <div key={idx} className="px-3 py-2 text-xs">
                      <span className="text-red-500 font-mono mr-2">#{err.index + 1}</span>
                      <span className="text-slate-700">{err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Item results */}
            {selectedJob.resultData && selectedJob.resultData.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-700">
                  Resultats par element ({selectedJob.resultData.length})
                </h4>
                <div className="max-h-[200px] overflow-auto border rounded-lg divide-y divide-slate-100">
                  {selectedJob.resultData.map((result, idx) => (
                    <div
                      key={idx}
                      className={`px-3 py-2 text-xs flex items-center gap-2 ${
                        result.success ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      {result.success ? (
                        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                      )}
                      <span className="font-mono text-slate-400">#{result.index + 1}</span>
                      {result.id && <span className="text-slate-500">{result.id.slice(0, 8)}...</span>}
                      {result.data && (
                        <span className="text-slate-600 truncate">
                          {Object.entries(result.data)
                            .filter(([k]) => k !== 'exportData')
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')}
                        </span>
                      )}
                      {result.error && (
                        <span className="text-red-600 truncate">{result.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => { setShowDetailModal(false); setSelectedJob(null); }}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
