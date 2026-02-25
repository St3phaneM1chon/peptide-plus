// FIXED: F-055 - Added INACTIVE status variant, filter tab, and badge label to UI
// TODO: F-056 - t('admin.ambassadors.joinedAt') has French fallback "Membre depuis"; ensure key exists in all 22 locales
// FIXED: F-057 - Removed redundant locale from listItems dependency array
// TODO: F-072 - Ambassador detail pane does not show individual commission history
// FIXED: F-075 - Added processingPayoutId loading state + disabled button to prevent duplicate clicks
// FIXED: F-078 - Ambassador config modal now loads values from /api/admin/settings on open
// FIXED: F-097 - Extracted pendingAmbassadors to useMemo, replaced 3+ inline filter calls
// F098 FIX: editCommissionRate kept as string for input binding, but parseFloat is called only once on save (see handleSaveCommission)
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  Settings,
  Inbox,
  Percent,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { FormField, Input } from '@/components/admin/FormField';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { z } from 'zod';

// A-046: F-046 FIX - Zod schema for ambassador program config JSON structure
const ambassadorConfigSchema = z.object({
  defaultCommission: z.number().min(0).max(100),
  minPayoutAmount: z.number().min(0),
  cookieDays: z.number().int().min(1).max(365),
  autoApprove: z.boolean(),
  programActive: z.boolean(),
});

// ── Types ─────────────────────────────────────────────────────

interface Ambassador {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  referralCode: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  commissionRate: number;
  totalReferrals: number;
  totalSales: number;
  totalEarnings: number;
  pendingPayout: number;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  joinedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

// TODO: F-050 - Ambassador tiers are hardcoded here instead of loaded from DB (SiteSettings.ambassadorTiers)
// F40 FIX: formatCurrency now used for minSales display in the UI
// A-046: F-046 FIX - Zod validation schema for ambassador config JSON structure (validated in handleSaveConfig)
const tierConfig: Record<string, { color: string; commission: number; minSales: number }> = {
  BRONZE: { color: 'bg-amber-100 text-amber-800', commission: 5, minSales: 0 },
  SILVER: { color: 'bg-slate-200 text-slate-700', commission: 8, minSales: 1000 },
  GOLD: { color: 'bg-yellow-100 text-yellow-800', commission: 10, minSales: 5000 },
  PLATINUM: { color: 'bg-blue-100 text-blue-800', commission: 15, minSales: 15000 },
};

function tierBadgeVariant(tier: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (tier) {
    case 'PLATINUM': return 'info';
    case 'GOLD': return 'success';
    case 'SILVER': return 'neutral';
    case 'BRONZE': return 'warning';
    default: return 'neutral';
  }
}

// FIX: F-055 - Added INACTIVE status variant for UI display
function statusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'PENDING': return 'warning';
    case 'SUSPENDED': return 'error';
    case 'INACTIVE': return 'neutral';
    default: return 'neutral';
  }
}

// ── Main Component ────────────────────────────────────────────

