'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Workflow,
  Plus,
  Play,
  Pause,
  Trash2,
  Settings,
  ChevronDown,
  ChevronRight,
  Zap,
  X,
  LayoutGrid,
  List,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { addCSRFHeader } from '@/lib/csrf';

const WorkflowBuilder = dynamic(
  () => import('@/components/crm/WorkflowBuilder'),
  { ssr: false, loading: () => <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" /></div> }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
type WorkflowTriggerType =
  | 'DEAL_STAGE_CHANGE'
  | 'LEAD_STATUS_CHANGE'
  | 'LEAD_SCORE_THRESHOLD'
  | 'NEW_LEAD'
  | 'NEW_DEAL'
  | 'TIME_BASED'
  | 'MANUAL'
  | 'FORM_SUBMISSION';
type WorkflowActionType =
  | 'SEND_EMAIL'
  | 'SEND_SMS'
  | 'CREATE_TASK'
  | 'UPDATE_FIELD'
  | 'NOTIFY_AGENT'
  | 'WEBHOOK'
  | 'ASSIGN_TO'
  | 'MOVE_STAGE'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'WAIT';

interface WorkflowStep {
  id: string;
  position: number;
  actionType: WorkflowActionType;
  config: Record<string, unknown>;
  delayMinutes: number;
  conditionJson: Record<string, unknown> | null;
  createdAt: string;
}

interface CrmWorkflow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, unknown>;
  createdById: string;
  createdBy: { id: string; name: string | null };
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
  _count: { executions: number };
}

interface StepForm {
  actionType: WorkflowActionType;
  config: Record<string, string>;
  delayMinutes: number;
}

interface WorkflowForm {
  name: string;
  description: string;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, string>;
  steps: StepForm[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIGGER_TYPES: WorkflowTriggerType[] = [
  'DEAL_STAGE_CHANGE',
  'LEAD_STATUS_CHANGE',
  'LEAD_SCORE_THRESHOLD',
  'NEW_LEAD',
  'NEW_DEAL',
  'TIME_BASED',
  'MANUAL',
  'FORM_SUBMISSION',
];

const ACTION_TYPES: WorkflowActionType[] = [
  'SEND_EMAIL',
  'SEND_SMS',
  'CREATE_TASK',
  'UPDATE_FIELD',
  'NOTIFY_AGENT',
  'WEBHOOK',
  'ASSIGN_TO',
  'MOVE_STAGE',
  'ADD_TAG',
  'REMOVE_TAG',
  'WAIT',
];

const STATUS_STYLES: Record<WorkflowStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  ARCHIVED: 'bg-red-100 text-red-600',
};

const DEFAULT_FORM: WorkflowForm = {
  name: '',
  description: '',
  triggerType: 'NEW_LEAD',
  triggerConfig: {},
  steps: [],
};

const DEFAULT_STEP: StepForm = {
  actionType: 'SEND_EMAIL',
  config: {},
  delayMinutes: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function triggerLabel(t: WorkflowTriggerType): string {
  const map: Record<WorkflowTriggerType, string> = {
    DEAL_STAGE_CHANGE: 'Deal Stage Change',
    LEAD_STATUS_CHANGE: 'Lead Status Change',
    LEAD_SCORE_THRESHOLD: 'Lead Score Threshold',
    NEW_LEAD: 'New Lead',
    NEW_DEAL: 'New Deal',
    TIME_BASED: 'Time Based',
    MANUAL: 'Manual Trigger',
    FORM_SUBMISSION: 'Form Submission',
  };
  return map[t] ?? t;
}

function actionLabel(a: WorkflowActionType): string {
  const map: Record<WorkflowActionType, string> = {
    SEND_EMAIL: 'Send Email',
    SEND_SMS: 'Send SMS',
    CREATE_TASK: 'Create Task',
    UPDATE_FIELD: 'Update Field',
    NOTIFY_AGENT: 'Notify Agent',
    WEBHOOK: 'Call Webhook',
    ASSIGN_TO: 'Assign To',
    MOVE_STAGE: 'Move Stage',
    ADD_TAG: 'Add Tag',
    REMOVE_TAG: 'Remove Tag',
    WAIT: 'Wait',
  };
  return map[a] ?? a;
}

// ---------------------------------------------------------------------------
// Step config fields per action type
// ---------------------------------------------------------------------------

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number';
}

function getConfigFields(actionType: WorkflowActionType): ConfigField[] {
  switch (actionType) {
    case 'SEND_EMAIL':
      return [
        { key: 'subject', label: 'Email Subject', type: 'text' },
        { key: 'body', label: 'Email Body', type: 'textarea' },
      ];
    case 'SEND_SMS':
      return [{ key: 'message', label: 'SMS Message', type: 'textarea' }];
    case 'CREATE_TASK':
      return [
        { key: 'taskTitle', label: 'Task Title', type: 'text' },
        { key: 'dueInMinutes', label: 'Due In (minutes)', type: 'number' },
      ];
    case 'UPDATE_FIELD':
      return [
        { key: 'fieldName', label: 'Field Name', type: 'text' },
        { key: 'fieldValue', label: 'New Value', type: 'text' },
      ];
    case 'NOTIFY_AGENT':
      return [
        { key: 'agentId', label: 'Agent ID', type: 'text' },
        { key: 'message', label: 'Notification Message', type: 'textarea' },
      ];
    case 'WEBHOOK':
      return [
        { key: 'url', label: 'Webhook URL', type: 'text' },
        { key: 'method', label: 'HTTP Method (GET/POST)', type: 'text' },
      ];
    case 'ASSIGN_TO':
      return [{ key: 'assigneeId', label: 'User ID to Assign', type: 'text' }];
    case 'MOVE_STAGE':
      return [{ key: 'stageId', label: 'Target Stage ID', type: 'text' }];
    case 'ADD_TAG':
    case 'REMOVE_TAG':
      return [{ key: 'tag', label: 'Tag Value', type: 'text' }];
    case 'WAIT':
      return [{ key: 'waitMinutes', label: 'Wait Duration (minutes)', type: 'number' }];
    default:
      return [];
  }
}

function getTriggerConfigFields(triggerType: WorkflowTriggerType): ConfigField[] {
  switch (triggerType) {
    case 'DEAL_STAGE_CHANGE':
      return [{ key: 'stageId', label: 'Target Stage ID (optional)', type: 'text' }];
    case 'LEAD_STATUS_CHANGE':
      return [{ key: 'status', label: 'Target Status (optional)', type: 'text' }];
    case 'LEAD_SCORE_THRESHOLD':
      return [{ key: 'threshold', label: 'Score Threshold', type: 'number' }];
    case 'TIME_BASED':
      return [{ key: 'cronExpression', label: 'Cron Expression (e.g. 0 9 * * 1)', type: 'text' }];
    case 'FORM_SUBMISSION':
      return [{ key: 'formId', label: 'Form ID', type: 'text' }];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StepEditorProps {
  step: StepForm;
  index: number;
  onUpdate: (index: number, step: StepForm) => void;
  onRemove: (index: number) => void;
}

function StepEditor({ step, index, onUpdate, onRemove }: StepEditorProps) {
  const configFields = getConfigFields(step.actionType);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Step {index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
        >
          <X className="h-3.5 w-3.5" /> Remove
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Action Type</label>
          <select
            value={step.actionType}
            onChange={e =>
              onUpdate(index, {
                ...step,
                actionType: e.target.value as WorkflowActionType,
                config: {},
              })
            }
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white"
          >
            {ACTION_TYPES.map(a => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Delay (minutes)</label>
          <input
            type="number"
            min={0}
            value={step.delayMinutes}
            onChange={e => onUpdate(index, { ...step, delayMinutes: parseInt(e.target.value, 10) || 0 })}
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white"
          />
        </div>
      </div>

      {configFields.map(field => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
          {field.type === 'textarea' ? (
            <textarea
              value={(step.config[field.key] as string) ?? ''}
              onChange={e =>
                onUpdate(index, { ...step, config: { ...step.config, [field.key]: e.target.value } })
              }
              rows={2}
              className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white resize-none"
            />
          ) : (
            <input
              type={field.type}
              value={(step.config[field.key] as string) ?? ''}
              onChange={e =>
                onUpdate(index, { ...step, config: { ...step.config, [field.key]: e.target.value } })
              }
              className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white"
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface WorkflowCardProps {
  workflow: CrmWorkflow;
  onToggleStatus: (id: string, currentStatus: WorkflowStatus) => void;
  onDelete: (id: string) => void;
}

function WorkflowCard({ workflow, onToggleStatus, onDelete }: WorkflowCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex-shrink-0">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
            <Zap className="h-4 w-4 text-purple-600" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{workflow.name}</p>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[workflow.status]}`}>
              {workflow.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {triggerLabel(workflow.triggerType)}
            </span>
            <span>{workflow.steps.length} steps</span>
            <span>{workflow._count.executions} executions</span>
            <span>by {workflow.createdBy.name ?? 'Unknown'}</span>
          </div>
          {workflow.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{workflow.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {workflow.status === 'DRAFT' || workflow.status === 'PAUSED' ? (
            <button
              onClick={() => onToggleStatus(workflow.id, workflow.status)}
              className="p-1.5 rounded-md hover:bg-green-50 text-green-600 transition-colors"
              title="Activate"
            >
              <Play className="h-4 w-4" />
            </button>
          ) : workflow.status === 'ACTIVE' ? (
            <button
              onClick={() => onToggleStatus(workflow.id, workflow.status)}
              className="p-1.5 rounded-md hover:bg-yellow-50 text-yellow-600 transition-colors"
              title="Pause"
            >
              <Pause className="h-4 w-4" />
            </button>
          ) : null}

          <button
            onClick={() => onDelete(workflow.id)}
            className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {workflow.steps.length > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors"
              title="View steps"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {expanded && workflow.steps.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">
          {workflow.steps.map((step, i) => (
            <div key={step.id} className="flex items-start gap-3 text-sm">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-gray-800">{actionLabel(step.actionType)}</p>
                {step.delayMinutes > 0 && (
                  <p className="text-xs text-gray-500">Wait {step.delayMinutes}m before executing</p>
                )}
                {Object.keys(step.config).length > 0 && (
                  <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                    {Object.entries(step.config).map(([k, v]) => (
                      <span key={k} className="block">
                        <span className="font-medium">{k}:</span> {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function WorkflowsPage() {
  const { t } = useI18n();
  const [workflows, setWorkflows] = useState<CrmWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<WorkflowForm>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [editorMode, setEditorMode] = useState<'list' | 'visual'>('visual');
  // selectedNodeId tracks which node is selected in the visual builder (used by WorkflowBuilder)
  const [, setSelectedNodeId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/admin/crm/workflows${params}`);
      const json = await res.json();
      if (json.success) {
        setWorkflows(json.data ?? []);
      } else {
        toast.error(json.error?.message || 'Failed to load workflows');
      }
    } catch {
      toast.error('Network error loading workflows');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const createWorkflow = async () => {
    if (!form.name.trim()) {
      toast.error('Workflow name is required');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        triggerType: form.triggerType,
        triggerConfig: form.triggerConfig,
        steps: form.steps.map(s => ({
          actionType: s.actionType,
          config: s.config,
          delayMinutes: s.delayMinutes,
        })),
      };
      const res = await fetch('/api/admin/crm/workflows', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t('admin.crm.workflowSaved'));
        setShowCreate(false);
        setForm(DEFAULT_FORM);
        fetchWorkflows();
      } else {
        toast.error(json.error?.message || 'Failed to create workflow');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: WorkflowStatus) => {
    const newStatus: WorkflowStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/crm/workflows/${id}`, {
        method: 'PATCH',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          newStatus === 'ACTIVE'
            ? (t('admin.crm.workflowActivated'))
            : (t('admin.crm.workflowPaused'))
        );
        fetchWorkflows();
      } else {
        toast.error(json.error?.message || 'Failed to update status');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const deleteWorkflow = async (id: string) => {
    if (!window.confirm(t('admin.crm.confirmDeleteWorkflow'))) return;
    try {
      const res = await fetch(`/api/admin/crm/workflows/${id}`, { method: 'DELETE', headers: addCSRFHeader({}) });
      const json = await res.json();
      if (json.success || res.status === 204) {
        toast.success(t('admin.crm.workflowDeleted'));
        fetchWorkflows();
      } else {
        toast.error(json.error?.message || 'Failed to delete workflow');
      }
    } catch {
      toast.error('Network error');
    }
  };

  // ---------------------------------------------------------------------------
  // Step helpers
  // ---------------------------------------------------------------------------

  const addStep = () => {
    setForm(f => ({ ...f, steps: [...f.steps, { ...DEFAULT_STEP }] }));
  };

  const updateStep = (index: number, step: StepForm) => {
    setForm(f => {
      const steps = [...f.steps];
      steps[index] = step;
      return { ...f, steps };
    });
  };

  const removeStep = (index: number) => {
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== index) }));
  };

  const triggerConfigFields = getTriggerConfigFields(form.triggerType);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Workflow className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('admin.crm.workflows')}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('admin.crm.workflowsDesc')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white text-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('admin.crm.newWorkflow')}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as WorkflowStatus[]).map(s => {
          const count = workflows.filter(w => w.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(prev => (prev === s ? '' : s))}
              className={`rounded-lg border p-3 text-start transition-colors ${
                statusFilter === s ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <p className="text-xl font-bold text-gray-900">{count}</p>
              <p className={`text-xs font-medium mt-0.5 ${STATUS_STYLES[s].split(' ')[1]}`}>{s}</p>
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-200">
          <Workflow className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('admin.crm.noWorkflows')}</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 text-sm text-purple-600 hover:underline"
          >
            {t('admin.crm.newWorkflow')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map(w => (
            <WorkflowCard
              key={w.id}
              workflow={w}
              onToggleStatus={toggleStatus}
              onDelete={deleteWorkflow}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
          <div className={`bg-white rounded-xl shadow-2xl w-full mx-4 flex flex-col ${editorMode === 'visual' ? 'max-w-5xl' : 'max-w-2xl'}`}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('admin.crm.newWorkflow')}
                </h2>
              </div>
              <button
                onClick={() => { setShowCreate(false); setForm(DEFAULT_FORM); }}
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[70vh]">
              {/* Basic info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.crm.workflowName')} *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    autoFocus
                    placeholder="e.g. Welcome new leads"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.crm.workflowDescription')}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
                    placeholder="What does this workflow do?"
                  />
                </div>
              </div>

              {/* Trigger */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.crm.triggerType')}
                </label>
                <select
                  value={form.triggerType}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      triggerType: e.target.value as WorkflowTriggerType,
                      triggerConfig: {},
                    }))
                  }
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  {TRIGGER_TYPES.map(t => (
                    <option key={t} value={t}>
                      {triggerLabel(t)}
                    </option>
                  ))}
                </select>

                {triggerConfigFields.length > 0 && (
                  <div className="mt-3 space-y-2 ps-3 border-s-2 border-purple-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {t('admin.crm.triggerConfig')}
                    </p>
                    {triggerConfigFields.map(field => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {field.label}
                        </label>
                        <input
                          type={field.type}
                          value={(form.triggerConfig[field.key] as string) ?? ''}
                          onChange={e =>
                            setForm(f => ({
                              ...f,
                              triggerConfig: { ...f.triggerConfig, [field.key]: e.target.value },
                            }))
                          }
                          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Steps — with visual/list toggle */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.crm.steps')} ({form.steps.length})
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-gray-100 rounded-md p-0.5">
                      <button
                        type="button"
                        onClick={() => setEditorMode('visual')}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          editorMode === 'visual'
                            ? 'bg-white text-purple-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Visual
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorMode('list')}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          editorMode === 'list'
                            ? 'bg-white text-purple-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <List className="h-3.5 w-3.5" />
                        List
                      </button>
                    </div>
                    {editorMode === 'list' && (
                      <button
                        type="button"
                        onClick={addStep}
                        className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t('admin.crm.addStep')}
                      </button>
                    )}
                  </div>
                </div>

                {editorMode === 'visual' ? (
                  <div className="h-[450px] rounded-xl overflow-hidden">
                    <WorkflowBuilder
                      triggerType={form.triggerType}
                      triggerConfig={form.triggerConfig as Record<string, unknown>}
                      steps={form.steps.map(s => ({
                        actionType: s.actionType,
                        config: s.config as Record<string, unknown>,
                        delayMinutes: s.delayMinutes,
                        conditionJson: null,
                      }))}
                      onStepsChange={(newSteps) => {
                        setForm(f => ({
                          ...f,
                          steps: newSteps.map(s => ({
                            actionType: s.actionType as WorkflowActionType,
                            config: Object.fromEntries(
                              Object.entries(s.config).map(([k, v]) => [k, String(v ?? '')])
                            ),
                            delayMinutes: s.delayMinutes,
                          })),
                        }));
                      }}
                      onNodeSelect={setSelectedNodeId}
                    />
                  </div>
                ) : form.steps.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg py-6 text-center">
                    <p className="text-sm text-gray-400">No steps added yet</p>
                    <button
                      type="button"
                      onClick={addStep}
                      className="mt-2 text-xs text-purple-600 hover:underline"
                    >
                      + Add first step
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {form.steps.map((step, i) => (
                      <StepEditor
                        key={i}
                        step={step}
                        index={i}
                        onUpdate={updateStep}
                        onRemove={removeStep}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => { setShowCreate(false); setForm(DEFAULT_FORM); }}
                className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createWorkflow}
                disabled={creating || !form.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? 'Creating...' : (t('admin.crm.newWorkflow'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
