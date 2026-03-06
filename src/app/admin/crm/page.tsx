'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Users,
  Handshake,
  Plus,
  Mail,
  Phone,
  User,
  DollarSign,
  Target,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────

interface Lead {
  id: string;
  email: string;
  name: string | null;
  source: string;
  createdAt: string;
  notes: string | null;
}

interface Deal {
  id: string;
  contactId: string;
  contactName: string | null;
  contactEmail: string | null;
  value: number;
  stage: string;
  source: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PipelineSummary {
  [stage: string]: { count: number; totalValue: number };
}

type Tab = 'leads' | 'deals';

const DEAL_STAGES = ['PROSPECT', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;

const stageColors: Record<string, { bg: string; text: string }> = {
  PROSPECT: { bg: 'bg-slate-100', text: 'text-slate-700' },
  QUALIFIED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  PROPOSAL: { bg: 'bg-purple-100', text: 'text-purple-700' },
  NEGOTIATION: { bg: 'bg-amber-100', text: 'text-amber-700' },
  WON: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  LOST: { bg: 'bg-red-100', text: 'text-red-700' },
};

// ── Main Component ────────────────────────────────────────────

export default function CRMPage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>('leads');

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [totalUserLeads, setTotalUserLeads] = useState(0);
  const [totalNewsletterLeads, setTotalNewsletterLeads] = useState(0);

  // Deals state
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineSummary>({});
  const [totalDeals, setTotalDeals] = useState(0);

  // Modals
  const [showNewLead, setShowNewLead] = useState(false);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state - Lead
  const [leadForm, setLeadForm] = useState({ name: '', email: '', source: '', notes: '' });

  // Form state - Deal
  const [dealForm, setDealForm] = useState({ contactId: '', value: '', stage: 'PROSPECT', notes: '' });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(amount);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });

  // ── Fetch Leads ──

  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const res = await fetch('/api/admin/crm/leads?limit=50');
      if (!res.ok) {
        toast.error('Failed to fetch leads');
        return;
      }
      const json = await res.json();
      setLeads(json.data || []);
      setTotalUserLeads(json.pagination?.totalUserLeads || 0);
      setTotalNewsletterLeads(json.pagination?.totalNewsletterLeads || 0);
    } catch {
      toast.error('Network error');
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  // ── Fetch Deals ──

  const fetchDeals = useCallback(async () => {
    setDealsLoading(true);
    try {
      const res = await fetch('/api/admin/crm/deals?limit=50');
      if (!res.ok) {
        toast.error('Failed to fetch deals');
        return;
      }
      const json = await res.json();
      setDeals(json.data || []);
      setPipeline(json.pipeline || {});
      setTotalDeals(json.pagination?.total || 0);
    } catch {
      toast.error('Network error');
    } finally {
      setDealsLoading(false);
    }
  }, []);

  // ── Initial Load ──

  useEffect(() => {
    if (activeTab === 'leads') fetchLeads();
    else fetchDeals();
  }, [activeTab, fetchLeads, fetchDeals]);

  // ── Create Lead ──

  const handleCreateLead = async () => {
    if (!leadForm.name.trim() || !leadForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leadForm.name.trim(),
          email: leadForm.email.trim(),
          source: leadForm.source.trim() || undefined,
          notes: leadForm.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to create lead');
        return;
      }
      toast.success('Lead created');
      setShowNewLead(false);
      setLeadForm({ name: '', email: '', source: '', notes: '' });
      fetchLeads();
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Create Deal ──

  const handleCreateDeal = async () => {
    if (!dealForm.contactId.trim() || !dealForm.value.trim()) {
      toast.error('Contact ID and value are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/crm/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: dealForm.contactId.trim(),
          value: parseFloat(dealForm.value),
          stage: dealForm.stage,
          notes: dealForm.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to create deal');
        return;
      }
      toast.success('Deal created');
      setShowNewDeal(false);
      setDealForm({ contactId: '', value: '', stage: 'PROSPECT', notes: '' });
      fetchDeals();
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render helpers ──

  const sourceBadge = (source: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      signup: { bg: 'bg-blue-100', text: 'text-blue-700' },
      newsletter: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
      manual_lead: { bg: 'bg-purple-100', text: 'text-purple-700' },
    };
    const s = map[source] || { bg: 'bg-slate-100', text: 'text-slate-700' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.bg} ${s.text}`}>
        {source}
      </span>
    );
  };

  const stageBadge = (stage: string) => {
    const s = stageColors[stage] || { bg: 'bg-slate-100', text: 'text-slate-700' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.bg} ${s.text}`}>
        {stage}
      </span>
    );
  };

  const pipelineTotal = Object.values(pipeline).reduce((sum, s) => sum + s.totalValue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('admin.crm.dashboardTitle') || 'CRM - Leads & Deals'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('admin.crm.dashboardDesc') || 'Manage leads and sales pipeline'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('leads')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'leads'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          {t('admin.crm.leads') || 'Leads'}
        </button>
        <button
          onClick={() => setActiveTab('deals')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'deals'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Handshake className="w-4 h-4" />
          {t('admin.crm.deals') || 'Deals'}
        </button>
      </div>

      {/* ── LEADS TAB ── */}
      {activeTab === 'leads' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label={t('admin.crm.totalLeads') || 'Total Leads'} value={leads.length} icon={Users} />
            <StatCard label={t('admin.crm.fromSignups') || 'From Signups'} value={totalUserLeads} icon={User} />
            <StatCard label={t('admin.crm.fromNewsletter') || 'From Newsletter'} value={totalNewsletterLeads} icon={Mail} />
          </div>

          {/* Action bar */}
          <div className="flex justify-end">
            <Button variant="primary" icon={Plus} size="sm" onClick={() => setShowNewLead(true)}>
              {t('admin.crm.newLead') || 'New Lead'}
            </Button>
          </div>

          {/* Loading */}
          {leadsLoading && (
            <div className="flex items-center justify-center h-48" role="status">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
            </div>
          )}

          {/* Leads table */}
          {!leadsLoading && leads.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">{t('common.name') || 'Name'}</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">{t('common.email') || 'Email'}</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">{t('admin.crm.source') || 'Source'}</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">{t('common.date') || 'Date'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {lead.name || '---'}
                      </td>
                      <td className="px-6 py-3 text-slate-600">{lead.email}</td>
                      <td className="px-6 py-3">{sourceBadge(lead.source)}</td>
                      <td className="px-6 py-3 text-slate-600">{formatDate(lead.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {!leadsLoading && leads.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">{t('admin.crm.noLeadsFound') || 'No leads found'}</h3>
              <p className="text-sm text-slate-500 mb-4">
                {t('admin.crm.noLeadsDesc') || 'Create a lead manually or wait for signups and newsletter subscriptions.'}
              </p>
            </div>
          )}
        </>
      )}

      {/* ── DEALS TAB ── */}
      {activeTab === 'deals' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label={t('admin.crm.totalDeals') || 'Total Deals'} value={totalDeals} icon={Handshake} />
            <StatCard label={t('admin.crm.pipelineValue') || 'Pipeline Value'} value={formatCurrency(pipelineTotal)} icon={DollarSign} />
            <StatCard
              label={t('admin.crm.won') || 'Won'}
              value={pipeline['WON']?.count || 0}
              icon={TrendingUp}
            />
            <StatCard
              label={t('admin.crm.wonValue') || 'Won Value'}
              value={formatCurrency(pipeline['WON']?.totalValue || 0)}
              icon={Target}
            />
          </div>

          {/* Pipeline stages visual */}
          {Object.keys(pipeline).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4">{t('admin.crm.pipelineStages') || 'Pipeline Stages'}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {DEAL_STAGES.map((stage) => {
                  const data = pipeline[stage] || { count: 0, totalValue: 0 };
                  const colors = stageColors[stage];
                  return (
                    <div key={stage} className={`text-center p-3 rounded-lg ${colors.bg}`}>
                      <p className={`text-lg font-bold ${colors.text}`}>{data.count}</p>
                      <p className={`text-xs font-medium ${colors.text} mt-0.5`}>{stage}</p>
                      <p className={`text-xs ${colors.text} opacity-75 mt-1`}>
                        {formatCurrency(data.totalValue)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="flex justify-end">
            <Button variant="primary" icon={Plus} size="sm" onClick={() => setShowNewDeal(true)}>
              {t('admin.crm.newDeal') || 'New Deal'}
            </Button>
          </div>

          {/* Loading */}
          {dealsLoading && (
            <div className="flex items-center justify-center h-48" role="status">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
            </div>
          )}

          {/* Deals table */}
          {!dealsLoading && deals.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">{t('admin.crm.contact') || 'Contact'}</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">{t('admin.crm.dealValue') || 'Value'}</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">{t('admin.crm.stage') || 'Stage'}</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">{t('admin.crm.createdBy') || 'Created By'}</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">{t('common.date') || 'Date'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{deal.contactName || '---'}</p>
                          <p className="text-xs text-slate-500">{deal.contactEmail}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3 font-semibold text-slate-900">
                        {formatCurrency(deal.value)}
                      </td>
                      <td className="px-6 py-3">{stageBadge(deal.stage)}</td>
                      <td className="px-6 py-3 text-slate-600">{deal.createdBy || '---'}</td>
                      <td className="px-6 py-3 text-slate-600">{formatDate(deal.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {!dealsLoading && deals.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <Handshake className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">{t('admin.crm.noDealsYet') || 'No deals yet'}</h3>
              <p className="text-sm text-slate-500 mb-4">
                {t('admin.crm.noDealsDesc') || 'Create your first deal to start tracking your sales pipeline.'}
              </p>
            </div>
          )}
        </>
      )}

      {/* ── New Lead Modal ── */}
      <Modal isOpen={showNewLead} onClose={() => setShowNewLead(false)} title={t('admin.crm.newLead') || 'New Lead'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <User className="w-3.5 h-3.5 inline mr-1" />
              {t('common.name') || 'Name'} *
            </label>
            <input
              type="text"
              value={leadForm.name}
              onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <Mail className="w-3.5 h-3.5 inline mr-1" />
              {t('common.email') || 'Email'} *
            </label>
            <input
              type="email"
              value={leadForm.email}
              onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <Phone className="w-3.5 h-3.5 inline mr-1" />
              {t('admin.crm.source') || 'Source'}
            </label>
            <input
              type="text"
              value={leadForm.source}
              onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="e.g. referral, website, trade show"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              {t('common.notes') || 'Notes'}
            </label>
            <textarea
              value={leadForm.notes}
              onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
              className="w-full h-24 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"
              placeholder="Additional notes..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowNewLead(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateLead} loading={submitting}>
              {t('admin.crm.createLead') || 'Create Lead'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── New Deal Modal ── */}
      <Modal isOpen={showNewDeal} onClose={() => setShowNewDeal(false)} title={t('admin.crm.newDeal') || 'New Deal'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <User className="w-3.5 h-3.5 inline mr-1" />
              {t('admin.crm.contactId') || 'Contact ID'} *
            </label>
            <input
              type="text"
              value={dealForm.contactId}
              onChange={(e) => setDealForm({ ...dealForm, contactId: e.target.value })}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="User ID (from leads or customers)"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <DollarSign className="w-3.5 h-3.5 inline mr-1" />
              {t('admin.crm.valueCad') || 'Value (CAD)'} *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={dealForm.value}
              onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <Target className="w-3.5 h-3.5 inline mr-1" />
              {t('admin.crm.stage') || 'Stage'}
            </label>
            <select
              value={dealForm.stage}
              onChange={(e) => setDealForm({ ...dealForm, stage: e.target.value })}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
            >
              {DEAL_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              {t('common.notes') || 'Notes'}
            </label>
            <textarea
              value={dealForm.notes}
              onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })}
              className="w-full h-24 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"
              placeholder="Deal details..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowNewDeal(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateDeal} loading={submitting}>
              {t('admin.crm.createDeal') || 'Create Deal'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
