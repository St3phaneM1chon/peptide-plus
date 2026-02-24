'use client';
/**
 * Dashboard de traduction automatique
 * Affiche la couverture de traduction par modèle et permet de déclencher des traductions
 * Inclut un wizard 3 étapes pour les sessions de traduction globales
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Languages,
  Loader2,
  Play,
  BarChart3,
  ChevronDown,
  ChevronUp,
  X,
  ArrowRight,
  ArrowLeft,
  Zap,
  Settings,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

interface ModelCoverage {
  totalEntities: number;
  fullyTranslated: number;
  partiallyTranslated: number;
  untranslated: number;
  coveragePercent: number;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

interface QueueJob {
  id: string;
  model: string;
  entityId: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  error?: string;
  createdAt: string;
}

const MODEL_KEYS: Record<string, string> = {
  Product: 'modelProduct',
  ProductFormat: 'modelProductFormat',
  Category: 'modelCategory',
  Article: 'modelArticle',
  BlogPost: 'modelBlogPost',
  Video: 'modelVideo',
  Webinar: 'modelWebinar',
  QuickReply: 'modelQuickReply',
};

const MODEL_ICONS: Record<string, string> = {
  Product: '🧪',
  ProductFormat: '📦',
  Category: '📂',
  Article: '📄',
  BlogPost: '✍️',
  Video: '🎬',
  Webinar: '🎙️',
  QuickReply: '💬',
};

const ALL_MODELS = ['Product', 'ProductFormat', 'Category', 'Article', 'BlogPost', 'Video', 'Webinar', 'QuickReply'];

// ---------------------------------------------------------------------------
// Translation Wizard (3 steps)
// ---------------------------------------------------------------------------

interface WizardProps {
  overview: Record<string, ModelCoverage>;
  onClose: () => void;
  onComplete: () => void;
  getModelLabel: (m: string) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
}

function TranslationWizard({ overview, onClose, onComplete, getModelLabel, t, locale }: WizardProps) {
  const [step, setStep] = useState(1);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [forceRetranslate, setForceRetranslate] = useState(false);
  const [translationResults, setTranslationResults] = useState<Record<string, { queued: number; error?: string }>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationDone, setTranslationDone] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [liveQueue, setLiveQueue] = useState<QueueStats | null>(null);
  const [liveJobs, setLiveJobs] = useState<QueueJob[]>([]);

  // Step 1: Auto-select models that have untranslated content
  useEffect(() => {
    const modelsWithWork = new Set<string>();
    for (const [model, cov] of Object.entries(overview)) {
      if (cov.untranslated > 0 || cov.partiallyTranslated > 0) {
        modelsWithWork.add(model);
      }
    }
    setSelectedModels(modelsWithWork);
  }, [overview]);

  // Step 3: Poll queue for progress + live jobs
  useEffect(() => {
    if (step === 3 && isTranslating) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/admin/translations/status?queue=true');
          const data = await res.json();
          if (data.queue) setLiveQueue(data.queue);
          if (data.recentJobs) setLiveJobs(data.recentJobs);
          // Auto-complete when queue is empty
          if (data.queue && data.queue.pending === 0 && data.queue.processing === 0) {
            setIsTranslating(false);
            setTranslationDone(true);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch { /* ignore */ }
      }, 2000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, isTranslating]);

  const toggleModel = (model: string) => {
    setSelectedModels(prev => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  };

  const selectAll = () => setSelectedModels(new Set(ALL_MODELS));
  const deselectAll = () => setSelectedModels(new Set());

  // Calculate analysis
  const analysisData = ALL_MODELS.map(model => {
    const cov = overview[model];
    if (!cov) return { model, entities: 0, missing: 0, estimate: 0 };
    const missing = cov.untranslated + cov.partiallyTranslated;
    // 21 target locales (all except source 'fr'), partial ones need ~10 locales on average
    const estimate = forceRetranslate
      ? cov.totalEntities * 21
      : (cov.untranslated * 21) + (cov.partiallyTranslated * 10);
    return { model, entities: cov.totalEntities, missing, estimate };
  });

  const totalEstimate = analysisData
    .filter(a => selectedModels.has(a.model))
    .reduce((sum, a) => sum + a.estimate, 0);

  const totalQueued = Object.values(translationResults).reduce((sum, r) => sum + (r.queued || 0), 0);

  // Step 3: Launch translations
  const startTranslation = async () => {
    setIsTranslating(true);
    const results: Record<string, { queued: number; error?: string }> = {};

    for (const model of selectedModels) {
      try {
        const res = await fetch('/api/admin/translations/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, all: true, force: forceRetranslate }),
        });
        const data = await res.json();
        results[model] = { queued: data.queued || 0 };
      } catch {
        results[model] = { queued: 0, error: 'Network error' };
      }
      setTranslationResults({ ...results });
    }

    setTranslationResults(results);
  };

  const stepTitles = [
    { num: 1, title: t('admin.translationsDashboard.wizardStep1Title'), icon: BarChart3 },
    { num: 2, title: t('admin.translationsDashboard.wizardStep2Title'), icon: Settings },
    { num: 3, title: t('admin.translationsDashboard.wizardStep3Title'), icon: Zap },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="translations-modal-title">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 id="translations-modal-title" className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Languages className="w-5 h-5 text-blue-600" />
            {t('admin.translationsDashboard.wizardTitle')}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b bg-gray-50">
          {stepTitles.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                step === s.num ? 'bg-blue-100 text-blue-700' :
                step > s.num ? 'text-green-600' : 'text-gray-400'
              }`}>
                {step > s.num ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <s.icon className="w-4 h-4" />
                )}
                {s.title}
              </div>
              {i < stepTitles.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-300 mx-1 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* STEP 1: Analysis */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">{t('admin.translationsDashboard.wizardStep1Desc')}</p>

              <div className="space-y-2">
                {analysisData.map(({ model, entities, missing, estimate: _estimate }) => {
                  const cov = overview[model];
                  if (!cov || entities === 0) return null;
                  return (
                    <div key={model} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <span className="text-lg">{MODEL_ICONS[model]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 text-sm">{getModelLabel(model)}</span>
                          <span className="text-xs text-gray-500">{entities} {t('admin.translationsDashboard.wizardEntities', { count: entities }).split(' ').slice(1).join(' ')}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                cov.coveragePercent === 100 ? 'bg-green-500' :
                                cov.coveragePercent > 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${cov.coveragePercent}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600 w-10 text-right">{cov.coveragePercent}%</span>
                        </div>
                        {missing > 0 && (
                          <p className="text-xs text-orange-600 mt-1">
                            {t('admin.translationsDashboard.wizardMissingTranslations', { count: missing })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">{t('admin.translationsDashboard.wizardTotalToTranslate')}</span>
                  <span className="text-lg font-bold text-blue-700">
                    ~{analysisData.reduce((s, a) => s + a.estimate, 0).toLocaleString(locale)}
                  </span>
                </div>
                <p className="text-xs text-blue-600 mt-1">{t('admin.translationsDashboard.wizardLocales')}</p>
              </div>
            </div>
          )}

          {/* STEP 2: Configuration */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">{t('admin.translationsDashboard.wizardStep2Desc')}</p>

              {/* Select/Deselect all */}
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">
                  {t('admin.translationsDashboard.wizardSelectAll')}
                </button>
                <button onClick={deselectAll} className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition">
                  {t('admin.translationsDashboard.wizardDeselectAll')}
                </button>
              </div>

              {/* Model checkboxes */}
              <div className="space-y-2">
                {analysisData.map(({ model, entities, missing, estimate: _estimate }) => {
                  if (entities === 0) return null;
                  const selected = selectedModels.has(model);
                  return (
                    <button
                      key={model}
                      onClick={() => toggleModel(model)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition text-left ${
                        selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {selected ? (
                        <CheckSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300 flex-shrink-0" />
                      )}
                      <span className="text-lg">{MODEL_ICONS[model]}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900 text-sm">{getModelLabel(model)}</span>
                        <span className="text-xs text-gray-500 ms-2">({entities})</span>
                      </div>
                      {missing > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full flex-shrink-0">
                          {t('admin.translationsDashboard.wizardMissingCount', { count: missing })}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Force retranslate toggle */}
              <div className="border-t pt-4">
                <button
                  onClick={() => setForceRetranslate(!forceRetranslate)}
                  className="flex items-center gap-3 w-full p-3 rounded-lg border hover:bg-gray-50 transition"
                >
                  {forceRetranslate ? (
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-300" />
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{t('admin.translationsDashboard.wizardForceRetranslate')}</p>
                    <p className="text-xs text-gray-500">{t('admin.translationsDashboard.wizardForceRetranslateDesc')}</p>
                  </div>
                </button>
              </div>

              {/* Estimate */}
              {selectedModels.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-800">
                      {t('admin.translationsDashboard.wizardEstimate', { count: totalEstimate.toLocaleString(locale) })}
                    </span>
                    <span className="text-xs text-blue-600">
                      {selectedModels.size} {t('admin.translationsDashboard.colType').toLowerCase()}(s)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Execution */}
          {step === 3 && (
            <div className="space-y-4">
              {!translationDone && (
                <p className="text-sm text-gray-500">{t('admin.translationsDashboard.wizardStep3Desc')}</p>
              )}

              {/* Per-model progress */}
              <div className="space-y-2">
                {Array.from(selectedModels).map(model => {
                  const result = translationResults[model];
                  const hasError = result?.error;
                  const isQueued = result && !hasError;
                  const isPending = !result;

                  return (
                    <div key={model} className={`flex items-center gap-3 p-3 rounded-lg border ${
                      hasError ? 'border-red-200 bg-red-50' :
                      isQueued ? 'border-green-200 bg-green-50' :
                      'border-gray-200 bg-gray-50'
                    }`}>
                      <span className="text-lg">{MODEL_ICONS[model]}</span>
                      <div className="flex-1">
                        <span className="font-medium text-gray-900 text-sm">{getModelLabel(model)}</span>
                      </div>
                      {isPending && isTranslating && (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      )}
                      {isQueued && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {t('admin.translationsDashboard.wizardQueued', { count: result.queued })}
                        </span>
                      )}
                      {hasError && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {result.error}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Live translation log - shows individual entities being translated */}
              {(isTranslating || translationDone) && liveJobs.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <RefreshCw className={`w-3.5 h-3.5 ${isTranslating ? 'animate-spin text-blue-500' : 'text-green-500'}`} />
                      {t('admin.translationsDashboard.wizardLiveLog')}
                    </h4>
                    <span className="text-xs text-gray-400">{liveJobs.length} {t('admin.translationsDashboard.wizardJobs')}</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y">
                    {liveJobs.slice(0, 30).map(job => (
                      <div key={job.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50">
                        <span>{MODEL_ICONS[job.model] || '📋'}</span>
                        <span className="font-medium text-gray-700">{getModelLabel(job.model)}</span>
                        <span className="text-gray-400 font-mono truncate max-w-[100px]">#{job.entityId.slice(0, 8)}</span>
                        <span className="flex-1" />
                        {job.status === 'processing' && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {t('admin.translationsDashboard.processing')}
                          </span>
                        )}
                        {job.status === 'completed' && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-3 h-3" />
                            {t('admin.translationsDashboard.completed')}
                          </span>
                        )}
                        {job.status === 'pending' && (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <Clock className="w-3 h-3" />
                            {t('admin.translationsDashboard.pending')}
                          </span>
                        )}
                        {job.status === 'failed' && (
                          <span className="flex items-center gap-1 text-red-600" title={job.error}>
                            <AlertCircle className="w-3 h-3" />
                            {t('admin.translationsDashboard.failed')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live queue stats */}
              {isTranslating && liveQueue && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="text-center p-2 bg-yellow-50 rounded-lg">
                    <p className="text-lg font-bold text-yellow-700">{liveQueue.pending}</p>
                    <p className="text-xs text-yellow-600">{t('admin.translationsDashboard.pending')}</p>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded-lg">
                    <p className="text-lg font-bold text-blue-700">{liveQueue.processing}</p>
                    <p className="text-xs text-blue-600">{t('admin.translationsDashboard.processing')}</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-700">{liveQueue.completed}</p>
                    <p className="text-xs text-green-600">{t('admin.translationsDashboard.completed')}</p>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded-lg">
                    <p className="text-lg font-bold text-red-700">{liveQueue.failed}</p>
                    <p className="text-xs text-red-600">{t('admin.translationsDashboard.failed')}</p>
                  </div>
                </div>
              )}

              {/* Global progress bar */}
              {isTranslating && (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500 flex-shrink-0" />
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                      style={{
                        width: liveQueue
                          ? `${Math.max(5, Math.round(((liveQueue.completed + liveQueue.failed) / Math.max(1, liveQueue.total)) * 100))}%`
                          : '5%',
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {liveQueue ? `${liveQueue.completed + liveQueue.failed}/${liveQueue.total}` : '...'}
                  </span>
                </div>
              )}

              {/* Completion */}
              {translationDone && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-green-800">
                    {t('admin.translationsDashboard.wizardCompleted')}
                  </h3>
                  <p className="text-sm text-green-600 mt-1">
                    {t('admin.translationsDashboard.wizardCompletedDesc', { total: totalQueued })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
          >
            {translationDone ? t('admin.translationsDashboard.wizardClose') : t('admin.translationsDashboard.wizardCancel')}
          </button>

          <div className="flex gap-2">
            {step > 1 && step < 3 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border rounded-lg hover:bg-gray-100 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('admin.translationsDashboard.wizardPrev')}
              </button>
            )}

            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                {t('admin.translationsDashboard.wizardNext')}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 2 && (
              <button
                onClick={() => {
                  if (selectedModels.size === 0) return;
                  setStep(3);
                  startTranslation();
                }}
                disabled={selectedModels.size === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Zap className="w-4 h-4" />
                {t('admin.translationsDashboard.wizardStartTranslation')}
              </button>
            )}

            {step === 3 && translationDone && (
              <button
                onClick={() => { onComplete(); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                {t('admin.translationsDashboard.wizardClose')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function TranslationsDashboard() {
  const { t, locale } = useI18n();
  const [overview, setOverview] = useState<Record<string, ModelCoverage>>({});
  const [queue, setQueue] = useState<QueueStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const [showQueue, setShowQueue] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/translations/status');
      const data = await res.json();
      if (data.overview) setOverview(data.overview);
      if (data.queue) setQueue(data.queue);
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/translations/status?queue=true');
      const data = await res.json();
      if (data.queue) setQueue(data.queue);
      if (data.recentJobs) setRecentJobs(data.recentJobs);
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (showQueue) fetchQueue();
  }, [showQueue, fetchQueue]);

  const getModelLabel = (model: string) => {
    const key = MODEL_KEYS[model];
    return key ? t(`admin.translationsDashboard.${key}`) : model;
  };

  const triggerTranslation = async (model: string) => {
    setTranslating(prev => ({ ...prev, [model]: true }));
    setMessage(null);

    try {
      const res = await fetch('/api/admin/translations/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, all: true, force: false }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message || t('admin.translationsDashboard.translationStarted', { model: getModelLabel(model) }) });
        setTimeout(fetchStatus, 3000);
      } else {
        setMessage({ type: 'error', text: data.error || t('admin.translationsDashboard.triggerError') });
      }
    } catch {
      setMessage({ type: 'error', text: t('admin.translationsDashboard.networkError') });
    } finally {
      setTranslating(prev => ({ ...prev, [model]: false }));
    }
  };

  const totalEntities = Object.values(overview).reduce((sum, m) => sum + (m.totalEntities || 0), 0);
  const totalFullyTranslated = Object.values(overview).reduce((sum, m) => sum + (m.fullyTranslated || 0), 0);
  const globalCoverage = totalEntities > 0 ? Math.round((totalFullyTranslated / totalEntities) * 100) : 0;

  // Ribbon action handlers
  const handleRibbonSave = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonResetDefaults = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonImportConfig = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonExportConfig = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonTest = useCallback(() => {
    setShowWizard(true);
  }, []);

  useRibbonAction('save', handleRibbonSave);
  useRibbonAction('resetDefaults', handleRibbonResetDefaults);
  useRibbonAction('importConfig', handleRibbonImportConfig);
  useRibbonAction('exportConfig', handleRibbonExportConfig);
  useRibbonAction('test', handleRibbonTest);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-label="Loading">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ms-3 text-gray-500">{t('admin.translationsDashboard.loadingStats')}</span>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wizard Modal */}
      {showWizard && (
        <TranslationWizard
          overview={overview}
          onClose={() => setShowWizard(false)}
          onComplete={() => { fetchStatus(); }}
          getModelLabel={getModelLabel}
          t={t}
          locale={locale}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Languages className="w-7 h-7 text-blue-600" />
            {t('admin.translationsDashboard.title')}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('admin.translationsDashboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); fetchStatus(); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            {t('admin.translationsDashboard.refresh')}
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <Zap className="w-4 h-4" />
            {t('admin.translationsDashboard.startSession')}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('admin.translationsDashboard.globalCoverage')}</p>
              <p className="text-2xl font-bold text-gray-900">{globalCoverage}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('admin.translationsDashboard.translatedEntities')}</p>
              <p className="text-2xl font-bold text-gray-900">{totalFullyTranslated}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('admin.translationsDashboard.totalContent')}</p>
              <p className="text-2xl font-bold text-gray-900">{totalEntities}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('admin.translationsDashboard.queue')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {queue ? queue.pending + queue.processing : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Model Coverage Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">{t('admin.translationsDashboard.coverageByType')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t('admin.translationsDashboard.colType')}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('admin.translationsDashboard.colTotal')}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('admin.translationsDashboard.colTranslated')}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('admin.translationsDashboard.colPartial')}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('admin.translationsDashboard.colUntranslated')}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('admin.translationsDashboard.colCoverage')}</th>
                <th className="px-6 py-3 text-end text-xs font-medium text-gray-500 uppercase">{t('admin.translationsDashboard.colAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(overview).map(([model, coverage]) => (
                <tr key={model} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="me-2">{MODEL_ICONS[model] || '📋'}</span>
                    <span className="font-medium text-gray-900">{getModelLabel(model)}</span>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">
                    {coverage.totalEntities}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-green-600 font-medium">{coverage.fullyTranslated}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-yellow-600 font-medium">{coverage.partiallyTranslated}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-red-600 font-medium">{coverage.untranslated}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            coverage.coveragePercent === 100
                              ? 'bg-green-500'
                              : coverage.coveragePercent > 50
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${coverage.coveragePercent}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-600">
                        {coverage.coveragePercent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-end">
                    <button
                      onClick={() => triggerTranslation(model)}
                      disabled={translating[model] || coverage.totalEntities === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {translating[model] ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      {t('admin.translationsDashboard.translateAll')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Queue Section */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <button
          onClick={() => setShowQueue(!showQueue)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            {t('admin.translationsDashboard.translationQueue')}
            {queue && (queue.pending + queue.processing > 0) && (
              <span className="ms-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                {t('admin.translationsDashboard.inProgress', { count: queue.pending + queue.processing })}
              </span>
            )}
          </h2>
          {showQueue ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {showQueue && (
          <div className="px-6 pb-4">
            {queue && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-lg font-bold text-yellow-700">{queue.pending}</p>
                  <p className="text-xs text-yellow-600">{t('admin.translationsDashboard.pending')}</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-lg font-bold text-blue-700">{queue.processing}</p>
                  <p className="text-xs text-blue-600">{t('admin.translationsDashboard.processing')}</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-lg font-bold text-green-700">{queue.completed}</p>
                  <p className="text-xs text-green-600">{t('admin.translationsDashboard.completed')}</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-lg font-bold text-red-700">{queue.failed}</p>
                  <p className="text-xs text-red-600">{t('admin.translationsDashboard.failed')}</p>
                </div>
              </div>
            )}

            {recentJobs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-start text-xs font-medium text-gray-500">{t('admin.translationsDashboard.colJobId')}</th>
                      <th className="px-3 py-2 text-start text-xs font-medium text-gray-500">{t('admin.translationsDashboard.colModel')}</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">{t('admin.translationsDashboard.colPriority')}</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">{t('admin.translationsDashboard.colStatus')}</th>
                      <th className="px-3 py-2 text-start text-xs font-medium text-gray-500">{t('admin.translationsDashboard.colError')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentJobs.slice(0, 20).map(job => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{job.id.slice(0, 12)}</td>
                        <td className="px-3 py-2">
                          {MODEL_ICONS[job.model] || ''} {job.model}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            job.priority <= 2 ? 'bg-red-100 text-red-700' :
                            job.priority <= 3 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            P{job.priority}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                            job.status === 'completed' ? 'bg-green-100 text-green-700' :
                            job.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                            job.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {job.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                            {job.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-red-500 truncate max-w-[200px]">
                          {job.error || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {recentJobs.length === 0 && (
              <p className="text-center text-gray-400 py-4">{t('admin.translationsDashboard.noRecentJobs')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
