'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Star,
  ArrowLeftRight,
  FileBarChart,
  GitBranch,
  BarChart3,
  Clock,
  Ban,
  ChevronRight,
  RefreshCw,
  Zap,
  Link2,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  StatusBadge,
  StatCard,
  DataTable,
  FormField,
  Input,
  type Column,
  type BadgeVariant,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { sectionThemes } from '@/lib/admin/section-themes';
import { addCSRFHeader } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LegalEntity {
  id: string;
  name: string;
  code: string;
  legalName: string | null;
  taxNumber: string | null;
  gstNumber: string | null;
  qstNumber: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  currency: string;
  fiscalYearStart: number;
  parentEntityId: string | null;
  isActive: boolean;
  isDefault: boolean;
  parentEntity: { id: string; name: string; code: string } | null;
  childEntities: Array<{ id: string; name: string; code: string; isActive: boolean }>;
  _count: { intercoTransactions: number; intercoReceived: number };
}

interface IntercoTransaction {
  id: string;
  transactionNumber: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  journalEntryRef: string | null;
  matchingRef: string | null;
  eliminatedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  fromEntity: { id: string; name: string; code: string };
  toEntity: { id: string; name: string; code: string };
}

interface ConsolidatedReport {
  startDate: string;
  endDate: string;
  entityIds: string[];
  entityNames: string[];
  incomeStatement: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingIncome: number;
    otherIncomeExpense: number;
    netIncome: number;
  };
  balanceSheet: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
  eliminations: {
    totalEliminated: number;
    transactionCount: number;
    details: Array<{
      id: string;
      fromEntity: string;
      toEntity: string;
      type: string;
      amount: number;
      description: string;
    }>;
  };
}

interface EntityComparison {
  startDate: string;
  endDate: string;
  entities: Array<{
    entityId: string;
    entityName: string;
    entityCode: string;
    revenue: number;
    expenses: number;
    netIncome: number;
    totalAssets: number;
    totalLiabilities: number;
    grossMargin: number;
    netMargin: number;
  }>;
}