export default function AmbassadeursPage() {
  const { t, locale, formatCurrency } = useI18n();
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAmbassadorId, setSelectedAmbassadorId] = useState<string | null>(null);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [showApplicationsModal, setShowApplicationsModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showEditCommissionModal, setShowEditCommissionModal] = useState(false);
  const [editCommissionAmbassadorId, setEditCommissionAmbassadorId] = useState<string | null>(null);
  const [editCommissionRate, setEditCommissionRate] = useState('');
  const [savingCommission, setSavingCommission] = useState(false);
  const [commissionError, setCommissionError] = useState('');

  // Config form state
  const [configDefaultCommission, setConfigDefaultCommission] = useState('5');
  const [configMinPayout, setConfigMinPayout] = useState('50');
  const [configCookieDays, setConfigCookieDays] = useState('30');
  const [configAutoApprove, setConfigAutoApprove] = useState(false);
  const [configProgramActive, setConfigProgramActive] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});

  // FIX: F-075 - Loading state for payout button to prevent duplicate clicks
  const [processingPayoutId, setProcessingPayoutId] = useState<string | null>(null);

  // UX FIX: ConfirmDialog state for destructive actions (suspend/activate)
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

  // ─── Data fetching ──────────────────────────────────────────

  // FIX: FLAW-055 - Wrap fetchAmbassadors in useCallback for stable reference
  const fetchAmbassadors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchWithRetry('/api/ambassadors');
      if (res.ok) {
        const data = await res.json();
        setAmbassadors(data.ambassadors || []);
      } else {
        toast.error(t('common.error'));
      }
    } catch (error) {
      console.error('Failed to fetch ambassadors:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    fetchAmbassadors();
  }, [fetchAmbassadors]);

  const updateStatus = async (id: string, status: 'ACTIVE' | 'SUSPENDED') => {
    const previous = ambassadors.find(a => a.id === id);
    if (!previous) return;

    // Optimistic update
    setAmbassadors(prev => prev.map(a => a.id === id ? { ...a, status } : a));

    try {
      const res = await fetch(`/api/ambassadors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        // Revert on failure
        setAmbassadors(prev => prev.map(a => a.id === id ? { ...a, status: previous.status } : a));
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.ambassadors.updateError') || 'Failed to update status');
        return;
      }
      toast.success(status === 'ACTIVE'
        ? (t('admin.ambassadors.activated') || 'Ambassador activated')
        : (t('admin.ambassadors.suspended') || 'Ambassador suspended'));
    } catch {
      // Revert on failure
      setAmbassadors(prev => prev.map(a => a.id === id ? { ...a, status: previous.status } : a));
      toast.error(t('admin.ambassadors.updateError') || 'Network error');
    }
  };

  // FIX: F-075 - Payout button loading state to prevent duplicate clicks
  const processPayout = async (id: string) => {
    if (processingPayoutId) return; // Prevent double-click
    setProcessingPayoutId(id);
    try {
      const res = await fetch('/api/ambassadors/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambassadorId: id }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t('admin.ambassadors.payoutError'));
        return;
      }

      const data = await res.json();
      toast.success(
        t('admin.ambassadors.payoutProcessed', {
          amount: data.payout.amount.toFixed(2),
          count: data.payout.commissionsCount,
        })
      );

      // Refresh the ambassador list to get updated figures
      await fetchAmbassadors();
    } catch (error) {
      console.error('Payout error:', error);
      toast.error(t('admin.ambassadors.payoutError'));
    } finally {
      setProcessingPayoutId(null);
    }
  };

  // ─── Edit Commission ───────────────────────────────────

  const openEditCommission = (amb: Ambassador) => {
    setEditCommissionAmbassadorId(amb.id);
    setEditCommissionRate(String(amb.commissionRate));
    setShowEditCommissionModal(true);
  };

  const handleSaveCommission = async () => {
    if (!editCommissionAmbassadorId) return;
    setCommissionError('');
    const rate = parseFloat(editCommissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setCommissionError(t('admin.ambassadors.commissionError') || 'Commission must be between 0 and 100');
      return;
    }

    setSavingCommission(true);
    try {
      const res = await fetch(`/api/ambassadors/${editCommissionAmbassadorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionRate: rate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.ambassadors.commissionError'));
        return;
      }
      // Update local state
      setAmbassadors(prev =>
        prev.map(a =>
          a.id === editCommissionAmbassadorId ? { ...a, commissionRate: rate } : a
        )
      );
      toast.success(t('admin.ambassadors.commissionUpdated'));
      setShowEditCommissionModal(false);
    } catch {
      toast.error(t('admin.ambassadors.commissionError'));
    } finally {
      setSavingCommission(false);
    }
  };

  // FIX: FLAW-053 - Load existing ambassador config when opening the config modal
  const openConfigModal = async () => {
    setShowConfigModal(true);
    try {
      const res = await fetch('/api/admin/settings?key=ambassador_program_config');
      if (res.ok) {
        const data = await res.json();
        if (data.value) {
          const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          setConfigDefaultCommission(String(config.defaultCommission ?? 5));
          setConfigMinPayout(String(config.minPayoutAmount ?? 50));
          setConfigCookieDays(String(config.cookieDays ?? 30));
          setConfigAutoApprove(config.autoApprove ?? false);
          setConfigProgramActive(config.programActive ?? true);
        }
      }
    } catch (error) {
      // Use defaults if fetch fails
      console.warn('[AmbassadeursPage] Failed to load ambassador config, using defaults:', error);
    }
  };

  // ─── Save Config ──────────────────────────────────────

  const handleSaveConfig = async () => {
    // UX FIX: Validate config fields before saving
    const errors: Record<string, string> = {};
    const commission = parseFloat(configDefaultCommission);
    const minPayout = parseFloat(configMinPayout);
    const cookieDays = parseInt(configCookieDays);
    if (isNaN(commission) || commission < 0 || commission > 100) {
      errors.commission = t('admin.ambassadors.commissionError') || 'Commission must be between 0 and 100';
    }
    if (isNaN(minPayout) || minPayout < 0) {
      errors.minPayout = t('admin.ambassadors.minPayoutError') || 'Minimum payout must be 0 or greater';
    }
    if (isNaN(cookieDays) || cookieDays < 1 || cookieDays > 365) {
      errors.cookieDays = t('admin.ambassadors.cookieDaysError') || 'Cookie duration must be between 1 and 365 days';
    }
    setConfigErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingConfig(true);
    try {
      // A-046: F-046 FIX - Validate config structure with Zod before saving
      const configPayload = {
        defaultCommission: parseFloat(configDefaultCommission) || 5,
        minPayoutAmount: parseFloat(configMinPayout) || 50,
        cookieDays: parseInt(configCookieDays) || 30,
        autoApprove: configAutoApprove,
        programActive: configProgramActive,
      };
      const zodResult = ambassadorConfigSchema.safeParse(configPayload);
      if (!zodResult.success) {
        const firstError = zodResult.error.issues[0];
        toast.error(firstError?.message || 'Invalid config');
        setSavingConfig(false);
        return;
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'ambassador_program_config',
          value: JSON.stringify(zodResult.data),
        }),
      });
      if (res.ok) {
        toast.success(t('admin.ambassadors.configSaved'));
        setShowConfigModal(false);
      } else {
        toast.error(t('admin.ambassadors.configError'));
      }
    } catch {
      toast.error(t('admin.ambassadors.configError'));
    } finally {
      setSavingConfig(false);
    }
  };

  // ─── Filtering ──────────────────────────────────────────────

  const filteredAmbassadors = useMemo(() => {
    return ambassadors.filter(amb => {
      if (statusFilter !== 'all' && amb.status !== statusFilter) return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (!amb.userName.toLowerCase().includes(search) &&
            !amb.userEmail.toLowerCase().includes(search) &&
            !amb.referralCode.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [ambassadors, statusFilter, searchValue]);

  const stats = useMemo(() => ({
    total: ambassadors.filter(a => a.status === 'ACTIVE').length,
    // FIX: F-099 - Round aggregated Decimal values to 2 decimal places to avoid floating point display issues
    totalSales: Math.round(ambassadors.reduce((sum, a) => sum + a.totalSales, 0) * 100) / 100,
    totalCommissions: Math.round(ambassadors.reduce((sum, a) => sum + a.totalEarnings, 0) * 100) / 100,
    pendingPayouts: Math.round(ambassadors.reduce((sum, a) => sum + a.pendingPayout, 0) * 100) / 100,
    pending: ambassadors.filter(a => a.status === 'PENDING').length,
    suspended: ambassadors.filter(a => a.status === 'SUSPENDED').length,
    // FIX: F-055 - Track INACTIVE count for filter tab
    inactive: ambassadors.filter(a => a.status === 'INACTIVE').length,
  }), [ambassadors]);

  // F097 FIX: Memoize pending ambassadors list to avoid recomputing .filter(a => a.status === 'PENDING') 3+ times
  const pendingAmbassadors = useMemo(() => ambassadors.filter(a => a.status === 'PENDING'), [ambassadors]);

  // ─── ContentList data ───────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.ambassadors.allStatuses'), count: ambassadors.length },
    { key: 'ACTIVE', label: t('admin.ambassadors.statusActive'), count: stats.total },
    { key: 'PENDING', label: t('admin.ambassadors.statusPending'), count: stats.pending },
    { key: 'SUSPENDED', label: t('admin.ambassadors.statusSuspended'), count: stats.suspended },
    // FIX: F-055 - Added INACTIVE filter tab so admins can see inactive ambassadors
    { key: 'INACTIVE', label: t('admin.ambassadors.statusInactive') || 'Inactive', count: stats.inactive },
  ], [t, ambassadors.length, stats]);

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredAmbassadors.map((amb) => ({
      id: amb.id,
      avatar: { text: amb.userName || 'A' },
      title: amb.userName,
      // FIX: F-063 - Show placeholder when ambassador email is empty instead of blank string
      subtitle: amb.userEmail || (t('admin.ambassadors.noEmail') || 'No email provided'),
      preview: `${amb.referralCode} - ${formatCurrency(amb.totalSales)} ${t('admin.ambassadors.salesLabel')}`,
      timestamp: amb.joinedAt,
      badges: [
        { text: amb.tier, variant: tierBadgeVariant(amb.tier) },
        // FIX: F-055 - Include INACTIVE status label in badge
        { text: amb.status === 'ACTIVE' ? t('admin.ambassadors.statusActive') : amb.status === 'PENDING' ? t('admin.ambassadors.statusPending') : amb.status === 'INACTIVE' ? (t('admin.ambassadors.statusInactive') || 'Inactive') : t('admin.ambassadors.statusSuspended'), variant: statusBadgeVariant(amb.status) },
        ...(amb.pendingPayout > 0
          ? [{ text: formatCurrency(amb.pendingPayout), variant: 'info' as const }]
          : []),
      ],
    }));
  // F057 FIX: Removed redundant `locale` from dependency array - formatCurrency already depends on locale via useI18n
  }, [filteredAmbassadors, t]);

  // ─── Selected ambassador ────────────────────────────────────

  const selectedAmbassador = useMemo(() => {
    if (!selectedAmbassadorId) return null;
    return ambassadors.find(a => a.id === selectedAmbassadorId) || null;
  }, [ambassadors, selectedAmbassadorId]);

  const handleSelectAmbassador = useCallback((id: string) => {
    setSelectedAmbassadorId(id);
  }, []);

  // ─── Auto-select first item ────────────────────────────────

  useEffect(() => {
    if (!loading && filteredAmbassadors.length > 0) {
      const currentStillVisible = selectedAmbassadorId &&
        filteredAmbassadors.some(a => a.id === selectedAmbassadorId);
      if (!currentStillVisible) {
        handleSelectAmbassador(filteredAmbassadors[0].id);
      }
    }
  }, [filteredAmbassadors, loading, selectedAmbassadorId, handleSelectAmbassador]);

  // ─── Ribbon action handlers ────────────────────────────────
  const handleRibbonNewAmbassador = useCallback(() => {
    setShowApplicationsModal(true);
    toast.info(t('admin.ambassadors.applicationsTitle') || 'Review pending applications or invite a new ambassador');
  }, [t]);

  const handleRibbonApproveCandidacy = useCallback(() => {
    if (!selectedAmbassador) { toast.info(t('admin.ambassadors.emptyTitle') || 'Select an ambassador first'); return; }
    updateStatus(selectedAmbassador.id, 'ACTIVE');
  }, [selectedAmbassador, t]);

  const handleRibbonDelete = useCallback(() => {
    if (!selectedAmbassador) { toast.info(t('admin.ambassadors.emptyTitle') || 'Select an ambassador first'); return; }
    setConfirmAction({
      isOpen: true,
      title: t('admin.ambassadors.confirmSuspendTitle') || 'Suspend ambassador?',
      message: t('admin.ambassadors.confirmSuspendMessage') || `Are you sure you want to suspend ${selectedAmbassador.userName}? They will no longer earn commissions.`,
      variant: 'danger',
      onConfirm: () => {
        updateStatus(selectedAmbassador.id, 'SUSPENDED');
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
      },
    });
  }, [selectedAmbassador, t]);

  const handleRibbonManageCommission = useCallback(() => {
    if (!selectedAmbassador) { toast.info(t('admin.ambassadors.emptyTitle') || 'Select an ambassador first'); return; }
    openEditCommission(selectedAmbassador);
  }, [selectedAmbassador, t]);

  const handleRibbonSalesStats = useCallback(() => {
    const active = ambassadors.filter(a => a.status === 'ACTIVE').length;
    const totalSales = ambassadors.reduce((s, a) => s + a.totalSales, 0);
    const totalEarnings = ambassadors.reduce((s, a) => s + a.totalEarnings, 0);
    const pendingPayout = ambassadors.reduce((s, a) => s + a.pendingPayout, 0);
    const avgCommission = ambassadors.length > 0
      ? (ambassadors.reduce((s, a) => s + a.commissionRate, 0) / ambassadors.length).toFixed(1)
      : '0';
    toast.success(
      `${t('admin.ambassadors.activeAmbassadors') || 'Active'}: ${active} | ` +
      `${t('admin.ambassadors.generatedSales') || 'Sales'}: ${formatCurrency(totalSales)} | ` +
      `${t('admin.ambassadors.commissionsPaid') || 'Commissions'}: ${formatCurrency(totalEarnings)} | ` +
      `${t('admin.ambassadors.pendingPayouts') || 'Pending'}: ${formatCurrency(pendingPayout)} | ` +
      `${t('admin.ambassadors.commissionLabel') || 'Avg rate'}: ${avgCommission}%`,
      { duration: 8000 }
    );
  }, [ambassadors, t, formatCurrency]);

  const handleRibbonExport = useCallback(() => {
    if (ambassadors.length === 0) {
      toast.info(t('admin.ambassadors.emptyTitle') || 'No ambassadors to export');
      return;
    }
    const headers = [
      t('admin.ambassadors.referralCode') || 'Referral Code',
      'Name', 'Email', 'Tier', 'Status',
      t('admin.ambassadors.commissionLabel') || 'Commission %',
      t('admin.ambassadors.referralsLabel') || 'Referrals',
      t('admin.ambassadors.generatedSalesLabel') || 'Total Sales',
      t('admin.ambassadors.totalEarningsLabel') || 'Total Earnings',
      t('admin.ambassadors.pendingPayoutLabel') || 'Pending Payout',
      t('admin.ambassadors.joinedAt') || 'Joined At',
    ];
    const rows = ambassadors.map(a => [
      a.referralCode, a.userName, a.userEmail, a.tier, a.status,
      a.commissionRate, a.totalReferrals, a.totalSales, a.totalEarnings,
      a.pendingPayout, new Date(a.joinedAt).toLocaleDateString(locale),
    ]);
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ambassadors-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported') || 'Exported');
  }, [ambassadors, t, locale]);

  useRibbonAction('newAmbassador', handleRibbonNewAmbassador);
  useRibbonAction('approveCandidacy', handleRibbonApproveCandidacy);
  useRibbonAction('delete', handleRibbonDelete);
  useRibbonAction('manageCommission', handleRibbonManageCommission);
  useRibbonAction('salesStats', handleRibbonSalesStats);
  useRibbonAction('export', handleRibbonExport);

  // ─── Loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Stat cards row */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.ambassadors.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.ambassadors.subtitle')}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" icon={Inbox} onClick={() => setShowApplicationsModal(true)}>
              {t('admin.ambassadors.applications')}
              {stats.pending > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold leading-none">{stats.pending}</span>
              )}
            </Button>
            <Button variant="primary" icon={Settings} onClick={openConfigModal}>
              {t('admin.ambassadors.configureProgram')}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard
            label={t('admin.ambassadors.activeAmbassadors')}
            value={stats.total}
            icon={Users}
          />
          <StatCard
            label={t('admin.ambassadors.generatedSales')}
            value={formatCurrency(stats.totalSales)}
            icon={TrendingUp}
            className="bg-green-50 border-green-200"
          />
          <StatCard
            label={t('admin.ambassadors.commissionsPaid')}
            value={formatCurrency(stats.totalCommissions)}
            icon={DollarSign}
            className="bg-sky-50 border-sky-200"
          />
          <StatCard
            label={t('admin.ambassadors.pendingPayouts')}
            value={formatCurrency(stats.pendingPayouts)}
            icon={Clock}
            className="bg-purple-50 border-purple-200"
          />
        </div>

        {/* Tiers Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <h3 className="font-semibold text-slate-900 mb-3">{t('admin.ambassadors.commissionLevels')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(tierConfig).map(([tier, config]) => (
              <div key={tier} className={`p-3 rounded-lg ${config.color}`}>
                <p className="font-bold">{tier}</p>
                <p className="text-sm">{t('admin.ambassadors.commissionPercent', { rate: config.commission })}</p>
                {/* F40 FIX: Use formatCurrency for minSales display instead of raw number */}
                <p className="text-xs opacity-75">{config.minSales > 0 ? t('admin.ambassadors.minSales', { amount: formatCurrency(config.minSales) }) : t('admin.ambassadors.baseLevel')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Attribution des revenus par ambassadeur */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-slate-900">Attribution des revenus par code</h3>
          </div>
          {ambassadors.filter(a => a.status === 'ACTIVE' && a.totalSales > 0).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Ambassadeur</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Code</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Ventes générées</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Commissions</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Revenu net</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">% du total</th>
                  </tr>
                </thead>
                <tbody>
                  {ambassadors
                    .filter(a => a.totalSales > 0)
                    .sort((a, b) => b.totalSales - a.totalSales)
                    .slice(0, 10)
                    .map((amb) => {
                      const netRevenue = amb.totalSales - amb.totalEarnings;
                      const pctOfTotal = stats.totalSales > 0
                        ? ((amb.totalSales / stats.totalSales) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <tr key={amb.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-900 font-medium">{amb.userName}</td>
                          <td className="py-2 px-3">
                            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono text-sky-700">{amb.referralCode}</code>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-900">{formatCurrency(amb.totalSales)}</td>
                          <td className="py-2 px-3 text-right text-red-600">{formatCurrency(amb.totalEarnings)}</td>
                          <td className="py-2 px-3 text-right font-medium text-emerald-700">{formatCurrency(netRevenue)}</td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${Math.min(parseFloat(pctOfTotal), 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-600">{pctOfTotal}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">Aucune vente enregistrée pour le moment</p>
          )}
        </div>

        {/* ROI par ambassadeur et Métriques de campagne */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Calcul ROI par ambassadeur */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight className="h-5 w-5 text-sky-600" />
              <h3 className="font-semibold text-slate-900">ROI par ambassadeur</h3>
            </div>
            <div className="space-y-2">
              {ambassadors
                .filter(a => a.totalEarnings > 0)
                .sort((a, b) => {
                  const roiA = a.totalEarnings > 0 ? ((a.totalSales - a.totalEarnings) / a.totalEarnings) * 100 : 0;
                  const roiB = b.totalEarnings > 0 ? ((b.totalSales - b.totalEarnings) / b.totalEarnings) * 100 : 0;
                  return roiB - roiA;
                })
                .slice(0, 5)
                .map((amb) => {
                  const roi = amb.totalEarnings > 0
                    ? ((amb.totalSales - amb.totalEarnings) / amb.totalEarnings) * 100
                    : 0;
                  const costPerReferral = amb.totalReferrals > 0
                    ? amb.totalEarnings / amb.totalReferrals
                    : 0;
                  return (
                    <div key={amb.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{amb.userName}</p>
                        <p className="text-xs text-slate-500">
                          {amb.totalReferrals} référence{amb.totalReferrals > 1 ? 's' : ''} | Coût/réf: {formatCurrency(costPerReferral)}
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <p className={`text-lg font-bold ${roi >= 100 ? 'text-emerald-700' : roi >= 0 ? 'text-sky-700' : 'text-red-600'}`}>
                          {roi.toFixed(0)}%
                        </p>
                        <p className="text-[10px] text-slate-500">ROI</p>
                      </div>
                    </div>
                  );
                })}
              {ambassadors.filter(a => a.totalEarnings > 0).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">Aucune donnée ROI disponible</p>
              )}
            </div>
            {stats.totalCommissions > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">ROI global du programme</span>
                  <span className="font-bold text-emerald-700">
                    {((stats.totalSales - stats.totalCommissions) / stats.totalCommissions * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Métriques de suivi des campagnes */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-5 w-5 text-violet-600" />
              <h3 className="font-semibold text-slate-900">Métriques des campagnes</h3>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-emerald-700">{stats.total}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Ambassadeurs actifs</p>
                </div>
                <div className="bg-sky-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-sky-700">
                    {ambassadors.reduce((sum, a) => sum + a.totalReferrals, 0)}
                  </p>
                  <p className="text-xs text-sky-600 mt-0.5">Références totales</p>
                </div>
                <div className="bg-violet-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-violet-700">
                    {ambassadors.length > 0
                      ? (ambassadors.reduce((sum, a) => sum + a.commissionRate, 0) / ambassadors.length).toFixed(1)
                      : '0'}%
                  </p>
                  <p className="text-xs text-violet-600 mt-0.5">Commission moyenne</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-amber-700">
                    {ambassadors.filter(a => a.status === 'ACTIVE' && a.totalReferrals > 0).length > 0
                      ? formatCurrency(
                          ambassadors.filter(a => a.status === 'ACTIVE' && a.totalReferrals > 0)
                            .reduce((sum, a) => sum + a.totalSales / a.totalReferrals, 0) /
                          ambassadors.filter(a => a.status === 'ACTIVE' && a.totalReferrals > 0).length
                        )
                      : formatCurrency(0)}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">Valeur moy. / référence</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Performance par palier</h4>
                {Object.entries(tierConfig).map(([tier, config]) => {
                  const tierAmbassadors = ambassadors.filter(a => a.tier === tier && a.status === 'ACTIVE');
                  const tierSales = tierAmbassadors.reduce((sum, a) => sum + a.totalSales, 0);
                  return (
                    <div key={tier} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color}`}>{tier}</span>
                        <span className="text-xs text-slate-600">{tierAmbassadors.length} ambassadeur{tierAmbassadors.length > 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-xs font-medium text-slate-900">{formatCurrency(tierSales)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content: list + detail */}

      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={400}
          showDetail={!!selectedAmbassadorId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedAmbassadorId}
              onSelect={handleSelectAmbassador}
              filterTabs={filterTabs}
              activeFilter={statusFilter}
              onFilterChange={setStatusFilter}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.ambassadors.searchPlaceholder')}
              loading={loading}
              emptyIcon={Users}
              emptyTitle={t('admin.ambassadors.emptyTitle')}
              emptyDescription={t('admin.ambassadors.emptyDescription')}
            />
          }
          detail={
            selectedAmbassador ? (
              <DetailPane
                header={{
                  title: selectedAmbassador.userName,
                  // FIX: F-063 - Show placeholder when ambassador email is empty
                  subtitle: selectedAmbassador.userEmail || (t('admin.ambassadors.noEmail') || 'No email provided'),
                  avatar: { text: selectedAmbassador.userName || 'A' },
                  onBack: () => setSelectedAmbassadorId(null),
                  backLabel: t('admin.ambassadors.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      {selectedAmbassador.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => updateStatus(selectedAmbassador.id, 'ACTIVE')}
                        >
                          {t('admin.ambassadors.approve')}
                        </Button>
                      )}
                      {selectedAmbassador.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setConfirmAction({
                            isOpen: true,
                            title: t('admin.ambassadors.confirmSuspendTitle') || 'Suspend ambassador?',
                            message: t('admin.ambassadors.confirmSuspendMessage') || `Are you sure you want to suspend ${selectedAmbassador.userName}? They will no longer earn commissions.`,
                            variant: 'danger',
                            onConfirm: () => {
                              updateStatus(selectedAmbassador.id, 'SUSPENDED');
                              setConfirmAction(prev => ({ ...prev, isOpen: false }));
                            },
                          })}
                        >
                          {t('admin.ambassadors.suspend')}
                        </Button>
                      )}
                      {selectedAmbassador.status === 'SUSPENDED' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setConfirmAction({
                            isOpen: true,
                            title: t('admin.ambassadors.confirmActivateTitle') || 'Reactivate ambassador?',
                            message: t('admin.ambassadors.confirmActivateMessage') || `Are you sure you want to reactivate ${selectedAmbassador.userName}?`,
                            variant: 'info',
                            onConfirm: () => {
                              updateStatus(selectedAmbassador.id, 'ACTIVE');
                              setConfirmAction(prev => ({ ...prev, isOpen: false }));
                            },
                          })}
                        >
                          {t('admin.ambassadors.activate')}
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" icon={Percent} onClick={() => openEditCommission(selectedAmbassador)}>
                        {t('admin.ambassadors.editCommission')}
                      </Button>
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      selectedAmbassador.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' :
                      selectedAmbassador.status === 'PENDING' ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {selectedAmbassador.status === 'ACTIVE' ? t('admin.ambassadors.statusActive') :
                       selectedAmbassador.status === 'PENDING' ? t('admin.ambassadors.statusPending') :
                       t('admin.ambassadors.statusSuspended')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierConfig[selectedAmbassador.tier].color}`}>
                      {selectedAmbassador.tier}
                    </span>
                  </div>

                  {/* Key stats grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.ambassadors.referralCode')}</p>
                      <code className="font-mono font-bold text-lg text-sky-600">{selectedAmbassador.referralCode}</code>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.ambassadors.commissionLabel')}</p>
                      <p className="font-bold text-lg">{selectedAmbassador.commissionRate}%</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.ambassadors.referralsLabel')}</p>
                      <p className="font-bold text-lg">{selectedAmbassador.totalReferrals}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.ambassadors.generatedSalesLabel')}</p>
                      <p className="font-bold text-lg">{formatCurrency(selectedAmbassador.totalSales)}</p>
                    </div>
                  </div>

                  {/* Earnings */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-3">{t('admin.ambassadors.totalEarningsLabel')}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">{t('admin.ambassadors.totalEarningsLabel')}</p>
                        <p className="font-bold text-lg">{formatCurrency(selectedAmbassador.totalEarnings)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{t('admin.ambassadors.pendingPayoutLabel')}</p>
                        {selectedAmbassador.pendingPayout > 0 ? (
                          <div className="flex items-center gap-3">
                            <p className="font-bold text-lg text-purple-600">{formatCurrency(selectedAmbassador.pendingPayout)}</p>
                            <button
                              onClick={() => processPayout(selectedAmbassador.id)}
                              disabled={processingPayoutId === selectedAmbassador.id}
                              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {processingPayoutId === selectedAmbassador.id
                                ? (t('admin.ambassadors.processingPayout') || 'Processing...')
                                : t('admin.ambassadors.processPayoutNow')}
                            </button>
                          </div>
                        ) : (
                          <p className="text-slate-400">{t('admin.ambassadors.noPendingPayout')}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tier info */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-2">{t('admin.ambassadors.tierLabel')}</h4>
                    <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${tierConfig[selectedAmbassador.tier].color}`}>
                      {selectedAmbassador.tier} ({selectedAmbassador.commissionRate}%)
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {t('admin.ambassadors.referralsCount', { count: selectedAmbassador.totalReferrals })}
                    </p>
                  </div>

                  {/* Joined date */}
                  <div className="text-sm text-slate-500">
                    {t('admin.ambassadors.joinedAt') || 'Membre depuis'}: {new Date(selectedAmbassador.joinedAt).toLocaleDateString(locale)}
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Users}
                emptyTitle={t('admin.ambassadors.emptyTitle')}
                emptyDescription={t('admin.ambassadors.emptyDescription')}
              />
            )
          }
        />
      </div>

      {/* ─── APPLICATIONS MODAL ─────────────────────────────────── */}
      <Modal
        isOpen={showApplicationsModal}
        onClose={() => setShowApplicationsModal(false)}
        title={t('admin.ambassadors.applicationsTitle')}
        subtitle={t('admin.ambassadors.applicationsSubtitle')}
        size="lg"
      >
        <div className="space-y-4">
          {/* F097 FIX: Use memoized pendingAmbassadors instead of inline filter */}
          {pendingAmbassadors.length === 0 ? (
            <div className="text-center py-8">
              <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-900">{t('admin.ambassadors.noApplications')}</p>
              <p className="text-sm text-slate-500 mt-1">{t('admin.ambassadors.noApplicationsDesc')}</p>
            </div>
          ) : (
            pendingAmbassadors.map((amb) => (
              <div key={amb.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="font-medium text-slate-900">{amb.userName}</p>
                  {/* FIX: F-063 - Show placeholder when ambassador email is empty */}
                  <p className="text-sm text-slate-500">{amb.userEmail || (t('admin.ambassadors.noEmail') || 'No email provided')}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {t('admin.ambassadors.referralCode')}: <code className="font-mono text-sky-600">{amb.referralCode}</code>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={async () => {
                      await updateStatus(amb.id, 'ACTIVE');
                      // F097 FIX: Use pendingAmbassadors.length check instead of inline filter
                      if (pendingAmbassadors.filter(a => a.id !== amb.id).length === 0) {
                        setShowApplicationsModal(false);
                      }
                    }}
                  >
                    {t('admin.ambassadors.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      await updateStatus(amb.id, 'SUSPENDED');
                      // F097 FIX: Use pendingAmbassadors.length check instead of inline filter
                      if (pendingAmbassadors.filter(a => a.id !== amb.id).length === 0) {
                        setShowApplicationsModal(false);
                      }
                    }}
                  >
                    {t('admin.ambassadors.suspend')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* ─── CONFIGURE PROGRAM MODAL ────────────────────────────── */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title={t('admin.ambassadors.configureTitle')}
        subtitle={t('admin.ambassadors.configureSubtitle')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowConfigModal(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" onClick={handleSaveConfig} loading={savingConfig}>
              {t('common.save') || 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.ambassadors.defaultCommission')}>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={configDefaultCommission}
              onChange={(e) => { setConfigDefaultCommission(e.target.value); setConfigErrors(prev => { const n = { ...prev }; delete n.commission; return n; }); }}
            />
            {configErrors.commission && (
              <p className="mt-1 text-sm text-red-600" role="alert">{configErrors.commission}</p>
            )}
          </FormField>
          <FormField label={t('admin.ambassadors.minPayoutAmount')}>
            <Input
              type="number"
              min="0"
              step="1"
              value={configMinPayout}
              onChange={(e) => { setConfigMinPayout(e.target.value); setConfigErrors(prev => { const n = { ...prev }; delete n.minPayout; return n; }); }}
            />
            {configErrors.minPayout && (
              <p className="mt-1 text-sm text-red-600" role="alert">{configErrors.minPayout}</p>
            )}
          </FormField>
          <FormField label={t('admin.ambassadors.cookieDuration')}>
            <Input
              type="number"
              min="1"
              max="365"
              value={configCookieDays}
              onChange={(e) => { setConfigCookieDays(e.target.value); setConfigErrors(prev => { const n = { ...prev }; delete n.cookieDays; return n; }); }}
            />
            {configErrors.cookieDays && (
              <p className="mt-1 text-sm text-red-600" role="alert">{configErrors.cookieDays}</p>
            )}
          </FormField>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-700">{t('admin.ambassadors.autoApprove')}</span>
            <button
              onClick={() => setConfigAutoApprove(!configAutoApprove)}
              className={`w-11 h-6 rounded-full transition-colors relative ${configAutoApprove ? 'bg-sky-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${configAutoApprove ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-700">{t('admin.ambassadors.programActive')}</span>
            <button
              onClick={() => setConfigProgramActive(!configProgramActive)}
              className={`w-11 h-6 rounded-full transition-colors relative ${configProgramActive ? 'bg-green-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${configProgramActive ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </Modal>

      {/* UX FIX: ConfirmDialog for destructive actions */}
      <ConfirmDialog
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        variant={confirmAction.variant}
        onConfirm={confirmAction.onConfirm}
        onCancel={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
      />

      {/* ─── EDIT COMMISSION MODAL ──────────────────────────────── */}
      <Modal
        isOpen={showEditCommissionModal}
        onClose={() => setShowEditCommissionModal(false)}
        title={t('admin.ambassadors.editCommissionTitle')}
        subtitle={t('admin.ambassadors.editCommissionSubtitle', { name: selectedAmbassador?.userName || '' })}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditCommissionModal(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" onClick={handleSaveCommission} loading={savingCommission}>
              {t('common.save') || 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {selectedAmbassador && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-sm text-slate-500">{t('admin.ambassadors.currentRate')}</p>
              <p className="text-2xl font-bold text-slate-900">{selectedAmbassador.commissionRate}%</p>
            </div>
          )}
          <FormField label={t('admin.ambassadors.newRate')}>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={editCommissionRate}
              onChange={(e) => { setEditCommissionRate(e.target.value); setCommissionError(''); }}
            />
            {commissionError && (
              <p className="mt-1 text-sm text-red-600" role="alert">{commissionError}</p>
            )}
          </FormField>
          {/* Tier reference */}
          <div className="bg-sky-50 rounded-lg p-3">
            <p className="text-xs text-sky-700 font-medium mb-1">{t('admin.ambassadors.commissionLevels')}</p>
            <div className="flex gap-3 text-xs text-sky-600">
              {Object.entries(tierConfig).map(([tier, config]) => (
                <span key={tier}>{tier}: {config.commission}%</span>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
