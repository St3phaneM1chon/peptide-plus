'use client';

import { useState, useEffect } from 'react';
import {
  GitBranch, Plus, Play, Pause, Trash2, Edit, Zap,
  Mail, Clock, GitMerge,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

interface FlowNodeSummary {
  type: string;
  [key: string]: unknown;
}

interface Flow {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  isActive: boolean;
  nodes: FlowNodeSummary[];
  edges: unknown[];
  stats: { triggered: number; sent: number; opened: number; clicked: number; revenue: number };
  updatedAt: string;
}

interface FlowListProps {
  onEditFlow: (flowId: string) => void;
  onCreateFlow: () => void;
}

export default function FlowList({ onEditFlow, onCreateFlow }: FlowListProps) {
  const { t, locale } = useI18n();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flowToDelete, setFlowToDelete] = useState<string | null>(null);

  const triggerLabels: Record<string, { label: string; icon: typeof Zap; color: string }> = {
    'order.created': { label: t('admin.emails.flows.triggerOrderCreated'), icon: Zap, color: 'text-green-500' },
    'order.shipped': { label: t('admin.emails.flows.triggerOrderShipped'), icon: Zap, color: 'text-blue-500' },
    'order.delivered': { label: t('admin.emails.flows.triggerOrderDelivered'), icon: Zap, color: 'text-emerald-500' },
    'cart.abandoned': { label: t('admin.emails.flows.triggerCartAbandoned'), icon: Zap, color: 'text-orange-500' },
    'user.registered': { label: t('admin.emails.flows.triggerUserRegistered'), icon: Zap, color: 'text-purple-500' },
    'user.birthday': { label: t('admin.emails.flows.triggerBirthday'), icon: Zap, color: 'text-pink-500' },
    'winback.eligible': { label: t('admin.emails.flows.triggerWinback'), icon: Zap, color: 'text-red-500' },
    'reorder.due': { label: t('admin.emails.flows.triggerReorder'), icon: Zap, color: 'text-amber-500' },
  };

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    try {
      const res = await fetch('/api/admin/emails/flows');
      if (res.ok) {
        const data = await res.json();
        setFlows(data.flows || []);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const toggleFlow = async (flowId: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/emails/flows/${flowId}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isActive: !isActive }),
      });
      setFlows(flows.map(f => f.id === flowId ? { ...f, isActive: !isActive } : f));
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    }
  };

  const deleteFlow = async (flowId: string) => {
    setDeletingId(flowId);
    try {
      await fetch(`/api/admin/emails/flows/${flowId}`, { method: 'DELETE', headers: addCSRFHeader() });
      setFlows(flows.filter(f => f.id !== flowId));
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setDeletingId(null);
      setFlowToDelete(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32" role="status" aria-label="Loading"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500" /><span className="sr-only">Loading...</span></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t('admin.emails.flows.title')}</h3>
          <p className="text-sm text-slate-500">{flows.length} {t('admin.emails.flows.workflowCount')} - {flows.filter(f => f.isActive).length} {t('admin.emails.flows.activeCount')}</p>
        </div>
        <button
          onClick={onCreateFlow}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-lg"
        >
          <Plus className="h-4 w-4" /> {t('admin.emails.flows.newWorkflow')}
        </button>
      </div>

      {flows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <GitBranch className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-slate-900 mb-1">{t('admin.emails.flows.noFlows')}</h4>
          <p className="text-sm text-slate-500 mb-4">{t('admin.emails.flows.createFirstFlow')}</p>
          <button
            onClick={onCreateFlow}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-lg"
          >
            {t('admin.emails.flows.getStarted')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {flows.map((flow) => {
            const trigger = triggerLabels[flow.trigger] || { label: flow.trigger, icon: Zap, color: 'text-slate-500' };
            const TriggerIcon = trigger.icon;

            return (
              <div key={flow.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TriggerIcon className={`h-5 w-5 ${trigger.color}`} />
                    <div>
                      <h4 className="font-semibold text-slate-900">{flow.name}</h4>
                      <p className="text-xs text-slate-500">{trigger.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleFlow(flow.id, flow.isActive)}
                      className={`p-1.5 rounded ${flow.isActive ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-50'}`}
                      title={flow.isActive ? t('admin.emails.flows.deactivate') : t('admin.emails.flows.activate')}
                      aria-label={flow.isActive ? 'Desactiver le flux' : 'Activer le flux'}
                    >
                      {flow.isActive ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </button>
                    <button onClick={() => onEditFlow(flow.id)} className="p-1.5 rounded text-slate-400 hover:bg-slate-50" aria-label="Modifier le flux">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => setFlowToDelete(flow.id)} disabled={deletingId === flow.id} className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50" aria-label="Supprimer le flux">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {flow.description && (
                  <p className="text-sm text-slate-600 mb-3">{flow.description}</p>
                )}

                {/* Flow preview: node count */}
                <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {flow.nodes.filter((n) => n.type === 'email').length} {t('admin.emails.flows.emailsLabel')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {flow.nodes.filter((n) => n.type === 'delay').length} {t('admin.emails.flows.delaysLabel')}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitMerge className="h-3 w-3" /> {flow.nodes.filter((n) => n.type === 'condition').length} {t('admin.emails.flows.conditionsLabel')}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-2 bg-slate-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-900">{flow.stats.triggered}</div>
                    <div className="text-[10px] text-slate-400">{t('admin.emails.flows.statsTriggered')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-900">{flow.stats.sent}</div>
                    <div className="text-[10px] text-slate-400">{t('admin.emails.flows.statsSent')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-900">{flow.stats.opened}</div>
                    <div className="text-[10px] text-slate-400">{t('admin.emails.flows.statsOpened')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-green-600">{flow.stats.revenue}$</div>
                    <div className="text-[10px] text-slate-400">{t('admin.emails.flows.statsRevenue')}</div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${flow.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {flow.isActive ? t('admin.emails.flows.active') : t('admin.emails.flows.inactive')}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {t('admin.emails.flows.modified')}: {new Date(flow.updatedAt).toLocaleDateString(locale)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete flow ConfirmDialog (replaces native confirm()) */}
      <ConfirmDialog
        isOpen={flowToDelete !== null}
        title={t('admin.emails.flows.deleteTitle') || 'Delete Workflow'}
        message={t('admin.emails.flows.confirmDelete')}
        confirmLabel={t('common.delete') || 'Delete'}
        cancelLabel={t('common.cancel')}
        onConfirm={() => { if (flowToDelete) deleteFlow(flowToDelete); }}
        onCancel={() => setFlowToDelete(null)}
        variant="danger"
      />
    </div>
  );
}
