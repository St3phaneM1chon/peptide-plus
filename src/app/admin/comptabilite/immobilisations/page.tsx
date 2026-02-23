'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Calculator,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Pencil,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import {
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  Button,
  Modal,
  FormField,
  Input,
  SelectFilter,
  FilterBar,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { CCA_CLASSES } from '@/lib/accounting/canadian-tax-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DepreciationEntry {
  id: string;
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  openingUCC: number;
  ccaClaimed: number;
  closingUCC: number;
}

interface FixedAsset {
  id: string;
  name: string;
  description: string | null;
  assetNumber: string;
  serialNumber: string | null;
  location: string | null;
  acquisitionDate: string;
  acquisitionCost: number;
  residualValue: number;
  currentBookValue: number;
  accumulatedDepreciation: number;
  ccaClass: number;
  ccaRate: number;
  depreciationMethod: string;
  halfYearRuleApplied: boolean;
  aiiApplied: boolean;
  superDeduction: boolean;
  gifiCode: string | null;
  status: string;
  disposalDate: string | null;
  disposalProceeds: number | null;
  disposalGainLoss: number | null;
  assetAccount: { id: string; code: string; name: string };
  depreciationAccount: { id: string; code: string; name: string };
  expenseAccount: { id: string; code: string; name: string };
  depreciationEntries: DepreciationEntry[];
  notes: string | null;
}

