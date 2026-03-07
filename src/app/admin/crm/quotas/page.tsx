'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { Target, Plus, TrendingUp } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Quota {
  id: string;
  agentId: string;
  agent: { name: string | null };
  period: string;
  periodStart: string;
  periodEnd: string;
  targetType: string;
  target: number;
  actual: number;
  createdAt: string;
}

interface AgentOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function QuotasPage() {
  const { t } = useI18n();
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [agents, setAgents] = useState<AgentOption[]>([]);

  // Form state
  const [formAgentId, setFormAgentId] = useState('');
  const [formPeriod, setFormPeriod] = useState('monthly');
  const [formType, setFormType] = useState('calls');
  const [formTarget, setFormTarget] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchQuotas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/crm/quotas');
      const json = await res.json();
      if (json.success) {
        setQuotas(json.data || []);
      }
    } catch {
      toast.error(t('admin.crm.quotas.loadError') || 'Failed to load quotas');
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/agents/performance');
      const json = await res.json();
      if (json.success && json.data) {
        setAgents(
          json.data.map((a: { id: string; name: string | null }) => ({
            id: a.id,
            name: a.name || 'Unknown',
          }))
        );
      }
    } catch {
      // Silently fail - agents dropdown will be empty
    }
  }, []);

  useEffect(() => {
    fetchQuotas();
    fetchAgents();
  }, [fetchQuotas, fetchAgents]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAgentId || !formTarget) {
      toast.error(t('admin.crm.quotas.fillRequired') || 'Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/crm/quotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: formAgentId,
          period: formPeriod,
          type: formType,
          target: Number(formTarget),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to create quota');
      }
      toast.success(t('admin.crm.quotas.created') || 'Quota created');
      setShowForm(false);
      setFormAgentId('');
      setFormTarget('');
      fetchQuotas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create quota');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/crm/quotas/${id}`, { method: 'DELETE' });
      if (res.status === 204 || res.ok) {
        toast.success(t('admin.crm.quotas.deleted') || 'Quota deleted');
        setQuotas((prev) => prev.filter((q) => q.id !== id));
      } else {
        throw new Error('Failed to delete');
      }
    } catch {
      toast.error(t('admin.crm.quotas.deleteError') || 'Failed to delete quota');
    }
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getProgressBg = (pct: number) => {
    if (pct >= 80) return 'bg-green-100';
    if (pct >= 50) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const formatType = (type: string) => {
    switch (type) {
      case 'calls': return 'Calls';
      case 'revenue': return 'Revenue';
      case 'deals': return 'Deals';
      case 'conversions': return 'Conversions';
      default: return type;
    }
  };

  const formatPeriod = (period: string) => {
    switch (period) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      default: return period;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="h-6 w-6 text-teal-600" />
            {t('admin.crm.quotas.title') || 'Quotas & Goals'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.quotas.subtitle') || 'Set and track agent performance targets'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          {t('admin.crm.quotas.new') || 'New Quota'}
        </button>
      </div>

      {/* Inline Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {t('admin.crm.quotas.createTitle') || 'Create New Quota'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.quotas.agent') || 'Agent'} *
              </label>
              <select
                value={formAgentId}
                onChange={(e) => setFormAgentId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">{t('admin.crm.quotas.selectAgent') || 'Select agent...'}</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.quotas.period') || 'Period'}
              </label>
              <select
                value={formPeriod}
                onChange={(e) => setFormPeriod(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.quotas.type') || 'Type'}
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="calls">Calls</option>
                <option value="revenue">Revenue</option>
                <option value="deals">Deals</option>
                <option value="conversions">Conversions</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.quotas.target') || 'Target'} *
              </label>
              <input
                type="number"
                min={1}
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="100"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? (t('common.saving') || 'Saving...') : (t('admin.crm.quotas.create') || 'Create Quota')}
            </button>
          </div>
        </form>
      )}

      {/* Quotas Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      ) : quotas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {t('admin.crm.quotas.empty') || 'No quotas configured'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {t('admin.crm.quotas.emptyDesc') || 'Create quotas to track agent performance targets'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotas.agentColumn') || 'Agent'}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotas.periodColumn') || 'Period'}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotas.typeColumn') || 'Type'}
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotas.targetColumn') || 'Target'}
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotas.actualColumn') || 'Actual'}
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 min-w-[160px]">
                    {t('admin.crm.quotas.progressColumn') || 'Progress'}
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotas.actions') || 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotas.map((quota) => {
                  const targetNum = Number(quota.target);
                  const actualNum = Number(quota.actual);
                  const pct = targetNum > 0 ? Math.min(Math.round((actualNum / targetNum) * 100), 100) : 0;

                  return (
                    <tr key={quota.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {quota.agent?.name || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatPeriod(quota.period)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatType(quota.targetType)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {targetNum.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {actualNum.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 h-2 rounded-full ${getProgressBg(pct)}`}>
                            <div
                              className={`h-2 rounded-full transition-all ${getProgressColor(pct)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold min-w-[36px] text-right ${
                            pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(quota.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          {t('common.delete') || 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
