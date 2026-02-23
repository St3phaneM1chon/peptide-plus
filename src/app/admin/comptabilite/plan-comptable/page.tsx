'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Download, ChevronRight, Pencil, ClipboardList, Sparkles, FileSpreadsheet } from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  FilterBar,
  SelectFilter,
  FormField,
  Input,
  StatusBadge,
  SectionCard,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { CCA_CLASSES } from '@/lib/accounting/canadian-tax-config';
import { useRibbonAction } from '@/hooks/useRibbonAction';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  category: string;
  balance: number;
  isActive: boolean;
  parentId?: string;
  children?: Account[];
  // GIFI fields
  gifiCode?: string | null;
  gifiName?: string | null;
  ccaClass?: number | null;
  ccaRate?: number | null;
  deductiblePercent?: number | null;
  isContra?: boolean;
}

interface GifiSuggestion {
  code: string;
  nameEn: string;
  nameFr: string;
  category: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlanComptablePage() {
  const { t, locale, formatCurrency } = useI18n();

  const accountTypes: Record<string, { label: string; color: string; prefix: string }> = {
    ASSET: { label: t('admin.chartOfAccounts.typeAsset'), color: 'blue', prefix: '1' },
    LIABILITY: { label: t('admin.chartOfAccounts.typeLiability'), color: 'red', prefix: '2' },
    EQUITY: { label: t('admin.chartOfAccounts.typeEquity'), color: 'purple', prefix: '3' },
    REVENUE: { label: t('admin.chartOfAccounts.typeRevenue'), color: 'green', prefix: '4' },
    EXPENSE: { label: t('admin.chartOfAccounts.typeExpense'), color: 'sky', prefix: '5-6-7' },
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [gifiFilter, setGifiFilter] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['1000', '2000', '4000', '5000']));
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchAssigning, setBatchAssigning] = useState(false);

  // GIFI modal state
  const [modalCode, setModalCode] = useState('');
  const [modalType, setModalType] = useState('ASSET');
  const [modalName, setModalName] = useState('');
  const [modalCategory, setModalCategory] = useState('');
  const [modalParent, setModalParent] = useState('');
  const [modalActive, setModalActive] = useState(true);
  const [modalGifiCode, setModalGifiCode] = useState('');
  const [modalGifiName, setModalGifiName] = useState('');
  const [modalCcaClass, setModalCcaClass] = useState('');
  const [modalCcaRate, setModalCcaRate] = useState('');
  const [modalDeductiblePercent, setModalDeductiblePercent] = useState('');
  const [modalIsContra, setModalIsContra] = useState(false);
  const [gifiSuggestions, setGifiSuggestions] = useState<GifiSuggestion[]>([]);
  const [suggestingGifi, setSuggestingGifi] = useState(false);

  const getCategoryFromType = useCallback((type: string, code: string): string => {
    const codeNum = parseInt(code);
    if (type === 'ASSET') return codeNum < 1500 ? t('admin.chartOfAccounts.currentAssets') : t('admin.chartOfAccounts.nonCurrentAssets');
    if (type === 'LIABILITY') return t('admin.chartOfAccounts.currentLiabilities');
    if (type === 'EQUITY') return t('admin.chartOfAccounts.typeEquity');
    if (type === 'REVENUE') return t('admin.chartOfAccounts.typeRevenue');
    if (type === 'EXPENSE') {
      if (codeNum < 6000) return t('admin.chartOfAccounts.cogs');
      if (codeNum < 7000) return t('admin.chartOfAccounts.operations');
      return t('admin.chartOfAccounts.other');
    }
    return '';
  }, [t]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/chart-of-accounts');
      const json = await res.json();
      if (json.accounts) {
        const mapped: Account[] = json.accounts.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          code: a.code as string,
          name: a.name as string,
          type: a.type as Account['type'],
          category: (a.description as string) || getCategoryFromType(a.type as string, a.code as string),
          balance: 0,
          isActive: a.isActive as boolean,
          parentId: (a.parentId as string) || undefined,
          gifiCode: (a.gifiCode as string) || null,
          gifiName: (a.gifiName as string) || null,
          ccaClass: (a.ccaClass as number) ?? null,
          ccaRate: (a.ccaRate as number) ?? null,
          deductiblePercent: (a.deductiblePercent as number) ?? null,
          isContra: (a.isContra as boolean) || false,
        }));
        setAccounts(mapped);
      }
    } catch (err) {
      console.error('Error fetching chart of accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [getCategoryFromType]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Reset modal GIFI fields when editing account changes
  const openModal = (account: Account | null) => {
    setEditingAccount(account);
    setModalCode(account?.code || '');
    setModalType(account?.type || 'ASSET');
    setModalName(account?.name || '');
    setModalCategory(account?.category || '');
    setModalParent(account?.parentId || '');
    setModalActive(account?.isActive ?? true);
    setModalGifiCode(account?.gifiCode || '');
    setModalGifiName(account?.gifiName || '');
    setModalCcaClass(account?.ccaClass != null ? String(account.ccaClass) : '');
    setModalCcaRate(account?.ccaRate != null ? String(account.ccaRate) : '');
    setModalDeductiblePercent(account?.deductiblePercent != null ? String(account.deductiblePercent) : '');
    setModalIsContra(account?.isContra || false);
    setGifiSuggestions([]);
    setShowModal(true);
  };

  const handleSuggestGifi = async () => {
    const name = modalName || editingAccount?.name || '';
    const type = modalType || editingAccount?.type || '';

    if (!name) return;

    setSuggestingGifi(true);
    try {
      const params = new URLSearchParams({ accountName: name });
      if (type) params.set('accountType', type);
      const res = await fetch(`/api/accounting/chart-of-accounts/gifi-suggest?${params}`);
      const json = await res.json();
      if (json.suggestions) {
        setGifiSuggestions(json.suggestions);
      }
    } catch (err) {
      console.error('Error suggesting GIFI:', err);
    } finally {
      setSuggestingGifi(false);
    }
  };

  const selectGifiSuggestion = (suggestion: GifiSuggestion) => {
    setModalGifiCode(suggestion.code);
    setModalGifiName(locale === 'fr' ? suggestion.nameFr : suggestion.nameEn);
    setGifiSuggestions([]);
  };

  const handleCcaClassChange = (classNum: string) => {
    setModalCcaClass(classNum);
    if (classNum) {
      const ccaClass = CCA_CLASSES.find((c) => c.classNumber === Number(classNum));
      if (ccaClass) {
        setModalCcaRate(String(ccaClass.rate));
      }
    } else {
      setModalCcaRate('');
    }
  };

  const handleSaveAccount = async () => {
    const payload: Record<string, unknown> = {
      code: modalCode,
      name: modalName,
      type: modalType,
      normalBalance: ['ASSET', 'EXPENSE'].includes(modalType) ? 'DEBIT' : 'CREDIT',
      description: modalCategory,
      parentId: modalParent || null,
      isActive: modalActive,
    };

    try {
      if (editingAccount) {
        const res = await fetch('/api/accounting/chart-of-accounts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingAccount.id,
            name: payload.name,
            description: payload.description,
            isActive: payload.isActive,
            // GIFI / Fiscal fields
            gifiCode: modalGifiCode || null,
            gifiName: modalGifiName || null,
            ccaClass: modalCcaClass ? Number(modalCcaClass) : null,
            ccaRate: modalCcaRate ? Number(modalCcaRate) : null,
            deductiblePercent: modalDeductiblePercent ? Number(modalDeductiblePercent) : null,
            isContra: modalIsContra,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || t('admin.chartOfAccounts.updateError'));
          return;
        }
      } else {
        const res = await fetch('/api/accounting/chart-of-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || t('admin.chartOfAccounts.createError'));
          return;
        }
      }
      setShowModal(false);
      await fetchAccounts();
    } catch (err) {
      console.error('Error saving account:', err);
      toast.error(t('admin.chartOfAccounts.saveError'));
    }
  };

  const handleBatchAssignGifi = async () => {
    if (!confirm(t('admin.chartOfAccounts.autoAssignGifiConfirm'))) return;

    setBatchAssigning(true);
    try {
      const res = await fetch('/api/accounting/chart-of-accounts/gifi-suggest', {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(
          t('admin.chartOfAccounts.autoAssignSuccess')
            .replace('{count}', String(json.assigned))
            .replace('{skipped}', String(json.skipped))
        );
        await fetchAccounts();
      } else {
        toast.error(json.error || t('admin.chartOfAccounts.autoAssignError'));
      }
    } catch (err) {
      console.error('Error batch assigning GIFI:', err);
      toast.error(t('admin.chartOfAccounts.autoAssignError'));
    } finally {
      setBatchAssigning(false);
    }
  };

  const handleExportGifi = () => {
    window.open('/api/accounting/chart-of-accounts/gifi-export', '_blank');
  };

  const toggleCategory = (code: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedCategories(newExpanded);
  };

  const filteredAccounts = accounts.filter(account => {
    if (searchTerm && !account.name.toLowerCase().includes(searchTerm.toLowerCase()) && !account.code.includes(searchTerm)) {
      return false;
    }
    if (selectedType && account.type !== selectedType) {
      return false;
    }
    if (gifiFilter === 'assigned' && !account.gifiCode) {
      return false;
    }
    if (gifiFilter === 'not-assigned' && account.gifiCode) {
      return false;
    }
    return true;
  });

  const parentAccounts = filteredAccounts.filter(a => !a.parentId);

  const getChildren = (parentId: string) => filteredAccounts.filter(a => a.parentId === parentId);

  const typeColors: Record<string, string> = {
    ASSET: 'bg-blue-100 text-blue-800',
    LIABILITY: 'bg-red-100 text-red-800',
    EQUITY: 'bg-purple-100 text-purple-800',
    REVENUE: 'bg-green-100 text-green-800',
    EXPENSE: 'bg-sky-100 text-sky-800',
  };

  const totals = {
    ASSET: accounts.filter(a => a.type === 'ASSET' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
    LIABILITY: accounts.filter(a => a.type === 'LIABILITY' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
    EQUITY: accounts.filter(a => a.type === 'EQUITY' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
    REVENUE: accounts.filter(a => a.type === 'REVENUE' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
    EXPENSE: accounts.filter(a => a.type === 'EXPENSE' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
  };

  // GIFI coverage stats
  const gifiAssignedCount = accounts.filter(a => a.gifiCode).length;
  const totalAccountCount = accounts.length;

  const typeFilterOptions = [
    { value: 'ASSET', label: t('admin.chartOfAccounts.typeAssets') },
    { value: 'LIABILITY', label: t('admin.chartOfAccounts.typeLiabilities') },
    { value: 'EQUITY', label: t('admin.chartOfAccounts.typeEquity') },
    { value: 'REVENUE', label: t('admin.chartOfAccounts.typeRevenue') },
    { value: 'EXPENSE', label: t('admin.chartOfAccounts.typeExpense') },
  ];

  const gifiFilterOptions = [
    { value: 'assigned', label: t('admin.chartOfAccounts.gifiAssigned') },
    { value: 'not-assigned', label: t('admin.chartOfAccounts.gifiNotAssigned') },
  ];

  const summaryCardColors: Record<string, { bg: string; border: string; text: string; value: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', value: 'text-blue-900' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', value: 'text-red-900' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', value: 'text-purple-900' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', value: 'text-green-900' },
    sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600', value: 'text-sky-900' },
  };

  const theme = sectionThemes.accounts;

  // -- Ribbon actions --
  const handleSearch = useCallback(() => { /* search is already live via searchTerm state */ }, []);
  const handleFilterPeriod = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleExportPdfAction = useCallback(() => { handleExportGifi(); }, []);
  const handlePrint = useCallback(() => { window.print(); }, []);
  const handleNewAccount = useCallback(() => { openModal(null); }, []);

  useRibbonAction('search', handleSearch);
  useRibbonAction('filterPeriod', handleFilterPeriod);
  useRibbonAction('exportPdf', handleExportPdfAction);
  useRibbonAction('print', handlePrint);
  useRibbonAction('newAccount', handleNewAccount);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderGifiCell = (account: Account) => {
    if (account.gifiCode) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title={t('admin.chartOfAccounts.gifiAssigned')} />
          <span className="font-mono text-xs text-slate-700">{account.gifiCode}</span>
          {account.gifiName && (
            <span className="text-xs text-slate-500 truncate max-w-[120px]" title={account.gifiName}>
              {account.gifiName}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title={t('admin.chartOfAccounts.gifiNotAssigned')} />
        <span className="text-xs text-slate-400">&mdash;</span>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) return (
    <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
      </div>
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.chartOfAccounts.title')}
        subtitle={t('admin.chartOfAccounts.subtitle')}
        theme={theme}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={Sparkles}
              onClick={handleBatchAssignGifi}
              disabled={batchAssigning}
            >
              {batchAssigning ? '...' : t('admin.chartOfAccounts.autoAssignGifi')}
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => openModal(null)}
              className={`${theme.btnPrimary} border-transparent text-white`}
            >
              {t('admin.chartOfAccounts.newAccount')}
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(accountTypes).map(([key, value]) => {
          const colors = summaryCardColors[value.color];
          return (
            <div key={key} className={`${colors.bg} rounded-xl p-4 border ${colors.border}`}>
              <p className={`text-sm ${colors.text}`}>{value.label}</p>
              <p className={`text-xl font-bold ${colors.value}`}>
                {formatCurrency(totals[key as keyof typeof totals])}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {accounts.filter(a => a.type === key && !a.parentId).length} {t('admin.chartOfAccounts.accounts')}
              </p>
            </div>
          );
        })}
      </div>

      {/* GIFI Coverage Badge */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-indigo-700 font-medium">
            {t('admin.chartOfAccounts.gifiCoverage')
              .replace('{count}', String(gifiAssignedCount))
              .replace('{total}', String(totalAccountCount))}
          </span>
          {totalAccountCount > 0 && (
            <span className="text-indigo-500 text-xs">
              ({Math.round((gifiAssignedCount / totalAccountCount) * 100)}%)
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('admin.chartOfAccounts.searchPlaceholder')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={FileSpreadsheet} onClick={handleExportGifi}>
              {t('admin.chartOfAccounts.exportGifi')}
            </Button>
            <Button variant="secondary" icon={Download}>
              {t('admin.chartOfAccounts.export')}
            </Button>
          </div>
        }
      >
        <SelectFilter
          label={t('admin.chartOfAccounts.allTypes')}
          value={selectedType}
          onChange={setSelectedType}
          options={typeFilterOptions}
        />
        <SelectFilter
          label={t('admin.chartOfAccounts.gifiAll')}
          value={gifiFilter}
          onChange={setGifiFilter}
          options={gifiFilterOptions}
        />
      </FilterBar>

      {/* Accounts Table */}
      <SectionCard title={t('admin.chartOfAccounts.title')} theme={theme} noPadding>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.chartOfAccounts.code')}</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.chartOfAccounts.accountName')}</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.chartOfAccounts.type')}</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.chartOfAccounts.gifi')}</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.chartOfAccounts.category')}</th>
              <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.chartOfAccounts.balance')}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.chartOfAccounts.statusCol')}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.chartOfAccounts.actionsCol')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {parentAccounts.map((account) => {
              const children = getChildren(account.id);
              const hasChildren = children.length > 0;
              const isExpanded = expandedCategories.has(account.code);

              return (
                <>{/* Fragment key on first tr */}
                  <tr key={account.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {hasChildren && (
                          <button
                            onClick={() => toggleCategory(account.code)}
                            className="p-0.5 hover:bg-slate-200 rounded"
                            aria-label={isExpanded ? 'Reduire' : 'Developper'}
                          >
                            <ChevronRight
                              className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            />
                          </button>
                        )}
                        <span className="font-mono font-medium text-slate-900">{account.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{account.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[account.type]}`}>
                        {accountTypes[account.type].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">{renderGifiCell(account)}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{account.category}</td>
                    <td className="px-4 py-3 text-end">
                      <span className={`font-medium ${account.balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                        {formatCurrency(account.balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge variant={account.isActive ? 'success' : 'neutral'}>
                        {account.isActive ? t('admin.chartOfAccounts.active') : t('admin.chartOfAccounts.inactive')}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openModal(account)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title={t('admin.chartOfAccounts.edit')}
                          aria-label={t('admin.chartOfAccounts.edit')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title={t('admin.chartOfAccounts.viewTransactions')}
                          aria-label={t('admin.chartOfAccounts.viewTransactions')}
                        >
                          <ClipboardList className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Child accounts */}
                  {isExpanded && children.map((child) => (
                    <tr key={child.id} className="bg-slate-50/50 hover:bg-slate-100">
                      <td className="px-4 py-2 ps-12">
                        <span className="font-mono text-sm text-slate-600">{child.code}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-sm text-slate-700">{child.name}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[child.type]}`}>
                          {accountTypes[child.type].label}
                        </span>
                      </td>
                      <td className="px-4 py-2">{renderGifiCell(child)}</td>
                      <td className="px-4 py-2 text-slate-500 text-sm">{child.category}</td>
                      <td className="px-4 py-2 text-end">
                        <span className={`text-sm ${child.balance >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                          {formatCurrency(child.balance)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <StatusBadge variant={child.isActive ? 'success' : 'neutral'}>
                          {child.isActive ? t('admin.chartOfAccounts.active') : t('admin.chartOfAccounts.inactive')}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openModal(child)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
        </div>
      </SectionCard>

      {/* Account Modal (enhanced with GIFI/Fiscal section) */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAccount ? t('admin.chartOfAccounts.editAccount') : t('admin.chartOfAccounts.newAccount')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              {t('admin.chartOfAccounts.cancel')}
            </Button>
            <Button
              onClick={handleSaveAccount}
              className={`${theme.btnPrimary} border-transparent text-white shadow-sm`}
            >
              {editingAccount ? t('admin.chartOfAccounts.updateAccount') : t('admin.chartOfAccounts.createAccount')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* --- General Section --- */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.chartOfAccounts.code')}>
              <Input
                id="accountCode"
                type="text"
                value={modalCode}
                onChange={(e) => setModalCode(e.target.value)}
                placeholder="1000"
              />
            </FormField>
            <FormField label={t('admin.chartOfAccounts.type')}>
              <select
                id="accountType"
                value={modalType}
                onChange={(e) => setModalType(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white
                  focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
              >
                <option value="ASSET">{t('admin.chartOfAccounts.typeAsset')}</option>
                <option value="LIABILITY">{t('admin.chartOfAccounts.typeLiability')}</option>
                <option value="EQUITY">{t('admin.chartOfAccounts.typeEquity')}</option>
                <option value="REVENUE">{t('admin.chartOfAccounts.typeRevenue')}</option>
                <option value="EXPENSE">{t('admin.chartOfAccounts.typeExpense')}</option>
              </select>
            </FormField>
          </div>
          <FormField label={t('admin.chartOfAccounts.accountName')}>
            <Input
              id="accountName"
              type="text"
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              placeholder={t('admin.chartOfAccounts.placeholderAccountName')}
            />
          </FormField>
          <FormField label={t('admin.chartOfAccounts.category')}>
            <Input
              id="accountCategory"
              type="text"
              value={modalCategory}
              onChange={(e) => setModalCategory(e.target.value)}
              placeholder={t('admin.chartOfAccounts.currentAssets')}
            />
          </FormField>
          <FormField label={t('admin.chartOfAccounts.parentAccount')}>
            <select
              id="accountParent"
              value={modalParent}
              onChange={(e) => setModalParent(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white
                focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
            >
              <option value="">{t('admin.chartOfAccounts.noParent')}</option>
              {parentAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </FormField>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={modalActive}
              onChange={(e) => setModalActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700">{t('admin.chartOfAccounts.activeAccount')}</label>
          </div>

          {/* --- GIFI / Fiscal Section (only in edit mode) --- */}
          {editingAccount && (
            <>
              <div className="border-t border-slate-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-indigo-700 mb-3">
                  {t('admin.chartOfAccounts.gifiFiscalSection')}
                </h3>

                {/* GIFI Code + Suggest button */}
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormField label={t('admin.chartOfAccounts.gifiCode')}>
                        <Input
                          type="text"
                          value={modalGifiCode}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModalGifiCode(e.target.value)}
                          placeholder="8000"
                        />
                      </FormField>
                    </div>
                    <Button
                      variant="secondary"
                      icon={Sparkles}
                      onClick={handleSuggestGifi}
                      disabled={suggestingGifi}
                      className="shrink-0 mb-0.5"
                    >
                      {suggestingGifi ? '...' : t('admin.chartOfAccounts.suggestGifi')}
                    </Button>
                  </div>

                  {/* GIFI Suggestions dropdown */}
                  {gifiSuggestions.length > 0 && (
                    <div className="border border-indigo-200 rounded-lg overflow-hidden bg-white shadow-sm">
                      {gifiSuggestions.map((s) => (
                        <button
                          key={s.code}
                          onClick={() => selectGifiSuggestion(s)}
                          className="w-full px-3 py-2 text-start hover:bg-indigo-50 flex items-center justify-between border-b border-slate-100 last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-indigo-700">{s.code}</span>
                            <span className="text-sm text-slate-700">
                              {locale === 'fr' ? s.nameFr : s.nameEn}
                            </span>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            s.score >= 0.8 ? 'bg-emerald-100 text-emerald-700' :
                            s.score >= 0.5 ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {Math.round(s.score * 100)}%
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* GIFI Name */}
                  <FormField label={t('admin.chartOfAccounts.gifiName')}>
                    <Input
                      type="text"
                      value={modalGifiName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModalGifiName(e.target.value)}
                      placeholder={t('admin.chartOfAccounts.selectGifi')}
                    />
                  </FormField>

                  {/* CCA Class + Rate */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label={t('admin.chartOfAccounts.ccaClass')}>
                      <select
                        value={modalCcaClass}
                        onChange={(e) => handleCcaClassChange(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white
                          focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
                      >
                        <option value="">--</option>
                        {CCA_CLASSES.map((c) => (
                          <option key={c.classNumber} value={c.classNumber}>
                            {c.classNumber} - {locale === 'fr' ? c.descriptionFr : c.description} ({c.rate}%)
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label={t('admin.chartOfAccounts.ccaRate')}>
                      <Input
                        type="number"
                        value={modalCcaRate}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModalCcaRate(e.target.value)}
                        placeholder="0"
                      />
                    </FormField>
                  </div>

                  {/* Deductible % + Is Contra */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label={t('admin.chartOfAccounts.deductiblePercent')}>
                      <select
                        value={modalDeductiblePercent}
                        onChange={(e) => setModalDeductiblePercent(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white
                          focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
                      >
                        <option value="">--</option>
                        <option value="100">100%</option>
                        <option value="50">50%</option>
                        <option value="0">0%</option>
                      </select>
                    </FormField>
                    <div className="flex items-end pb-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isContra"
                          checked={modalIsContra}
                          onChange={(e) => setModalIsContra(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                        />
                        <label htmlFor="isContra" className="text-sm text-slate-700">
                          {t('admin.chartOfAccounts.isContraAccount')}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