interface Stats {
  totalAssets: number;
  totalCost: number;
  totalBookValue: number;
  totalDepreciation: number;
  activeCount: number;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImmobilisationsPage() {
  const { t, locale, formatCurrency } = useI18n();
  const theme = sectionThemes.accounts;

  // Data
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [stats, setStats] = useState<Stats>({ totalAssets: 0, totalCost: 0, totalBookValue: 0, totalDepreciation: 0, activeCount: 0 });
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ccaClassFilter, setCcaClassFilter] = useState('');

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showDisposeModal, setShowDisposeModal] = useState(false);
  const [disposingAsset, setDisposingAsset] = useState<FixedAsset | null>(null);
  const [showCCAModal, setShowCCAModal] = useState(false);
  const [ccaAsset, setCcaAsset] = useState<FixedAsset | null>(null);
  const [disposingId, setDisposingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '', description: '', assetNumber: '', serialNumber: '', location: '',
    acquisitionDate: '', acquisitionCost: '', residualValue: '0',
    ccaClass: '', ccaRate: '', depreciationMethod: 'DECLINING_BALANCE',
    halfYearRuleApplied: true, aiiApplied: false, superDeduction: false,
    gifiCode: '', assetAccountId: '', depreciationAccountId: '', expenseAccountId: '', notes: '',
  });

  const [disposeForm, setDisposeForm] = useState({ disposalDate: '', disposalProceeds: '0' });
  const [ccaForm, setCcaForm] = useState({ fiscalYear: String(new Date().getFullYear()), periodStart: '', periodEnd: '' });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchAssets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (ccaClassFilter) params.set('ccaClass', ccaClassFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/accounting/fixed-assets?${params}`);
      const json = await res.json();
      if (json.assets) { setAssets(json.assets); setStats(json.stats); }
    } catch (err) {
      console.error('Error fetching fixed assets:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, ccaClassFilter, search]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/chart-of-accounts');
      const json = await res.json();
      if (json.accounts) {
        setAccounts(json.accounts.map((a: Record<string, unknown>) => ({
          id: a.id as string, code: a.code as string, name: a.name as string,
        })));
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  }, []);

  useEffect(() => { fetchAssets(); fetchAccounts(); }, [fetchAssets, fetchAccounts]);

  // Refetch when filters change
  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const openCreate = () => {
    setEditingAsset(null);
    setForm({
      name: '', description: '', assetNumber: '', serialNumber: '', location: '',
      acquisitionDate: '', acquisitionCost: '', residualValue: '0',
      ccaClass: '', ccaRate: '', depreciationMethod: 'DECLINING_BALANCE',
      halfYearRuleApplied: true, aiiApplied: false, superDeduction: false,
      gifiCode: '', assetAccountId: '', depreciationAccountId: '', expenseAccountId: '', notes: '',
    });
    setActiveTab(0);
    setShowModal(true);
  };

  const openEdit = (asset: FixedAsset) => {
    setEditingAsset(asset);
    setForm({
      name: asset.name,
      description: asset.description || '',
      assetNumber: asset.assetNumber,
      serialNumber: asset.serialNumber || '',
      location: asset.location || '',
      acquisitionDate: asset.acquisitionDate.slice(0, 10),
      acquisitionCost: String(asset.acquisitionCost),
      residualValue: String(asset.residualValue),
      ccaClass: String(asset.ccaClass),
      ccaRate: String(asset.ccaRate),
      depreciationMethod: asset.depreciationMethod,
      halfYearRuleApplied: asset.halfYearRuleApplied,
      aiiApplied: asset.aiiApplied,
      superDeduction: asset.superDeduction,
      gifiCode: asset.gifiCode || '',
      assetAccountId: asset.assetAccount.id,
      depreciationAccountId: asset.depreciationAccount.id,
      expenseAccountId: asset.expenseAccount.id,
      notes: asset.notes || '',
    });
    setActiveTab(0);
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const payload = editingAsset
        ? { id: editingAsset.id, ...form, ccaClass: parseInt(form.ccaClass, 10), ccaRate: parseFloat(form.ccaRate) }
        : { ...form, ccaClass: parseInt(form.ccaClass, 10), ccaRate: parseFloat(form.ccaRate) };

      const res = await fetch('/api/accounting/fixed-assets', {
        method: editingAsset ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Erreur');
        return;
      }

      toast.success(editingAsset ? t('admin.accounting.assets.updated') : t('admin.accounting.assets.created'));
      setShowModal(false);
      await fetchAssets();
    } catch {
      toast.error(t('admin.accounting.assets.saveError'));
    }
  };

  const handleDispose = async () => {
    if (!disposingAsset) return;
    setDisposingId(disposingAsset.id);
    try {
      const res = await fetch('/api/accounting/fixed-assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: disposingAsset.id,
          status: 'DISPOSED',
          disposalDate: disposeForm.disposalDate,
          disposalProceeds: disposeForm.disposalProceeds,
        }),
      });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Erreur'); return; }
      toast.success(t('admin.accounting.assets.disposed'));
      setShowDisposeModal(false);
      await fetchAssets();
    } catch {
      toast.error(t('admin.accounting.assets.disposeError'));
    } finally {
      setDisposingId(null);
    }
  };

  const handleCalculateCCA = async () => {
    if (!ccaAsset) return;
    try {
      const res = await fetch('/api/accounting/fixed-assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ccaAsset.id,
          action: 'depreciate',
          fiscalYear: parseInt(ccaForm.fiscalYear, 10),
          periodStart: ccaForm.periodStart,
          periodEnd: ccaForm.periodEnd,
        }),
      });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Erreur'); return; }
      const json = await res.json();
      toast.success(`DPA calculee: ${formatCurrency(json.depreciationEntry.ccaClaimed)}`);
      setShowCCAModal(false);
      await fetchAssets();
    } catch {
      toast.error(t('admin.accounting.assets.ccaError'));
    }
  };

  const handleCCAClassChange = (val: string) => {
    setForm((f) => {
      const cls = CCA_CLASSES.find((c) => String(c.classNumber) === val);
      return { ...f, ccaClass: val, ccaRate: cls ? String(cls.rate) : '' };
    });
  };

  // ---------------------------------------------------------------------------
  // Ribbon actions
  // ---------------------------------------------------------------------------

  const handleRibbonNewEntry = useCallback(() => { openCreate(); }, []);
  const handleRibbonDelete = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonValidate = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonCancel = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonDuplicate = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonPrint = useCallback(() => { window.print(); }, []);
  const handleRibbonExport = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);

  useRibbonAction('newEntry', handleRibbonNewEntry);
  useRibbonAction('delete', handleRibbonDelete);
  useRibbonAction('validate', handleRibbonValidate);
  useRibbonAction('cancel', handleRibbonCancel);
  useRibbonAction('duplicate', handleRibbonDuplicate);
  useRibbonAction('print', handleRibbonPrint);
  useRibbonAction('export', handleRibbonExport);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const getCcaDescription = (c: { description: string; descriptionFr: string }) => {
    return locale === 'fr' ? c.descriptionFr : c.description;
  };

  const statusBadge = (s: string) => {
    if (s === 'ACTIVE') return <StatusBadge variant="success">{t('admin.accounting.assets.statusActive')}</StatusBadge>;
    if (s === 'DISPOSED') return <StatusBadge variant="error">{t('admin.accounting.assets.statusDisposed')}</StatusBadge>;
    return <StatusBadge variant="neutral">{t('admin.accounting.assets.statusDepreciated')}</StatusBadge>;
  };

  const ccaClassOptions = CCA_CLASSES.map((c) => ({
    value: String(c.classNumber),
    label: `${t('admin.accounting.assets.classLabel')} ${c.classNumber} (${c.rate}%) - ${getCcaDescription(c)}`,
  }));

  const statusOptions = [
    { value: 'ACTIVE', label: t('admin.accounting.assets.statusActive') },
    { value: 'DISPOSED', label: t('admin.accounting.assets.statusDisposed') },
    { value: 'FULLY_DEPRECIATED', label: t('admin.accounting.assets.statusDepreciated') },
  ];

  const tabs = [
    t('admin.accounting.assets.tabGeneral'),
    t('admin.accounting.assets.tabFinancial'),
    t('admin.accounting.assets.tabCcaOptions'),
    t('admin.accounting.assets.tabAccounts'),
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) return (
    <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
      </div>
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('admin.accounting.assets.title')}
        subtitle={t('admin.accounting.assets.subtitle')}
        theme={theme}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={openCreate}
            className={`${theme.btnPrimary} border-transparent text-white`}
          >
            {t('admin.accounting.assets.newAsset')}
          </Button>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('admin.accounting.assets.totalAssets')} value={stats.totalAssets} icon={Building2} theme={theme} />
        <StatCard label={t('admin.accounting.assets.acquisitionCost')} value={formatCurrency(stats.totalCost)} icon={DollarSign} theme={theme} />
        <StatCard label={t('admin.accounting.assets.netBookValue')} value={formatCurrency(stats.totalBookValue)} icon={TrendingDown} theme={theme} />
        <StatCard label={t('admin.accounting.assets.totalDepreciation')} value={formatCurrency(stats.totalDepreciation)} icon={Calculator} theme={theme} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('admin.accounting.assets.searchPlaceholder')}
        actions={
          <Button variant="secondary" icon={Calculator} onClick={() => fetchAssets()}>
            {t('admin.accounting.assets.refresh')}
          </Button>
        }
      >
        <SelectFilter
          label={t('admin.accounting.assets.allStatuses')}
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
        />
        <SelectFilter
          label={t('admin.accounting.assets.allCcaClasses')}
          value={ccaClassFilter}
          onChange={setCcaClassFilter}
          options={ccaClassOptions.map((o) => ({ value: o.value, label: `${t('admin.accounting.assets.classLabel')} ${o.value}` }))}
        />
      </FilterBar>

      {/* Assets Table */}
      <SectionCard title={t('admin.accounting.assets.title')} theme={theme} noPadding>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.assets.assetNumber')}</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.assets.colName')}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.assets.colCcaClass')}</th>
              <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.assets.colCost')}</th>
              <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.assets.colBookValue')}</th>
              <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.assets.colAccumDepr')}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.assets.colStatus')}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {assets.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  {t('admin.accounting.assets.noAssetsFound')}
                </td>
              </tr>
            )}
            {assets.map((asset) => (
              <>
                <tr key={asset.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedId(expandedId === asset.id ? null : asset.id)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === asset.id ? '' : '-rotate-90'}`} />
                      <span className="font-mono font-medium text-slate-900">{asset.assetNumber}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{asset.name}</span>
                    {asset.location && <span className="block text-xs text-slate-400">{asset.location}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {asset.ccaClass} ({asset.ccaRate}%)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end font-medium text-slate-900 tabular-nums">{formatCurrency(Number(asset.acquisitionCost))}</td>
                  <td className="px-4 py-3 text-end font-medium text-slate-900 tabular-nums">{formatCurrency(Number(asset.currentBookValue))}</td>
                  <td className="px-4 py-3 text-end text-slate-600 tabular-nums">{formatCurrency(Number(asset.accumulatedDepreciation))}</td>
                  <td className="px-4 py-3 text-center">{statusBadge(asset.status)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openEdit(asset)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Modifier">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {asset.status === 'ACTIVE' && (
                        <>
                          <button
                            onClick={() => { setCcaAsset(asset); setCcaForm({ fiscalYear: String(new Date().getFullYear()), periodStart: `${new Date().getFullYear()}-01-01`, periodEnd: `${new Date().getFullYear()}-12-31` }); setShowCCAModal(true); }}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                            title={t('admin.accounting.assets.calculateCca')}
                          >
                            <Calculator className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setDisposingAsset(asset); setDisposeForm({ disposalDate: new Date().toISOString().slice(0, 10), disposalProceeds: '0' }); setShowDisposeModal(true); }}
                            disabled={disposingId === asset.id}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            title={t('admin.accounting.assets.dispose')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded row: depreciation history + disposal details */}
                {expandedId === asset.id && (
                  <tr key={`${asset.id}-detail`} className="bg-slate-50/70">
                    <td colSpan={8} className="px-6 py-4">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Depreciation history */}
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 mb-2">
                            {t('admin.accounting.assets.depreciationHistory')}
                          </h4>
                          {asset.depreciationEntries.length === 0 ? (
                            <p className="text-xs text-slate-400">{t('admin.accounting.assets.noDepreciation')}</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-500">
                                    <th className="text-start py-1">{t('admin.accounting.assets.year')}</th>
                                    <th className="text-end py-1">UCC {t('admin.accounting.assets.opening')}</th>
                                    <th className="text-end py-1">DPA</th>
                                    <th className="text-end py-1">UCC {t('admin.accounting.assets.closing')}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {asset.depreciationEntries.map((e) => (
                                    <tr key={e.id}>
                                      <td className="py-1 font-medium">{e.fiscalYear}</td>
                                      <td className="py-1 text-end tabular-nums">{formatCurrency(Number(e.openingUCC))}</td>
                                      <td className="py-1 text-end tabular-nums text-emerald-700">{formatCurrency(Number(e.ccaClaimed))}</td>
                                      <td className="py-1 text-end tabular-nums">{formatCurrency(Number(e.closingUCC))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Asset details / Disposal */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-slate-700">
                            {t('admin.accounting.assets.details')}
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <span className="text-slate-500">{t('admin.accounting.assets.method')}</span>
                            <span className="text-slate-900">{asset.depreciationMethod}</span>
                            <span className="text-slate-500">{t('admin.accounting.assets.halfYearRule')}</span>
                            <span className="text-slate-900">{asset.halfYearRuleApplied ? t('admin.accounting.assets.yes') : t('admin.accounting.assets.no')}</span>
                            <span className="text-slate-500">AII</span>
                            <span className="text-slate-900">{asset.aiiApplied ? t('admin.accounting.assets.yes') : t('admin.accounting.assets.no')}</span>
                            <span className="text-slate-500">{t('admin.accounting.assets.superDeduction')}</span>
                            <span className="text-slate-900">{asset.superDeduction ? t('admin.accounting.assets.yes') : t('admin.accounting.assets.no')}</span>
                            <span className="text-slate-500">{t('admin.accounting.assets.assetAccount')}</span>
                            <span className="text-slate-900">{asset.assetAccount.code} - {asset.assetAccount.name}</span>
                            <span className="text-slate-500">{t('admin.accounting.assets.deprAccount')}</span>
                            <span className="text-slate-900">{asset.depreciationAccount.code} - {asset.depreciationAccount.name}</span>
                            <span className="text-slate-500">{t('admin.accounting.assets.expenseAccount')}</span>
                            <span className="text-slate-900">{asset.expenseAccount.code} - {asset.expenseAccount.name}</span>
                          </div>

                          {asset.status === 'DISPOSED' && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="flex items-center gap-2 text-red-700 text-sm font-semibold mb-1">
                                <AlertTriangle className="w-4 h-4" />
                                {t('admin.accounting.assets.disposal')}
                              </div>
                              <div className="grid grid-cols-2 gap-1 text-xs">
                                <span className="text-red-600">Date</span>
                                <span>{asset.disposalDate ? new Date(asset.disposalDate).toLocaleDateString(locale) : '-'}</span>
                                <span className="text-red-600">{t('admin.accounting.assets.proceeds')}</span>
                                <span>{formatCurrency(Number(asset.disposalProceeds || 0))}</span>
                                <span className="text-red-600">{t('admin.accounting.assets.gainLoss')}</span>
                                <span className={Number(asset.disposalGainLoss || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                                  {formatCurrency(Number(asset.disposalGainLoss || 0))}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        </div>
      </SectionCard>

      {/* ================================================================= */}
      {/* Add / Edit Modal                                                   */}
      {/* ================================================================= */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAsset ? t('admin.accounting.assets.editAsset') : t('admin.accounting.assets.newAssetTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>{t('admin.accounting.assets.cancel')}</Button>
            <Button onClick={handleSave} className={`${theme.btnPrimary} border-transparent text-white shadow-sm`}>
              {editingAsset ? t('admin.accounting.assets.update') : t('admin.accounting.assets.create')}
            </Button>
          </>
        }
      >
        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-200">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === i ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab 0: General */}
        {activeTab === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.accounting.assets.colName')}>
                <Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('admin.accounting.assets.placeholderName')} />
              </FormField>
              <FormField label={t('admin.accounting.assets.assetNumber')}>
                <Input value={form.assetNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, assetNumber: e.target.value }))} placeholder="FA-001" disabled={!!editingAsset} />
              </FormField>
            </div>
            <FormField label="Description">
              <Input value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t('admin.accounting.assets.optionalDescription')} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.accounting.assets.serialNumber')}>
                <Input value={form.serialNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} placeholder="SN-12345" />
              </FormField>
              <FormField label={t('admin.accounting.assets.location')}>
                <Input value={form.location} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder={t('admin.accounting.assets.placeholderLocation')} />
              </FormField>
            </div>
          </div>
        )}

        {/* Tab 1: Financial */}
        {activeTab === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.accounting.assets.acquisitionDate')}>
                <Input type="date" value={form.acquisitionDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, acquisitionDate: e.target.value }))} />
              </FormField>
              <FormField label={t('admin.accounting.assets.acquisitionCostField')}>
                <Input type="number" step="0.01" value={form.acquisitionCost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, acquisitionCost: e.target.value }))} placeholder="0.00" />
              </FormField>
            </div>
            <FormField label={t('admin.accounting.assets.residualValue')}>
              <Input type="number" step="0.01" value={form.residualValue} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, residualValue: e.target.value }))} placeholder="0.00" />
            </FormField>
            <FormField label={t('admin.accounting.assets.ccaClassField')}>
              <select
                value={form.ccaClass}
                onChange={(e) => handleCCAClassChange(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
              >
                <option value="">{t('admin.accounting.assets.selectClass')}</option>
                {CCA_CLASSES.map((c) => (
                  <option key={c.classNumber} value={String(c.classNumber)}>
                    {t('admin.accounting.assets.classLabel')} {c.classNumber} ({c.rate}%) - {getCcaDescription(c)}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.accounting.assets.ccaRate')}>
                <Input type="number" step="0.01" value={form.ccaRate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, ccaRate: e.target.value }))} placeholder="20" />
              </FormField>
              <FormField label={t('admin.accounting.assets.method')}>
                <select
                  value={form.depreciationMethod}
                  onChange={(e) => setForm((f) => ({ ...f, depreciationMethod: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
                >
                  <option value="DECLINING_BALANCE">{t('admin.accounting.assets.methodDeclining')}</option>
                  <option value="STRAIGHT_LINE">{t('admin.accounting.assets.methodStraight')}</option>
                  <option value="LEASE_TERM">{t('admin.accounting.assets.methodLease')}</option>
                </select>
              </FormField>
            </div>
          </div>
        )}

        {/* Tab 2: CCA Options */}
        {activeTab === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <input type="checkbox" id="halfYear" checked={form.halfYearRuleApplied} onChange={(e) => setForm((f) => ({ ...f, halfYearRuleApplied: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
              <label htmlFor="halfYear" className="text-sm text-slate-700">
                <span className="font-medium">{t('admin.accounting.assets.halfYearRule')}</span>
                <span className="block text-xs text-slate-500">{t('admin.accounting.assets.halfYearRuleDesc')}</span>
              </label>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <input type="checkbox" id="aii" checked={form.aiiApplied} onChange={(e) => setForm((f) => ({ ...f, aiiApplied: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
              <label htmlFor="aii" className="text-sm text-slate-700">
                <span className="font-medium">{t('admin.accounting.assets.aiiLabel')}</span>
                <span className="block text-xs text-slate-500">{t('admin.accounting.assets.aiiDesc')}</span>
              </label>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <input type="checkbox" id="superDeduction" checked={form.superDeduction} onChange={(e) => setForm((f) => ({ ...f, superDeduction: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
              <label htmlFor="superDeduction" className="text-sm text-slate-700">
                <span className="font-medium">{t('admin.accounting.assets.superDeductionLabel')}</span>
                <span className="block text-xs text-slate-500">{t('admin.accounting.assets.superDeductionDesc')}</span>
              </label>
            </div>
            <FormField label={t('admin.accounting.assets.gifiCode')}>
              <Input value={form.gifiCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, gifiCode: e.target.value }))} placeholder="1600" />
            </FormField>
          </div>
        )}

        {/* Tab 3: Accounts */}
        {activeTab === 3 && (
          <div className="space-y-4">
            <FormField label={t('admin.accounting.assets.assetAccount')}>
              <select
                value={form.assetAccountId}
                onChange={(e) => setForm((f) => ({ ...f, assetAccountId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
              >
                <option value="">{t('admin.accounting.assets.select')}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </FormField>
            <FormField label={t('admin.accounting.assets.accumDeprAccount')}>
              <select
                value={form.depreciationAccountId}
                onChange={(e) => setForm((f) => ({ ...f, depreciationAccountId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
              >
                <option value="">{t('admin.accounting.assets.select')}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </FormField>
            <FormField label={t('admin.accounting.assets.deprExpenseAccount')}>
              <select
                value={form.expenseAccountId}
                onChange={(e) => setForm((f) => ({ ...f, expenseAccountId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
              >
                <option value="">{t('admin.accounting.assets.select')}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </FormField>
            <FormField label="Notes">
              <Input value={form.notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t('admin.accounting.assets.optionalNotes')} />
            </FormField>
          </div>
        )}
      </Modal>

      {/* ================================================================= */}
      {/* Dispose Modal                                                      */}
      {/* ================================================================= */}
      <Modal
        isOpen={showDisposeModal}
        onClose={() => setShowDisposeModal(false)}
        title={t('admin.accounting.assets.disposeAsset')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDisposeModal(false)}>{t('admin.accounting.assets.cancel')}</Button>
            <Button onClick={handleDispose} disabled={!!disposingId} className="bg-red-600 hover:bg-red-700 border-transparent text-white shadow-sm">
              {t('admin.accounting.assets.confirmDisposal')}
            </Button>
          </>
        }
      >
        {disposingAsset && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <div className="flex items-center gap-2 mb-1 font-semibold">
                <AlertTriangle className="w-4 h-4" />
                {t('admin.accounting.assets.warning')}
              </div>
              {t('admin.accounting.assets.disposeWarning')
                .replace('{name}', disposingAsset.name)
                .replace('{value}', formatCurrency(Number(disposingAsset.currentBookValue)))}
            </div>
            <FormField label={t('admin.accounting.assets.disposalDate')}>
              <Input type="date" value={disposeForm.disposalDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisposeForm((f) => ({ ...f, disposalDate: e.target.value }))} />
            </FormField>
            <FormField label={t('admin.accounting.assets.disposalProceeds')}>
              <Input type="number" step="0.01" value={disposeForm.disposalProceeds} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisposeForm((f) => ({ ...f, disposalProceeds: e.target.value }))} placeholder="0.00" />
            </FormField>
            {disposeForm.disposalProceeds && (
              <div className="text-sm text-slate-600">
                {t('admin.accounting.assets.estimatedGainLoss')}:{' '}
                <span className={Number(disposeForm.disposalProceeds) - Number(disposingAsset.currentBookValue) >= 0 ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                  {formatCurrency(Number(disposeForm.disposalProceeds) - Number(disposingAsset.currentBookValue))}
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ================================================================= */}
      {/* Calculate CCA Modal                                                */}
      {/* ================================================================= */}
      <Modal
        isOpen={showCCAModal}
        onClose={() => setShowCCAModal(false)}
        title={t('admin.accounting.assets.calculateCcaTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCCAModal(false)}>{t('admin.accounting.assets.cancel')}</Button>
            <Button onClick={handleCalculateCCA} className={`${theme.btnPrimary} border-transparent text-white shadow-sm`}>
              {t('admin.accounting.assets.calculate')}
            </Button>
          </>
        }
      >
        {ccaAsset && (
          <div className="space-y-4">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
              <p className="font-medium text-indigo-900">{ccaAsset.name} ({ccaAsset.assetNumber})</p>
              <p className="text-indigo-700">
                {t('admin.accounting.assets.classLabel')} {ccaAsset.ccaClass} - {ccaAsset.ccaRate}% |{' '}
                UCC: {formatCurrency(Number(ccaAsset.currentBookValue))}
              </p>
            </div>
            <FormField label={t('admin.accounting.assets.fiscalYear')}>
              <Input type="number" value={ccaForm.fiscalYear} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCcaForm((f) => ({ ...f, fiscalYear: e.target.value }))} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.accounting.assets.periodStart')}>
                <Input type="date" value={ccaForm.periodStart} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCcaForm((f) => ({ ...f, periodStart: e.target.value }))} />
              </FormField>
              <FormField label={t('admin.accounting.assets.periodEnd')}>
                <Input type="date" value={ccaForm.periodEnd} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCcaForm((f) => ({ ...f, periodEnd: e.target.value }))} />
              </FormField>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
