'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, Button, EmptyState, Modal, FormField, Input, Textarea } from '@/components/admin';
import { Plus, Award, Pencil, Trash2 } from 'lucide-react';
import { ConfirmProvider, useConfirm } from '@/components/lms/ConfirmDialog';

interface BadgeRow {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  criteriaType: string | null;
  criteriaValue: number | null;
  _count: { userBadges: number };
}

interface BadgeForm {
  name: string;
  description: string;
  icon: string;
  criteriaType: string;
  criteriaValue: string;
}

const BADGE_ICONS = [
  '\u{1F3C6}', '\u{1F31F}', '\u{1F525}', '\u{1F4A1}', '\u{1F680}', '\u{1F3AF}', '\u{1F48E}', '\u{1F451}',
  '\u{1F396}\uFE0F', '\u{2B50}', '\u{1F4DA}', '\u{1F9EA}', '\u{1F52C}', '\u{1F9EC}', '\u{1F9E0}', '\u{1F393}',
  '\u{26A1}', '\u{1F4AA}', '\u{1F3C5}', '\u{1FA84}', '\u{2764}\uFE0F', '\u{1F4AB}', '\u{1F308}', '\u{1F332}',
];

const emptyForm: BadgeForm = {
  name: '',
  description: '',
  icon: '\u{1F3C6}',
  criteriaType: 'manual',
  criteriaValue: '',
};

export default function BadgesPage() {
  return <ConfirmProvider><BadgesPageInner /></ConfirmProvider>;
}

function BadgesPageInner() {
  const { confirm: confirmDialog } = useConfirm();
  const { t } = useTranslations();

  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BadgeForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchBadges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lms/badges');
      const data = await res.json();
      const list = data.data ?? data;
      setBadges(Array.isArray(list) ? list : []);
    } catch {
      setBadges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBadges(); }, [fetchBadges]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (badge: BadgeRow) => {
    setEditingId(badge.id);
    setForm({
      name: badge.name,
      description: badge.description ?? '',
      icon: badge.icon || '\u{1F3C6}',
      criteriaType: badge.criteriaType ?? 'manual',
      criteriaValue: badge.criteriaValue != null ? String(badge.criteriaValue) : '',
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSubmitting(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      icon: form.icon,
      criteriaType: form.criteriaType,
      criteriaValue: form.criteriaValue ? parseInt(form.criteriaValue, 10) : null,
    };

    try {
      const url = editingId
        ? `/api/admin/lms/badges?id=${editingId}`
        : '/api/admin/lms/badges';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error || err.message || t(
            editingId
              ? 'admin.lms.badges.updateError'
              : 'admin.lms.badges.createError'
          )
        );
      }

      closeModal();
      fetchBadges();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.lms.badges.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({ title: t('admin.lms.badges.deleteConfirm'), message: t('admin.lms.badges.deleteConfirm'), destructive: true });
    if (!ok) return;
    try {
      await fetch(`/api/admin/lms/badges?id=${id}`, { method: 'DELETE' });
      fetchBadges();
    } catch {
      // silently fail
    }
  };

  const criteriaTypeOptions = [
    { value: 'manual', label: t('admin.lms.badges.criteriaManual') },
    { value: 'course_completion', label: t('admin.lms.badges.criteriaCourseCompletion') },
    { value: 'quiz_score', label: t('admin.lms.badges.criteriaQuizScore') },
    { value: 'streak_days', label: t('admin.lms.badges.criteriaStreakDays') },
    { value: 'courses_completed', label: t('admin.lms.badges.criteriaCoursesCompleted') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.badges.title')}
        subtitle={`${badges.length} ${t('admin.lms.badges.total')}`}
        backHref="/admin/formation"
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />{t('admin.lms.badges.addBadge')}
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse bg-white border border-slate-200 rounded-xl p-5">
              <div className="h-12 w-12 bg-slate-100 rounded-xl mb-3" />
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : badges.length === 0 ? (
        <EmptyState
          icon={Award}
          title={t('admin.lms.badges.noBadges')}
          description={t('admin.lms.badges.noBadgesDesc')}
          action={
            <Button variant="primary" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />{t('admin.lms.badges.addBadge')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {badges.map(badge => (
            <div
              key={badge.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow group relative"
            >
              {/* Actions */}
              <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(badge)}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={t('admin.lms.badges.editBadge')}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(badge.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                  aria-label={t('admin.lms.badges.deleteConfirm')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Icon */}
              <div className="text-4xl mb-3" role="img" aria-label={badge.name}>
                {badge.icon || '\u{1F3C6}'}
              </div>

              {/* Name */}
              <h3 className="font-medium text-slate-900 text-sm">{badge.name}</h3>

              {/* Description */}
              {badge.description && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{badge.description}</p>
              )}

              {/* Criteria tag */}
              {badge.criteriaType && badge.criteriaType !== 'manual' && (
                <span className="inline-flex mt-2 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700">
                  {criteriaTypeOptions.find(o => o.value === badge.criteriaType)?.label ?? badge.criteriaType}
                  {badge.criteriaValue != null && `: ${badge.criteriaValue}`}
                </span>
              )}

              {/* Awarded count */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs text-slate-500 tabular-nums">
                  {badge._count?.userBadges ?? 0} {t('admin.lms.badges.awarded')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? t('admin.lms.badges.editBadge') : t('admin.lms.badges.addBadge')}
        footer={
          <>
            <Button onClick={closeModal}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || !form.name.trim()}
            >
              {submitting ? t('admin.lms.badges.saving') : t('admin.lms.badges.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Icon picker */}
          <FormField label={t('admin.lms.badges.icon')} htmlFor="badgeIcon">
            <div className="grid grid-cols-8 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              {BADGE_ICONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, icon }))}
                  className={`
                    w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all
                    ${form.icon === icon
                      ? 'bg-indigo-100 ring-2 ring-indigo-500 scale-110'
                      : 'hover:bg-white hover:shadow-sm'
                    }
                  `}
                  aria-label={t('admin.lms.badges.selectIcon')}
                >
                  {icon}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label={t('admin.lms.badges.name')} htmlFor="badgeName" required>
            <Input
              id="badgeName"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('admin.lms.badges.namePlaceholder')}
              required
              autoFocus
            />
          </FormField>

          <FormField label={t('admin.lms.badges.description')} htmlFor="badgeDesc">
            <Textarea
              id="badgeDesc"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('admin.lms.badges.descriptionPlaceholder')}
              rows={2}
            />
          </FormField>

          <FormField label={t('admin.lms.badges.criteriaType')} htmlFor="badgeCriteria">
            <select
              id="badgeCriteria"
              value={form.criteriaType}
              onChange={(e) => setForm(prev => ({ ...prev, criteriaType: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900
                bg-white focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-indigo-700"
            >
              {criteriaTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FormField>

          {form.criteriaType !== 'manual' && (
            <FormField
              label={t('admin.lms.badges.criteriaValue')}
              htmlFor="badgeCriteriaVal"
              hint={t('admin.lms.badges.criteriaValueHint')}
            >
              <Input
                id="badgeCriteriaVal"
                type="number"
                min="1"
                value={form.criteriaValue}
                onChange={(e) => setForm(prev => ({ ...prev, criteriaValue: e.target.value }))}
                placeholder={t('admin.lms.badges.criteriaPlaceholder')}
              />
            </FormField>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