interface IntercoBalance {
  fromEntityId: string;
  fromEntityName: string;
  fromEntityCode: string;
  toEntityId: string;
  toEntityName: string;
  toEntityCode: string;
  pendingAmount: number;
  postedAmount: number;
  eliminatedAmount: number;
  netBalance: number;
  transactionCount: number;
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'entities' | 'interco' | 'consolidation' | 'comparison';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MultiEntityPage() {
  const { t, formatCurrency } = useI18n();

  const [activeTab, setActiveTab] = useState<TabId>('entities');

  // Entity state
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<LegalEntity | null>(null);
  const [entityForm, setEntityForm] = useState({
    name: '',
    code: '',
    legalName: '',
    taxNumber: '',
    gstNumber: '',
    qstNumber: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'CA',
    currency: 'CAD',
    fiscalYearStart: 1,
    parentEntityId: '',
    isActive: true,
  });

  // Interco state
  const [intercoTransactions, setIntercoTransactions] = useState<IntercoTransaction[]>([]);
  const [intercoBalances, setIntercoBalances] = useState<IntercoBalance[]>([]);
  const [loadingInterco, setLoadingInterco] = useState(false);
  const [showIntercoModal, setShowIntercoModal] = useState(false);
  const [intercoForm, setIntercoForm] = useState({
    fromEntityId: '',
    toEntityId: '',
    type: 'SALE' as string,
    amount: '',
    description: '',
  });
  const [intercoPage, setIntercoPage] = useState(1);
  const [intercoTotal, setIntercoTotal] = useState(0);

  // Consolidation state
  const [consolidatedReport, setConsolidatedReport] = useState<ConsolidatedReport | null>(null);
  const [loadingConsolidation, setLoadingConsolidation] = useState(false);
  const [consolStartDate, setConsolStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().split('T')[0];
  });
  const [consolEndDate, setConsolEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Comparison state
  const [comparison, setComparison] = useState<EntityComparison | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [compStartDate, setCompStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().split('T')[0];
  });
  const [compEndDate, setCompEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // ------ Fetch entities ------
  const fetchEntities = useCallback(async () => {
    setLoadingEntities(true);
    try {
      const res = await fetchWithRetry('/api/accounting/entities?includeInactive=true');
      if (res.ok) {
        const json = await res.json();
        setEntities(json.data || []);
      }
    } catch (e) {
      toast.error(t('admin.multiEntity.fetchError'));
    } finally {
      setLoadingEntities(false);
    }
  }, [t]);

  // ------ Fetch interco ------
  const fetchInterco = useCallback(async () => {
    setLoadingInterco(true);
    try {
      const [txnRes, balRes] = await Promise.all([
        fetchWithRetry(`/api/accounting/interco?page=${intercoPage}&limit=50`),
        fetchWithRetry('/api/accounting/interco?view=balances'),
      ]);
      if (txnRes.ok) {
        const json = await txnRes.json();
        setIntercoTransactions(json.data || []);
        setIntercoTotal(json.pagination?.totalCount || 0);
      }
      if (balRes.ok) {
        const json = await balRes.json();
        setIntercoBalances(json.data || []);
      }
    } catch {
      toast.error(t('admin.multiEntity.fetchError'));
    } finally {
      setLoadingInterco(false);
    }
  }, [intercoPage, t]);

  // ------ Fetch consolidated ------
  const fetchConsolidation = useCallback(async () => {
    setLoadingConsolidation(true);
    try {
      const res = await fetchWithRetry(
        `/api/accounting/consolidation?startDate=${consolStartDate}&endDate=${consolEndDate}`,
      );
      if (res.ok) {
        const json = await res.json();
        setConsolidatedReport(json.data);
      }
    } catch {
      toast.error(t('admin.multiEntity.fetchError'));
    } finally {
      setLoadingConsolidation(false);
    }
  }, [consolStartDate, consolEndDate, t]);

  // ------ Fetch comparison ------
  const fetchComparison = useCallback(async () => {
    if (selectedCompareIds.length < 2) return;
    setLoadingComparison(true);
    try {
      const ids = selectedCompareIds.join(',');
      const res = await fetchWithRetry(
        `/api/accounting/consolidation?startDate=${compStartDate}&endDate=${compEndDate}&entityIds=${ids}&view=comparison`,
      );
      if (res.ok) {
        const json = await res.json();
        setComparison(json.data);
      }
    } catch {
      toast.error(t('admin.multiEntity.fetchError'));
    } finally {
      setLoadingComparison(false);
    }
  }, [selectedCompareIds, compStartDate, compEndDate, t]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  useEffect(() => {
    if (activeTab === 'interco') fetchInterco();
  }, [activeTab, fetchInterco]);

  useEffect(() => {
    if (activeTab === 'consolidation') fetchConsolidation();
  }, [activeTab, fetchConsolidation]);

  // ------ Entity CRUD ------
  const openCreateEntity = () => {
    setEditingEntity(null);
    setEntityForm({
      name: '',
      code: '',
      legalName: '',
      taxNumber: '',
      gstNumber: '',
      qstNumber: '',
      address: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'CA',
      currency: 'CAD',
      fiscalYearStart: 1,
      parentEntityId: '',
      isActive: true,
    });
    setShowEntityModal(true);
  };

  const openEditEntity = (entity: LegalEntity) => {
    setEditingEntity(entity);
    setEntityForm({
      name: entity.name,
      code: entity.code,
      legalName: entity.legalName || '',
      taxNumber: entity.taxNumber || '',
      gstNumber: entity.gstNumber || '',
      qstNumber: entity.qstNumber || '',
      address: entity.address || '',
      city: entity.city || '',
      province: entity.province || '',
      postalCode: entity.postalCode || '',
      country: entity.country,
      currency: entity.currency,
      fiscalYearStart: entity.fiscalYearStart,
      parentEntityId: entity.parentEntityId || '',
      isActive: entity.isActive,
    });
    setShowEntityModal(true);
  };

  const saveEntity = async () => {
    try {
      const payload = {
        ...entityForm,
        parentEntityId: entityForm.parentEntityId || null,
        fiscalYearStart: Number(entityForm.fiscalYearStart),
      };

      let res: Response;
      if (editingEntity) {
        res = await fetch(`/api/accounting/entities/${editingEntity.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/accounting/entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (res.ok) {
        toast.success(
          editingEntity
            ? t('admin.multiEntity.entityUpdated')
            : t('admin.multiEntity.entityCreated'),
        );
        setShowEntityModal(false);
        fetchEntities();
      } else {
        toast.error(json.error || t('admin.multiEntity.saveError'));
      }
    } catch {
      toast.error(t('admin.multiEntity.saveError'));
    }
  };

  const deleteEntityHandler = async (id: string) => {
    if (!confirm(t('admin.multiEntity.confirmDelete'))) return;
    try {
      const res = await fetch(`/api/accounting/entities/${id}`, {
        method: 'DELETE',
        headers: addCSRFHeader(),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(t('admin.multiEntity.entityDeleted'));
        fetchEntities();
      } else {
        toast.error(json.error || t('admin.multiEntity.deleteError'));
      }
    } catch {
      toast.error(t('admin.multiEntity.deleteError'));
    }
  };

  const setDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/accounting/entities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({ setDefault: true }),
      });
      if (res.ok) {
        toast.success(t('admin.multiEntity.defaultSet'));
        fetchEntities();
      }
    } catch {
      toast.error(t('admin.multiEntity.saveError'));
    }
  };

  // ------ Interco CRUD ------
  const createInterco = async () => {
    try {
      const res = await fetch('/api/accounting/interco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({
          ...intercoForm,
          amount: parseFloat(intercoForm.amount),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(t('admin.multiEntity.intercoCreated'));
        setShowIntercoModal(false);
        fetchInterco();
      } else {
        toast.error(json.error || t('admin.multiEntity.saveError'));
      }
    } catch {
      toast.error(t('admin.multiEntity.saveError'));
    }
  };

  const autoMatch = async () => {
    try {
      const res = await fetch('/api/accounting/interco/match', {
        method: 'POST',
        headers: addCSRFHeader(),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || t('admin.multiEntity.matchDone'));
        fetchInterco();
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error(t('admin.multiEntity.saveError'));
    }
  };

  const eliminate = async () => {
    try {
      const res = await fetch('/api/accounting/interco/eliminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({ startDate: consolStartDate, endDate: consolEndDate }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || t('admin.multiEntity.eliminationDone'));
        fetchInterco();
        if (activeTab === 'consolidation') fetchConsolidation();
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error(t('admin.multiEntity.saveError'));
    }
  };

  // ------ Status badge config ------
  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    PENDING: { label: t('admin.multiEntity.statusPending'), variant: 'warning' },
    POSTED: { label: t('admin.multiEntity.statusPosted'), variant: 'info' },
    ELIMINATED: { label: t('admin.multiEntity.statusEliminated'), variant: 'success' },
    CANCELLED: { label: t('admin.multiEntity.statusCancelled'), variant: 'error' },
  };

  const typeLabels: Record<string, string> = {
    SALE: t('admin.multiEntity.typeSale'),
    PURCHASE: t('admin.multiEntity.typePurchase'),
    LOAN: t('admin.multiEntity.typeLoan'),
    PAYMENT: t('admin.multiEntity.typePayment'),
    EXPENSE_ALLOCATION: t('admin.multiEntity.typeExpenseAlloc'),
    MANAGEMENT_FEE: t('admin.multiEntity.typeMgmtFee'),
  };

  // ------ Stats ------
  const activeEntities = entities.filter((e) => e.isActive).length;
  const totalInterco = intercoTotal;
  const pendingInterco = intercoTransactions.filter((t) => t.status === 'PENDING').length;

  // ------ Entity columns ------
  const entityColumns: Column<LegalEntity>[] = [
    {
      key: 'code',
      header: t('admin.multiEntity.code'),
      render: (e) => (
        <div className="flex items-center gap-2">
          {e.parentEntityId && <ChevronRight className="h-3 w-3 text-gray-400 ml-2" />}
          <span className="font-mono font-semibold text-sm">{e.code}</span>
          {e.isDefault && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
        </div>
      ),
    },
    {
      key: 'name',
      header: t('admin.multiEntity.entityName'),
      render: (e) => (
        <div>
          <div className="font-medium">{e.name}</div>
          {e.legalName && <div className="text-xs text-gray-500">{e.legalName}</div>}
        </div>
      ),
    },
    {
      key: 'country',
      header: t('admin.multiEntity.country'),
      render: (e) => `${e.country} / ${e.currency}`,
    },
    {
      key: 'isActive',
      header: t('admin.multiEntity.status'),
      render: (e) => (
        <StatusBadge variant={e.isActive ? 'success' : 'error'}>
          {e.isActive ? t('admin.multiEntity.active') : t('admin.multiEntity.inactive')}
        </StatusBadge>
      ),
    },
    {
      key: 'parentEntity',
      header: t('admin.multiEntity.parent'),
      render: (e) => e.parentEntity ? e.parentEntity.code : '-',
    },
    {
      key: 'id',
      header: t('admin.multiEntity.actions'),
      render: (e) => (
        <div className="flex items-center gap-1">
          {!e.isDefault && (
            <button
              onClick={() => setDefault(e.id)}
              className="p-1 hover:bg-amber-50 rounded text-amber-600"
              title={t('admin.multiEntity.setDefault')}
            >
              <Star className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => openEditEntity(e)}
            className="p-1 hover:bg-blue-50 rounded text-blue-600"
            title={t('admin.multiEntity.edit')}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => deleteEntityHandler(e.id)}
            className="p-1 hover:bg-red-50 rounded text-red-600"
            title={t('admin.multiEntity.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ------ Interco columns ------
  const intercoColumns: Column<IntercoTransaction>[] = [
    {
      key: 'transactionNumber',
      header: '#',
      render: (tx) => <span className="font-mono text-xs">{tx.transactionNumber}</span>,
    },
    {
      key: 'fromEntity',
      header: t('admin.multiEntity.from'),
      render: (tx) => tx.fromEntity.code,
    },
    {
      key: 'toEntity',
      header: t('admin.multiEntity.to'),
      render: (tx) => tx.toEntity.code,
    },
    {
      key: 'type',
      header: t('admin.multiEntity.type'),
      render: (tx) => typeLabels[tx.type] || tx.type,
    },
    {
      key: 'amount',
      header: t('admin.multiEntity.amount'),
      render: (tx) => (
        <span className="font-semibold">
          {formatCurrency(tx.amount, tx.currency)}
        </span>
      ),
    },
    {
      key: 'description',
      header: t('admin.multiEntity.description'),
      render: (tx) => (
        <span className="text-sm text-gray-600 max-w-[200px] truncate block">
          {tx.description}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('admin.multiEntity.status'),
      render: (tx) => {
        const cfg = statusConfig[tx.status] || { label: tx.status, variant: 'neutral' as BadgeVariant };
        return <StatusBadge variant={cfg.variant}>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'matchingRef',
      header: t('admin.multiEntity.matched'),
      render: (tx) =>
        tx.matchingRef ? (
          <Link2 className="h-4 w-4 text-green-500" />
        ) : (
          <span className="text-gray-300">-</span>
        ),
    },
    {
      key: 'createdAt',
      header: t('admin.multiEntity.date'),
      render: (tx) => new Date(tx.createdAt).toLocaleDateString(),
    },
  ];

  // ------ Tabs ------
  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    {
      id: 'entities',
      label: t('admin.multiEntity.tabEntities'),
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      id: 'interco',
      label: t('admin.multiEntity.tabInterco'),
      icon: <ArrowLeftRight className="h-4 w-4" />,
    },
    {
      id: 'consolidation',
      label: t('admin.multiEntity.tabConsolidation'),
      icon: <FileBarChart className="h-4 w-4" />,
    },
    {
      id: 'comparison',
      label: t('admin.multiEntity.tabComparison'),
      icon: <BarChart3 className="h-4 w-4" />,
    },
  ];

  const theme = sectionThemes.compliance;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.multiEntity.title')}
        subtitle={t('admin.multiEntity.subtitle')}
        theme={theme}
        actions={
          activeTab === 'entities' ? (
            <Button onClick={openCreateEntity} icon={<Plus className="h-4 w-4" />}>
              {t('admin.multiEntity.addEntity')}
            </Button>
          ) : activeTab === 'interco' ? (
            <div className="flex gap-2">
              <Button
                onClick={autoMatch}
                variant="secondary"
                icon={<Zap className="h-4 w-4" />}
              >
                {t('admin.multiEntity.autoMatch')}
              </Button>
              <Button
                onClick={() => {
                  setIntercoForm({
                    fromEntityId: entities[0]?.id || '',
                    toEntityId: entities[1]?.id || '',
                    type: 'SALE',
                    amount: '',
                    description: '',
                  });
                  setShowIntercoModal(true);
                }}
                icon={<Plus className="h-4 w-4" />}
              >
                {t('admin.multiEntity.addInterco')}
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={t('admin.multiEntity.activeEntities')}
          value={activeEntities}
          icon={Building2}
          theme={theme}
        />
        <StatCard
          label={t('admin.multiEntity.totalInterco')}
          value={totalInterco}
          icon={ArrowLeftRight}
          theme={theme}
        />
        <StatCard
          label={t('admin.multiEntity.pendingInterco')}
          value={pendingInterco}
          icon={Clock}
          theme={theme}
        />
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4 -mb-px" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: Entities                                                   */}
      {/* ================================================================= */}
      {activeTab === 'entities' && (
        <div>
          {loadingEntities ? (
            <div className="text-center py-12 text-gray-500">
              {t('admin.multiEntity.loading')}
            </div>
          ) : entities.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500">{t('admin.multiEntity.noEntities')}</p>
              <Button onClick={openCreateEntity} className="mt-4">
                {t('admin.multiEntity.addEntity')}
              </Button>
            </div>
          ) : (
            <DataTable
              columns={entityColumns}
              data={entities}
              keyExtractor={(e) => e.id}
            />
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: Intercompany Transactions                                  */}
      {/* ================================================================= */}
      {activeTab === 'interco' && (
        <div className="space-y-6">
          {/* Interco Balances Summary */}
          {intercoBalances.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                {t('admin.multiEntity.intercoBalances')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2">{t('admin.multiEntity.entityPair')}</th>
                      <th className="pb-2 text-right">{t('admin.multiEntity.pending')}</th>
                      <th className="pb-2 text-right">{t('admin.multiEntity.posted')}</th>
                      <th className="pb-2 text-right">{t('admin.multiEntity.eliminated')}</th>
                      <th className="pb-2 text-right font-semibold">{t('admin.multiEntity.netBalance')}</th>
                      <th className="pb-2 text-right">{t('admin.multiEntity.txnCount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intercoBalances.map((b, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2">
                          <span className="font-mono text-xs">
                            {b.fromEntityCode} &harr; {b.toEntityCode}
                          </span>
                        </td>
                        <td className="py-2 text-right text-amber-600">
                          {formatCurrency(b.pendingAmount)}
                        </td>
                        <td className="py-2 text-right text-blue-600">
                          {formatCurrency(b.postedAmount)}
                        </td>
                        <td className="py-2 text-right text-green-600">
                          {formatCurrency(b.eliminatedAmount)}
                        </td>
                        <td className="py-2 text-right font-semibold">
                          {formatCurrency(b.netBalance)}
                        </td>
                        <td className="py-2 text-right text-gray-500">{b.transactionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Elimination controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">{t('admin.multiEntity.period')}:</label>
                <input
                  type="date"
                  value={consolStartDate}
                  onChange={(e) => setConsolStartDate(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="date"
                  value={consolEndDate}
                  onChange={(e) => setConsolEndDate(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                />
              </div>
              <Button
                onClick={eliminate}
                variant="secondary"
                icon={<Ban className="h-4 w-4" />}
              >
                {t('admin.multiEntity.eliminatePosted')}
              </Button>
            </div>
          </div>

          {/* Transactions table */}
          {loadingInterco ? (
            <div className="text-center py-12 text-gray-500">{t('admin.multiEntity.loading')}</div>
          ) : intercoTransactions.length === 0 ? (
            <div className="text-center py-12">
              <ArrowLeftRight className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500">{t('admin.multiEntity.noInterco')}</p>
            </div>
          ) : (
            <>
              <DataTable
                columns={intercoColumns}
                data={intercoTransactions}
                keyExtractor={(tx) => tx.id}
              />
              {intercoTotal > 50 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="secondary"
                    disabled={intercoPage <= 1}
                    onClick={() => setIntercoPage((p) => Math.max(1, p - 1))}
                  >
                    {t('admin.multiEntity.prev')}
                  </Button>
                  <span className="px-4 py-2 text-sm text-gray-600">
                    {t('admin.multiEntity.pageOf')
                      .replace('{page}', String(intercoPage))
                      .replace('{total}', String(Math.ceil(intercoTotal / 50)))}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={intercoPage >= Math.ceil(intercoTotal / 50)}
                    onClick={() => setIntercoPage((p) => p + 1)}
                  >
                    {t('admin.multiEntity.next')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: Consolidation                                              */}
      {/* ================================================================= */}
      {activeTab === 'consolidation' && (
        <div className="space-y-6">
          {/* Date range picker */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border p-4 flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-600">{t('admin.multiEntity.period')}:</label>
            <input
              type="date"
              value={consolStartDate}
              onChange={(e) => setConsolStartDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={consolEndDate}
              onChange={(e) => setConsolEndDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <Button
              onClick={fetchConsolidation}
              variant="secondary"
              icon={<RefreshCw className="h-4 w-4" />}
            >
              {t('admin.multiEntity.refresh')}
            </Button>
          </div>

          {loadingConsolidation ? (
            <div className="text-center py-12 text-gray-500">{t('admin.multiEntity.loading')}</div>
          ) : consolidatedReport ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Income Statement */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileBarChart className="h-5 w-5 text-indigo-600" />
                  {t('admin.multiEntity.consolidatedPL')}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1">
                    <span>{t('admin.multiEntity.revenue')}</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(consolidatedReport.incomeStatement.revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-gray-600">
                    <span>{t('admin.multiEntity.cogs')}</span>
                    <span>({formatCurrency(consolidatedReport.incomeStatement.cogs)})</span>
                  </div>
                  <div className="flex justify-between py-1 border-t font-medium">
                    <span>{t('admin.multiEntity.grossProfit')}</span>
                    <span>{formatCurrency(consolidatedReport.incomeStatement.grossProfit)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-gray-600">
                    <span>{t('admin.multiEntity.operatingExpenses')}</span>
                    <span>
                      ({formatCurrency(consolidatedReport.incomeStatement.operatingExpenses)})
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-t font-medium">
                    <span>{t('admin.multiEntity.operatingIncome')}</span>
                    <span>{formatCurrency(consolidatedReport.incomeStatement.operatingIncome)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-gray-600">
                    <span>{t('admin.multiEntity.otherIncomeExpense')}</span>
                    <span>
                      ({formatCurrency(consolidatedReport.incomeStatement.otherIncomeExpense)})
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-t-2 border-gray-900 dark:border-gray-100 text-base font-bold">
                    <span>{t('admin.multiEntity.netIncome')}</span>
                    <span
                      className={
                        consolidatedReport.incomeStatement.netIncome >= 0
                          ? 'text-green-700'
                          : 'text-red-700'
                      }
                    >
                      {formatCurrency(consolidatedReport.incomeStatement.netIncome)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance Sheet */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  {t('admin.multiEntity.consolidatedBS')}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 font-medium">
                    <span>{t('admin.multiEntity.totalAssets')}</span>
                    <span>{formatCurrency(consolidatedReport.balanceSheet.totalAssets)}</span>
                  </div>
                  <div className="flex justify-between py-1 font-medium">
                    <span>{t('admin.multiEntity.totalLiabilities')}</span>
                    <span>{formatCurrency(consolidatedReport.balanceSheet.totalLiabilities)}</span>
                  </div>
                  <div className="flex justify-between py-1 font-medium">
                    <span>{t('admin.multiEntity.totalEquity')}</span>
                    <span>{formatCurrency(consolidatedReport.balanceSheet.totalEquity)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-t-2 border-gray-900 dark:border-gray-100 text-base font-bold">
                    <span>{t('admin.multiEntity.liabAndEquity')}</span>
                    <span>
                      {formatCurrency(
                        consolidatedReport.balanceSheet.totalLiabilities +
                          consolidatedReport.balanceSheet.totalEquity,
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Eliminations */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg border p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Ban className="h-5 w-5 text-red-500" />
                  {t('admin.multiEntity.eliminations')} (
                  {consolidatedReport.eliminations.transactionCount})
                </h3>
                {consolidatedReport.eliminations.details.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {t('admin.multiEntity.noEliminations')}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2">{t('admin.multiEntity.from')}</th>
                          <th className="pb-2">{t('admin.multiEntity.to')}</th>
                          <th className="pb-2">{t('admin.multiEntity.type')}</th>
                          <th className="pb-2">{t('admin.multiEntity.description')}</th>
                          <th className="pb-2 text-right">{t('admin.multiEntity.amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consolidatedReport.eliminations.details.map((d) => (
                          <tr key={d.id} className="border-b border-gray-100">
                            <td className="py-1.5 font-mono text-xs">{d.fromEntity}</td>
                            <td className="py-1.5 font-mono text-xs">{d.toEntity}</td>
                            <td className="py-1.5">{typeLabels[d.type] || d.type}</td>
                            <td className="py-1.5 text-gray-600 max-w-[200px] truncate">
                              {d.description}
                            </td>
                            <td className="py-1.5 text-right text-red-600 font-medium">
                              ({formatCurrency(d.amount)})
                            </td>
                          </tr>
                        ))}
                        <tr className="font-bold">
                          <td colSpan={4} className="py-2">
                            {t('admin.multiEntity.totalEliminated')}
                          </td>
                          <td className="py-2 text-right text-red-700">
                            ({formatCurrency(consolidatedReport.eliminations.totalEliminated)})
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              {t('admin.multiEntity.noConsolidationData')}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 4: Comparison                                                 */}
      {/* ================================================================= */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          {/* Entity selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('admin.multiEntity.selectEntities')}
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {entities
                .filter((e) => e.isActive)
                .map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setSelectedCompareIds((prev) =>
                        prev.includes(e.id)
                          ? prev.filter((id) => id !== e.id)
                          : [...prev, e.id],
                      );
                    }}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      selectedCompareIds.includes(e.id)
                        ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {e.code} - {e.name}
                  </button>
                ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="date"
                value={compStartDate}
                onChange={(e) => setCompStartDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={compEndDate}
                onChange={(e) => setCompEndDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <Button
                onClick={fetchComparison}
                disabled={selectedCompareIds.length < 2}
                icon={<BarChart3 className="h-4 w-4" />}
              >
                {t('admin.multiEntity.compare')}
              </Button>
            </div>
          </div>

          {loadingComparison ? (
            <div className="text-center py-12 text-gray-500">{t('admin.multiEntity.loading')}</div>
          ) : comparison ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border p-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-3 font-semibold">{t('admin.multiEntity.metric')}</th>
                    {comparison.entities.map((e) => (
                      <th key={e.entityId} className="pb-3 text-right font-semibold">
                        {e.entityCode}
                        <span className="block text-xs font-normal text-gray-500">
                          {e.entityName}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2">{t('admin.multiEntity.revenue')}</td>
                    {comparison.entities.map((e) => (
                      <td key={e.entityId} className="py-2 text-right text-green-600 font-medium">
                        {formatCurrency(e.revenue)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">{t('admin.multiEntity.expenses')}</td>
                    {comparison.entities.map((e) => (
                      <td key={e.entityId} className="py-2 text-right text-red-600">
                        {formatCurrency(e.expenses)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b font-semibold">
                    <td className="py-2">{t('admin.multiEntity.netIncome')}</td>
                    {comparison.entities.map((e) => (
                      <td
                        key={e.entityId}
                        className={`py-2 text-right ${e.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}
                      >
                        {formatCurrency(e.netIncome)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">{t('admin.multiEntity.totalAssets')}</td>
                    {comparison.entities.map((e) => (
                      <td key={e.entityId} className="py-2 text-right">
                        {formatCurrency(e.totalAssets)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">{t('admin.multiEntity.totalLiabilities')}</td>
                    {comparison.entities.map((e) => (
                      <td key={e.entityId} className="py-2 text-right">
                        {formatCurrency(e.totalLiabilities)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">{t('admin.multiEntity.grossMargin')}</td>
                    {comparison.entities.map((e) => (
                      <td key={e.entityId} className="py-2 text-right">
                        {e.grossMargin.toFixed(1)}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2">{t('admin.multiEntity.netMargin')}</td>
                    {comparison.entities.map((e) => (
                      <td
                        key={e.entityId}
                        className={`py-2 text-right font-medium ${e.netMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {e.netMargin.toFixed(1)}%
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500">{t('admin.multiEntity.selectToCompare')}</p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* Entity Create/Edit Modal                                          */}
      {/* ================================================================= */}
      <Modal
        isOpen={showEntityModal}
        onClose={() => setShowEntityModal(false)}
        title={
          editingEntity
            ? t('admin.multiEntity.editEntity')
            : t('admin.multiEntity.createEntity')
        }
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.multiEntity.entityName')} required>
              <Input
                value={entityForm.name}
                onChange={(e) => setEntityForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="BioCycle Peptides Inc."
              />
            </FormField>
            <FormField label={t('admin.multiEntity.code')} required>
              <Input
                value={entityForm.code}
                onChange={(e) =>
                  setEntityForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                }
                placeholder="BCP-QC"
                disabled={!!editingEntity}
              />
            </FormField>
          </div>
          <FormField label={t('admin.multiEntity.legalName')}>
            <Input
              value={entityForm.legalName}
              onChange={(e) => setEntityForm((f) => ({ ...f, legalName: e.target.value }))}
              placeholder="9000-1234 Quebec Inc."
            />
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label={t('admin.multiEntity.taxNumber')}>
              <Input
                value={entityForm.taxNumber}
                onChange={(e) => setEntityForm((f) => ({ ...f, taxNumber: e.target.value }))}
                placeholder="BN/NEQ"
              />
            </FormField>
            <FormField label={t('admin.multiEntity.gstNumber')}>
              <Input
                value={entityForm.gstNumber}
                onChange={(e) => setEntityForm((f) => ({ ...f, gstNumber: e.target.value }))}
                placeholder="GST/TPS #"
              />
            </FormField>
            <FormField label={t('admin.multiEntity.qstNumber')}>
              <Input
                value={entityForm.qstNumber}
                onChange={(e) => setEntityForm((f) => ({ ...f, qstNumber: e.target.value }))}
                placeholder="QST/TVQ #"
              />
            </FormField>
          </div>
          <FormField label={t('admin.multiEntity.address')}>
            <Input
              value={entityForm.address}
              onChange={(e) => setEntityForm((f) => ({ ...f, address: e.target.value }))}
            />
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label={t('admin.multiEntity.city')}>
              <Input
                value={entityForm.city}
                onChange={(e) => setEntityForm((f) => ({ ...f, city: e.target.value }))}
              />
            </FormField>
            <FormField label={t('admin.multiEntity.province')}>
              <Input
                value={entityForm.province}
                onChange={(e) => setEntityForm((f) => ({ ...f, province: e.target.value }))}
              />
            </FormField>
            <FormField label={t('admin.multiEntity.postalCode')}>
              <Input
                value={entityForm.postalCode}
                onChange={(e) => setEntityForm((f) => ({ ...f, postalCode: e.target.value }))}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label={t('admin.multiEntity.country')}>
              <Input
                value={entityForm.country}
                onChange={(e) => setEntityForm((f) => ({ ...f, country: e.target.value }))}
              />
            </FormField>
            <FormField label={t('admin.multiEntity.currency')}>
              <Input
                value={entityForm.currency}
                onChange={(e) => setEntityForm((f) => ({ ...f, currency: e.target.value }))}
              />
            </FormField>
            <FormField label={t('admin.multiEntity.fiscalYearStart')}>
              <select
                value={entityForm.fiscalYearStart}
                onChange={(e) =>
                  setEntityForm((f) => ({
                    ...f,
                    fiscalYearStart: parseInt(e.target.value),
                  }))
                }
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2024, m - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label={t('admin.multiEntity.parent')}>
            <select
              value={entityForm.parentEntityId}
              onChange={(e) =>
                setEntityForm((f) => ({ ...f, parentEntityId: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">{t('admin.multiEntity.noParent')}</option>
              {entities
                .filter((e) => e.id !== editingEntity?.id)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.code} - {e.name}
                  </option>
                ))}
            </select>
          </FormField>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={entityForm.isActive}
              onChange={(e) => setEntityForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm">
              {t('admin.multiEntity.active')}
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowEntityModal(false)}>
              {t('admin.multiEntity.cancel')}
            </Button>
            <Button onClick={saveEntity}>
              {editingEntity
                ? t('admin.multiEntity.save')
                : t('admin.multiEntity.create')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================================================================= */}
      {/* Interco Create Modal                                              */}
      {/* ================================================================= */}
      <Modal
        isOpen={showIntercoModal}
        onClose={() => setShowIntercoModal(false)}
        title={t('admin.multiEntity.createInterco')}
        size="md"
      >
        <div className="space-y-4">
          <FormField label={t('admin.multiEntity.fromEntity')} required>
            <select
              value={intercoForm.fromEntityId}
              onChange={(e) =>
                setIntercoForm((f) => ({ ...f, fromEntityId: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">{t('admin.multiEntity.selectEntity')}</option>
              {entities
                .filter((e) => e.isActive)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.code} - {e.name}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label={t('admin.multiEntity.toEntity')} required>
            <select
              value={intercoForm.toEntityId}
              onChange={(e) =>
                setIntercoForm((f) => ({ ...f, toEntityId: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">{t('admin.multiEntity.selectEntity')}</option>
              {entities
                .filter((e) => e.isActive && e.id !== intercoForm.fromEntityId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.code} - {e.name}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label={t('admin.multiEntity.transactionType')} required>
            <select
              value={intercoForm.type}
              onChange={(e) => setIntercoForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="SALE">{t('admin.multiEntity.typeSale')}</option>
              <option value="PURCHASE">{t('admin.multiEntity.typePurchase')}</option>
              <option value="LOAN">{t('admin.multiEntity.typeLoan')}</option>
              <option value="PAYMENT">{t('admin.multiEntity.typePayment')}</option>
              <option value="EXPENSE_ALLOCATION">
                {t('admin.multiEntity.typeExpenseAlloc')}
              </option>
              <option value="MANAGEMENT_FEE">{t('admin.multiEntity.typeMgmtFee')}</option>
            </select>
          </FormField>
          <FormField label={t('admin.multiEntity.amount')} required>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={intercoForm.amount}
              onChange={(e) => setIntercoForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
            />
          </FormField>
          <FormField label={t('admin.multiEntity.description')} required>
            <Input
              value={intercoForm.description}
              onChange={(e) =>
                setIntercoForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder={t('admin.multiEntity.intercoDescPlaceholder')}
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowIntercoModal(false)}>
              {t('admin.multiEntity.cancel')}
            </Button>
            <Button
              onClick={createInterco}
              disabled={
                !intercoForm.fromEntityId ||
                !intercoForm.toEntityId ||
                !intercoForm.amount ||
                !intercoForm.description
              }
            >
              {t('admin.multiEntity.create')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
