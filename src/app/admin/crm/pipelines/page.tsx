'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Settings } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface Stage {
  id: string;
  name: string;
  color: string | null;
  probability: number;
  sortOrder: number;
  _count?: { deals: number };
}

interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
  _count?: { deals: number };
}

export default function PipelinesPage() {
  const { t } = useI18n();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPipelines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/crm/pipelines');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPipelines(json.data || json.pipelines || []);
    } catch {
      toast.error('Failed to load pipelines');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPipelines(); }, [fetchPipelines]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title={t('admin.crm.pipelines') || 'Pipelines CRM'}
        subtitle={t('admin.crm.pipelinesDesc') || 'Configurez les etapes de vos pipelines de vente'}
        actions={
          <button
            onClick={() => toast.info('Creation de pipeline a venir')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nouveau pipeline
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : pipelines.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <Settings className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-2">Aucun pipeline configure</p>
          <p className="text-xs text-slate-400">Les pipelines permettent de suivre vos opportunites de vente par etapes</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pipelines.map(pipeline => (
            <div key={pipeline.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Pipeline Header */}
              <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{pipeline.name}</h3>
                    {pipeline.isDefault && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                        Par defaut
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {pipeline._count?.deals || 0} deal(s) · {pipeline.stages.length} etape(s)
                  </p>
                </div>
                <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50">
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              {/* Stages */}
              <div className="p-5">
                <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
                  {pipeline.stages
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map(stage => (
                      <div
                        key={stage.id}
                        className="flex-1 min-w-[140px] rounded-lg border border-slate-200 p-3 bg-slate-50 hover:bg-white transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color || '#6366f1' }}
                          />
                          <span className="text-sm font-medium text-slate-800 truncate">{stage.name}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{stage.probability}%</span>
                          <span>{stage._count?.deals || 0} deals</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
