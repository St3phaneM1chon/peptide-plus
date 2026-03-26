'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '@/i18n/client';
import {
  FolderOpen, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
  Video, Loader2, Save, X, GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fetchWithCSRF } from '@/lib/csrf';
import { resolveIcon } from '@/lib/admin/icon-resolver';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  children: VideoCategory[];
  _count: { videos: number; children: number };
}

interface CreateForm {
  name: string;
  description: string;
  icon: string;
  parentId: string;
  sortOrder: number;
  isActive: boolean;
}

const emptyForm: CreateForm = {
  name: '',
  description: '',
  icon: '',
  parentId: '',
  sortOrder: 0,
  isActive: true,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoCategoriesPage() {
  const { t } = useI18n();

  // Data
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / edit form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [updating, setUpdating] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<VideoCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Tree expand/collapse
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Ribbon (no-op, for consistency with other admin pages)
  useRibbonAction('create', useCallback(() => setShowCreateForm(true), []));

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/video-categories');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      const cats: VideoCategory[] = data.categories || [];
      setCategories(cats);
      // Auto-expand all parents that have children
      const ids = new Set<string>();
      const walk = (list: VideoCategory[]) => {
        for (const c of list) {
          if (c.children && c.children.length > 0) {
            ids.add(c.id);
            walk(c.children);
          }
        }
      };
      walk(cats);
      setExpandedIds(prev => {
        const merged = new Set(prev);
        ids.forEach(id => merged.add(id));
        return merged;
      });
    } catch (err) {
      console.error('Failed to load video categories:', err);
      toast.error(t('admin.videoCategories.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // ------------------------------------------------------------------
  // Flat list of all categories for the parentId dropdown
  // ------------------------------------------------------------------

  const flatCategories = useMemo(() => {
    const result: { id: string; name: string; depth: number }[] = [];
    const walk = (list: VideoCategory[], depth: number) => {
      for (const c of list) {
        result.push({ id: c.id, name: c.name, depth });
        if (c.children && c.children.length > 0) {
          walk(c.children, depth + 1);
        }
      }
    };
    walk(categories, 0);
    return result;
  }, [categories]);

  // ------------------------------------------------------------------
  // Toggle expand / collapse
  // ------------------------------------------------------------------

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ------------------------------------------------------------------
  // Create
  // ------------------------------------------------------------------

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.error(t('admin.videoCategories.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        icon: createForm.icon.trim() || undefined,
        parentId: createForm.parentId || undefined,
        sortOrder: createForm.sortOrder,
        isActive: createForm.isActive,
      };
      const res = await fetchWithCSRF('/api/admin/video-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(t('admin.videoCategories.created'));
        setShowCreateForm(false);
        setCreateForm({ ...emptyForm });
        loadCategories();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.videoCategories.createError'));
      }
    } catch (err) {
      console.error('Create error:', err);
      toast.error(t('admin.videoCategories.createError'));
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Inline edit (name + sortOrder)
  // ------------------------------------------------------------------

  const startInlineEdit = useCallback((cat: VideoCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSortOrder(cat.sortOrder);
  }, []);

  const cancelInlineEdit = useCallback(() => {
    setEditingId(null);
    setEditName('');
    setEditSortOrder(0);
  }, []);

  const saveInlineEdit = useCallback(async () => {
    if (!editingId) return;
    if (!editName.trim()) {
      toast.error(t('admin.videoCategories.nameRequired'));
      return;
    }
    setUpdating(true);
    try {
      const res = await fetchWithCSRF(`/api/admin/video-categories/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), sortOrder: editSortOrder }),
      });
      if (res.ok) {
        toast.success(t('admin.videoCategories.updated'));
        cancelInlineEdit();
        loadCategories();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.videoCategories.updateError'));
      }
    } catch (err) {
      console.error('Update error:', err);
      toast.error(t('admin.videoCategories.updateError'));
    } finally {
      setUpdating(false);
    }
  }, [editingId, editName, editSortOrder, t, cancelInlineEdit, loadCategories]);

  // ------------------------------------------------------------------
  // Toggle active
  // ------------------------------------------------------------------

  const toggleActive = useCallback(async (cat: VideoCategory) => {
    try {
      const res = await fetchWithCSRF(`/api/admin/video-categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      if (res.ok) {
        loadCategories();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.videoCategories.updateError'));
      }
    } catch {
      toast.error(t('admin.videoCategories.updateError'));
    }
  }, [t, loadCategories]);

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetchWithCSRF(`/api/admin/video-categories/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(t('admin.videoCategories.deleted'));
        loadCategories();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.videoCategories.deleteError'));
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(t('admin.videoCategories.deleteError'));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, t, loadCategories]);

  // ------------------------------------------------------------------
  // Total video count helper
  // ------------------------------------------------------------------

  const getTotalVideoCount = useCallback((cat: VideoCategory): number => {
    let count = cat._count.videos;
    if (cat.children) {
      for (const child of cat.children) {
        count += getTotalVideoCount(child);
      }
    }
    return count;
  }, []);

  // ------------------------------------------------------------------
  // Tree rendering
  // ------------------------------------------------------------------

  const renderCategoryNode = (cat: VideoCategory, depth: number) => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = expandedIds.has(cat.id);
    const isEditing = editingId === cat.id;
    const totalVideos = getTotalVideoCount(cat);

    return (
      <div key={cat.id}>
        {/* Category row */}
        <div
          className={`flex items-center gap-2 px-4 py-3 border-b border-slate-100 hover:bg-white/5 transition-colors ${
            !cat.isActive ? 'opacity-60' : ''
          }`}
          style={{ paddingLeft: `${16 + depth * 28}px` }}
        >
          {/* Expand/collapse toggle */}
          <button
            onClick={() => hasChildren && toggleExpand(cat.id)}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              hasChildren ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-200 cursor-pointer' : 'text-transparent cursor-default'
            }`}
            disabled={!hasChildren}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {hasChildren && (
              isExpanded
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {/* Drag handle (visual only) */}
          <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />

          {/* Icon / folder */}
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            {cat.icon ? (
              (() => { const Icon = resolveIcon(cat.icon); return <Icon className="w-4 h-4 text-slate-600" />; })()
            ) : (
              <FolderOpen className="w-4 h-4 text-slate-400" />
            )}
          </div>

          {/* Name (inline edit or display) */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="border border-indigo-300 rounded px-2 py-1 text-sm flex-1 min-w-0 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveInlineEdit();
                    if (e.key === 'Escape') cancelInlineEdit();
                  }}
                  autoFocus
                />
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <span>{t('admin.videoCategories.sortOrder')}:</span>
                  <input
                    type="number"
                    className="border border-slate-300 rounded px-2 py-1 text-sm w-16 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    value={editSortOrder}
                    onChange={e => setEditSortOrder(parseInt(e.target.value) || 0)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveInlineEdit();
                      if (e.key === 'Escape') cancelInlineEdit();
                    }}
                  />
                </label>
                <button
                  onClick={saveInlineEdit}
                  disabled={updating}
                  className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                  title={t('common.save')}
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </button>
                <button
                  onClick={cancelInlineEdit}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                  title={t('common.cancel')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <p className="font-medium text-[var(--k-text-primary)] truncate">{cat.name}</p>
                {cat.description && (
                  <p className="text-xs text-slate-500 truncate">{cat.description}</p>
                )}
              </div>
            )}
          </div>

          {/* Video count badge */}
          {!isEditing && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg flex-shrink-0" title={`${totalVideos} ${t('admin.videoCategories.videos')}`}>
              <Video className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-semibold text-slate-700">{totalVideos}</span>
            </div>
          )}

          {/* Sort order badge */}
          {!isEditing && (
            <span className="text-xs text-slate-400 w-8 text-center flex-shrink-0" title={t('admin.videoCategories.sortOrder')}>
              #{cat.sortOrder}
            </span>
          )}

          {/* Active toggle */}
          {!isEditing && (
            <button
              onClick={() => toggleActive(cat)}
              className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                cat.isActive ? 'bg-green-500' : 'bg-slate-300'
              }`}
              title={cat.isActive ? (t('admin.videoCategories.active')) : (t('admin.videoCategories.inactive'))}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-[var(--k-glass-thin)] rounded-full shadow transition-transform ${
                  cat.isActive ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => startInlineEdit(cat)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                title={t('admin.videoCategories.edit')}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleteTarget(cat)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title={t('admin.videoCategories.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Children (recursive) */}
        {hasChildren && isExpanded && (
          <div>
            {cat.children.map(child => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="p-6 max-w-5xl space-y-4">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-indigo-600 transition-colors">
          {t('admin.nav.dashboard')}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/media" className="hover:text-indigo-600 transition-colors">
          {t('admin.nav.media')}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-700 font-medium">
          {t('admin.videoCategories.title')}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--k-text-primary)]">
            {t('admin.videoCategories.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('admin.videoCategories.subtitle')}
          </p>
        </div>
        <button
          onClick={() => { setCreateForm({ ...emptyForm }); setShowCreateForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('admin.videoCategories.create')}
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-slate-700">
              {t('admin.videoCategories.create')}
            </h2>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              placeholder={t('admin.videoCategories.namePlaceholder')}
              value={createForm.name}
              onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
            <select
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              value={createForm.parentId}
              onChange={e => setCreateForm({ ...createForm, parentId: e.target.value })}
            >
              <option value="">{t('admin.videoCategories.noParent')}</option>
              {flatCategories.map(fc => (
                <option key={fc.id} value={fc.id}>
                  {'  '.repeat(fc.depth)}{fc.name}
                </option>
              ))}
            </select>
            <input
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              placeholder={t('admin.videoCategories.iconPlaceholder')}
              value={createForm.icon}
              onChange={e => setCreateForm({ ...createForm, icon: e.target.value })}
            />
            <input
              type="number"
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              placeholder={t('admin.videoCategories.sortOrderPlaceholder')}
              value={createForm.sortOrder}
              onChange={e => setCreateForm({ ...createForm, sortOrder: parseInt(e.target.value) || 0 })}
            />
          </div>
          <textarea
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            placeholder={t('admin.videoCategories.descriptionPlaceholder')}
            rows={2}
            value={createForm.description}
            onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createForm.isActive}
                onChange={e => setCreateForm({ ...createForm, isActive: e.target.checked })}
              />
              {t('admin.videoCategories.active')}
            </label>
            <div className="ms-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-2 text-slate-600 border border-slate-300 rounded text-sm hover:bg-white/5"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('admin.videoCategories.create')}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Category tree */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)]">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-1">
            {t('admin.videoCategories.empty')}
          </p>
          <p className="text-sm text-slate-400 mb-4">
            {t('admin.videoCategories.emptyHint')}
          </p>
          <button
            onClick={() => { setCreateForm({ ...emptyForm }); setShowCreateForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            {t('admin.videoCategories.create')}
          </button>
        </div>
      ) : (
        <div className="bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border-b border-[var(--k-border-subtle)] text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span className="w-5" /> {/* expand toggle spacer */}
            <span className="w-4" /> {/* grip spacer */}
            <span className="w-8" /> {/* icon spacer */}
            <span className="flex-1">{t('admin.videoCategories.columnName')}</span>
            <span className="w-16 text-center">{t('admin.videoCategories.columnVideos')}</span>
            <span className="w-8 text-center">{t('admin.videoCategories.columnOrder')}</span>
            <span className="w-10 text-center">{t('admin.videoCategories.columnStatus')}</span>
            <span className="w-20 text-center">{t('admin.videoCategories.columnActions')}</span>
          </div>
          {/* Tree body */}
          {categories.map(cat => renderCategoryNode(cat, 0))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('admin.videoCategories.deleteTitle')}
        message={
          deleteTarget
            ? `${t('admin.videoCategories.deleteMessage')} "${deleteTarget.name}"? ${
                deleteTarget._count.videos > 0
                  ? `${t('admin.videoCategories.hasVideos')} ${deleteTarget._count.videos} ${t('admin.videoCategories.videos')}.`
                  : ''
              } ${deleteTarget._count.children > 0
                ? `${t('admin.videoCategories.hasChildren')} ${deleteTarget._count.children} ${t('admin.videoCategories.subcategories')}.`
                : ''
              } ${t('admin.videoCategories.deleteWarning')}`
            : ''
        }
        confirmLabel={deleting ? '...' : (t('common.delete'))}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
}
