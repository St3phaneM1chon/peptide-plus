'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, Search, CheckCircle2, XCircle,
  MapPin, GitMerge, Users, Download, Star, Globe, RefreshCw,
  ChevronLeft, ChevronRight, Pencil, Check, X, ExternalLink,
  Phone, MapPinned, Zap, BarChart3, FileDown, Shield,
  Megaphone, Clock, CalendarDays,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProspectListDetail {
  id: string;
  name: string;
  description?: string | null;
  source: string;
  status: string;
  sourceQuery?: string | null;
  totalCount: number;
  validatedCount: number;
  duplicateCount: number;
  integratedCount: number;
  assignmentMethod: string;
  assignmentConfig?: Record<string, unknown> | null;
  tags: string[];
  statusBreakdown?: Record<string, number>;
  createdBy?: { name: string | null; email: string } | null;
  createdAt: string;
}

interface Prospect {
  id: string;
  contactName: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
  industry?: string | null;
  notes?: string | null;
  googlePlaceId?: string | null;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  googleCategory?: string | null;
  enrichmentScore?: number | null;
  enrichedAt?: string | null;
  enrichmentSource?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  linkedinUrl?: string | null;
  dncStatus?: string | null;
  status: string;
  duplicateOf?: { id: string; contactName: string } | null;
  convertedLead?: { id: string; contactName: string; status: string } | null;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string | null;
  email: string;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-teal-100 text-teal-700',
  VALIDATED: 'bg-green-100 text-green-700',
  DUPLICATE: 'bg-orange-100 text-orange-700',
  MERGED: 'bg-gray-100 text-gray-600',
  INTEGRATED: 'bg-purple-100 text-purple-700',
  EXCLUDED: 'bg-red-100 text-red-700',
};

const TABS = ['prospects', 'googleMaps', 'enrichment', 'duplicates', 'assignment', 'campaign'] as const;
type Tab = (typeof TABS)[number];

