/**
 * ADMIN - GESTION DES CATEGORIES & SOUS-CATEGORIES
 * Supports: create/edit/delete categories and subcategories
 * Tree view with parent-child hierarchy
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  FolderOpen,
  Check,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  DataTable,
  FormField,
  Input,
  Textarea,
  type Column,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  parent?: { id: string; name: string; slug: string } | null;
  children?: Category[];
  _count: { products: number };
}

interface FormData {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  parentId: string;
}

export default function CategoriesPage() {
  const { t, locale } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ name: '', slug: '', description: '', imageUrl: '', sortOrder: 0, parentId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch categories
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories?includeInactive=true');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
    setLoading(false);
  };

  // Get parent categories (no parentId) for the dropdown
  const parentOptions = useMemo(() => {
    return categories.filter(c => !c.parentId);
  }, [categories]);

  // Build flat list ordered as tree: parent, then children indented
  const treeCategories = useMemo(() => {
    const parents = categories.filter(c => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    const result: (Category & { isChild: boolean; childCount: number })[] = [];

    for (const parent of parents) {
      const children = categories
        .filter(c => c.parentId === parent.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const childProductCount = children.reduce((sum, c) => sum + c._count.products, 0);
      result.push({
        ...parent,
        isChild: false,
        childCount: children.length,
        _count: { products: parent._count.products + childProductCount },
      });
      for (const child of children) {
        result.push({ ...child, isChild: true, childCount: 0 });
      }
    }

    // Also include orphans (categories with parentId pointing to missing parent)
    const allIds = new Set(categories.map(c => c.id));
    const orphans = categories.filter(c => c.parentId && !allIds.has(c.parentId));
    for (const orphan of orphans) {
      result.push({ ...orphan, isChild: false, childCount: 0 });
    }

    return result;
  }, [categories]);

  // Generate slug
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const url = editingId ? `/api/categories/${editingId}` : '/api/categories';
      const method = editingId ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        parentId: formData.parentId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('admin.categories.error'));
        setSaving(false);
        return;
      }

      await fetchCategories();
      resetForm();
    } catch {
      setError(t('admin.categories.connectionError'));
    }
    setSaving(false);
  };

  const resetForm = () => {
    setFormData({ name: '', slug: '', description: '', imageUrl: '', sortOrder: 0, parentId: '' });
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const startEdit = (cat: Category) => {
    setFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      imageUrl: cat.imageUrl || '',
      sortOrder: cat.sortOrder,
      parentId: cat.parentId || '',
    });
    setEditingId(cat.id);
    setShowForm(true);
  };

  const startCreateChild = (parentId: string) => {
    resetForm();
    setFormData(prev => ({ ...prev, parentId }));
    setShowForm(true);
  };

  const toggleActive = async (catId: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/categories/${catId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      await fetchCategories();
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const handleDelete = async (catId: string) => {
    try {
      const res = await fetch(`/api/categories/${catId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la suppression');
        return;
      }
      await fetchCategories();
    } catch (err) {
      console.error('Error deleting:', err);
    }
    setDeleteConfirm(null);
  };

  // Table columns
  const columns: Column<(typeof treeCategories)[number]>[] = useMemo(() => [
    {
      key: 'name',
      header: t('admin.categories.colCategory'),
      render: (cat) => (
        <div className={`flex items-center gap-3 ${cat.isChild ? 'ms-8' : ''}`}>
          {cat.isChild && (
            <ChevronRight className="w-4 h-4 text-slate-300 -ms-6" />
          )}
          <div
            className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center bg-cover bg-center flex-shrink-0"
            style={cat.imageUrl ? { backgroundImage: `url(${cat.imageUrl})` } : undefined}
          >
            {!cat.imageUrl && <FolderOpen className="w-5 h-5 text-slate-400" />}
          </div>
          <div>
            <p className={`font-semibold text-slate-900 ${!cat.isChild ? 'text-base' : 'text-sm'}`}>
              {cat.name}
            </p>
            <p className="text-xs text-slate-500">/{cat.slug}</p>
          </div>
          {!cat.isChild && cat.childCount > 0 && (
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              {cat.childCount} sub
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'products',
      header: t('admin.categories.colProducts'),
      align: 'center',
      width: '100px',
      render: (cat) => (
        <span className="font-semibold text-slate-700">{cat._count.products}</span>
      ),
    },
    {
      key: 'sortOrder',
      header: t('admin.categories.colOrder'),
      align: 'center',
      width: '80px',
      render: (cat) => (
        <span className="text-slate-500">{cat.sortOrder}</span>
      ),
    },
    {
      key: 'isActive',
      header: t('admin.categories.colActive'),
      align: 'center',
      width: '80px',
      render: (cat) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleActive(cat.id, cat.isActive); }}
          className={`
            w-7 h-7 rounded-md flex items-center justify-center transition-colors
            ${cat.isActive
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-slate-200 text-slate-400 hover:bg-slate-300'}
          `}
        >
          {cat.isActive && <Check className="w-4 h-4" />}
        </button>
      ),
    },
    {
      key: 'actions',
      header: t('admin.categories.colActions'),
      align: 'center',
      width: '180px',
      render: (cat) => (
        <div className="flex items-center gap-1 justify-center">
          {/* Add subcategory (only for parent categories) */}
          {!cat.isChild && (
            <Button
              variant="ghost"
              size="sm"
              icon={Plus}
              onClick={(e) => { e.stopPropagation(); startCreateChild(cat.id); }}
            >
              Sub
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={Pencil}
            onClick={(e) => { e.stopPropagation(); startEdit(cat); }}
          >
            {t('admin.categories.edit')}
          </Button>
          {cat._count.products === 0 && cat.childCount === 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(cat.id); }}
              className="text-red-500 hover:text-red-700"
            >
            </Button>
          )}
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [locale, treeCategories]);

  return (
    <>
      <PageHeader
        title={t('admin.categories.title')}
        subtitle={t('admin.categories.subtitle')}
        backHref="/admin/produits"
        backLabel={t('admin.categories.backToProducts')}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={Plus}
              onClick={() => { resetForm(); setShowForm(true); }}
            >
              {t('admin.categories.newCategory') || 'New Category'}
            </Button>
          </div>
        }
      />

      {/* Error Banner */}
      {error && !showForm && (
        <div className="mx-6 mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">
          {error}
          <button onClick={() => setError('')} className="ms-2 font-bold">×</button>
        </div>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={resetForm}
        title={editingId
          ? t('admin.categories.editCategory')
          : formData.parentId
            ? (t('admin.categories.newSubcategory') || 'New Subcategory')
            : t('admin.categories.newCategory')
        }
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={resetForm}>
              {t('admin.categories.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={() => {
                const form = document.getElementById('category-form') as HTMLFormElement;
                form?.requestSubmit();
              }}
            >
              {saving ? t('admin.categories.saving') : editingId ? t('admin.categories.save') : t('admin.categories.create')}
            </Button>
          </>
        }
      >
        {error && showForm && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg mb-4 text-sm border border-red-200">
            {error}
          </div>
        )}

        <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Parent Category Selector */}
          <FormField label={t('admin.categories.fieldParent') || 'Parent Category'}>
            <select
              value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="">{t('admin.categories.noParent') || '— None (Parent Category) —'}</option>
              {parentOptions
                .filter(p => p.id !== editingId) // Don't allow setting self as parent
                .map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))
              }
            </select>
          </FormField>

          <FormField label={t('admin.categories.fieldName')} required>
            <Input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({
                ...formData,
                name: e.target.value,
                slug: !editingId ? generateSlug(e.target.value) : formData.slug,
              })}
              placeholder={t('admin.categories.fieldNamePlaceholder')}
            />
          </FormField>

          <FormField label={t('admin.categories.fieldSlug')} required>
            <Input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder={t('admin.categories.fieldSlugPlaceholder')}
            />
          </FormField>

          <FormField label={t('admin.categories.fieldDescription')}>
            <Textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('admin.categories.fieldDescriptionPlaceholder')}
            />
          </FormField>

          <div className="grid grid-cols-[2fr_1fr] gap-4">
            <FormField label={t('admin.categories.fieldImageUrl')}>
              <Input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://..."
              />
            </FormField>
            <FormField label={t('admin.categories.fieldSortOrder')}>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={t('admin.categories.deleteConfirmTitle') || 'Delete Category'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              {t('admin.categories.cancel')}
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              {t('admin.categories.confirmDelete') || 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {t('admin.categories.deleteConfirmMessage') || 'Are you sure you want to delete this category? This action cannot be undone.'}
        </p>
      </Modal>

      {/* Categories Table (tree view) */}
      <DataTable<(typeof treeCategories)[number]>
        columns={columns}
        data={treeCategories}
        keyExtractor={(cat) => cat.id}
        loading={loading}
        emptyTitle={t('admin.categories.emptyTitle')}
        emptyDescription={t('admin.categories.emptyDescription')}
        emptyAction={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => { resetForm(); setShowForm(true); }}
          >
            {t('admin.categories.newCategory')}
          </Button>
        }
      />
    </>
  );
}
