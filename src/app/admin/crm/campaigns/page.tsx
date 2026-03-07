'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Plus, Play, Pause, Square, BarChart3, Phone, Mail, MessageSquare,
  Layers, Clock, Users, TrendingUp, ChevronDown, ChevronRight,
  Calendar, X, Search,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CampaignType = 'CALL' | 'EMAIL' | 'SMS' | 'MULTI_CHANNEL';
type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  description: string | null;
  totalLeads: number;
  contacted: number;
  connected: number;
  converted: number;
  revenue: number;
  contactRate: number;
  conversionRate: number;
  activityCount: number;
  callerIdNumber: string | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string | null; email: string | null };
}

interface CampaignStats {
  totals: { totalLeads: number; contacted: number; connected: number; converted: number; revenue: number };
  rates: { contactRate: number; conversionRate: number; connectionRate: number };
  dailyTimeline: Array<{ date: string; total: number; completed: number; failed: number; pending: number }>;
  byChannel: Array<{ channel: string; total: number; completed: number; avgDuration: number; completionRate: number }>;
  byDisposition: Array<{ disposition: string; count: number }>;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<CampaignType, { label: string; icon: React.ReactNode; color: string }> = {
  CALL: { label: 'Call', icon: <Phone className="h-3.5 w-3.5" />, color: 'bg-teal-100 text-teal-700' },
  EMAIL: { label: 'Email', icon: <Mail className="h-3.5 w-3.5" />, color: 'bg-purple-100 text-purple-700' },
  SMS: { label: 'SMS', icon: <MessageSquare className="h-3.5 w-3.5" />, color: 'bg-green-100 text-green-700' },
  MULTI_CHANNEL: { label: 'Multi', icon: <Layers className="h-3.5 w-3.5" />, color: 'bg-orange-100 text-orange-700' },
};

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  SCHEDULED: { label: 'Scheduled', color: 'bg-teal-100 text-teal-700' },
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700' },
  PAUSED: { label: 'Paused', color: 'bg-yellow-100 text-yellow-700' },
  COMPLETED: { label: 'Completed', color: 'bg-indigo-100 text-indigo-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-600' },
};

// ---------------------------------------------------------------------------
// Create Form
// ---------------------------------------------------------------------------

interface CreateFormProps {
  onCreated: (campaign: Campaign) => void;
  onClose: () => void;
}

