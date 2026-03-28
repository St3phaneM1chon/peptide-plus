'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical, Plus, Play, Pause, CheckCircle, Trash2, BarChart3,
  ChevronDown, ChevronUp, Trophy, Users, Target,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  FormField,
  Input,
  Textarea,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Variant {
  id: string;
  name: string;
  content: string;
  trafficPercent: number;
}

interface AbTestMetrics {
  [variantId: string]: {
    impressions: number;
    conversions: number;
    conversionRate: number;
  };
}

interface AbTest {
  id: string;
  name: string;
  pageUrl: string;
  status: string;
  variants: Variant[];
  metrics: AbTestMetrics;
  startDate: string | null;
  endDate: string | null;
  winnerId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AbTestsPage() {
  const { t } = useI18n();
  const [tests, setTests] = useState<AbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string>('');

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPageUrl, setCreatePageUrl] = useState('');
  const [createVariants, setCreateVariants] = useState<Variant[]>([
    { id: 'control', name: 'Control (A)', content: '', trafficPercent: 50 },
    { id: 'variant-b', name: 'Variant B', content: '', trafficPercent: 50 },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // Expanded test details
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchTests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (filter) params.set('status', filter);
      const res = await fetch(`/api/admin/ab-tests?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTests(data.tests || []);
        setTotal(data.total || 0);
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  // ---------------------------------------------------------------------------
  // Create test
  // ---------------------------------------------------------------------------

  const handleCreate = async () => {
    if (!createName.trim() || !createPageUrl.trim()) {
      toast.error(t('admin.abTests.nameRequired'));
      return;
    }
    const totalTraffic = createVariants.reduce((s, v) => s + v.trafficPercent, 0);
    if (totalTraffic !== 100) {
      toast.error(t('admin.abTests.trafficMustEqual100'));
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/ab-tests', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: createName,
          pageUrl: createPageUrl,
          variants: createVariants,
        }),
      });
      if (res.ok) {
        toast.success(t('admin.abTests.created'));
        setCreateOpen(false);
        resetCreateForm();
        fetchTests();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setIsSaving(false);
    }
  };

  const resetCreateForm = () => {
    setCreateName('');
    setCreatePageUrl('');
    setCreateVariants([
      { id: 'control', name: 'Control (A)', content: '', trafficPercent: 50 },
      { id: 'variant-b', name: 'Variant B', content: '', trafficPercent: 50 },
    ]);
  };

  // ---------------------------------------------------------------------------
  // Update status
  // ---------------------------------------------------------------------------

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/admin/ab-tests', {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        toast.success(t('admin.abTests.statusUpdated'));
        fetchTests();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  };

  // ---------------------------------------------------------------------------
  // Declare winner
  // ---------------------------------------------------------------------------

  const declareWinner = async (testId: string, winnerId: string) => {
    try {
      const res = await fetch('/api/admin/ab-tests', {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: testId, winnerId, status: 'completed' }),
      });
      if (res.ok) {
        toast.success(t('admin.abTests.winnerDeclared'));
        fetchTests();
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  };

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/admin/ab-tests', {
        method: 'DELETE',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: deleteId }),
      });
      if (res.ok) {
        toast.success(t('admin.abTests.deleted'));
        setDeleteId(null);
        fetchTests();
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return 'bg-emerald-500/20 text-emerald-300';
      case 'paused': return 'bg-yellow-500/20 text-yellow-300';
      case 'completed': return 'bg-blue-500/20 text-blue-300';
      default: return 'bg-white/10 text-[var(--k-text-muted)]';
    }
  };

  const addVariant = () => {
    const idx = createVariants.length + 1;
    setCreateVariants([...createVariants, {
      id: `variant-${String.fromCharCode(65 + idx)}`.toLowerCase(),
      name: `Variant ${String.fromCharCode(65 + idx)}`,
      content: '',
      trafficPercent: 0,
    }]);
  };

  const removeVariant = (idx: number) => {
    if (createVariants.length <= 2) return;
    setCreateVariants(createVariants.filter((_, i) => i !== idx));
  };

  const updateVariant = (idx: number, field: keyof Variant, value: string | number) => {
    setCreateVariants(createVariants.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  // Calculate total impressions for a test
  const getTotalImpressions = (metrics: AbTestMetrics) => {
    return Object.values(metrics).reduce((s, m) => s + (m.impressions || 0), 0);
  };

  const getTotalConversions = (metrics: AbTestMetrics) => {
    return Object.values(metrics).reduce((s, m) => s + (m.conversions || 0), 0);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.abTests.title')}
        subtitle={t('admin.abTests.subtitle')}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            {t('admin.abTests.create')}
          </Button>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--k-text-primary)]">{total}</p>
          <p className="text-[10px] text-[var(--k-text-muted)] uppercase">{t('admin.abTests.totalTests')}</p>
        </div>
        <div className="bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{tests.filter(t => t.status === 'running').length}</p>
          <p className="text-[10px] text-[var(--k-text-muted)] uppercase">{t('admin.abTests.running')}</p>
        </div>
        <div className="bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{tests.filter(t => t.status === 'completed').length}</p>
          <p className="text-[10px] text-[var(--k-text-muted)] uppercase">{t('admin.abTests.completed')}</p>
        </div>
        <div className="bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--k-text-primary)]">
            {tests.reduce((s, t) => s + getTotalImpressions(t.metrics || {}), 0)}
          </p>
          <p className="text-[10px] text-[var(--k-text-muted)] uppercase">{t('admin.abTests.totalImpressions')}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-[var(--k-glass-thin)] rounded-lg p-1 border border-[var(--k-border-subtle)] w-fit">
        {['', 'draft', 'running', 'paused', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === f ? 'bg-indigo-500/20 text-indigo-300' : 'text-[var(--k-text-muted)] hover:bg-white/5'
            }`}
          >
            {f ? t(`admin.abTests.status_${f}`) : t('admin.abTests.all')}
          </button>
        ))}
      </div>

      {/* Tests List */}
      {tests.length === 0 ? (
        <div className="bg-[var(--k-glass-thin)] rounded-xl border border-[var(--k-border-subtle)] p-12 text-center">
          <FlaskConical className="w-10 h-10 mx-auto mb-3 text-[var(--k-text-muted)] opacity-50" />
          <p className="text-sm text-[var(--k-text-muted)]">{t('admin.abTests.empty')}</p>
          <p className="text-xs text-[var(--k-text-muted)] mt-1">{t('admin.abTests.emptyPrompt')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => {
            const metrics = (test.metrics || {}) as AbTestMetrics;
            const variants = (test.variants || []) as Variant[];
            const totalImp = getTotalImpressions(metrics);
            const totalConv = getTotalConversions(metrics);
            const isExpanded = expandedTest === test.id;

            return (
              <div
                key={test.id}
                className="bg-[var(--k-glass-thin)] rounded-xl border border-[var(--k-border-subtle)] overflow-hidden"
              >
                {/* Header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FlaskConical className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-[var(--k-text-primary)] truncate">{test.name}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${getStatusBadge(test.status)}`}>
                          {t(`admin.abTests.status_${test.status}`)}
                        </span>
                        {test.winnerId && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-yellow-500/20 text-yellow-300 flex items-center gap-0.5">
                            <Trophy className="w-3 h-3" /> {t('admin.abTests.winnerDeclared')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <code className="text-xs text-[var(--k-text-muted)]">{test.pageUrl}</code>
                        <span className="text-[10px] text-[var(--k-text-muted)]">{variants.length} {t('admin.abTests.variants')}</span>
                        {totalImp > 0 && (
                          <>
                            <span className="text-[10px] text-[var(--k-text-muted)] flex items-center gap-0.5">
                              <Users className="w-3 h-3" /> {totalImp}
                            </span>
                            <span className="text-[10px] text-[var(--k-text-muted)] flex items-center gap-0.5">
                              <Target className="w-3 h-3" /> {totalConv}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {test.status === 'draft' && (
                      <Button variant="ghost" size="sm" icon={Play} onClick={() => updateStatus(test.id, 'running')}>
                        {t('admin.abTests.start')}
                      </Button>
                    )}
                    {test.status === 'running' && (
                      <Button variant="ghost" size="sm" icon={Pause} onClick={() => updateStatus(test.id, 'paused')}>
                        {t('admin.abTests.pause')}
                      </Button>
                    )}
                    {test.status === 'paused' && (
                      <Button variant="ghost" size="sm" icon={Play} onClick={() => updateStatus(test.id, 'running')}>
                        {t('admin.abTests.resume')}
                      </Button>
                    )}
                    {(test.status === 'running' || test.status === 'paused') && (
                      <Button variant="ghost" size="sm" icon={CheckCircle} onClick={() => updateStatus(test.id, 'completed')}>
                        {t('admin.abTests.complete')}
                      </Button>
                    )}
                    <button
                      onClick={() => setDeleteId(test.id)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-[var(--k-text-muted)] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedTest(isExpanded ? null : test.id)}
                      className="p-1.5 rounded hover:bg-white/5 text-[var(--k-text-muted)] transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-[var(--k-border-subtle)] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="w-4 h-4 text-indigo-400" />
                      <h5 className="text-sm font-semibold text-[var(--k-text-primary)]">{t('admin.abTests.results')}</h5>
                    </div>

                    {/* Variant Results */}
                    <div className="grid gap-3">
                      {variants.map((variant) => {
                        const vm = metrics[variant.id] || { impressions: 0, conversions: 0, conversionRate: 0 };
                        const isWinner = test.winnerId === variant.id;
                        const maxConvRate = Math.max(...Object.values(metrics).map(m => m.conversionRate || 0), 0.01);
                        const barWidth = maxConvRate > 0 ? (vm.conversionRate / maxConvRate) * 100 : 0;

                        return (
                          <div
                            key={variant.id}
                            className={`rounded-lg p-3 border ${isWinner ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-[var(--k-border-subtle)] bg-white/5'}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[var(--k-text-primary)]">{variant.name}</span>
                                <span className="text-[10px] text-[var(--k-text-muted)]">{variant.trafficPercent}% {t('admin.abTests.traffic')}</span>
                                {isWinner && <Trophy className="w-3.5 h-3.5 text-yellow-400" />}
                              </div>
                              {(test.status === 'running' || test.status === 'completed') && !test.winnerId && (
                                <button
                                  onClick={() => declareWinner(test.id, variant.id)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                                >
                                  {t('admin.abTests.declareWinner')}
                                </button>
                              )}
                            </div>

                            {/* Metrics bar */}
                            <div className="grid grid-cols-3 gap-3 text-center mb-2">
                              <div>
                                <p className="text-lg font-bold text-[var(--k-text-primary)]">{vm.impressions}</p>
                                <p className="text-[10px] text-[var(--k-text-muted)] uppercase">{t('admin.abTests.impressions')}</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-[var(--k-text-primary)]">{vm.conversions}</p>
                                <p className="text-[10px] text-[var(--k-text-muted)] uppercase">{t('admin.abTests.conversions')}</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-emerald-400">{vm.conversionRate}%</p>
                                <p className="text-[10px] text-[var(--k-text-muted)] uppercase">{t('admin.abTests.convRate')}</p>
                              </div>
                            </div>

                            {/* Visual bar */}
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isWinner ? 'bg-yellow-400' : 'bg-indigo-400'}`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>

                            {/* Content preview */}
                            {variant.content && (
                              <p className="text-xs text-[var(--k-text-muted)] mt-2 line-clamp-2 italic">{variant.content}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Test metadata */}
                    <div className="mt-3 pt-3 border-t border-[var(--k-border-subtle)] flex items-center gap-4 text-[10px] text-[var(--k-text-muted)]">
                      {test.startDate && <span>{t('admin.abTests.started')}: {new Date(test.startDate).toLocaleDateString()}</span>}
                      {test.endDate && <span>{t('admin.abTests.ended')}: {new Date(test.endDate).toLocaleDateString()}</span>}
                      <span>{t('admin.abTests.createdAt')}: {new Date(test.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Test Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('admin.abTests.createTitle')}
      >
        <div className="space-y-4">
          <FormField label={t('admin.abTests.testName')}>
            <Input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={t('admin.abTests.testNamePlaceholder')}
            />
          </FormField>
          <FormField label={t('admin.abTests.pageUrl')}>
            <Input
              type="text"
              value={createPageUrl}
              onChange={(e) => setCreatePageUrl(e.target.value)}
              placeholder="/products/example"
            />
          </FormField>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[var(--k-text-primary)]">{t('admin.abTests.variants')}</label>
              <button
                onClick={addVariant}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + {t('admin.abTests.addVariant')}
              </button>
            </div>
            <div className="space-y-3">
              {createVariants.map((variant, idx) => (
                <div key={idx} className="bg-white/5 rounded-lg p-3 border border-[var(--k-border-subtle)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      type="text"
                      value={variant.name}
                      onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                      placeholder={t('admin.abTests.variantName')}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={variant.trafficPercent}
                        onChange={(e) => updateVariant(idx, 'trafficPercent', parseInt(e.target.value) || 0)}
                        className="w-20"
                        min={0}
                        max={100}
                      />
                      <span className="text-xs text-[var(--k-text-muted)]">%</span>
                    </div>
                    {createVariants.length > 2 && (
                      <button
                        onClick={() => removeVariant(idx)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <Textarea
                    rows={2}
                    value={variant.content}
                    onChange={(e) => updateVariant(idx, 'content', e.target.value)}
                    placeholder={t('admin.abTests.variantContent')}
                  />
                </div>
              ))}
            </div>
            {/* Traffic total indicator */}
            <div className="mt-2 text-xs">
              <span className={
                createVariants.reduce((s, v) => s + v.trafficPercent, 0) === 100
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }>
                {t('admin.abTests.totalTraffic')}: {createVariants.reduce((s, v) => s + v.trafficPercent, 0)}%
                {createVariants.reduce((s, v) => s + v.trafficPercent, 0) !== 100 && ` (${t('admin.abTests.mustBe100')})`}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-[var(--k-border-subtle)]">
            <Button variant="secondary" onClick={() => { setCreateOpen(false); resetCreateForm(); }} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={isSaving} disabled={isSaving} onClick={handleCreate} className="flex-1">
              {t('admin.abTests.create')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={t('admin.abTests.deleteTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--k-text-secondary)]">{t('admin.abTests.deleteConfirm')}</p>
          <div className="flex gap-3 pt-4 border-t border-[var(--k-border-subtle)]">
            <Button variant="secondary" onClick={() => setDeleteId(null)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleDelete} className="flex-1 !bg-red-600 hover:!bg-red-700">
              {t('admin.abTests.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
