'use client';

/**
 * SondagesClient - Post-call survey configuration manager.
 */

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import { ClipboardCheck, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface SurveyQuestion {
  id: string;
  type: 'rating' | 'yes_no' | 'open_text' | 'dtmf';
  text: string;
}

interface Survey {
  id: string;
  key: string;
  name: string;
  questions: SurveyQuestion[];
  active: boolean;
  method?: string;
}

interface ResultStats {
  method: string;
  _count: { id: number };
  _avg: { overallScore: number | null };
}

const QUESTION_TYPES = [
  { value: 'rating', label: 'Rating (1-5)' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'open_text', label: 'Open Text' },
  { value: 'dtmf', label: 'DTMF Keypad' },
] as const;

export default function SondagesClient({
  surveys: initial,
  resultStats,
}: {
  surveys: Survey[];
  resultStats: ResultStats[];
}) {
  const { t } = useI18n();
  const [surveys, setSurveys] = useState<Survey[]>(initial);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Survey | null>(null);
  const [formName, setFormName] = useState('');
  const [formMethod, setFormMethod] = useState<string>('dtmf');
  const [formActive, setFormActive] = useState(true);
  const [formQuestions, setFormQuestions] = useState<SurveyQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setFormName('');
    setFormMethod('dtmf');
    setFormActive(true);
    setFormQuestions([]);
    setShowModal(true);
  };

  const openEdit = (survey: Survey) => {
    setEditing(survey);
    setFormName(survey.name);
    setFormMethod(survey.method || 'dtmf');
    setFormActive(survey.active);
    setFormQuestions(survey.questions || []);
    setShowModal(true);
  };

  const addQuestion = () => {
    setFormQuestions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: 'rating', text: '' },
    ]);
  };

  const updateQuestion = (id: string, field: keyof SurveyQuestion, value: string) => {
    setFormQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const removeQuestion = (id: string) => {
    setFormQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        method: formMethod,
        active: formActive,
        questions: formQuestions.filter((q) => q.text.trim()),
      };
      const method = editing ? 'PUT' : 'POST';
      const url = editing
        ? `/api/admin/voip/surveys?id=${editing.id}`
        : '/api/admin/voip/surveys';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || t('common.error'));
        return;
      }
      const data = await res.json();
      if (editing) {
        setSurveys((prev) =>
          prev.map((s) => (s.id === editing.id ? { ...s, ...payload, id: editing.id, key: editing.key } : s))
        );
      } else {
        setSurveys((prev) => [data, ...prev]);
      }
      toast.success(t('voip.admin.surveys.saved'));
      setShowModal(false);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (survey: Survey) => {
    try {
      const res = await fetch(`/api/admin/voip/surveys?id=${survey.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...survey, active: !survey.active }),
      });
      if (!res.ok) {
        toast.error(t('common.error'));
        return;
      }
      setSurveys((prev) =>
        prev.map((s) => (s.id === survey.id ? { ...s, active: !s.active } : s))
      );
      toast.success(t('voip.admin.surveys.saved'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleDelete = async (survey: Survey) => {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      await fetch(`/api/admin/voip/surveys?id=${survey.id}`, { method: 'DELETE' });
      setSurveys((prev) => prev.filter((s) => s.id !== survey.id));
      toast.success(t('common.deleted'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const totalResponses = resultStats.reduce((sum, r) => sum + r._count.id, 0);
  const avgScore = resultStats.length > 0
    ? resultStats.reduce((sum, r) => sum + (r._avg.overallScore || 0), 0) / resultStats.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('voip.admin.surveys.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('voip.admin.surveys.subtitle')}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('voip.admin.surveys.addSurvey')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('voip.admin.surveys.results')}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalResponses}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('voip.admin.surveys.averageScore')}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {avgScore > 0 ? `${avgScore.toFixed(1)}/5` : '-'}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('voip.admin.surveys.responseRate')}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {totalResponses > 0 ? `${Math.round((totalResponses / Math.max(totalResponses, 1)) * 100)}%` : '-'}
          </div>
        </div>
      </div>

      {/* Surveys Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                {t('voip.admin.surveys.name')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                {t('voip.admin.surveys.questions')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                {t('voip.admin.surveys.method')}
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">
                {t('voip.admin.surveys.active')}
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {surveys.map((survey) => (
              <tr key={survey.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {survey.name}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {survey.questions?.length || 0}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {survey.method === 'dtmf'
                    ? t('voip.admin.surveys.dtmf')
                    : t('voip.admin.surveys.webForm')}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleToggleActive(survey)} className="inline-flex">
                    {survey.active ? (
                      <ToggleRight className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-400" />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(survey)}
                      className="p-1.5 text-gray-400 hover:text-teal-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={t('voip.admin.surveys.editSurvey')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(survey)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {surveys.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>{t('voip.admin.surveys.empty')}</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editing ? t('voip.admin.surveys.editSurvey') : t('voip.admin.surveys.addSurvey')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('voip.admin.surveys.name')}
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('voip.admin.surveys.name')}
                />
              </div>

              {/* Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('voip.admin.surveys.method')}
                </label>
                <select
                  value={formMethod}
                  onChange={(e) => setFormMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="dtmf">{t('voip.admin.surveys.dtmf')}</option>
                  <option value="web_form">{t('voip.admin.surveys.webForm')}</option>
                </select>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3">
                <button onClick={() => setFormActive(!formActive)}>
                  {formActive ? (
                    <ToggleRight className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                  )}
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t('voip.admin.surveys.active')}
                </span>
              </div>

              {/* Questions Builder */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('voip.admin.surveys.questions')}
                  </label>
                  <button
                    onClick={addQuestion}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-600 bg-teal-50 dark:bg-teal-900/30 rounded-lg hover:bg-teal-100"
                  >
                    <Plus className="w-3 h-3" /> {t('voip.admin.surveys.addQuestion')}
                  </button>
                </div>

                <div className="space-y-3">
                  {formQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-750"
                    >
                      <span className="text-xs text-gray-400 font-mono mt-2.5">{idx + 1}</span>
                      <div className="flex-1 space-y-2">
                        <input
                          value={q.text}
                          onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                          placeholder={`Question ${idx + 1}...`}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <select
                          value={q.type}
                          onChange={(e) => updateQuestion(q.id, 'type', e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {QUESTION_TYPES.map((qt) => (
                            <option key={qt.value} value={qt.value}>
                              {qt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => removeQuestion(q.id)}
                        className="p-1 text-gray-400 hover:text-red-500 mt-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {formQuestions.length === 0 && (
                    <div className="text-center py-6 text-sm text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                      <BarChart3 className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                      {t('voip.admin.surveys.addQuestion')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
