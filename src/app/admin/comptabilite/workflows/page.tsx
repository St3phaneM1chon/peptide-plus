'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Settings2,
  History,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Pencil,
  Zap,
  X,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  StatusBadge,
  StatCard,
  FilterBar,
  SelectFilter,
  DataTable,
  type Column,
  SectionCard,
  FormField,
  Input,
  Textarea,
  EmptyState,
  type BadgeVariant,
} from '@/components/admin';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalData {
  id: string;
  workflowRuleId: string | null;
  entityType: string;
  entityId: string;
  entitySummary: string | null;
  amount: number | null;
  status: string;
  requestedBy: string | null;
  requestedAt: string;
  assignedTo: string | null;
  assignedRole: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
  responseNote: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  workflowRule?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

interface WorkflowCondition {
  field: string;
  operator: string;
  value: string | number | boolean | string[];
}

interface WorkflowAction {
  type: string;
  params?: {
    role?: string;
    userId?: string;
    message?: string;
    expiresInDays?: number;
  };
}

interface WorkflowRuleData {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  triggerEvent: string;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  priority: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type TabType = 'approvals' | 'rules' | 'history';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_TYPE_OPTIONS = [
  'JOURNAL_ENTRY',
  'EXPENSE',
  'PURCHASE_ORDER',
  'INVOICE',
  'CREDIT_NOTE',
  'PAYROLL_RUN',
  'TIME_ENTRY',
];

const TRIGGER_EVENT_OPTIONS = ['CREATE', 'UPDATE', 'STATUS_CHANGE', 'AMOUNT_THRESHOLD'];

const ACTION_TYPE_OPTIONS = ['REQUIRE_APPROVAL', 'SEND_NOTIFICATION', 'AUTO_APPROVE', 'BLOCK'];

const OPERATOR_OPTIONS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(amount: number | null): string {
  if (amount == null) return '-';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'error';
    case 'EXPIRED':
      return 'neutral';
    case 'CANCELLED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function getEntityTypeLabel(t: (key: string) => string, entityType: string): string {
  const map: Record<string, string> = {
    JOURNAL_ENTRY: t('admin.workflows.journalEntry'),
    EXPENSE: t('admin.workflows.expense'),
    PURCHASE_ORDER: t('admin.workflows.purchaseOrder'),
    INVOICE: t('admin.workflows.invoice'),
    CREDIT_NOTE: t('admin.workflows.creditNote'),
    PAYROLL_RUN: t('admin.workflows.payrollRun'),
    TIME_ENTRY: t('admin.workflows.timeEntry'),
  };
  return map[entityType] || entityType;
}

function getTriggerLabel(t: (key: string) => string, trigger: string): string {
  const map: Record<string, string> = {
    CREATE: t('admin.workflows.triggerCreate'),
    UPDATE: t('admin.workflows.triggerUpdate'),
    STATUS_CHANGE: t('admin.workflows.triggerStatusChange'),
    AMOUNT_THRESHOLD: t('admin.workflows.triggerAmountThreshold'),
  };
  return map[trigger] || trigger;
}

function getActionLabel(t: (key: string) => string, action: string): string {
  const map: Record<string, string> = {
    REQUIRE_APPROVAL: t('admin.workflows.actionRequireApproval'),
    SEND_NOTIFICATION: t('admin.workflows.actionSendNotification'),
    AUTO_APPROVE: t('admin.workflows.actionAutoApprove'),
    BLOCK: t('admin.workflows.actionBlock'),
  };
  return map[action] || action;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkflowsPage() {
  const { t } = useI18n();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('approvals');

  // Approvals state
  const [approvals, setApprovals] = useState<ApprovalData[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('PENDING');
  const [approvalEntityFilter, setApprovalEntityFilter] = useState('');

  // History state
  const [history, setHistory] = useState<ApprovalData[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Rules state
  const [rules, setRules] = useState<WorkflowRuleData[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);

  // Modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalData | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalNote, setApprovalNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Rule modal state
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRuleData | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    entityType: 'EXPENSE',
    triggerEvent: 'AMOUNT_THRESHOLD',
    conditions: [{ field: 'amount', operator: 'gt', value: '' }] as { field: string; operator: string; value: string }[],
    actions: [{ type: 'REQUIRE_APPROVAL', role: 'OWNER', expiresInDays: '7' }] as { type: string; role: string; expiresInDays: string }[],
    priority: '0',
    isActive: true,
  });
  const [ruleSaving, setRuleSaving] = useState(false);

  // Confirm dialog
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      const params = new URLSearchParams();
      if (approvalStatusFilter) params.set('status', approvalStatusFilter);
      if (approvalEntityFilter) params.set('entityType', approvalEntityFilter);
      params.set('limit', '50');

      const res = await fetch(`/api/accounting/approvals?${params}`);
      const json = await res.json();
      if (json.success !== false) {
        setApprovals(json.data || []);
      }
    } catch {
      toast.error(t('admin.workflows.loadError'));
    } finally {
      setApprovalsLoading(false);
    }
  }, [approvalStatusFilter, approvalEntityFilter, t]);

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/approvals/pending');
      const json = await res.json();
      if (json.data) {
        setPendingCount(json.data.count || 0);
      }
    } catch {
      // Silent fail
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      // History = everything except PENDING
      params.set('limit', '100');
      const res = await fetch(`/api/accounting/approvals?${params}`);
      const json = await res.json();
      if (json.success !== false) {
        const all = (json.data || []) as ApprovalData[];
        setHistory(all.filter((a) => a.status !== 'PENDING'));
      }
    } catch {
      toast.error(t('admin.workflows.loadError'));
    } finally {
      setHistoryLoading(false);
    }
  }, [t]);

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await fetch('/api/accounting/workflows?limit=100');
      const json = await res.json();
      if (json.success !== false) {
        setRules(json.data || []);
      }
    } catch {
      toast.error(t('admin.workflows.loadError'));
    } finally {
      setRulesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchApprovals();
    } else if (activeTab === 'rules') {
      fetchRules();
    } else if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchApprovals, fetchRules, fetchHistory]);

  // -------------------------------------------------------------------------
  // Approval actions
  // -------------------------------------------------------------------------

  const handleApprovalAction = async () => {
    if (!selectedApproval) return;
    if (approvalAction === 'reject' && !approvalNote.trim()) {
      toast.error(t('admin.workflows.rejectNote'));
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/accounting/approvals/${selectedApproval.id}`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: approvalAction,
          note: approvalNote || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        toast.success(
          approvalAction === 'approve'
            ? t('admin.workflows.approveSuccess')
            : t('admin.workflows.rejectSuccess'),
        );
        setShowApprovalModal(false);
        setSelectedApproval(null);
        setApprovalNote('');
        fetchApprovals();
        fetchPendingCount();
      } else {
        toast.error(json.error?.message || t('admin.workflows.approveError'));
      }
    } catch {
      toast.error(
        approvalAction === 'approve'
          ? t('admin.workflows.approveError')
          : t('admin.workflows.rejectError'),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const openApprovalModal = (approval: ApprovalData, action: 'approve' | 'reject') => {
    setSelectedApproval(approval);
    setApprovalAction(action);
    setApprovalNote('');
    setShowApprovalModal(true);
  };

  // -------------------------------------------------------------------------
  // Rule CRUD
  // -------------------------------------------------------------------------

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm({
      name: '',
      description: '',
      entityType: 'EXPENSE',
      triggerEvent: 'AMOUNT_THRESHOLD',
      conditions: [{ field: 'amount', operator: 'gt', value: '' }],
      actions: [{ type: 'REQUIRE_APPROVAL', role: 'OWNER', expiresInDays: '7' }],
      priority: '0',
      isActive: true,
    });
    setShowRuleModal(true);
  };

  const openEditRule = (rule: WorkflowRuleData) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      description: rule.description || '',
      entityType: rule.entityType,
      triggerEvent: rule.triggerEvent,
      conditions: rule.conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: String(c.value),
      })),
      actions: rule.actions.map((a) => ({
        type: a.type,
        role: a.params?.role || 'OWNER',
        expiresInDays: String(a.params?.expiresInDays ?? 7),
      })),
      priority: String(rule.priority),
      isActive: rule.isActive,
    });
    setShowRuleModal(true);
  };

  const saveRule = async () => {
    if (!ruleForm.name.trim()) {
      toast.error(t('admin.workflows.ruleName'));
      return;
    }

    setRuleSaving(true);
    try {
      const payload = {
        name: ruleForm.name,
        description: ruleForm.description || undefined,
        entityType: ruleForm.entityType,
        triggerEvent: ruleForm.triggerEvent,
        conditions: ruleForm.conditions
          .filter((c) => c.field && c.value !== '')
          .map((c) => ({
            field: c.field,
            operator: c.operator,
            value: isNaN(Number(c.value)) ? c.value : Number(c.value),
          })),
        actions: ruleForm.actions.map((a) => ({
          type: a.type,
          params: {
            role: a.role || 'OWNER',
            expiresInDays: parseInt(a.expiresInDays) || 7,
          },
        })),
        priority: parseInt(ruleForm.priority) || 0,
        isActive: ruleForm.isActive,
      };

      const url = editingRule
        ? `/api/accounting/workflows/${editingRule.id}`
        : '/api/accounting/workflows';

      const res = await fetch(url, {
        method: editingRule ? 'PUT' : 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok) {
        toast.success(t('admin.workflows.saveSuccess'));
        setShowRuleModal(false);
        fetchRules();
      } else {
        toast.error(json.error?.message || t('admin.workflows.saveError'));
      }
    } catch {
      toast.error(t('admin.workflows.saveError'));
    } finally {
      setRuleSaving(false);
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const res = await fetch(`/api/accounting/workflows/${id}`, {
        method: 'DELETE',
        headers: addCSRFHeader({}),
      });
      if (res.ok || res.status === 204) {
        toast.success(t('admin.workflows.deleteSuccess'));
        fetchRules();
      } else {
        toast.error(t('admin.workflows.deleteError'));
      }
    } catch {
      toast.error(t('admin.workflows.deleteError'));
    }
    setConfirmDelete(null);
  };

  const seedDefaults = async () => {
    try {
      const res = await fetch('/api/accounting/workflows?seedDefaults=true');
      if (res.ok) {
        toast.success(t('admin.workflows.seedSuccess'));
        fetchRules();
      }
    } catch {
      toast.error(t('admin.workflows.loadError'));
    }
  };

  // -------------------------------------------------------------------------
  // Table columns
  // -------------------------------------------------------------------------

  const approvalColumns: Column<ApprovalData>[] = [
    {
      key: 'entitySummary',
      header: t('admin.workflows.entitySummary'),
      render: (row) => (
        <div>
          <div className="font-medium text-sm">{row.entitySummary || row.entityId}</div>
          <div className="text-xs text-slate-500">
            {getEntityTypeLabel(t, row.entityType)}
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: t('admin.workflows.amount'),
      render: (row) => (
        <span className="font-mono text-sm">{formatAmount(row.amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge variant={getStatusVariant(row.status)}>{row.status}</StatusBadge>,
    },
    {
      key: 'requestedBy',
      header: t('admin.workflows.requestedBy'),
      render: (row) => <span className="text-sm">{row.requestedBy || '-'}</span>,
    },
    {
      key: 'requestedAt',
      header: t('admin.workflows.requestedAt'),
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.requestedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'PENDING' ? (
          <div className="flex gap-2">
            <button
              onClick={() => openApprovalModal(row, 'approve')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {t('admin.workflows.approve')}
            </button>
            <button
              onClick={() => openApprovalModal(row, 'reject')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              {t('admin.workflows.reject')}
            </button>
          </div>
        ) : null,
    },
  ];

  const ruleColumns: Column<WorkflowRuleData>[] = [
    {
      key: 'name',
      header: t('admin.workflows.ruleName'),
      render: (row) => (
        <div>
          <div className="font-medium text-sm">{row.name}</div>
          {row.description && (
            <div className="text-xs text-slate-500 mt-0.5">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'entityType',
      header: t('admin.workflows.ruleEntityType'),
      render: (row) => (
        <span className="text-sm">{getEntityTypeLabel(t, row.entityType)}</span>
      ),
    },
    {
      key: 'triggerEvent',
      header: t('admin.workflows.ruleTrigger'),
      render: (row) => (
        <span className="text-sm">{getTriggerLabel(t, row.triggerEvent)}</span>
      ),
    },
    {
      key: 'actions',
      header: t('admin.workflows.ruleActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.actions.map((a, i) => (
            <span
              key={i}
              className="inline-block px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700"
            >
              {getActionLabel(t, a.type)}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'priority',
      header: t('admin.workflows.rulePriority'),
      render: (row) => <span className="text-sm font-mono">{row.priority}</span>,
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <StatusBadge variant={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? t('admin.workflows.ruleActive') : t('admin.workflows.ruleInactive')}
        </StatusBadge>
      ),
    },
    {
      key: 'edit',
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEditRule(row)}
            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
            title={t('admin.workflows.editRule')}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setConfirmDelete(row.id)}
            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
            title={t('admin.workflows.deleteRule')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const historyColumns: Column<ApprovalData>[] = [
    {
      key: 'entitySummary',
      header: t('admin.workflows.entitySummary'),
      render: (row) => (
        <div>
          <div className="font-medium text-sm">{row.entitySummary || row.entityId}</div>
          <div className="text-xs text-slate-500">{getEntityTypeLabel(t, row.entityType)}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: t('admin.workflows.amount'),
      render: (row) => (
        <span className="font-mono text-sm">{formatAmount(row.amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge variant={getStatusVariant(row.status)}>{row.status}</StatusBadge>,
    },
    {
      key: 'respondedBy',
      header: t('admin.workflows.respondedBy'),
      render: (row) => <span className="text-sm">{row.respondedBy || '-'}</span>,
    },
    {
      key: 'respondedAt',
      header: t('admin.workflows.respondedAt'),
      render: (row) => (
        <span className="text-xs text-slate-500">{formatDate(row.respondedAt)}</span>
      ),
    },
    {
      key: 'responseNote',
      header: t('admin.workflows.responseNote'),
      render: (row) => (
        <span className="text-xs text-slate-500 max-w-[200px] truncate block">
          {row.responseNote || '-'}
        </span>
      ),
    },
  ];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('admin.workflows.title')}
        subtitle={t('admin.workflows.subtitle')}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={t('admin.workflows.pendingApprovals')}
          value={pendingCount}
          icon={Clock}
        />
        <StatCard
          label={t('admin.workflows.tabRules')}
          value={rules.length}
          icon={Settings2}
        />
        <StatCard
          label={t('admin.workflows.tabHistory')}
          value={history.length}
          icon={History}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {(
          [
            { id: 'approvals', label: t('admin.workflows.tabApprovals'), icon: ShieldCheck, badge: pendingCount },
            { id: 'rules', label: t('admin.workflows.tabRules'), icon: Settings2 },
            { id: 'history', label: t('admin.workflows.tabHistory'), icon: History },
          ] as { id: TabType; label: string; icon: typeof ShieldCheck; badge?: number }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-amber-500 rounded-full min-w-[20px]">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'approvals' && (
        <SectionCard>
          <div className="space-y-4">
            <FilterBar>
              <SelectFilter
                label={t('admin.workflows.allStatuses')}
                value={approvalStatusFilter}
                onChange={setApprovalStatusFilter}
                options={[
                  { value: 'PENDING', label: t('admin.workflows.pending') },
                  { value: 'APPROVED', label: t('admin.workflows.approved') },
                  { value: 'REJECTED', label: t('admin.workflows.rejected') },
                  { value: 'EXPIRED', label: t('admin.workflows.expired') },
                ]}
              />
              <SelectFilter
                label={t('admin.workflows.allEntityTypes')}
                value={approvalEntityFilter}
                onChange={setApprovalEntityFilter}
                options={ENTITY_TYPE_OPTIONS.map((et) => ({
                  value: et,
                  label: getEntityTypeLabel(t, et),
                }))}
              />
            </FilterBar>

            {approvalsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : approvals.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title={t('admin.workflows.noPending')}
                description={t('admin.workflows.noPendingDesc')}
              />
            ) : (
              <DataTable columns={approvalColumns} data={approvals} keyExtractor={(r) => r.id} />
            )}
          </div>
        </SectionCard>
      )}

      {activeTab === 'rules' && (
        <SectionCard>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={seedDefaults}>
                  <Zap className="w-4 h-4 mr-1" />
                  {t('admin.workflows.seedDefaults')}
                </Button>
                <Button onClick={openCreateRule}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t('admin.workflows.createRule')}
                </Button>
              </div>
            </div>

            {rulesLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : rules.length === 0 ? (
              <EmptyState
                icon={Settings2}
                title={t('admin.workflows.noRules')}
                description={t('admin.workflows.noRulesDesc')}
              />
            ) : (
              <DataTable columns={ruleColumns} data={rules} keyExtractor={(r) => r.id} />
            )}
          </div>
        </SectionCard>
      )}

      {activeTab === 'history' && (
        <SectionCard>
          {historyLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={History}
              title={t('admin.workflows.noHistory')}
              description={t('admin.workflows.noHistoryDesc')}
            />
          ) : (
            <DataTable columns={historyColumns} data={history} keyExtractor={(r) => r.id} />
          )}
        </SectionCard>
      )}

      {/* Approval Action Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title={
          approvalAction === 'approve'
            ? t('admin.workflows.approve')
            : t('admin.workflows.reject')
        }
      >
        <div className="space-y-4">
          {selectedApproval && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">{t('admin.workflows.entitySummary')}</span>
                <span className="text-sm font-medium">
                  {selectedApproval.entitySummary || selectedApproval.entityId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">{t('admin.workflows.entityType')}</span>
                <span className="text-sm">
                  {getEntityTypeLabel(t, selectedApproval.entityType)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">{t('admin.workflows.amount')}</span>
                <span className="text-sm font-mono font-medium">
                  {formatAmount(selectedApproval.amount)}
                </span>
              </div>
            </div>
          )}

          {approvalAction === 'approve' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-800">{t('admin.workflows.approveConfirm')}</p>
            </div>
          )}

          {approvalAction === 'reject' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{t('admin.workflows.rejectConfirm')}</p>
            </div>
          )}

          <FormField
            label={
              approvalAction === 'reject'
                ? t('admin.workflows.rejectNote')
                : t('admin.workflows.approvalNote')
            }
          >
            <Textarea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder={
                approvalAction === 'reject'
                  ? t('admin.workflows.rejectNotePlaceholder')
                  : t('admin.workflows.approvalNotePlaceholder')
              }
              rows={3}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowApprovalModal(false)}>
              {t('admin.workflows.cancel')}
            </Button>
            <Button
              onClick={handleApprovalAction}
              disabled={actionLoading || (approvalAction === 'reject' && !approvalNote.trim())}
              className={
                approvalAction === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }
            >
              {actionLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : approvalAction === 'approve' ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {t('admin.workflows.approve')}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-1" />
                  {t('admin.workflows.reject')}
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rule Create/Edit Modal */}
      <Modal
        isOpen={showRuleModal}
        onClose={() => setShowRuleModal(false)}
        title={editingRule ? t('admin.workflows.editRule') : t('admin.workflows.createRule')}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <FormField label={t('admin.workflows.ruleName')}>
            <Input
              value={ruleForm.name}
              onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
              placeholder={t('admin.workflows.ruleName')}
            />
          </FormField>

          <FormField label={t('admin.workflows.ruleDescription')}>
            <Textarea
              value={ruleForm.description}
              onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
              rows={2}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.workflows.ruleEntityType')}>
              <select
                value={ruleForm.entityType}
                onChange={(e) => setRuleForm({ ...ruleForm, entityType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                {ENTITY_TYPE_OPTIONS.map((et) => (
                  <option key={et} value={et}>
                    {getEntityTypeLabel(t, et)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={t('admin.workflows.ruleTrigger')}>
              <select
                value={ruleForm.triggerEvent}
                onChange={(e) => setRuleForm({ ...ruleForm, triggerEvent: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                {TRIGGER_EVENT_OPTIONS.map((te) => (
                  <option key={te} value={te}>
                    {getTriggerLabel(t, te)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.workflows.rulePriority')}>
              <Input
                type="number"
                value={ruleForm.priority}
                onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })}
                min="0"
                max="1000"
              />
            </FormField>

            <FormField label="Status">
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={ruleForm.isActive}
                  onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">{t('admin.workflows.ruleActive')}</span>
              </label>
            </FormField>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                {t('admin.workflows.ruleConditions')}
              </label>
              <button
                type="button"
                onClick={() =>
                  setRuleForm({
                    ...ruleForm,
                    conditions: [
                      ...ruleForm.conditions,
                      { field: 'amount', operator: 'gt', value: '' },
                    ],
                  })
                }
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                + {t('admin.workflows.addCondition')}
              </button>
            </div>
            {ruleForm.conditions.map((cond, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={cond.field}
                  onChange={(e) => {
                    const newConds = [...ruleForm.conditions];
                    newConds[i] = { ...newConds[i], field: e.target.value };
                    setRuleForm({ ...ruleForm, conditions: newConds });
                  }}
                  placeholder={t('admin.workflows.conditionField')}
                  className="flex-1"
                />
                <select
                  value={cond.operator}
                  onChange={(e) => {
                    const newConds = [...ruleForm.conditions];
                    newConds[i] = { ...newConds[i], operator: e.target.value };
                    setRuleForm({ ...ruleForm, conditions: newConds });
                  }}
                  className="px-2 py-2 border border-slate-300 rounded-md text-sm"
                >
                  {OPERATOR_OPTIONS.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
                <Input
                  value={cond.value}
                  onChange={(e) => {
                    const newConds = [...ruleForm.conditions];
                    newConds[i] = { ...newConds[i], value: e.target.value };
                    setRuleForm({ ...ruleForm, conditions: newConds });
                  }}
                  placeholder={t('admin.workflows.conditionValue')}
                  className="flex-1"
                />
                {ruleForm.conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newConds = ruleForm.conditions.filter((_, idx) => idx !== i);
                      setRuleForm({ ...ruleForm, conditions: newConds });
                    }}
                    className="p-1 text-red-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              {t('admin.workflows.ruleActions')}
            </label>
            {ruleForm.actions.map((action, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={action.type}
                  onChange={(e) => {
                    const newActions = [...ruleForm.actions];
                    newActions[i] = { ...newActions[i], type: e.target.value };
                    setRuleForm({ ...ruleForm, actions: newActions });
                  }}
                  className="px-2 py-2 border border-slate-300 rounded-md text-sm flex-1"
                >
                  {ACTION_TYPE_OPTIONS.map((at) => (
                    <option key={at} value={at}>{getActionLabel(t, at)}</option>
                  ))}
                </select>
                <Input
                  value={action.role}
                  onChange={(e) => {
                    const newActions = [...ruleForm.actions];
                    newActions[i] = { ...newActions[i], role: e.target.value };
                    setRuleForm({ ...ruleForm, actions: newActions });
                  }}
                  placeholder="Role (OWNER)"
                  className="w-28"
                />
                <Input
                  type="number"
                  value={action.expiresInDays}
                  onChange={(e) => {
                    const newActions = [...ruleForm.actions];
                    newActions[i] = { ...newActions[i], expiresInDays: e.target.value };
                    setRuleForm({ ...ruleForm, actions: newActions });
                  }}
                  placeholder="Days"
                  className="w-20"
                  min="1"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowRuleModal(false)}>
              {t('admin.workflows.cancel')}
            </Button>
            <Button onClick={saveRule} disabled={ruleSaving}>
              {ruleSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                t('admin.workflows.save')
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteRule(confirmDelete)}
        title={t('admin.workflows.deleteRule')}
        message={t('admin.workflows.deleteRuleConfirm')}
        variant="danger"
      />
    </div>
  );
}
