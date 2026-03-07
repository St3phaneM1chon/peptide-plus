'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  ClipboardCheck, Star, BarChart, Plus, Filter, X, ChevronDown,
  Scale, Play,
} from 'lucide-react';
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QaCriterion {
  name: string;
  maxScore: number;
  weight: number;
}

interface QaForm {
  id: string;
  name: string;
  description: string | null;
  criteria: QaCriterion[];
  isActive: boolean;
  createdAt: string;
  _count: { scores: number };
}

interface QaScore {
  id: string;
  formId: string;
  form: { id: string; name: string; criteria: QaCriterion[] };
  agentId: string;
  agent: { id: string; name: string | null; email: string | null; image: string | null };
  scoredBy: { id: string; name: string | null; email: string | null };
  callLogId: string | null;
  scores: Record<string, number>;
  totalScore: number;
  maxScore: number;
  percentage: number;
  feedback: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface CalibrationSession {
  id: string;
  callLogId: string;
  formId: string;
  formName: string;
  evaluators: CalibrationEvaluator[];
  status: 'setup' | 'in_progress' | 'completed';
  createdAt: string;
  reliability: number | null; // inter-rater reliability 0-1
}

interface CalibrationEvaluator {
  evaluatorId: string;
  evaluatorName: string;
  scores: Record<string, number> | null;
  totalScore: number | null;
  percentage: number | null;
  submitted: boolean;
}

// ---------------------------------------------------------------------------
// Create Form Modal
// ---------------------------------------------------------------------------

interface CreateFormModalProps {
  onClose: () => void;
  onCreated: (form: QaForm) => void;
}

function CreateFormModal({ onClose, onCreated }: CreateFormModalProps) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState<QaCriterion[]>([
    { name: '', maxScore: 10, weight: 1 },
  ]);

  const addCriterion = () => {
    setCriteria((prev) => [...prev, { name: '', maxScore: 10, weight: 1 }]);
  };

  const removeCriterion = (index: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCriterion = (index: number, field: keyof QaCriterion, value: string | number) => {
    setCriteria((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t('admin.crm.qa.nameRequired') || 'Form name is required');
      return;
    }
    const validCriteria = criteria.filter((c) => c.name.trim());
    if (validCriteria.length === 0) {
      toast.error(t('admin.crm.qa.criteriaRequired') || 'At least one criterion is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/crm/qa-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || null, criteria: validCriteria }),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to create form');
      }

      toast.success(t('admin.crm.qa.formCreated') || 'QA Form created');
      onCreated(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create form');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('admin.crm.qa.createForm') || 'Create QA Form'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.qa.formName') || 'Form Name'} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder={t('admin.crm.qa.formNamePlaceholder') || 'e.g., Inbound Call Quality'}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.qa.description') || 'Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputCls + ' resize-none'}
              rows={2}
              placeholder={t('admin.crm.qa.descriptionPlaceholder') || 'Optional description...'}
            />
          </div>

