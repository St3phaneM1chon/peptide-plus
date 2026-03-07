'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  BookOpen,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Link as LinkIcon,
  Trash2,
  Save,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StageGuidance {
  stageId: string;
  guidance: string;
  checklist: string[];
  resources: { title: string; url: string }[];
}

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  stages: StageGuidance[];
  targetPipeline: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; position: number }[];
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Playbook['status'] }) {
  const config = {
    DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
    ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700' },
    ARCHIVED: { label: 'Archived', color: 'bg-yellow-100 text-yellow-700' },
  };

  const { label, color } = config[status];

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stage Editor
// ---------------------------------------------------------------------------

function StageEditor({
  stage,
  onChange,
  onRemove,
}: {
  stage: StageGuidance;
  onChange: (updated: StageGuidance) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const updateChecklist = (index: number, value: string) => {
    const updated = [...stage.checklist];
    updated[index] = value;
    onChange({ ...stage, checklist: updated });
  };

  const addChecklistItem = () => {
    onChange({ ...stage, checklist: [...stage.checklist, ''] });
  };

  const removeChecklistItem = (index: number) => {
    onChange({ ...stage, checklist: stage.checklist.filter((_, i) => i !== index) });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {stage.stageId || (t('admin.crm.playbooks.unnamedStage') || 'Unnamed Stage')}
        </button>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Stage ID */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.playbooks.stageId') || 'Stage ID'}
            </label>
            <input
              type="text"
              value={stage.stageId}
              onChange={(e) => onChange({ ...stage, stageId: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Guidance */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.playbooks.guidance') || 'Guidance'}
            </label>
            <textarea
              value={stage.guidance}
              onChange={(e) => onChange({ ...stage, guidance: e.target.value })}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {/* Checklist */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.playbooks.checklist') || 'Checklist'}
            </label>
            {stage.checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-gray-300 flex-shrink-0" />
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateChecklist(i, e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder={t('admin.crm.playbooks.checklistItem') || 'Checklist item...'}
                />
                <button onClick={() => removeChecklistItem(i)} className="text-red-400 hover:text-red-600">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addChecklistItem}
              className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              {t('admin.crm.playbooks.addItem') || 'Add item'}
            </button>
          </div>

          {/* Resources */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.playbooks.resources') || 'Resources'}
            </label>
            {stage.resources.map((res, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <LinkIcon className="h-4 w-4 text-gray-300 flex-shrink-0" />
                <input
                  type="text"
                  value={res.title}
                  onChange={(e) => {
                    const updated = [...stage.resources];
                    updated[i] = { ...updated[i], title: e.target.value };
                    onChange({ ...stage, resources: updated });
                  }}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder={t('admin.crm.playbooks.resourceTitle') || 'Title'}
                />
                <input
                  type="text"
                  value={res.url}
                  onChange={(e) => {
                    const updated = [...stage.resources];
                    updated[i] = { ...updated[i], url: e.target.value };
                    onChange({ ...stage, resources: updated });
                  }}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="URL"
                />
                <button
                  onClick={() => onChange({ ...stage, resources: stage.resources.filter((_, j) => j !== i) })}
                  className="text-red-400 hover:text-red-600"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => onChange({ ...stage, resources: [...stage.resources, { title: '', url: '' }] })}
              className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              {t('admin.crm.playbooks.addResource') || 'Add resource'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create/Edit Modal
// ---------------------------------------------------------------------------

interface PlaybookModalProps {
  playbook: Playbook | null; // null = create mode
  pipelines: Pipeline[];
  onClose: () => void;
  onSave: () => void;
}

function PlaybookModal({ playbook, pipelines, onClose, onSave }: PlaybookModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState(playbook?.name || '');
  const [description, setDescription] = useState(playbook?.description || '');
  const [status, setStatus] = useState<Playbook['status']>(playbook?.status || 'DRAFT');
  const [targetPipeline, setTargetPipeline] = useState(playbook?.targetPipeline || '');
  const [stages, setStages] = useState<StageGuidance[]>(playbook?.stages || []);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('admin.crm.playbooks.nameRequired') || 'Name is required');
      return;
    }

    setSaving(true);
    try {
      const url = playbook
        ? `/api/admin/crm/playbooks/${playbook.id}`
        : '/api/admin/crm/playbooks';

      const res = await fetch(url, {
        method: playbook ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          status,
          targetPipeline: targetPipeline || null,
          stages,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to save playbook');
      }

      toast.success(
        playbook
          ? (t('admin.crm.playbooks.updated') || 'Playbook updated')
          : (t('admin.crm.playbooks.created') || 'Playbook created')
      );
      onSave();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addStage = () => {
    setStages([...stages, { stageId: '', guidance: '', checklist: [], resources: [] }]);
  };

  const updateStage = (index: number, updated: StageGuidance) => {
    const next = [...stages];
    next[index] = updated;
    setStages(next);
  };

  const removeStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teal-600" />
            {playbook
              ? (t('admin.crm.playbooks.editPlaybook') || 'Edit Playbook')
              : (t('admin.crm.playbooks.createPlaybook') || 'Create Playbook')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('common.name') || 'Name'} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder={t('admin.crm.playbooks.namePlaceholder') || 'Sales Playbook...'}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('common.description') || 'Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('common.status') || 'Status'}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Playbook['status'])}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.playbooks.pipeline') || 'Pipeline'}
              </label>
              <select
                value={targetPipeline}
                onChange={(e) => setTargetPipeline(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">{t('admin.crm.playbooks.allPipelines') || 'All Pipelines'}</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stage-by-Stage Guidance */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                {t('admin.crm.playbooks.stageGuidance') || 'Stage Guidance'}
              </label>
              <button
                onClick={addStage}
                className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                {t('admin.crm.playbooks.addStage') || 'Add Stage'}
              </button>
            </div>

            <div className="space-y-3">
              {stages.map((stage, i) => (
                <StageEditor
                  key={i}
                  stage={stage}
                  onChange={(updated) => updateStage(i, updated)}
                  onRemove={() => removeStage(i)}
                />
              ))}
              {stages.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  {t('admin.crm.playbooks.noStages') || 'No stages configured. Add stages to define the playbook flow.'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving
              ? (t('common.saving') || 'Saving...')
              : (t('common.save') || 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PlaybooksPage() {
  const { t } = useI18n();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ playbook: Playbook | null } | null>(null);

  const fetchPlaybooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/crm/playbooks');
      const json = await res.json();
      if (json.success) {
        setPlaybooks(json.data || json.items || []);
      }
    } catch {
      toast.error(t('admin.crm.playbooks.loadError') || 'Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/pipelines');
      const json = await res.json();
      if (json.success) {
        setPipelines(json.data || json.items || []);
      }
    } catch {
      // Silent fail for pipelines
    }
  }, []);

  useEffect(() => {
    fetchPlaybooks();
    fetchPipelines();
  }, [fetchPlaybooks, fetchPipelines]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-teal-600" />
            {t('admin.crm.playbooks.title') || 'Sales Playbooks'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.playbooks.subtitle') || 'Stage-by-stage guidance for your sales process'}
          </p>
        </div>
        <button
          onClick={() => setModal({ playbook: null })}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          {t('admin.crm.playbooks.create') || 'Create Playbook'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 text-teal-500 animate-spin" />
        </div>
      ) : playbooks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {t('admin.crm.playbooks.noPlaybooks') || 'No playbooks yet'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {t('admin.crm.playbooks.noPlaybooksDesc') || 'Create your first playbook to guide your sales team'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {playbooks.map((pb) => (
            <div
              key={pb.id}
              onClick={() => setModal({ playbook: pb })}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{pb.name}</h3>
                  {pb.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{pb.description}</p>
                  )}
                </div>
                <StatusBadge status={pb.status} />
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {pb.stages.length} {t('admin.crm.playbooks.stages') || 'stages'}
                </span>
                <span>
                  {new Date(pb.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <PlaybookModal
          playbook={modal.playbook}
          pipelines={pipelines}
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null);
            fetchPlaybooks();
          }}
        />
      )}
    </div>
  );
}
