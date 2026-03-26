'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, Button, DataTable, EmptyState, Modal, FormField, Input, type Column } from '@/components/admin';
import { Plus, FolderTree } from 'lucide-react';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  _count: { courses: number; children: number };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CategoriesPage() {
  const { t } = useTranslations();

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManual && newName) {
      setNewSlug(slugify(newName));
    }
  }, [newName, slugManual]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lms/categories');
      const data = await res.json();
      const list = data.data ?? data;
      setCategories(Array.isArray(list) ? list : []);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/admin/lms/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || t('admin.lms.categoryCreateError'));
      }

      setModalOpen(false);
      setNewName('');
      setNewSlug('');
      setSlugManual(false);
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.lms.categoryCreateError'));
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<CategoryRow>[] = [
    {
      key: 'name',
      header: t('admin.lms.categoryName'),
      render: (row) => <span className="font-medium text-[var(--k-text-primary)]">{row.name}</span>,
    },
    {
      key: 'slug',
      header: t('admin.lms.categorySlug'),
      render: (row) => (
        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">{row.slug}</code>
      ),
    },
    {
      key: 'courses',
      header: t('admin.lms.coursesCount'),
      render: (row) => String(row._count.courses),
    },
    {
      key: 'sortOrder',
      header: t('admin.lms.sortOrder'),
      render: (row) => String(row.sortOrder),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.categories')}
        subtitle={`${categories.length} ${t('admin.lms.categoriesTotal')}`}
        backHref="/admin/formation"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />{t('admin.lms.newCategory')}
          </Button>
        }
      />

      {!loading && categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title={t('admin.lms.noLmsCategories')}
          description={t('admin.lms.noLmsCategoriesDesc')}
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />{t('admin.lms.newCategory')}
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={categories}
          keyExtractor={(c) => c.id}
          loading={loading}
          emptyTitle={t('admin.lms.noLmsCategories')}
        />
      )}

      {/* Create Category Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setNewName('');
          setNewSlug('');
          setSlugManual(false);
          setError('');
        }}
        title={t('admin.lms.newCategory')}
        footer={
          <>
            <Button type="button" onClick={() => setModalOpen(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={submitting || !newName.trim()}
            >
              {submitting ? t('admin.lms.creatingCategory') : t('admin.lms.createCategory')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label={t('admin.lms.categoryName')} htmlFor="catName" required>
            <Input
              id="catName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('admin.lms.categoryName')}
              required
              autoFocus
            />
          </FormField>

          <FormField label={t('admin.lms.categorySlug')} htmlFor="catSlug" required hint={t('admin.lms.slugHint')}>
            <Input
              id="catSlug"
              value={newSlug}
              onChange={(e) => {
                setNewSlug(e.target.value);
                setSlugManual(true);
              }}
              placeholder="ma-categorie"
              required
              pattern="^[a-z0-9-]+$"
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