// ---------------------------------------------------------------------------
// Score badge helper
// ---------------------------------------------------------------------------

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="text-gray-300 text-xs">-</span>;
  let color = 'bg-red-100 text-red-700';
  if (score >= 80) color = 'bg-green-100 text-green-700';
  else if (score >= 50) color = 'bg-yellow-100 text-yellow-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {score}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProspectListDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const listId = params.id as string;

  const [list, setList] = useState<ProspectListDetail | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 30;

  const [tab, setTab] = useState<Tab>('prospects');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Inline edit
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Add prospect modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProspect, setNewProspect] = useState({ contactName: '', companyName: '', email: '', phone: '', city: '' });

  // Google Maps search
  const [gmQuery, setGmQuery] = useState('');
  const [gmLocation, setGmLocation] = useState('');
  const [gmMaxResults, setGmMaxResults] = useState(100);
  const [scraping, setScraping] = useState(false);

  // Enrichment
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ total: number; enriched: number; emailsFound: number; errors: number } | null>(null);
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ scored: number; averageScore: number; distribution: { hot: number; warm: number; cold: number } } | null>(null);

  // Assignment
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [assignMethod, setAssignMethod] = useState('ROUND_ROBIN');
  const [integrating, setIntegrating] = useState(false);

  // Campaign
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [callerIdNumber, setCallerIdNumber] = useState('');
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptBody, setScriptBody] = useState('');
  const [campaignStartTime, setCampaignStartTime] = useState('09:00');
  const [campaignEndTime, setCampaignEndTime] = useState('17:00');
  const [campaignTimezone, setCampaignTimezone] = useState('America/Montreal');
  const [campaignActiveDays, setCampaignActiveDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [campaignMaxConcurrent, setCampaignMaxConcurrent] = useState(1);
  const [campaignUseAmd, setCampaignUseAmd] = useState(true);
  const [launchingCampaign, setLaunchingCampaign] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchList = useCallback(async () => {
    const res = await fetch(`/api/admin/crm/lists/${listId}`);
    const json = await res.json();
    if (json.success) setList(json.data);
  }, [listId]);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);

    try {
      const res = await fetch(`/api/admin/crm/lists/${listId}/prospects?${params}`);
      const json = await res.json();
      if (json.success) {
        setProspects(json.data);
        setTotal(json.pagination?.total || 0);
      }
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [listId, page, search, statusFilter]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?role=EMPLOYEE&limit=100');
      const json = await res.json();
      if (json.success) setAgents(json.data || []);
    } catch {
      // noop
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/company?limit=100');
      const json = await res.json();
      const items = json.companies || [];
      if (items.length > 0) {
        setCompanies(items.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        setSelectedCompanyId(items[0].id);
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => { fetchList(); fetchAgents(); fetchCompanies(); }, [fetchList, fetchAgents, fetchCompanies]);
  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  // ---------------------------------------------------------------------------
  // Inline edit
  // ---------------------------------------------------------------------------

  function startEdit(id: string, field: string, currentValue: string) {
    setEditingCell({ id, field });
    setEditValue(currentValue || '');
  }

  async function saveEdit() {
    if (!editingCell) return;
    try {
      const res = await fetch(`/api/admin/crm/lists/${listId}/prospects/${editingCell.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editingCell.field]: editValue || null }),
      });
      const json = await res.json();
      if (json.success) {
        setProspects((prev) => prev.map((p) => p.id === editingCell.id ? { ...p, [editingCell.field]: editValue || null } : p));
      }
    } catch {
      toast.error(t('admin.crmLists.errorGeneric'));
    }
    setEditingCell(null);
  }

  // ---------------------------------------------------------------------------
  // Bulk actions
  // ---------------------------------------------------------------------------

  async function bulkSetStatus(status: 'VALIDATED' | 'EXCLUDED') {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((id) =>
        fetch(`/api/admin/crm/lists/${listId}/prospects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }),
      ));
      toast.success(t('admin.crmLists.prospectsUpdated').replace('{count}', String(ids.length)));
      setSelected(new Set());
      fetchProspects();
      fetchList();
    } catch {
      toast.error(t('admin.crmLists.errorGeneric'));
    }
  }

  async function bulkValidateWithRules() {
    // Validate all prospects that have phone + website
    try {
      const res = await fetch(`/api/admin/crm/lists/${listId}/prospects?limit=1000`);
      const json = await res.json();
      if (!json.success) return;
      const toValidate = (json.data as Prospect[]).filter(
        (p) => p.status === 'NEW' && (p.phone || p.email) && p.website,
      );
      if (toValidate.length === 0) {
        toast.info(t('admin.crmLists.noBulkValidate'));
        return;
      }
      await Promise.all(toValidate.map((p) =>
        fetch(`/api/admin/crm/lists/${listId}/prospects/${p.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'VALIDATED' }),
        }),
      ));
      toast.success(`${toValidate.length} ${t('admin.crmLists.bulkValidated')}`);
      fetchProspects();
      fetchList();
    } catch {
      toast.error(t('admin.crmLists.errorGeneric'));
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0 || !confirm(t('admin.crmLists.deleteProspectsConfirm').replace('{count}', String(ids.length)))) return;
    try {
      await fetch(`/api/admin/crm/lists/${listId}/prospects`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      toast.success(t('admin.crmLists.deleteSuccess'));
      setSelected(new Set());
      fetchProspects();
      fetchList();
    } catch {
      toast.error(t('admin.crmLists.errorGeneric'));
    }
  }

  // ---------------------------------------------------------------------------
  // Add prospect
  // ---------------------------------------------------------------------------

  async function handleAddProspect() {
    if (!newProspect.contactName.trim()) return;
    try {
      const res = await fetch(`/api/admin/crm/lists/${listId}/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospects: [newProspect] }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t('admin.crmLists.saveSuccess'));
        setShowAddModal(false);
        setNewProspect({ contactName: '', companyName: '', email: '', phone: '', city: '' });
        fetchProspects();
        fetchList();
      }
    } catch {
      toast.error(t('admin.crmLists.errorGeneric'));
    }
  }

  // ---------------------------------------------------------------------------
  // Deduplication
  // ---------------------------------------------------------------------------

  async function handleDeduplicate() {
    try {
      const res = await fetch(`/api/admin/crm/lists/${listId}/deduplicate`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success(`${t('admin.crmLists.deduplicateSuccess')}: ${json.data.merged} merged`);
        fetchProspects();
        fetchList();
      }
    } catch {
      toast.error(t('admin.crmLists.errorGeneric'));
    }
  }

  // ---------------------------------------------------------------------------
  // Google Maps scrape
  // ---------------------------------------------------------------------------

  async function handleScrape() {
    if (!gmQuery.trim()) return;
    setScraping(true);
    try {
      const res = await fetch(`/api/admin/crm/lists/${listId}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: gmQuery,
          location: gmLocation || undefined,
          maxResults: gmMaxResults,
          crawlWebsites: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        toast.success(`${t('admin.crmLists.scrapeSuccess')}: ${d.added} added, ${d.duplicates} duplicates, ${d.emailsFound || 0} emails`);
        fetchProspects();
        fetchList();
      } else {
        toast.error(json.error || t('admin.crmLists.errorGeneric'));
      }
    } catch {
      toast.error(t('admin.crmLists.errorScrape'));
    } finally {
      setScraping(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Enrichment
  // ---------------------------------------------------------------------------

  async function handleEnrich() {
    setEnriching(true);
    setEnrichResult(null);
    try {
      const res = await fetch(`/api/admin/crm/lists/${listId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxConcurrent: 3 }),
      });
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        setEnrichResult({ total: d.total, enriched: d.enriched, emailsFound: d.emailsFound, errors: d.errors });
        toast.success(`${t('admin.crmLists.enrichSuccess')}: ${d.emailsFound} emails found / ${d.total} processed`);
        fetchProspects();
        fetchList();
      } else {
        toast.error(json.error || t('admin.crmLists.errorGeneric'));
      }
    } catch {
      toast.error(t('admin.crmLists.errorEnrichment'));
    } finally {
      setEnriching(false);
    }
  }

  async function handleScore() {
    setScoring(true);
    setScoreResult(null);
    try {
      const res = await fetch(`/api/admin/crm/lists/${listId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoQualify: true, qualifyThreshold: 50 }),
      });
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        setScoreResult({ scored: d.scored, averageScore: d.averageScore, distribution: d.distribution });
        toast.success(`${t('admin.crmLists.scoreSuccess')}: avg ${d.averageScore}/100 (${d.distribution.hot} HOT, ${d.distribution.warm} WARM, ${d.distribution.cold} COLD)`);
        fetchProspects();
        fetchList();
      }
    } catch {
      toast.error(t('admin.crmLists.errorScoring'));
    } finally {
      setScoring(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Export CSV
  // ---------------------------------------------------------------------------

  function handleExport() {
    const url = `/api/admin/crm/lists/${listId}/export${statusFilter ? `?status=${statusFilter}` : ''}`;
    window.open(url, '_blank');
  }

  // ---------------------------------------------------------------------------
  // Integration
  // ---------------------------------------------------------------------------

  async function handleIntegrate() {
    if (selectedAgents.length === 0) {
      toast.error(t('admin.crmLists.selectAgents'));
      return;
    }
    if (!confirm(t('admin.crmLists.integrateConfirm'))) return;
    setIntegrating(true);
    try {
      const res = await fetch(`/api/admin/crm/lists/${listId}/integrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentMethod: assignMethod,
          agentIds: selectedAgents,
          statusFilter: 'VALIDATED',
          dncPreCheck: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        toast.success(`${t('admin.crmLists.integrateSuccess')}: ${d.integrated} integrated, ${d.assigned} assigned${d.dncFiltered ? `, ${d.dncFiltered} DNC filtered` : ''}`);
        fetchProspects();
        fetchList();
      } else {
        toast.error(json.error || t('admin.crmLists.errorGeneric'));
      }
    } catch {
      toast.error(t('admin.crmLists.errorGeneric'));
    } finally {
      setIntegrating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Start Campaign (1-click)
  // ---------------------------------------------------------------------------

  async function handleStartCampaign() {
    if (!campaignName.trim() || !callerIdNumber.trim() || selectedAgents.length === 0 || !selectedCompanyId) {
      toast.error(t('admin.crmLists.selectAgents'));
      return;
    }
    if (!confirm(t('admin.crmLists.launchCampaignConfirm'))) return;
    setLaunchingCampaign(true);
    try {
      const res = await fetch(`/api/admin/crm/lists/${listId}/start-campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: campaignName.trim(),
          companyId: selectedCompanyId,
          callerIdNumber: callerIdNumber.trim(),
          agentIds: selectedAgents,
          assignmentMethod: assignMethod,
          scriptTitle: scriptTitle.trim() || undefined,
          scriptBody: scriptBody.trim() || undefined,
          startTime: campaignStartTime,
          endTime: campaignEndTime,
          timezone: campaignTimezone,
          activeDays: campaignActiveDays,
          maxConcurrent: campaignMaxConcurrent,
          useAmd: campaignUseAmd,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        toast.success(`${t('admin.crmLists.campaignSuccess')}: ${d.leadsCreated} leads, ${d.entriesCreated} entries${d.dncFiltered ? `, ${d.dncFiltered} DNC filtered` : ''}`);
        fetchProspects();
        fetchList();
      } else {
        toast.error(json.error || t('admin.crmLists.campaignError'));
      }
    } catch {
      toast.error(t('admin.crmLists.campaignError'));
    } finally {
      setLaunchingCampaign(false);
    }
  }

  if (!list) return <div className="p-8 text-center text-gray-400">{t('admin.crmLists.searching')}</div>;

  const totalPages = Math.ceil(total / limit);
  const duplicateProspects = prospects.filter((p) => p.status === 'DUPLICATE');

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/admin/crm/lists')} className="rounded p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{list.name}</h1>
          {list.description && <p className="text-sm text-gray-500 mt-0.5">{list.description}</p>}
        </div>
        <button onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50" title={t('admin.crmLists.exportCSV')}>
          <FileDown className="h-3.5 w-3.5" /> CSV
        </button>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[list.status] || 'bg-gray-100'}`}>
          {t(`admin.crmLists.status${list.status}`)}
        </span>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: t('admin.crmLists.totalCount'), value: list.totalCount, color: 'text-gray-900' },
          { label: t('admin.crmLists.validatedCount'), value: list.validatedCount, color: 'text-green-600' },
          { label: t('admin.crmLists.duplicateCount'), value: list.duplicateCount, color: 'text-orange-600' },
          { label: t('admin.crmLists.integratedCount'), value: list.integratedCount, color: 'text-purple-600' },
          { label: t('admin.crmLists.excludedCount'), value: list.statusBreakdown?.EXCLUDED || 0, color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-white p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto">
        {TABS.map((t_tab) => (
          <button
            key={t_tab}
            onClick={() => setTab(t_tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t_tab ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t_tab === 'prospects' && t('admin.crmLists.prospects')}
            {t_tab === 'googleMaps' && t('admin.crmLists.googleMaps')}
            {t_tab === 'enrichment' && t('admin.crmLists.enrichment')}
            {t_tab === 'duplicates' && t('admin.crmLists.duplicates')}
            {t_tab === 'assignment' && t('admin.crmLists.assignment')}
            {t_tab === 'campaign' && t('admin.crmLists.campaignTab')}
          </button>
        ))}
      </div>

      {/* ========== TAB: Prospects ========== */}
      {tab === 'prospects' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-teal-500 focus:outline-none"
                placeholder={t('admin.crmLists.placeholderSearch')}
              />
            </div>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">{t('admin.crmLists.status')}</option>
              {['NEW', 'VALIDATED', 'DUPLICATE', 'INTEGRATED', 'EXCLUDED'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {selected.size > 0 && (
              <div className="flex gap-2">
                <button onClick={() => bulkSetStatus('VALIDATED')} className="rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100">
                  <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />{t('admin.crmLists.validate')} ({selected.size})
                </button>
                <button onClick={() => bulkSetStatus('EXCLUDED')} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100">
                  <XCircle className="inline h-3.5 w-3.5 mr-1" />{t('admin.crmLists.exclude')} ({selected.size})
                </button>
                <button onClick={bulkDelete} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100">
                  <Trash2 className="inline h-3.5 w-3.5 mr-1" />{t('admin.crmLists.delete')} ({selected.size})
                </button>
              </div>
            )}
            <button onClick={bulkValidateWithRules} className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100" title={t('admin.crmLists.bulkValidateRule')}>
              <Shield className="inline h-3.5 w-3.5 mr-1" />{t('admin.crmLists.bulkValidate')}
            </button>
            <button onClick={() => setShowAddModal(true)} className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-700">
              <Plus className="inline h-3.5 w-3.5 mr-1" />{t('admin.crmLists.addProspect')}
            </button>
          </div>

          {/* Prospects Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="w-8 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === prospects.length && prospects.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? new Set(prospects.map((p) => p.id)) : new Set())}
                    />
                  </th>
                  <th className="px-3 py-3 font-medium">{t('admin.crmLists.contactName')}</th>
                  <th className="px-3 py-3 font-medium">{t('admin.crmLists.companyName')}</th>
                  <th className="px-3 py-3 font-medium">{t('admin.crmLists.email')}</th>
                  <th className="px-3 py-3 font-medium">{t('admin.crmLists.phone')}</th>
                  <th className="px-3 py-3 font-medium">{t('admin.crmLists.city')}</th>
                  <th className="px-3 py-3 font-medium">{t('admin.crmLists.score')}</th>
                  <th className="px-3 py-3 font-medium">{t('admin.crmLists.status')}</th>
                  {list.source === 'GOOGLE_MAPS' && <th className="px-3 py-3 font-medium">{t('admin.crmLists.rating')}</th>}
                  <th className="px-3 py-3 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">{t('admin.crmLists.searching')}</td></tr>
                ) : prospects.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400">{t('admin.crmLists.noLists')}</td></tr>
                ) : (
                  prospects.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            e.target.checked ? next.add(p.id) : next.delete(p.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      {renderEditableCell(p, 'contactName')}
                      {renderEditableCell(p, 'companyName')}
                      {renderEditableCell(p, 'email')}
                      {renderEditableCell(p, 'phone')}
                      {renderEditableCell(p, 'city')}
                      <td className="px-3 py-2"><ScoreBadge score={p.enrichmentScore} /></td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100'}`}>
                          {p.status}
                        </span>
                        {p.dncStatus === 'NATIONAL_DNC' && (
                          <span className="ml-1 rounded bg-red-100 px-1 py-0.5 text-[10px] text-red-600">DNC</span>
                        )}
                      </td>
                      {list.source === 'GOOGLE_MAPS' && (
                        <td className="px-3 py-2">
                          {p.googleRating && (
                            <div className="flex items-center gap-1 text-xs">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              {p.googleRating} ({p.googleReviewCount})
                            </div>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleDeleteProspect(p.id)}
                          className="rounded p-1 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{total} prospects</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded p-1 hover:bg-gray-100 disabled:opacity-40">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span>{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded p-1 hover:bg-gray-100 disabled:opacity-40">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== TAB: Google Maps ========== */}
      {tab === 'googleMaps' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-6 space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-500" />
              {t('admin.crmLists.searchGoogleMaps')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.searchQuery')}</label>
                <input
                  value={gmQuery}
                  onChange={(e) => setGmQuery(e.target.value)}
                  placeholder={t('admin.crmLists.placeholderGoogleSearch')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.location')}</label>
                <input
                  value={gmLocation}
                  onChange={(e) => setGmLocation(e.target.value)}
                  placeholder={t('admin.crmLists.placeholderLocation')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.maxResults')}</label>
                <select value={gmMaxResults} onChange={(e) => setGmMaxResults(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value={60}>60</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleScrape}
                  disabled={scraping || !gmQuery.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {scraping ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  {scraping ? t('admin.crmLists.searching') : t('admin.crmLists.searchGoogleMaps')}
                </button>
              </div>
            </div>
            {list.sourceQuery && (
              <p className="text-xs text-gray-400">
                {t('admin.crmLists.lastSearch')}: <span className="font-medium text-gray-600">{list.sourceQuery}</span>
              </p>
            )}
          </div>

          {/* Google Maps results table */}
          {prospects.filter((p) => p.googlePlaceId).length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-600">
                  {prospects.filter((p) => p.googlePlaceId).length} {t('admin.crmLists.prospects').toLowerCase()}
                </h4>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="px-3 py-3 font-medium">{t('admin.crmLists.companyName')}</th>
                      <th className="px-3 py-3 font-medium">{t('admin.crmLists.address') || 'Address'}</th>
                      <th className="px-3 py-3 font-medium">{t('admin.crmLists.phone')}</th>
                      <th className="px-3 py-3 font-medium">{t('admin.crmLists.email')}</th>
                      <th className="px-3 py-3 font-medium">{t('admin.crmLists.website')}</th>
                      <th className="px-3 py-3 font-medium">{t('admin.crmLists.rating')}</th>
                      <th className="px-3 py-3 font-medium">{t('admin.crmLists.score')}</th>
                      <th className="px-3 py-3 font-medium text-center">{t('admin.crmLists.viewOnGoogleMaps')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {prospects.filter((p) => p.googlePlaceId).map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-gray-900">{p.contactName}</div>
                          {p.googleCategory && (
                            <span className="text-xs text-gray-400">{p.googleCategory.replace(/_/g, ' ')}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-start gap-1.5 max-w-[250px]">
                            <MapPinned className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-gray-700 text-xs leading-relaxed">{p.address || '-'}</div>
                              {p.city && (
                                <div className="text-xs text-gray-500">{[p.city, p.province, p.postalCode].filter(Boolean).join(', ')}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {p.phone ? (
                            <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-teal-600 hover:underline text-xs">
                              <Phone className="h-3 w-3" />{p.phone}
                            </a>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {p.email ? (
                            <span className="text-xs text-green-700 bg-green-50 rounded px-1.5 py-0.5">{p.email}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {p.website ? (
                            <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-teal-600 hover:underline text-xs">
                              <Globe className="h-3 w-3" />
                              {(() => { try { return new URL(p.website).hostname.replace('www.', ''); } catch { return 'site'; } })()}
                            </a>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {p.googleRating ? (
                            <div className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                              <span className="font-medium text-gray-800">{p.googleRating}</span>
                              <span className="text-xs text-gray-400">({p.googleReviewCount})</span>
                            </div>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2.5"><ScoreBadge score={p.enrichmentScore} /></td>
                        <td className="px-3 py-2.5 text-center">
                          {p.googlePlaceId && (
                            <a
                              href={`https://www.google.com/maps/place/?q=place_id:${p.googlePlaceId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors"
                              title={t('admin.crmLists.viewOnGoogleMaps') || 'View on Google Maps'}
                            >
                              <ExternalLink className="h-3 w-3" /> {t('admin.crmLists.viewOnGoogleMaps')}
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-8 text-center text-gray-400">
              <MapPin className="mx-auto mb-2 h-10 w-10 text-gray-300" />
              <p className="font-medium text-gray-500">{t('admin.crmLists.noGoogleMapsResults') || 'No Google Maps results yet'}</p>
              <p className="text-sm mt-1">{t('admin.crmLists.noGoogleMapsResultsDesc') || 'Search above to find businesses and add them to this list'}</p>
            </div>
          )}
        </div>
      )}

      {/* ========== TAB: Enrichment ========== */}
      {tab === 'enrichment' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-6 space-y-6">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              {t('admin.crmLists.enrichment')}
            </h3>

            {/* Enrichment actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <h4 className="font-medium text-sm">{t('admin.crmLists.enrichEmails')}</h4>
                </div>
                <p className="text-xs text-gray-500">{t('admin.crmLists.enrichEmailsDesc')}</p>
                <button
                  onClick={handleEnrich}
                  disabled={enriching}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {enriching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {enriching ? t('admin.crmLists.enriching') : t('admin.crmLists.enrichEmails')}
                </button>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-teal-500" />
                  <h4 className="font-medium text-sm">{t('admin.crmLists.scoreProspects')}</h4>
                </div>
                <p className="text-xs text-gray-500">{t('admin.crmLists.scoreProspectsDesc')}</p>
                <button
                  onClick={handleScore}
                  disabled={scoring}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {scoring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                  {scoring ? t('admin.crmLists.scoring') : t('admin.crmLists.scoreProspects')}
                </button>
              </div>
            </div>

            {/* Enrichment progress */}
            {enriching && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {t('admin.crmLists.enrichmentRunning')}
                </div>
                <div className="h-2 rounded-full bg-amber-200 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {/* Enrichment result */}
            {enrichResult && !enriching && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <h4 className="text-sm font-medium text-green-800 mb-2">{t('admin.crmLists.enrichSuccess')}</h4>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-green-800">{enrichResult.total}</div>
                    <div className="text-xs text-green-600">Processed</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-800">{enrichResult.emailsFound}</div>
                    <div className="text-xs text-green-600">Emails Found</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-800">
                      {enrichResult.total > 0 ? Math.round((enrichResult.emailsFound / enrichResult.total) * 100) : 0}%
                    </div>
                    <div className="text-xs text-green-600">Success Rate</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-600">{enrichResult.errors}</div>
                    <div className="text-xs text-red-500">Errors</div>
                  </div>
                </div>
              </div>
            )}

            {/* Score result */}
            {scoreResult && !scoring && (
              <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                <h4 className="text-sm font-medium text-teal-800 mb-2">{t('admin.crmLists.scoreSuccess')}</h4>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-teal-800">{scoreResult.averageScore}</div>
                    <div className="text-xs text-teal-600">{t('admin.crmLists.avgScore')}</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-600">{scoreResult.distribution.hot}</div>
                    <div className="text-xs text-red-500">HOT</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-yellow-600">{scoreResult.distribution.warm}</div>
                    <div className="text-xs text-yellow-500">WARM</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-600">{scoreResult.distribution.cold}</div>
                    <div className="text-xs text-blue-500">COLD</div>
                  </div>
                </div>
              </div>
            )}

            {/* Enrichment stats */}
            <div className="rounded-lg bg-gray-50 p-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-700">{t('admin.crmLists.enrichmentStats')}</h4>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-gray-900">{prospects.filter((p) => p.email).length}</div>
                  <div className="text-xs text-gray-500">{t('admin.crmLists.withEmail')}</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{prospects.filter((p) => p.phone).length}</div>
                  <div className="text-xs text-gray-500">{t('admin.crmLists.withPhone')}</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{prospects.filter((p) => p.enrichedAt).length}</div>
                  <div className="text-xs text-gray-500">{t('admin.crmLists.enriched')}</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {prospects.length > 0 ? Math.round(prospects.reduce((sum, p) => sum + (p.enrichmentScore || 0), 0) / prospects.length) : 0}
                  </div>
                  <div className="text-xs text-gray-500">{t('admin.crmLists.avgScore')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== TAB: Duplicates ========== */}
      {tab === 'duplicates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-orange-500" />
              {t('admin.crmLists.duplicates')} ({list.duplicateCount})
            </h3>
            <div className="flex gap-2">
              <button onClick={handleDeduplicate} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                {t('admin.crmLists.deduplicate')}
              </button>
              <button onClick={handleDeduplicate} className="rounded-lg bg-orange-600 px-3 py-2 text-sm text-white hover:bg-orange-700">
                {t('admin.crmLists.deduplicateAll')}
              </button>
            </div>
          </div>

          {duplicateProspects.length === 0 ? (
            <div className="rounded-lg border bg-white p-8 text-center text-gray-400">
              <GitMerge className="mx-auto mb-2 h-10 w-10 text-gray-300" />
              <p>{t('admin.crmLists.noDuplicatesFound')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {duplicateProspects.map((p) => (
                <div key={p.id} className="rounded-lg border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{p.contactName}</span>
                      {p.companyName && <span className="text-gray-500 ml-2">({p.companyName})</span>}
                      <div className="text-xs text-gray-500 mt-1">
                        {p.email && <span className="mr-3">{p.email}</span>}
                        {p.phone && <span>{p.phone}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      {p.duplicateOf && (
                        <div className="text-xs text-orange-600">
                          {t('admin.crmLists.duplicateOf')}: <span className="font-medium">{p.duplicateOf.contactName}</span>
                        </div>
                      )}
                      <button
                        onClick={() => handleMerge(p.duplicateOf?.id || '', p.id)}
                        disabled={!p.duplicateOf}
                        className="mt-1 rounded bg-orange-50 px-2 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-40"
                      >
                        {t('admin.crmLists.merge')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== TAB: Assignment ========== */}
      {tab === 'assignment' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-6 space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-500" />
              {t('admin.crmLists.assignment')}
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.assignmentMethod')}</label>
              <select
                value={assignMethod}
                onChange={(e) => setAssignMethod(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {['MANUAL', 'ROUND_ROBIN', 'LOAD_BALANCED', 'SCORE_BASED'].map((m) => (
                  <option key={m} value={m}>{t(`admin.crmLists.method${m}`)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.crmLists.selectAgents')}</label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {agents.length === 0 ? (
                  <p className="text-sm text-gray-400">{t('admin.crmLists.noAgentsAvailable')}</p>
                ) : (
                  agents.map((agent) => (
                    <label key={agent.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedAgents.includes(agent.id)}
                        onChange={(e) => {
                          setSelectedAgents((prev) =>
                            e.target.checked ? [...prev, agent.id] : prev.filter((id) => id !== agent.id),
                          );
                        }}
                      />
                      <div>
                        <div className="font-medium text-sm">{agent.name || agent.email}</div>
                        <div className="text-xs text-gray-500">{agent.email}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                <strong>{list.validatedCount}</strong> validated prospects will be converted to CRM leads
                and assigned to <strong>{selectedAgents.length}</strong> agent(s) via <strong>{assignMethod.replace(/_/g, ' ').toLowerCase()}</strong>.
                {t('admin.crmLists.dncPreCheck')}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleIntegrate}
                disabled={integrating || selectedAgents.length === 0 || list.validatedCount === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {integrating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {t('admin.crmLists.assignAndIntegrate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== TAB: Campaign ========== */}
      {tab === 'campaign' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-6 space-y-6">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-teal-600" />
              {t('admin.crmLists.campaignTab')}
            </h3>

            {/* Campaign name + Caller ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.campaignName')}</label>
                <input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder={t('admin.crmLists.campaignNamePlaceholder')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.callerIdNumber')}</label>
                <input
                  value={callerIdNumber}
                  onChange={(e) => setCallerIdNumber(e.target.value)}
                  placeholder={t('admin.crmLists.callerIdPlaceholder')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Company selector */}
            {companies.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.companyName')}</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Assignment method + agents */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.assignmentMethod')}</label>
                <select
                  value={assignMethod}
                  onChange={(e) => setAssignMethod(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {['MANUAL', 'ROUND_ROBIN', 'LOAD_BALANCED', 'SCORE_BASED'].map((m) => (
                    <option key={m} value={m}>{t(`admin.crmLists.method${m}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.selectAgents')}</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border p-2">
                  {agents.length === 0 ? (
                    <p className="text-sm text-gray-400 p-1">{t('admin.crmLists.noAgentsAvailable')}</p>
                  ) : (
                    agents.map((agent) => (
                      <label key={agent.id} className="flex items-center gap-2 rounded px-2 py-1 cursor-pointer hover:bg-gray-50 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedAgents.includes(agent.id)}
                          onChange={(e) =>
                            setSelectedAgents((prev) =>
                              e.target.checked ? [...prev, agent.id] : prev.filter((id) => id !== agent.id),
                            )
                          }
                          className="rounded border-gray-300 text-teal-600"
                        />
                        {agent.name || agent.email}
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Script */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.scriptTitle')}</label>
                <input
                  value={scriptTitle}
                  onChange={(e) => setScriptTitle(e.target.value)}
                  placeholder={t('admin.crmLists.scriptTitlePlaceholder')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.scriptBody')}</label>
                <textarea
                  value={scriptBody}
                  onChange={(e) => setScriptBody(e.target.value)}
                  placeholder={t('admin.crmLists.scriptBodyPlaceholder')}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none resize-y"
                />
              </div>
            </div>

            {/* Schedule */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-gray-400" />
                {t('admin.crmLists.schedule')}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('admin.crmLists.startTime')}</label>
                  <input
                    type="time"
                    value={campaignStartTime}
                    onChange={(e) => setCampaignStartTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('admin.crmLists.endTime')}</label>
                  <input
                    type="time"
                    value={campaignEndTime}
                    onChange={(e) => setCampaignEndTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('admin.crmLists.timezone')}</label>
                  <select
                    value={campaignTimezone}
                    onChange={(e) => setCampaignTimezone(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="America/Montreal">America/Montreal</option>
                    <option value="America/Toronto">America/Toronto</option>
                    <option value="America/Vancouver">America/Vancouver</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Chicago">America/Chicago</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="Europe/Paris">Europe/Paris</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('admin.crmLists.maxConcurrent')}</label>
                  <select
                    value={campaignMaxConcurrent}
                    onChange={(e) => setCampaignMaxConcurrent(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {[1, 2, 3, 5, 10].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active days */}
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-2">
                  <CalendarDays className="inline h-3.5 w-3.5 mr-1" />
                  {t('admin.crmLists.activeDays')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        setCampaignActiveDays((prev) =>
                          prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
                        )
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                        campaignActiveDays.includes(day)
                          ? 'bg-teal-100 text-teal-700 border-teal-300'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* AMD toggle */}
            <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={campaignUseAmd}
                onChange={(e) => setCampaignUseAmd(e.target.checked)}
                className="rounded border-gray-300 text-teal-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">{t('admin.crmLists.useAmd')}</span>
                <p className="text-xs text-gray-500">{t('admin.crmLists.useAmdDesc')}</p>
              </div>
            </label>

            {/* Preview */}
            <div className="rounded-lg bg-teal-50 border border-teal-100 p-4">
              <h4 className="text-sm font-medium text-teal-800 mb-1">{t('admin.crmLists.campaignPreview')}</h4>
              <p className="text-sm text-teal-700">
                {t('admin.crmLists.campaignPreviewDesc')
                  .replace('{validated}', String(list.validatedCount))
                  .replace('{agents}', String(selectedAgents.length))}
              </p>
              <p className="text-xs text-teal-600 mt-1">{t('admin.crmLists.dncPreCheck')}</p>
            </div>

            {/* Launch button */}
            <div className="flex gap-3">
              <button
                onClick={handleStartCampaign}
                disabled={launchingCampaign || !campaignName.trim() || !callerIdNumber.trim() || selectedAgents.length === 0 || list.validatedCount === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-3 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {launchingCampaign ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
                {launchingCampaign ? t('admin.crmLists.launching') : t('admin.crmLists.launchCampaign')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Prospect Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">{t('admin.crmLists.addProspect')}</h2>
            <div className="space-y-3">
              {(['contactName', 'companyName', 'email', 'phone', 'city'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t(`admin.crmLists.${field}`)}</label>
                  <input
                    value={newProspect[field]}
                    onChange={(e) => setNewProspect({ ...newProspect, [field]: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">{t('admin.crmLists.cancel')}</button>
              <button onClick={handleAddProspect} disabled={!newProspect.contactName.trim()} className="rounded-lg bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700 disabled:opacity-50">
                {t('admin.crmLists.addProspect')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Inline edit cell renderer
  // ---------------------------------------------------------------------------

  function renderEditableCell(p: Prospect, field: keyof Prospect) {
    const value = (p[field] as string) || '';
    const isEditing = editingCell?.id === p.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <td className="px-3 py-1">
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingCell(null); }}
              className="w-full rounded border border-teal-400 px-2 py-1 text-sm focus:outline-none"
            />
            <button onClick={saveEdit} className="text-green-600"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setEditingCell(null)} className="text-gray-400"><X className="h-3.5 w-3.5" /></button>
          </div>
        </td>
      );
    }

    return (
      <td
        className="px-3 py-2 cursor-pointer hover:bg-teal-50 group"
        onClick={() => startEdit(p.id, field, value)}
      >
        <div className="flex items-center gap-1">
          <span className={value ? '' : 'text-gray-300'}>{value || '-'}</span>
          <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />
        </div>
      </td>
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function handleDeleteProspect(id: string) {
    if (!confirm(t('admin.crmLists.deleteConfirm'))) return;
    try {
      await fetch(`/api/admin/crm/lists/${listId}/prospects/${id}`, { method: 'DELETE' });
      toast.success(t('admin.crmLists.deleteSuccess'));
      fetchProspects();
      fetchList();
    } catch {
      toast.error(t('admin.crmLists.errorGeneric'));
    }
  }

  async function handleMerge(survivorId: string, mergedId: string) {
    if (!survivorId) return;
    try {
      await fetch(`/api/admin/crm/lists/${listId}/prospects/${mergedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'MERGED' }),
      });
      toast.success(t('admin.crmLists.deduplicateSuccess'));
      fetchProspects();
      fetchList();
    } catch {
      toast.error(t('admin.crmLists.errorGeneric'));
    }
  }
}
