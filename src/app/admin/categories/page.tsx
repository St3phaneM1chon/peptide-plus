/**
 * ADMIN - GESTION DES CATEGORIES & SOUS-CATEGORIES
 * Supports: create/edit/delete categories and subcategories
 * Tree view with parent-child hierarchy
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Pencil,
  FolderOpen,
  Check,
  ChevronRight,
  Trash2,
  AlertTriangle, // BUG-057: Icon for orphan warning / fix button
  ArrowUp,
  ArrowDown,
  FileDown,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  DataTable,
  FormField,
  Input,
  Textarea,
  MediaUploader,
  type Column,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [reordering, setReordering] = useState<string | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  // Get parent categories (no parentId) for the dropdown
  const parentOptions = useMemo(() => {
    return categories.filter(c => !c.parentId);
  }, [categories]);

  // Build flat list ordered as tree: parent, then children indented
  const treeCategories = useMemo(() => {
    const parents = categories.filter(c => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    const result: (Category & { isChild: boolean; childCount: number; isOrphan: boolean })[] = [];

    for (const parent of parents) {
      const children = categories
        .filter(c => c.parentId === parent.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const childProductCount = children.reduce((sum, c) => sum + c._count.products, 0);
      result.push({
        ...parent,
        isChild: false,
        childCount: children.length,
        isOrphan: false,
        _count: { products: parent._count.products + childProductCount },
      });
      for (const child of children) {
        result.push({ ...child, isChild: true, childCount: 0, isOrphan: false });
      }
    }

    // Also include orphans (categories with parentId pointing to missing parent)
    // BUG-057 FIX: Flag orphans so the UI can render a corrective action button
    const allIds = new Set(categories.map(c => c.id));
    const orphans = categories.filter(c => c.parentId && !allIds.has(c.parentId));
    for (const orphan of orphans) {
      result.push({ ...orphan, isChild: false, childCount: 0, isOrphan: true });
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
        const msg = data.error || t('admin.categories.error');
        setError(msg);
        toast.error(msg);
        return;
      }

      await fetchCategories();
      toast.success(editingId
        ? (t('admin.categories.updated') || 'Category updated')
        : (t('admin.categories.created') || 'Category created'));
      resetForm();
    } catch {
      const msg = t('admin.categories.connectionError');
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = useCallback(() => {
    setFormData({ name: '', slug: '', description: '', imageUrl: '', sortOrder: 0, parentId: '' });
    setEditingId(null);
    setShowForm(false);
    setError('');
  }, []);

  const startEdit = useCallback((cat: Category) => {
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
  }, []);

  const startCreateChild = useCallback((parentId: string) => {
    resetForm();
    setFormData(prev => ({ ...prev, parentId }));
    setShowForm(true);
  }, [resetForm]);

  // BUG-057 FIX: Set orphan category as root by clearing its parentId
  const fixOrphan = useCallback(async (catId: string) => {
    try {
      const res = await fetch(`/api/categories/${catId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
        return;
      }
      await fetchCategories();
      toast.success(t('admin.categories.orphanFixed') || 'Category set as root category');
    } catch (err) {
      console.error('Error fixing orphan:', err);
      toast.error(t('common.networkError'));
    }
  }, [t]);

  const toggleActive = useCallback(async (catId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/categories/${catId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
        return;
      }
      await fetchCategories();
    } catch (err) {
      console.error('Error toggling status:', err);
      toast.error(t('common.networkError'));
    }
  }, [t]);

  const handleDelete = async (catId: string) => {
    setDeletingId(catId);
    try {
      const res = await fetch(`/api/categories/${catId}`, { method: 'DELETE' });
      // BUG-007 FIX: 204 No Content has no body; only parse JSON for non-204 responses
      if (res.status === 204) {
        // Success with no body
        await fetchCategories();
        toast.success(t('admin.categories.deleted') || 'Category deleted');
      } else if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || t('common.deleteFailed');
        setError(msg);
        toast.error(msg);
        return;
      } else {
        await fetchCategories();
        toast.success(t('admin.categories.deleted') || 'Category deleted');
      }
    } catch (err) {
      console.error('Error deleting:', err);
      toast.error(t('common.networkError'));
    } finally {
      setDeletingId(null);
    }
    setDeleteConfirm(null);
  };

  // ─── Ribbon Actions ────────────────────────────────────────

  const handleNewCategory = useCallback(() => {
    resetForm();
    setShowForm(true);
  }, [resetForm]);

  const handleNewSubcategory = useCallback(() => {
    // If there are parent categories, default to the first one; otherwise ask user to create a parent first
    if (parentOptions.length === 0) {
      toast.info(t('admin.categories.createParentFirst') || 'Create a parent category first');
      return;
    }
    resetForm();
    setFormData(prev => ({ ...prev, parentId: parentOptions[0].id }));
    setShowForm(true);
  }, [parentOptions, resetForm, t]);

  const handleRibbonDelete = useCallback(() => {
    toast.info(t('admin.categories.selectToDelete') || 'Use the delete button in each row to delete a category');
  }, [t]);

  const handleVisitStats = useCallback(() => {
    // Show a quick summary of category stats
    const totalProducts = categories.reduce((sum, c) => sum + c._count.products, 0);
    const activeCount = categories.filter(c => c.isActive).length;
    const parentCount = categories.filter(c => !c.parentId).length;
    const childCount = categories.filter(c => c.parentId).length;
    toast.info(
      `${categories.length} ${t('admin.categories.title') || 'categories'}: ${parentCount} ${t('admin.categories.parents') || 'parents'}, ${childCount} ${t('admin.categories.children') || 'children'}, ${activeCount} ${t('admin.categories.colActive') || 'active'}, ${totalProducts} ${t('admin.categories.colProducts') || 'products'}`
    );
  }, [categories, t]);

  const handleReorganize = useCallback(() => {
    setReorderMode(prev => !prev);
    if (!reorderMode) {
      toast.info(t('admin.categories.reorderModeOn') || 'Use the arrows to reorder categories');
    } else {
      toast.success(t('admin.categories.reorderModeSaved') || 'Reorder mode off');
    }
  }, [reorderMode, t]);

  const handleMoveCategory = useCallback(async (catId: string, direction: 'up' | 'down') => {
    // Find the category and its siblings (same parentId group)
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;

    const siblings = categories
      .filter(c => c.parentId === cat.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const idx = siblings.findIndex(c => c.id === catId);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === siblings.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const swapCat = siblings[swapIdx];

    setReordering(catId);
    try {
      // Swap sort orders
      await Promise.all([
        fetch(`/api/categories/${catId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: swapCat.sortOrder }),
        }),
        fetch(`/api/categories/${swapCat.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: cat.sortOrder }),
        }),
      ]);
      await fetchCategories();
    } catch (err) {
      console.error('Error reordering:', err);
      toast.error(t('common.networkError'));
    }
    setReordering(null);
  }, [categories, t]);

  const handleExport = useCallback(() => {
    // Generate CSV of categories in-browser
    const headers = ['ID', 'Name', 'Slug', 'Parent', 'Sort Order', 'Active', 'Products'];
    const rows = treeCategories.map(cat => [
      cat.id,
      `"${cat.name.replace(/"/g, '""')}"`,
      cat.slug,
      cat.parentId ? `"${(categories.find(c => c.id === cat.parentId)?.name || '').replace(/"/g, '""')}"` : '',
      cat.sortOrder,
      cat.isActive ? 'Yes' : 'No',
      cat._count.products,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `categories-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success(t('admin.categories.exportSuccess') || 'Categories exported');
  }, [treeCategories, categories, t]);

  useRibbonAction('newCategory', handleNewCategory);
  useRibbonAction('newSubcategory', handleNewSubcategory);
  useRibbonAction('delete', handleRibbonDelete);
  useRibbonAction('visitStats', handleVisitStats);
  useRibbonAction('reorganize', handleReorganize);
  useRibbonAction('export', handleExport);

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
          {/* BUG-057 FIX: Show orphan warning badge */}
          {cat.isOrphan && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {t('admin.categories.orphan') || 'Orphan'}
            </span>
          )}
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
      width: reorderMode ? '140px' : '80px',
      render: (cat) => (
        <div className="flex items-center justify-center gap-1">
          {reorderMode && (
            <button
              onClick={(e) => { e.stopPropagation(); handleMoveCategory(cat.id, 'up'); }}
              disabled={reordering === cat.id}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
              title={t('admin.categories.moveUp') || 'Move up'}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-slate-500 min-w-[2rem] text-center">{cat.sortOrder}</span>
          {reorderMode && (
            <button
              onClick={(e) => { e.stopPropagation(); handleMoveCategory(cat.id, 'down'); }}
              disabled={reordering === cat.id}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
              title={t('admin.categories.moveDown') || 'Move down'}
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
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
          {/* BUG-057 FIX: Show "Fix: Set as root" button for orphan categories */}
          {cat.isOrphan && (
            <Button
              variant="ghost"
              size="sm"
              icon={AlertTriangle}
              onClick={(e) => { e.stopPropagation(); fixOrphan(cat.id); }}
              className="text-amber-600 hover:text-amber-700"
            >
              {t('admin.categories.fixOrphan') || 'Set as root'}
            </Button>
          )}
          {/* Add subcategory (only for parent categories) */}
          {!cat.isChild && !cat.isOrphan && (
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
  ], [locale, treeCategories, t, toggleActive, startEdit, startCreateChild, fixOrphan, reorderMode, reordering, handleMoveCategory]);

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
              variant="ghost"
              icon={FileDown}
              onClick={handleExport}
              size="sm"
            >
              {t('admin.categories.exportBtn') || 'Export'}
            </Button>
            <Button
              variant={reorderMode ? 'primary' : 'secondary'}
              icon={reorderMode ? Check : ArrowUp}
              onClick={handleReorganize}
              size="sm"
            >
              {reorderMode
                ? (t('admin.categories.reorderDone') || 'Done')
                : (t('admin.categories.reorder') || 'Reorder')}
            </Button>
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
              <MediaUploader
                value={formData.imageUrl}
                onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                context="category"
                previewSize="sm"
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
              disabled={!!deletingId}
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