          {/* Criteria */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              {t('admin.crm.qa.criteria') || 'Scoring Criteria'} *
            </label>
            <div className="space-y-2">
              {criteria.map((criterion, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <input
                    type="text"
                    value={criterion.name}
                    onChange={(e) => updateCriterion(idx, 'name', e.target.value)}
                    className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder={t('admin.crm.qa.criterionName') || 'Criterion name'}
                  />
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-gray-400">Max</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={criterion.maxScore}
                      onChange={(e) => updateCriterion(idx, 'maxScore', parseInt(e.target.value, 10) || 10)}
                      className="w-14 border border-gray-200 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-gray-400">Wt</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={criterion.weight}
                      onChange={(e) => updateCriterion(idx, 'weight', parseFloat(e.target.value) || 1)}
                      className="w-14 border border-gray-200 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  {criteria.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCriterion(idx)}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addCriterion}
              className="mt-2 flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('admin.crm.qa.addCriterion') || 'Add Criterion'}
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {saving
                ? (t('common.creating') || 'Creating...')
                : (t('common.create') || 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Call Modal
// ---------------------------------------------------------------------------

interface ScoreCallModalProps {
  forms: QaForm[];
  onClose: () => void;
  onScored: (score: QaScore) => void;
}

function ScoreCallModal({ forms, onClose, onScored }: ScoreCallModalProps) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState(forms[0]?.id || '');
  const [agentId, setAgentId] = useState('');
  const [callLogId, setCallLogId] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState('');

  const selectedForm = forms.find((f) => f.id === selectedFormId);

  // Reset scores when form changes
  useEffect(() => {
    if (selectedForm) {
      const initial: Record<string, number> = {};
      selectedForm.criteria.forEach((c) => {
        initial[c.name] = 0;
      });
      setScores(initial);
    }
  }, [selectedFormId, selectedForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId.trim()) {
      toast.error(t('admin.crm.qa.agentRequired') || 'Agent ID is required');
      return;
    }
    if (!selectedFormId) {
      toast.error(t('admin.crm.qa.formRequired') || 'Please select a QA form');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/crm/qa-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: selectedFormId,
          agentId,
          callLogId: callLogId || null,
          scores,
          feedback: feedback || null,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to create score');
      }

      toast.success(t('admin.crm.qa.scoreCreated') || 'Score recorded');
      onScored(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record score');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            {t('admin.crm.qa.scoreCall') || 'Score a Call'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Form selection */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.qa.selectForm') || 'QA Form'} *
            </label>
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
              className={inputCls}
            >
              {forms.filter((f) => f.isActive).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Agent & Call */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.qa.agentId') || 'Agent ID'} *
              </label>
              <input
                type="text"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className={inputCls}
                placeholder="cuid..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.qa.callLogId') || 'Call Log ID'}
              </label>
              <input
                type="text"
                value={callLogId}
                onChange={(e) => setCallLogId(e.target.value)}
                className={inputCls}
                placeholder={t('admin.crm.qa.optional') || 'Optional'}
              />
            </div>
          </div>

          {/* Criteria Sliders */}
          {selectedForm && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                {t('admin.crm.qa.criteriaScores') || 'Criteria Scores'}
              </label>
              <div className="space-y-3">
                {selectedForm.criteria.map((criterion) => (
                  <div key={criterion.name} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{criterion.name}</span>
                      <span className="text-sm font-bold text-teal-600">
                        {scores[criterion.name] || 0}/{criterion.maxScore}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={criterion.maxScore}
                      value={scores[criterion.name] || 0}
                      onChange={(e) =>
                        setScores((prev) => ({ ...prev, [criterion.name]: parseInt(e.target.value, 10) }))
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                    {criterion.weight !== 1 && (
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        Weight: {criterion.weight}x
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.qa.feedback') || 'Feedback'}
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className={inputCls + ' resize-none'}
              rows={3}
              placeholder={t('admin.crm.qa.feedbackPlaceholder') || 'Provide feedback for the agent...'}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              {saving
                ? (t('common.saving') || 'Saving...')
                : (t('admin.crm.qa.submitScore') || 'Submit Score')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Percentage Bar
// ---------------------------------------------------------------------------

function PercentageBar({ percentage }: { percentage: number }) {
  const color =
    percentage >= 80 ? 'bg-green-500' :
    percentage >= 60 ? 'bg-yellow-500' :
    percentage >= 40 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2.5">
        <div
          className={`${color} h-2.5 rounded-full transition-all`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-gray-700 w-12 text-right">
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function QaPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'forms' | 'scores' | 'calibration'>('forms');

  // Forms state
  const [forms, setForms] = useState<QaForm[]>([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Scores state
  const [scores, setScores] = useState<QaScore[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [scoresPagination, setScoresPagination] = useState<Pagination | null>(null);
  const [filterFormId, setFilterFormId] = useState('');
  const [filterAgentId, setFilterAgentId] = useState('');
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Calibration state (F9)
  const [calibrationSessions, setCalibrationSessions] = useState<CalibrationSession[]>([]);
  const [showCalibrationSetup, setShowCalibrationSetup] = useState(false);
  const [calibrationForm, setCalibrationForm] = useState({
    callLogId: '',
    formId: '',
    evaluatorIds: '' as string, // comma-separated
  });

  // Fetch forms
  const fetchForms = useCallback(async () => {
    setFormsLoading(true);
    try {
      const res = await fetch('/api/admin/crm/qa-forms?limit=100');
      const json = await res.json();
      if (json.success) {
        setForms(json.data);
      }
    } catch {
      toast.error('Failed to load QA forms');
    } finally {
      setFormsLoading(false);
    }
  }, []);

  // Fetch scores
  const fetchScores = useCallback(async (page = 1) => {
    setScoresLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterFormId) params.set('formId', filterFormId);
      if (filterAgentId) params.set('agentId', filterAgentId);

      const res = await fetch(`/api/admin/crm/qa-scores?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setScores(json.data);
        setScoresPagination(json.pagination);
      }
    } catch {
      toast.error('Failed to load QA scores');
    } finally {
      setScoresLoading(false);
    }
  }, [filterFormId, filterAgentId]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  useEffect(() => {
    if (tab === 'scores') {
      fetchScores();
    }
  }, [tab, fetchScores]);

  const handleFormCreated = (form: QaForm) => {
    setForms((prev) => [form, ...prev]);
    setShowCreateForm(false);
  };

  const handleScoreCreated = (score: QaScore) => {
    setScores((prev) => [score, ...prev]);
    setShowScoreModal(false);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-green-600" />
            {t('admin.crm.qa.title') || 'Quality Assurance'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.qa.subtitle') || 'Evaluate agent performance with QA scoring forms'}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'forms' && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              {t('admin.crm.qa.newForm') || 'New Form'}
            </button>
          )}
          {tab === 'scores' && forms.length > 0 && (
            <button
              onClick={() => setShowScoreModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              <Star className="h-4 w-4" />
              {t('admin.crm.qa.scoreCall') || 'Score a Call'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('forms')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'forms'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <ClipboardCheck className="h-4 w-4" />
            {t('admin.crm.qa.formsTab') || 'Forms'}
          </span>
        </button>
        <button
          onClick={() => setTab('scores')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'scores'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <BarChart className="h-4 w-4" />
            {t('admin.crm.qa.scoresTab') || 'Scores'}
          </span>
        </button>
        <button
          onClick={() => setTab('calibration')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'calibration'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Scale className="h-4 w-4" />
            {t('admin.crm.qa.calibrationTab') || 'Calibration'}
          </span>
        </button>
      </div>

      {/* Forms Tab */}
      {tab === 'forms' && (
        <div>
          {formsLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
            </div>
          ) : forms.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">
                {t('admin.crm.qa.noForms') || 'No QA forms yet'}
              </h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                {t('admin.crm.qa.noFormsDesc') || 'Create a QA form to start evaluating agent performance.'}
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700"
              >
                <Plus className="h-4 w-4" />
                {t('admin.crm.qa.createFirst') || 'Create First Form'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forms.map((form) => (
                <div
                  key={form.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">{form.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      form.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {form.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {form.description && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{form.description}</p>
                  )}

                  <div className="space-y-1 mb-3">
                    {form.criteria.map((c, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{c.name}</span>
                        <span className="text-gray-400">max {c.maxScore} (x{c.weight})</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                    <span>{form.criteria.length} {t('admin.crm.qa.criteria') || 'criteria'}</span>
                    <span>{form._count.scores} {t('admin.crm.qa.evaluations') || 'evaluations'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scores Tab */}
      {tab === 'scores' && (
        <div>
          {/* Filters */}
          <div className="mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <Filter className="h-4 w-4" />
              {t('admin.crm.qa.filters') || 'Filters'}
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {showFilters && (
              <div className="mt-2 bg-white rounded-lg border border-gray-200 p-4 flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('admin.crm.qa.filterByForm') || 'Filter by Form'}
                  </label>
                  <select
                    value={filterFormId}
                    onChange={(e) => setFilterFormId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">{t('admin.crm.qa.allForms') || 'All Forms'}</option>
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('admin.crm.qa.filterByAgent') || 'Filter by Agent ID'}
                  </label>
                  <input
                    type="text"
                    value={filterAgentId}
                    onChange={(e) => setFilterAgentId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Agent ID..."
                  />
                </div>
              </div>
            )}
          </div>

          {scoresLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
            </div>
          ) : scores.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <BarChart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">
                {t('admin.crm.qa.noScores') || 'No scores yet'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {t('admin.crm.qa.noScoresDesc') || 'Score a call to see QA evaluations here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {scores.map((score) => (
                <div
                  key={score.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {score.agent.image ? (
                        <Image src={score.agent.image} alt="" width={40} height={40} className="h-9 w-9 rounded-full" unoptimized />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                          {(score.agent.name || score.agent.email || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {score.agent.name || score.agent.email || 'Unknown Agent'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {score.form.name} &middot; Scored by {score.scoredBy.name || score.scoredBy.email}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(score.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </div>
                  </div>

                  {/* Percentage bar */}
                  <div className="mb-3">
                    <PercentageBar percentage={Number(score.percentage)} />
                  </div>

                  {/* Individual scores */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
                    {Object.entries(score.scores).map(([name, val]) => {
                      const criterion = score.form.criteria.find((c) => c.name === name);
                      const max = criterion?.maxScore || 10;
                      return (
                        <div key={name} className="bg-gray-50 rounded-lg px-2 py-1.5 text-xs">
                          <div className="text-gray-500 truncate">{name}</div>
                          <div className="font-semibold text-gray-800">{val}/{max}</div>
                        </div>
                      );
                    })}
                  </div>

                  {score.feedback && (
                    <div className="text-xs text-gray-600 bg-yellow-50 rounded-lg px-3 py-2 border border-yellow-100">
                      <span className="font-medium">{t('admin.crm.qa.feedback') || 'Feedback'}:</span> {score.feedback}
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination */}
              {scoresPagination && scoresPagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    onClick={() => fetchScores(scoresPagination.page - 1)}
                    disabled={!scoresPagination.hasPrev}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    {t('common.previous') || 'Previous'}
                  </button>
                  <span className="text-sm text-gray-500">
                    {scoresPagination.page} / {scoresPagination.totalPages}
                  </span>
                  <button
                    onClick={() => fetchScores(scoresPagination.page + 1)}
                    disabled={!scoresPagination.hasNext}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    {t('common.next') || 'Next'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Calibration Tab (F9) */}
      {tab === 'calibration' && (
        <div>
          {/* Setup button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowCalibrationSetup(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" />
              {t('admin.crm.qa.newCalibration') || 'New Calibration Session'}
            </button>
          </div>

          {calibrationSessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Scale className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">
                {t('admin.crm.qa.noCalibrations') || 'No calibration sessions yet'}
              </h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                {t('admin.crm.qa.noCalibrationsDesc') || 'Create a calibration session to compare scores across evaluators.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {calibrationSessions.map((session) => {
                const submittedEvals = session.evaluators.filter(e => e.submitted);
                const chartData = submittedEvals.map(e => ({
                  name: e.evaluatorName,
                  score: e.percentage ?? 0,
                }));

                return (
                  <div key={session.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    {/* Session header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Scale className="h-4 w-4 text-purple-600" />
                          {t('admin.crm.qa.calibrationSession') || 'Calibration Session'}
                        </h3>
                        <div className="text-xs text-gray-500 mt-1">
                          Form: {session.formName} | Call: {session.callLogId} |{' '}
                          {new Date(session.createdAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          session.status === 'completed' ? 'bg-green-100 text-green-700' :
                          session.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {session.status.replace('_', ' ')}
                        </span>
                        {session.reliability !== null && (
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Inter-rater reliability</div>
                            <div className={`text-sm font-bold ${
                              session.reliability >= 0.8 ? 'text-green-600' :
                              session.reliability >= 0.6 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {(session.reliability * 100).toFixed(0)}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Evaluator scores table */}
                    <div className="mb-4">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Evaluator</th>
                            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Total Score</th>
                            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Percentage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {session.evaluators.map(ev => (
                            <tr key={ev.evaluatorId} className="border-b border-gray-100">
                              <td className="px-3 py-2 text-sm text-gray-900">{ev.evaluatorName}</td>
                              <td className="px-3 py-2 text-center">
                                {ev.submitted ? (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">Submitted</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">Pending</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center text-sm font-medium text-gray-700">
                                {ev.totalScore !== null ? ev.totalScore : '-'}
                              </td>
                              <td className="px-3 py-2 text-center text-sm font-bold text-gray-900">
                                {ev.percentage !== null ? `${ev.percentage.toFixed(0)}%` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Score comparison chart */}
                    {chartData.length >= 2 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-xs font-medium text-gray-600 mb-3">
                          {t('admin.crm.qa.scoreComparison') || 'Score Comparison Across Evaluators'}
                        </h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <ReBarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <ReTooltip formatter={(v: any) => [`${v}%`, 'Score']} />
                            <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={40}>
                              {chartData.map((_, idx) => (
                                <Cell key={idx} fill={['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'][idx % 5]} />
                              ))}
                            </Bar>
                          </ReBarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Calibration Setup Modal */}
          {showCalibrationSetup && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Scale className="h-5 w-5 text-purple-600" />
                    {t('admin.crm.qa.setupCalibration') || 'Setup Calibration Session'}
                  </h3>
                  <button onClick={() => setShowCalibrationSetup(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('admin.crm.qa.selectForm') || 'QA Form'} *
                    </label>
                    <select
                      value={calibrationForm.formId}
                      onChange={(e) => setCalibrationForm(prev => ({ ...prev, formId: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select form...</option>
                      {forms.filter(f => f.isActive).map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('admin.crm.qa.callRecording') || 'Call Log ID'} *
                    </label>
                    <input
                      type="text"
                      value={calibrationForm.callLogId}
                      onChange={(e) => setCalibrationForm(prev => ({ ...prev, callLogId: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter call log ID to evaluate..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('admin.crm.qa.evaluators') || 'Evaluator IDs (comma-separated)'} *
                    </label>
                    <input
                      type="text"
                      value={calibrationForm.evaluatorIds}
                      onChange={(e) => setCalibrationForm(prev => ({ ...prev, evaluatorIds: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="id1, id2, id3..."
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      {t('admin.crm.qa.evaluatorsHint') || 'Enter user IDs of evaluators who will independently score this call'}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCalibrationSetup(false)}
                      className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      {t('common.cancel') || 'Cancel'}
                    </button>
                    <button
                      onClick={() => {
                        if (!calibrationForm.formId || !calibrationForm.callLogId || !calibrationForm.evaluatorIds) {
                          toast.error('Please fill all fields');
                          return;
                        }
                        const evaluatorIds = calibrationForm.evaluatorIds.split(',').map(id => id.trim()).filter(Boolean);
                        if (evaluatorIds.length < 2) {
                          toast.error('At least 2 evaluators are required');
                          return;
                        }
                        const selectedForm = forms.find(f => f.id === calibrationForm.formId);
                        const newSession: CalibrationSession = {
                          id: `cal-${Date.now()}`,
                          callLogId: calibrationForm.callLogId,
                          formId: calibrationForm.formId,
                          formName: selectedForm?.name || 'Unknown',
                          evaluators: evaluatorIds.map(id => ({
                            evaluatorId: id,
                            evaluatorName: `Evaluator ${id.slice(-4)}`,
                            scores: null,
                            totalScore: null,
                            percentage: null,
                            submitted: false,
                          })),
                          status: 'setup',
                          createdAt: new Date().toISOString(),
                          reliability: null,
                        };
                        setCalibrationSessions(prev => [newSession, ...prev]);
                        setShowCalibrationSetup(false);
                        setCalibrationForm({ callLogId: '', formId: '', evaluatorIds: '' });
                        toast.success(t('admin.crm.qa.calibrationCreated') || 'Calibration session created');
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                    >
                      <Play className="h-4 w-4" />
                      {t('admin.crm.qa.startCalibration') || 'Create Session'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreateForm && (
        <CreateFormModal
          onClose={() => setShowCreateForm(false)}
          onCreated={handleFormCreated}
        />
      )}
      {showScoreModal && (
        <ScoreCallModal
          forms={forms}
          onClose={() => setShowScoreModal(false)}
          onScored={handleScoreCreated}
        />
      )}
    </div>
  );
}
