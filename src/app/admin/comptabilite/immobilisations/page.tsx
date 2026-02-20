'use client';

import { useState, useEffect } from 'react';
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
  const { locale, formatCurrency } = useI18n();
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

  useEffect(() => { fetchAssets(); fetchAccounts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAssets = async () => {
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
  };

  const fetchAccounts = async () => {
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
  };

  // Refetch when filters change
  useEffect(() => { fetchAssets(); }, [statusFilter, ccaClassFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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

      toast.success(editingAsset ? 'Immobilisation mise a jour' : 'Immobilisation creee');
      setShowModal(false);
      await fetchAssets();
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDispose = async () => {
    if (!disposingAsset) return;
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
      toast.success('Immobilisation disposee');
      setShowDisposeModal(false);
      await fetchAssets();
    } catch {
      toast.error('Erreur lors de la disposition');
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
      toast.error('Erreur lors du calcul DPA');
    }
  };

  const handleCCAClassChange = (val: string) => {
    setForm((f) => {
      const cls = CCA_CLASSES.find((c) => String(c.classNumber) === val);
      return { ...f, ccaClass: val, ccaRate: cls ? String(cls.rate) : '' };
    });
  };

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const statusBadge = (s: string) => {
    if (s === 'ACTIVE') return <StatusBadge variant="success">Actif</StatusBadge>;
    if (s === 'DISPOSED') return <StatusBadge variant="error">Dispose</StatusBadge>;
    return <StatusBadge variant="neutral">Amorti</StatusBadge>;
  };

  const ccaClassOptions = CCA_CLASSES.map((c) => ({
    value: String(c.classNumber),
    label: `Classe ${c.classNumber} (${c.rate}%) - ${locale === 'fr' ? c.descriptionFr : c.description}`,
  }));

  const statusOptions = [
    { value: 'ACTIVE', label: 'Actif' },
    { value: 'DISPOSED', label: 'Dispose' },
    { value: 'FULLY_DEPRECIATED', label: 'Entierement amorti' },
  ];

  const tabs = [
    locale === 'fr' ? 'General' : 'General',
    locale === 'fr' ? 'Financier' : 'Financial',
    locale === 'fr' ? 'Options DPA' : 'CCA Options',
    locale === 'fr' ? 'Comptes' : 'Accounts',
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) return (
    <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
      </div>
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={locale === 'fr' ? 'Immobilisations' : 'Fixed Assets'}
        subtitle={locale === 'fr' ? 'Gestion des actifs immobilises et amortissement DPA' : 'Fixed asset management and CCA depreciation'}
        theme={theme}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={openCreate}
            className={`${theme.btnPrimary} border-transparent text-white`}
          >
            {locale === 'fr' ? 'Nouvelle immobilisation' : 'New Asset'}
          </Button>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label={locale === 'fr' ? 'Total actifs' : 'Total Assets'} value={stats.totalAssets} icon={Building2} theme={theme} />
        <StatCard label={locale === 'fr' ? 'Cout d\'acquisition' : 'Acquisition Cost'} value={formatCurrency(stats.totalCost)} icon={DollarSign} theme={theme} />
        <StatCard label={locale === 'fr' ? 'Valeur comptable nette' : 'Net Book Value'} value={formatCurrency(stats.totalBookValue)} icon={TrendingDown} theme={theme} />
        <StatCard label={locale === 'fr' ? 'Amortissement cumule' : 'Total Depreciation'} value={formatCurrency(stats.totalDepreciation)} icon={Calculator} theme={theme} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={locale === 'fr' ? 'Rechercher un actif...' : 'Search assets...'}
        actions={
          <Button variant="secondary" icon={Calculator} onClick={() => fetchAssets()}>
            {locale === 'fr' ? 'Actualiser' : 'Refresh'}
          </Button>
        }
      >
        <SelectFilter
          label={locale === 'fr' ? 'Tous les statuts' : 'All Statuses'}
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
        />
        <SelectFilter
          label={locale === 'fr' ? 'Toutes les classes' : 'All CCA Classes'}
          value={ccaClassFilter}
          onChange={setCcaClassFilter}
          options={ccaClassOptions.map((o) => ({ value: o.value, label: `Classe ${o.value}` }))}
        />
      </FilterBar>

      {/* Assets Table */}
      <SectionCard title={locale === 'fr' ? 'Immobilisations' : 'Fixed Assets'} theme={theme} noPadding>
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">No Actif</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{locale === 'fr' ? 'Nom' : 'Name'}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{locale === 'fr' ? 'Classe DPA' : 'CCA Class'}</th>
              <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{locale === 'fr' ? 'Cout' : 'Cost'}</th>
              <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{locale === 'fr' ? 'Valeur comptable' : 'Book Value'}</th>
              <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{locale === 'fr' ? 'Amort. cumule' : 'Accum. Depr.'}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{locale === 'fr' ? 'Statut' : 'Status'}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {assets.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  {locale === 'fr' ? 'Aucune immobilisation trouvee' : 'No fixed assets found'}
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
                            title={locale === 'fr' ? 'Calculer DPA' : 'Calculate CCA'}
                          >
                            <Calculator className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setDisposingAsset(asset); setDisposeForm({ disposalDate: new Date().toISOString().slice(0, 10), disposalProceeds: '0' }); setShowDisposeModal(true); }}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title={locale === 'fr' ? 'Disposer' : 'Dispose'}
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
                            {locale === 'fr' ? 'Historique d\'amortissement' : 'Depreciation History'}
                          </h4>
                          {asset.depreciationEntries.length === 0 ? (
                            <p className="text-xs text-slate-400">{locale === 'fr' ? 'Aucun amortissement enregistre' : 'No depreciation recorded'}</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-500">
                                  <th className="text-start py-1">{locale === 'fr' ? 'Annee' : 'Year'}</th>
                                  <th className="text-end py-1">UCC {locale === 'fr' ? 'ouverture' : 'opening'}</th>
                                  <th className="text-end py-1">DPA</th>
                                  <th className="text-end py-1">UCC {locale === 'fr' ? 'fermeture' : 'closing'}</th>
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
                          )}
                        </div>

                        {/* Asset details / Disposal */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-slate-700">
                            {locale === 'fr' ? 'Details' : 'Details'}
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <span className="text-slate-500">{locale === 'fr' ? 'Methode' : 'Method'}</span>
                            <span className="text-slate-900">{asset.depreciationMethod}</span>
                            <span className="text-slate-500">{locale === 'fr' ? 'Regle 50%' : 'Half-Year Rule'}</span>
                            <span className="text-slate-900">{asset.halfYearRuleApplied ? 'Oui' : 'Non'}</span>
                            <span className="text-slate-500">AII</span>
                            <span className="text-slate-900">{asset.aiiApplied ? 'Oui' : 'Non'}</span>
                            <span className="text-slate-500">{locale === 'fr' ? 'Super deduction' : 'Super Deduction'}</span>
                            <span className="text-slate-900">{asset.superDeduction ? 'Oui' : 'Non'}</span>
                            <span className="text-slate-500">{locale === 'fr' ? 'Compte actif' : 'Asset Account'}</span>
                            <span className="text-slate-900">{asset.assetAccount.code} - {asset.assetAccount.name}</span>
                            <span className="text-slate-500">{locale === 'fr' ? 'Compte amort.' : 'Depr. Account'}</span>
                            <span className="text-slate-900">{asset.depreciationAccount.code} - {asset.depreciationAccount.name}</span>
                            <span className="text-slate-500">{locale === 'fr' ? 'Compte charge' : 'Expense Account'}</span>
                            <span className="text-slate-900">{asset.expenseAccount.code} - {asset.expenseAccount.name}</span>
                          </div>

                          {asset.status === 'DISPOSED' && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="flex items-center gap-2 text-red-700 text-sm font-semibold mb-1">
                                <AlertTriangle className="w-4 h-4" />
                                {locale === 'fr' ? 'Disposition' : 'Disposal'}
                              </div>
                              <div className="grid grid-cols-2 gap-1 text-xs">
                                <span className="text-red-600">Date</span>
                                <span>{asset.disposalDate ? new Date(asset.disposalDate).toLocaleDateString() : '-'}</span>
                                <span className="text-red-600">{locale === 'fr' ? 'Produit' : 'Proceeds'}</span>
                                <span>{formatCurrency(Number(asset.disposalProceeds || 0))}</span>
                                <span className="text-red-600">{locale === 'fr' ? 'Gain/Perte' : 'Gain/Loss'}</span>
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
      </SectionCard>

      {/* ================================================================= */}
      {/* Add / Edit Modal                                                   */}
      {/* ================================================================= */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAsset ? (locale === 'fr' ? 'Modifier l\'immobilisation' : 'Edit Fixed Asset') : (locale === 'fr' ? 'Nouvelle immobilisation' : 'New Fixed Asset')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>{locale === 'fr' ? 'Annuler' : 'Cancel'}</Button>
            <Button onClick={handleSave} className={`${theme.btnPrimary} border-transparent text-white shadow-sm`}>
              {editingAsset ? (locale === 'fr' ? 'Mettre a jour' : 'Update') : (locale === 'fr' ? 'Creer' : 'Create')}
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
              <FormField label={locale === 'fr' ? 'Nom' : 'Name'}>
                <Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ordinateur portable Dell" />
              </FormField>
              <FormField label="No Actif">
                <Input value={form.assetNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, assetNumber: e.target.value }))} placeholder="FA-001" disabled={!!editingAsset} />
              </FormField>
            </div>
            <FormField label="Description">
              <Input value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={locale === 'fr' ? 'Description optionnelle' : 'Optional description'} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={locale === 'fr' ? 'No Serie' : 'Serial Number'}>
                <Input value={form.serialNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} placeholder="SN-12345" />
              </FormField>
              <FormField label={locale === 'fr' ? 'Emplacement' : 'Location'}>
                <Input value={form.location} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Bureau 201" />
              </FormField>
            </div>
          </div>
        )}

        {/* Tab 1: Financial */}
        {activeTab === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label={locale === 'fr' ? 'Date d\'acquisition' : 'Acquisition Date'}>
                <Input type="date" value={form.acquisitionDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, acquisitionDate: e.target.value }))} />
              </FormField>
              <FormField label={locale === 'fr' ? 'Cout d\'acquisition ($)' : 'Acquisition Cost ($)'}>
                <Input type="number" step="0.01" value={form.acquisitionCost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, acquisitionCost: e.target.value }))} placeholder="0.00" />
              </FormField>
            </div>
            <FormField label={locale === 'fr' ? 'Valeur residuelle ($)' : 'Residual Value ($)'}>
              <Input type="number" step="0.01" value={form.residualValue} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, residualValue: e.target.value }))} placeholder="0.00" />
            </FormField>
            <FormField label={locale === 'fr' ? 'Classe DPA' : 'CCA Class'}>
              <select
                value={form.ccaClass}
                onChange={(e) => handleCCAClassChange(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
              >
                <option value="">{locale === 'fr' ? '-- Choisir une classe --' : '-- Select a class --'}</option>
                {CCA_CLASSES.map((c) => (
                  <option key={c.classNumber} value={String(c.classNumber)}>
                    Classe {c.classNumber} ({c.rate}%) - {locale === 'fr' ? c.descriptionFr : c.description}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={locale === 'fr' ? 'Taux DPA (%)' : 'CCA Rate (%)'}>
                <Input type="number" step="0.01" value={form.ccaRate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, ccaRate: e.target.value }))} placeholder="20" />
              </FormField>
              <FormField label={locale === 'fr' ? 'Methode' : 'Method'}>
                <select
                  value={form.depreciationMethod}
                  onChange={(e) => setForm((f) => ({ ...f, depreciationMethod: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
                >
                  <option value="DECLINING_BALANCE">{locale === 'fr' ? 'Solde degressif' : 'Declining Balance'}</option>
                  <option value="STRAIGHT_LINE">{locale === 'fr' ? 'Lineaire' : 'Straight Line'}</option>
                  <option value="LEASE_TERM">{locale === 'fr' ? 'Duree du bail' : 'Lease Term'}</option>
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
                <span className="font-medium">{locale === 'fr' ? 'Regle de 50% (demi-annee)' : 'Half-Year Rule'}</span>
                <span className="block text-xs text-slate-500">{locale === 'fr' ? 'Applique 50% du taux la premiere annee d\'acquisition' : 'Applies 50% of the rate in the first year of acquisition'}</span>
              </label>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <input type="checkbox" id="aii" checked={form.aiiApplied} onChange={(e) => setForm((f) => ({ ...f, aiiApplied: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
              <label htmlFor="aii" className="text-sm text-slate-700">
                <span className="font-medium">{locale === 'fr' ? 'Incitatif a l\'investissement accelere (IIA)' : 'Accelerated Investment Incentive (AII)'}</span>
                <span className="block text-xs text-slate-500">{locale === 'fr' ? '1.5x le taux normal la premiere annee (remplace la regle de 50%)' : '1.5x the normal rate in the first year (replaces half-year rule)'}</span>
              </label>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <input type="checkbox" id="superDeduction" checked={form.superDeduction} onChange={(e) => setForm((f) => ({ ...f, superDeduction: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
              <label htmlFor="superDeduction" className="text-sm text-slate-700">
                <span className="font-medium">{locale === 'fr' ? 'Super deduction (100%)' : 'Super Deduction (100%)'}</span>
                <span className="block text-xs text-slate-500">{locale === 'fr' ? 'Passation immediate en charges completes (Budget 2025)' : '100% immediate expensing (Budget 2025)'}</span>
              </label>
            </div>
            <FormField label={locale === 'fr' ? 'Code GIFI' : 'GIFI Code'}>
              <Input value={form.gifiCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, gifiCode: e.target.value }))} placeholder="1600" />
            </FormField>
          </div>
        )}

        {/* Tab 3: Accounts */}
        {activeTab === 3 && (
          <div className="space-y-4">
            <FormField label={locale === 'fr' ? 'Compte d\'actif' : 'Asset Account'}>
              <select
                value={form.assetAccountId}
                onChange={(e) => setForm((f) => ({ ...f, assetAccountId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
              >
                <option value="">{locale === 'fr' ? '-- Choisir --' : '-- Select --'}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </FormField>
            <FormField label={locale === 'fr' ? 'Compte d\'amortissement cumule' : 'Accumulated Depreciation Account'}>
              <select
                value={form.depreciationAccountId}
                onChange={(e) => setForm((f) => ({ ...f, depreciationAccountId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
              >
                <option value="">{locale === 'fr' ? '-- Choisir --' : '-- Select --'}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </FormField>
            <FormField label={locale === 'fr' ? 'Compte de charge (amortissement)' : 'Depreciation Expense Account'}>
              <select
                value={form.expenseAccountId}
                onChange={(e) => setForm((f) => ({ ...f, expenseAccountId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
              >
                <option value="">{locale === 'fr' ? '-- Choisir --' : '-- Select --'}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </FormField>
            <FormField label="Notes">
              <Input value={form.notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={locale === 'fr' ? 'Notes optionnelles' : 'Optional notes'} />
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
        title={locale === 'fr' ? 'Disposer de l\'immobilisation' : 'Dispose Fixed Asset'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDisposeModal(false)}>{locale === 'fr' ? 'Annuler' : 'Cancel'}</Button>
            <Button onClick={handleDispose} className="bg-red-600 hover:bg-red-700 border-transparent text-white shadow-sm">
              {locale === 'fr' ? 'Confirmer la disposition' : 'Confirm Disposal'}
            </Button>
          </>
        }
      >
        {disposingAsset && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <div className="flex items-center gap-2 mb-1 font-semibold">
                <AlertTriangle className="w-4 h-4" />
                {locale === 'fr' ? 'Attention' : 'Warning'}
              </div>
              {locale === 'fr'
                ? `Vous allez disposer de "${disposingAsset.name}" (valeur comptable: ${formatCurrency(Number(disposingAsset.currentBookValue))}). Cette action est irreversible.`
                : `You are about to dispose of "${disposingAsset.name}" (book value: ${formatCurrency(Number(disposingAsset.currentBookValue))}). This action is irreversible.`}
            </div>
            <FormField label={locale === 'fr' ? 'Date de disposition' : 'Disposal Date'}>
              <Input type="date" value={disposeForm.disposalDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisposeForm((f) => ({ ...f, disposalDate: e.target.value }))} />
            </FormField>
            <FormField label={locale === 'fr' ? 'Produit de disposition ($)' : 'Disposal Proceeds ($)'}>
              <Input type="number" step="0.01" value={disposeForm.disposalProceeds} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisposeForm((f) => ({ ...f, disposalProceeds: e.target.value }))} placeholder="0.00" />
            </FormField>
            {disposeForm.disposalProceeds && (
              <div className="text-sm text-slate-600">
                {locale === 'fr' ? 'Gain/Perte estime' : 'Estimated Gain/Loss'}:{' '}
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
        title={locale === 'fr' ? 'Calculer la DPA' : 'Calculate CCA'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCCAModal(false)}>{locale === 'fr' ? 'Annuler' : 'Cancel'}</Button>
            <Button onClick={handleCalculateCCA} className={`${theme.btnPrimary} border-transparent text-white shadow-sm`}>
              {locale === 'fr' ? 'Calculer' : 'Calculate'}
            </Button>
          </>
        }
      >
        {ccaAsset && (
          <div className="space-y-4">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
              <p className="font-medium text-indigo-900">{ccaAsset.name} ({ccaAsset.assetNumber})</p>
              <p className="text-indigo-700">
                {locale === 'fr' ? 'Classe' : 'Class'} {ccaAsset.ccaClass} - {ccaAsset.ccaRate}% |{' '}
                UCC: {formatCurrency(Number(ccaAsset.currentBookValue))}
              </p>
            </div>
            <FormField label={locale === 'fr' ? 'Annee fiscale' : 'Fiscal Year'}>
              <Input type="number" value={ccaForm.fiscalYear} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCcaForm((f) => ({ ...f, fiscalYear: e.target.value }))} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={locale === 'fr' ? 'Debut de periode' : 'Period Start'}>
                <Input type="date" value={ccaForm.periodStart} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCcaForm((f) => ({ ...f, periodStart: e.target.value }))} />
              </FormField>
              <FormField label={locale === 'fr' ? 'Fin de periode' : 'Period End'}>
                <Input type="date" value={ccaForm.periodEnd} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCcaForm((f) => ({ ...f, periodEnd: e.target.value }))} />
              </FormField>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
