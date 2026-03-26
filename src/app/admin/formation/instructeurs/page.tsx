'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, Button, DataTable, EmptyState, Modal, FormField, Input, Textarea, StatusBadge, type Column } from '@/components/admin';
import { Plus, GraduationCap, Pencil, Trash2 } from 'lucide-react';
import { ConfirmProvider, useConfirm } from '@/components/lms/ConfirmDialog';

interface InstructorRow {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
  specializations: string[];
  isActive: boolean;
  _count: { courses: number };
}

interface InstructorForm {
  name: string;
  title: string;
  bio: string;
  avatarUrl: string;
  specializations: string;
}

const emptyForm: InstructorForm = {
  name: '',
  title: '',
  bio: '',
  avatarUrl: '',
  specializations: '',
};

export default function InstructorsPage() {
  return <ConfirmProvider><InstructorsPageInner /></ConfirmProvider>;
}
function InstructorsPageInner() {
  const { confirm: confirmDialog } = useConfirm();
  const { t } = useTranslations();

  const [instructors, setInstructors] = useState<InstructorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InstructorForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lms/instructors');
      const data = await res.json();
      const list = data.data ?? data;
      setInstructors(Array.isArray(list) ? list : []);
    } catch {
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInstructors(); }, [fetchInstructors]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (row: InstructorRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      title: row.title ?? '',
      bio: row.bio ?? '',
      avatarUrl: row.avatarUrl ?? '',
      specializations: (row.specializations ?? []).join(', '),
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
      title: form.title.trim() || null,
      bio: form.bio.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
      specializations: form.specializations
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    };

    try {
      const url = editingId
        ? `/api/admin/lms/instructors?id=${editingId}`
        : '/api/admin/lms/instructors';
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
              ? 'admin.lms.instructors.updateError'
              : 'admin.lms.instructors.createError'
          )
        );
      }

      closeModal();
      fetchInstructors();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.lms.instructors.createError')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({ title: t('admin.lms.instructors.deleteConfirm'), message: t('admin.lms.instructors.deleteConfirm'), destructive: true });
    if (!ok) return;
    try {
      await fetch(`/api/admin/lms/instructors?id=${id}`, { method: 'DELETE' });
      fetchInstructors();
    } catch {
      // silently fail
    }
  };

  const columns: Column<InstructorRow>[] = [
    {
      key: 'avatar',
      header: '',
      width: '48px',
      render: (row) => (
        <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">
          {row.avatarUrl ? (
            <img
              src={row.avatarUrl}
              alt={row.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <GraduationCap className="w-4 h-4 text-slate-400" />
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: t('admin.lms.instructors.name'),
      render: (row) => (
        <div>
          <span className="font-medium text-[var(--k-text-primary)]">{row.name}</span>
          {row.title && (
            <p className="text-xs text-slate-500 mt-0.5">{row.title}</p>
          )}
        </div>
      ),
    },
    {
      key: 'bio',
      header: t('admin.lms.instructors.bio'),
      render: (row) => (
        <span className="text-sm text-slate-600 line-clamp-2 max-w-xs">
          {row.bio || '—'}
        </span>
      ),
    },
    {
      key: 'specializations',
      header: t('admin.lms.instructors.specializations'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.specializations ?? []).length > 0 ? (
            row.specializations.slice(0, 3).map((s, i) => (
              <span
                key={i}
                className="inline-flex px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700"
              >
                {s}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )}
          {(row.specializations ?? []).length > 3 && (
            <span className="text-xs text-slate-400">
              +{row.specializations.length - 3}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'courses',
      header: t('admin.lms.instructors.courseCount'),
      align: 'center',
      render: (row) => (
        <span className="text-sm text-slate-700 tabular-nums">
          {row._count?.courses ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <StatusBadge variant={row.isActive !== false ? 'success' : 'neutral'}>
          {row.isActive !== false
            ? t('admin.lms.instructors.statusActive')
            : t('admin.lms.instructors.statusInactive')}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      align: 'right',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(row); }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={t('admin.lms.instructors.editInstructor')}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
            className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
            aria-label={t('admin.lms.instructors.deleteConfirm')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.instructors.title')}
        subtitle={`${instructors.length} ${t('admin.lms.instructors.total')}`}
        backHref="/admin/formation"
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />{t('admin.lms.instructors.addInstructor')}
          </Button>
        }
      />

      {!loading && instructors.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={t('admin.lms.instructors.noInstructors')}
          description={t('admin.lms.instructors.noInstructorsDesc')}
          action={
            <Button variant="primary" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />{t('admin.lms.instructors.addInstructor')}
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={instructors}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyTitle={t('admin.lms.instructors.noInstructors')}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? t('admin.lms.instructors.editInstructor') : t('admin.lms.instructors.addInstructor')}
        size="lg"
        footer={
          <>
            <Button onClick={closeModal}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || !form.name.trim()}
            >
              {submitting ? t('admin.lms.instructors.saving') : t('admin.lms.instructors.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label={t('admin.lms.instructors.name')} htmlFor="instrName" required>
            <Input
              id="instrName"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('admin.lms.instructors.namePlaceholder')}
              required
              autoFocus
            />
          </FormField>

          <FormField label={t('admin.lms.instructors.jobTitle')} htmlFor="instrTitle">
            <Input
              id="instrTitle"
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder={t('admin.lms.instructors.titlePlaceholder')}
            />
          </FormField>

          <FormField label={t('admin.lms.instructors.bio')} htmlFor="instrBio">
            <Textarea
              id="instrBio"
              value={form.bio}
              onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))}
              placeholder={t('admin.lms.instructors.bioPlaceholder')}
              rows={3}
            />
          </FormField>

          <FormField label={t('admin.lms.instructors.avatarUrl')} htmlFor="instrAvatar">
            <Input
              id="instrAvatar"
              type="url"
              value={form.avatarUrl}
              onChange={(e) => setForm(prev => ({ ...prev, avatarUrl: e.target.value }))}
              placeholder={t('admin.lms.instructors.avatarPlaceholder')}
            />
          </FormField>

          <FormField
            label={t('admin.lms.instructors.specializations')}
            htmlFor="instrSpec"
            hint={t('admin.lms.instructors.specializationsHint')}
          >
            <Input
              id="instrSpec"
              value={form.specializations}
              onChange={(e) => setForm(prev => ({ ...prev, specializations: e.target.value }))}
              placeholder={t('admin.lms.instructors.specializationsPlaceholder')}
            />
          </FormField>

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