function CreateCampaignForm({ onCreated, onClose }: CreateFormProps) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'CALL' as CampaignType,
    description: '',
    callerIdNumber: '',
    startAt: '',
    endAt: '',
    maxAttemptsPerLead: 3,
    retryIntervalHours: 24,
    // Target criteria
    status: '',
    temperature: '',
    minScore: '',
    maxScore: '',
    tags: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('admin.crm.campaigns.nameRequired') || 'Campaign name is required');
      return;
    }

    setSaving(true);
    try {
      // Build targetCriteria from form fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetCriteria: Record<string, any> = {};
      if (form.status) targetCriteria.status = form.status;
      if (form.temperature) targetCriteria.temperature = form.temperature;
      if (form.minScore) targetCriteria.minScore = parseInt(form.minScore, 10);
      if (form.maxScore) targetCriteria.maxScore = parseInt(form.maxScore, 10);
      if (form.tags) targetCriteria.tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);

      const payload = {
        name: form.name,
        type: form.type,
        description: form.description || null,
        targetCriteria: Object.keys(targetCriteria).length > 0 ? targetCriteria : null,
        startAt: form.startAt || null,
        endAt: form.endAt || null,
        callerIdNumber: form.callerIdNumber || null,
        maxAttemptsPerLead: form.maxAttemptsPerLead,
        retryIntervalHours: form.retryIntervalHours,
      };

      const res = await fetch('/api/admin/crm/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to create campaign');
      }

      toast.success(t('admin.crm.campaigns.created') || 'Campaign created');
      onCreated(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('admin.crm.campaigns.createTitle') || 'Create Campaign'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>{t('admin.crm.campaigns.name') || 'Campaign Name'} *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls}
                placeholder="Q1 Peptide Outreach..."
                required
              />
            </div>

            <div>
              <label className={labelCls}>{t('admin.crm.campaigns.type') || 'Type'}</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as CampaignType }))}
                className={inputCls}
              >
                <option value="CALL">Call</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="MULTI_CHANNEL">Multi-Channel</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>{t('admin.crm.campaigns.callerId') || 'Caller ID (optional)'}</label>
              <input
                type="tel"
                value={form.callerIdNumber}
                onChange={e => setForm(f => ({ ...f, callerIdNumber: e.target.value }))}
                className={inputCls}
                placeholder="+1 514 555 0100"
              />
            </div>

            <div>
              <label className={labelCls}>{t('admin.crm.campaigns.startAt') || 'Start Date'}</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>{t('admin.crm.campaigns.endAt') || 'End Date'}</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>{t('admin.crm.campaigns.maxAttempts') || 'Max Attempts per Lead'}</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.maxAttemptsPerLead}
                onChange={e => setForm(f => ({ ...f, maxAttemptsPerLead: parseInt(e.target.value, 10) }))}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>{t('admin.crm.campaigns.retryInterval') || 'Retry Interval (hours)'}</label>
              <input
                type="number"
                min={1}
                max={168}
                value={form.retryIntervalHours}
                onChange={e => setForm(f => ({ ...f, retryIntervalHours: parseInt(e.target.value, 10) }))}
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>{t('admin.crm.campaigns.description') || 'Description'}</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className={`${inputCls} h-20 resize-none`}
                placeholder="Campaign goals and notes..."
              />
            </div>
          </div>

          {/* Target Criteria */}
          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-medium text-gray-700 mb-3">
              {t('admin.crm.campaigns.targetCriteria') || 'Target Lead Criteria'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('admin.crm.campaigns.leadStatus') || 'Lead Status'}</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">{t('admin.crm.campaigns.any') || 'Any'}</option>
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="UNQUALIFIED">Unqualified</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>{t('admin.crm.campaigns.temperature') || 'Temperature'}</label>
                <select
                  value={form.temperature}
                  onChange={e => setForm(f => ({ ...f, temperature: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">{t('admin.crm.campaigns.any') || 'Any'}</option>
                  <option value="COLD">Cold</option>
                  <option value="WARM">Warm</option>
                  <option value="HOT">Hot</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>{t('admin.crm.campaigns.minScore') || 'Min Score (0-100)'}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.minScore}
                  onChange={e => setForm(f => ({ ...f, minScore: e.target.value }))}
                  className={inputCls}
                  placeholder="0"
                />
              </div>

              <div>
                <label className={labelCls}>{t('admin.crm.campaigns.maxScore') || 'Max Score (0-100)'}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.maxScore}
                  onChange={e => setForm(f => ({ ...f, maxScore: e.target.value }))}
                  className={inputCls}
                  placeholder="100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>{t('admin.crm.campaigns.tags') || 'Tags (comma-separated)'}</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  className={inputCls}
                  placeholder="peptide, research, premium"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {saving
                ? (t('common.saving') || 'Saving...')
                : (t('admin.crm.campaigns.create') || 'Create Campaign')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign Row
// ---------------------------------------------------------------------------

interface CampaignRowProps {
  campaign: Campaign;
  onRefresh: () => void;
}

function CampaignRow({ campaign, onRefresh }: CampaignRowProps) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const typeConf = TYPE_CONFIG[campaign.type];
  const statusConf = STATUS_CONFIG[campaign.status];

  const loadStats = useCallback(async () => {
    if (stats) return; // Already loaded
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/admin/crm/campaigns/${campaign.id}/stats`);
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch {
      // Silently fail
    } finally {
      setLoadingStats(false);
    }
  }, [campaign.id, stats]);

  const handleExpand = () => {
    setExpanded(e => !e);
    if (!expanded) loadStats();
  };

  const handleAction = async (action: 'start' | 'pause' | 'stop') => {
    setActionLoading(true);
    try {
      let res: Response;
      if (action === 'start') {
        res = await fetch(`/api/admin/crm/campaigns/${campaign.id}/start`, { method: 'POST' });
      } else {
        const newStatus = action === 'pause' ? 'PAUSED' : 'CANCELLED';
        res = await fetch(`/api/admin/crm/campaigns/${campaign.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Action failed');
      toast.success(
        action === 'start'
          ? (t('admin.crm.campaigns.started') || 'Campaign started')
          : action === 'pause'
          ? (t('admin.crm.campaigns.paused') || 'Campaign paused')
          : (t('admin.crm.campaigns.stopped') || 'Campaign stopped')
      );
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Summary Row */}
      <div className="bg-white p-4">
        <div className="flex items-center gap-3">
          {/* Expand toggle */}
          <button
            onClick={handleExpand}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {/* Type badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeConf.color} flex-shrink-0`}>
            {typeConf.icon}
            {typeConf.label}
          </span>

          {/* Name & description */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{campaign.name}</p>
            {campaign.description && (
              <p className="text-xs text-gray-400 truncate">{campaign.description}</p>
            )}
          </div>

          {/* Status */}
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusConf.color}`}>
            {statusConf.label}
          </span>

          {/* Quick stats */}
          <div className="hidden lg:flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {campaign.totalLeads}
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              {campaign.contactRate}%
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED') && (
              <button
                onClick={() => handleAction('start')}
                disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                title={t('admin.crm.campaigns.start') || 'Start'}
              >
                <Play className="h-3.5 w-3.5" />
                {t('admin.crm.campaigns.start') || 'Start'}
              </button>
            )}
            {campaign.status === 'ACTIVE' && (
              <button
                onClick={() => handleAction('pause')}
                disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                title={t('admin.crm.campaigns.pause') || 'Pause'}
              >
                <Pause className="h-3.5 w-3.5" />
                {t('admin.crm.campaigns.pause') || 'Pause'}
              </button>
            )}
            {campaign.status === 'PAUSED' && (
              <button
                onClick={() => handleAction('start')}
                disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                title={t('admin.crm.campaigns.resume') || 'Resume'}
              >
                <Play className="h-3.5 w-3.5" />
                {t('admin.crm.campaigns.resume') || 'Resume'}
              </button>
            )}
            {(campaign.status === 'ACTIVE' || campaign.status === 'PAUSED') && (
              <button
                onClick={() => handleAction('stop')}
                disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                title={t('admin.crm.campaigns.stop') || 'Stop'}
              >
                <Square className="h-3.5 w-3.5" />
                {t('admin.crm.campaigns.stop') || 'Stop'}
              </button>
            )}
          </div>
        </div>

        {/* Performance summary bar */}
        {campaign.totalLeads > 0 && (
          <div className="mt-3 ml-7 grid grid-cols-4 gap-2 text-center">
            <div className="bg-gray-50 rounded-lg px-3 py-1.5">
              <p className="text-xs text-gray-500">{t('admin.crm.campaigns.totalLeads') || 'Leads'}</p>
              <p className="text-sm font-semibold text-gray-800">{campaign.totalLeads.toLocaleString()}</p>
            </div>
            <div className="bg-teal-50 rounded-lg px-3 py-1.5">
              <p className="text-xs text-teal-500">{t('admin.crm.campaigns.contacted') || 'Contacted'}</p>
              <p className="text-sm font-semibold text-teal-700">{campaign.contacted.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 rounded-lg px-3 py-1.5">
              <p className="text-xs text-green-500">{t('admin.crm.campaigns.converted') || 'Converted'}</p>
              <p className="text-sm font-semibold text-green-700">{campaign.converted.toLocaleString()}</p>
            </div>
            <div className="bg-purple-50 rounded-lg px-3 py-1.5">
              <p className="text-xs text-purple-500">{t('admin.crm.campaigns.conversionRate') || 'Conv. Rate'}</p>
              <p className="text-sm font-semibold text-purple-700">{campaign.conversionRate}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-5">
          {loadingStats ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500" />
            </div>
          ) : !stats ? (
            <p className="text-sm text-gray-400 text-center py-4">
              {t('admin.crm.campaigns.noStats') || 'No statistics available yet'}
            </p>
          ) : (
            <div className="space-y-6">
              {/* Key metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard
                  icon={<Phone className="h-4 w-4" />}
                  label={t('admin.crm.campaigns.contactRate') || 'Contact Rate'}
                  value={`${stats.rates.contactRate}%`}
                  color="text-teal-600"
                />
                <MetricCard
                  icon={<Users className="h-4 w-4" />}
                  label={t('admin.crm.campaigns.connectionRate') || 'Connection Rate'}
                  value={`${stats.rates.connectionRate}%`}
                  color="text-green-600"
                />
                <MetricCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  label={t('admin.crm.campaigns.conversionRate') || 'Conversion Rate'}
                  value={`${stats.rates.conversionRate}%`}
                  color="text-purple-600"
                />
                <MetricCard
                  icon={<BarChart3 className="h-4 w-4" />}
                  label={t('admin.crm.campaigns.revenue') || 'Revenue'}
                  value={`$${stats.totals.revenue.toFixed(0)}`}
                  color="text-orange-600"
                />
              </div>

              {/* Channel breakdown */}
              {stats.byChannel.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {t('admin.crm.campaigns.byChannel') || 'By Channel'}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 border-b border-gray-200">
                          <th className="pb-1.5 text-left font-medium">
                            {t('admin.crm.campaigns.channel') || 'Channel'}
                          </th>
                          <th className="pb-1.5 text-right font-medium">
                            {t('admin.crm.campaigns.total') || 'Total'}
                          </th>
                          <th className="pb-1.5 text-right font-medium">
                            {t('admin.crm.campaigns.completed') || 'Completed'}
                          </th>
                          <th className="pb-1.5 text-right font-medium">
                            {t('admin.crm.campaigns.rate') || 'Rate'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {stats.byChannel.map(row => (
                          <tr key={row.channel} className="hover:bg-white">
                            <td className="py-1.5 capitalize font-medium text-gray-700">{row.channel}</td>
                            <td className="py-1.5 text-right text-gray-500">{row.total}</td>
                            <td className="py-1.5 text-right text-green-600">{row.completed}</td>
                            <td className="py-1.5 text-right text-gray-700">{row.completionRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Daily timeline mini chart */}
              {stats.dailyTimeline.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {t('admin.crm.campaigns.dailyActivity') || 'Daily Activity (last 30 days)'}
                  </p>
                  <div className="flex items-end gap-0.5 h-16">
                    {stats.dailyTimeline.slice(-30).map(day => {
                      const maxTotal = Math.max(...stats.dailyTimeline.map(d => d.total), 1);
                      const hPct = (day.total / maxTotal) * 100;
                      return (
                        <div
                          key={day.date}
                          className="flex-1 bg-teal-400 rounded-t hover:bg-teal-500 transition-colors"
                          style={{ height: `${hPct}%` }}
                          title={`${day.date}: ${day.total} activities (${day.completed} completed, ${day.failed} failed)`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {stats.dailyTimeline[stats.dailyTimeline.length - 1]?.date}
                  </p>
                </div>
              )}

              {/* Campaign metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {campaign.startAt
                      ? new Date(campaign.startAt).toLocaleDateString(locale)
                      : (t('admin.crm.campaigns.noStartDate') || 'No start date')}
                    {campaign.endAt && ` → ${new Date(campaign.endAt).toLocaleDateString(locale)}`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {t('admin.crm.campaigns.created') || 'Created'}:{' '}
                    {new Date(campaign.createdAt).toLocaleDateString(locale)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className={`flex items-center gap-1.5 text-xs mb-1 ${color} opacity-80`}>
        {icon}
        <span>{label}</span>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CampaignsPage() {
  const { t } = useI18n();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('type', filterType);

      const res = await fetch(`/api/admin/crm/campaigns?${params}`);
      const json = await res.json();

      if (json.success) {
        setCampaigns(json.data || []);
        setPagination(json.pagination || null);
      }
    } catch {
      toast.error(t('admin.crm.campaigns.loadError') || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterType, t]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleCreated = (campaign: Campaign) => {
    setShowCreate(false);
    setCampaigns(prev => [campaign, ...prev]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-teal-600" />
            {t('admin.crm.campaigns.title') || 'Campaign Management'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.campaigns.subtitle') || 'Create, manage, and monitor outreach campaigns'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          {t('admin.crm.campaigns.new') || 'New Campaign'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('admin.crm.campaigns.search') || 'Search campaigns...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">{t('admin.crm.campaigns.allStatuses') || 'All Statuses'}</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">{t('admin.crm.campaigns.allTypes') || 'All Types'}</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {t('admin.crm.campaigns.empty') || 'No campaigns found'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {t('admin.crm.campaigns.emptyDesc') || 'Create your first campaign to start reaching leads'}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            {t('admin.crm.campaigns.new') || 'New Campaign'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <CampaignRow key={c.id} campaign={c} onRefresh={fetchCampaigns} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 text-sm text-gray-500">
          <p>
            {t('admin.crm.campaigns.showing') || 'Showing'}{' '}
            {((pagination.page - 1) * pagination.pageSize) + 1}
            {' - '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            {' '}
            {t('common.of') || 'of'} {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev}
              className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              {t('common.previous') || 'Previous'}
            </button>
            <span className="px-3 py-1.5 text-gray-700 font-medium">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!pagination.hasNext}
              className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              {t('common.next') || 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateCampaignForm
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
