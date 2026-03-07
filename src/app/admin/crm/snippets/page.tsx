'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { FileText, Plus, Search, Edit, Trash2, X, Copy } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Snippet {
  id: string;
  title: string;
  content: string;
  category: string;
  shortcut: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy?: { id: string; name: string | null; email: string };
}

interface SnippetForm {
  title: string;
  content: string;
  category: string;
  shortcut: string;
  isActive: boolean;
}

const CATEGORIES = ['general', 'email', 'sms', 'chat'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-gray-100 text-gray-700',
  email: 'bg-teal-100 text-teal-700',
  sms: 'bg-green-100 text-green-700',
  chat: 'bg-purple-100 text-purple-700',
};

const emptyForm: SnippetForm = {
  title: '',
  content: '',
  category: 'general',
  shortcut: '',
  isActive: true,
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SnippetsPage() {
  const { t } = useI18n();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SnippetForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Fetch snippets
  // -------------------------------------------------------------------------

  const fetchSnippets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);

      const res = await fetch(`/api/admin/crm/snippets?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setSnippets(json.data || []);
      }
    } catch {
      toast.error(t('admin.crm.snippets.loadError') || 'Failed to load snippets');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, t]);

  useEffect(() => {
    fetchSnippets();
  }, [fetchSnippets]);

  // -------------------------------------------------------------------------
  // Create / Edit
  // -------------------------------------------------------------------------

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (snippet: Snippet) => {
    setEditingId(snippet.id);
    setForm({
      title: snippet.title,
      content: snippet.content,
      category: snippet.category,
      shortcut: snippet.shortcut || '',
      isActive: snippet.isActive,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error(t('admin.crm.snippets.titleContentRequired') || 'Title and content are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        category: form.category,
        shortcut: form.shortcut || undefined,
        isActive: form.isActive,
      };

      const url = editingId
        ? `/api/admin/crm/snippets?id=${editingId}`
        : '/api/admin/crm/snippets';

      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        toast.success(
          editingId
            ? (t('admin.crm.snippets.updated') || 'Snippet updated')
            : (t('admin.crm.snippets.created') || 'Snippet created')
        );
        closeModal();
        fetchSnippets();
      } else {
        toast.error(json.error?.message || 'Failed to save snippet');
      }
    } catch {
      toast.error(t('admin.crm.snippets.saveError') || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/crm/snippets?id=${id}`, {
        method: 'DELETE',
      });

      if (res.status === 204 || res.ok) {
        toast.success(t('admin.crm.snippets.deleted') || 'Snippet deleted');
        setSnippets((prev) => prev.filter((s) => s.id !== id));
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || 'Failed to delete snippet');
      }
    } catch {
      toast.error(t('admin.crm.snippets.deleteError') || 'Failed to delete snippet');
    } finally {
      setDeletingId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Copy to clipboard
  // -------------------------------------------------------------------------

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content).then(
      () => toast.success(t('admin.crm.snippets.copied') || 'Copied to clipboard'),
      () => toast.error('Failed to copy')
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-teal-600" />
            {t('admin.crm.snippets') || 'Snippets'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.snippets.subtitle') || 'Reusable text templates for quick responses'}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          {t('admin.crm.snippets.new') || 'New Snippet'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.crm.snippets.searchPlaceholder') || 'Search snippets...'}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">{t('admin.crm.snippets.allCategories') || 'All Categories'}</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      ) : snippets.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {t('admin.crm.snippets.empty') || 'No snippets found'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {t('admin.crm.snippets.emptyDesc') || 'Create reusable text snippets for quick customer responses'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {snippets.map((snippet) => (
            <div
              key={snippet.id}
              className={`bg-white rounded-xl border p-4 flex flex-col ${
                !snippet.isActive ? 'opacity-60' : ''
              }`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{snippet.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        CATEGORY_COLORS[snippet.category] || CATEGORY_COLORS.general
                      }`}
                    >
                      {snippet.category}
                    </span>
                    {snippet.shortcut && (
                      <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded text-xs font-mono">
                        {snippet.shortcut}
                      </span>
                    )}
                    {!snippet.isActive && (
                      <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-medium">
                        {t('admin.crm.snippets.inactive') || 'Inactive'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Content preview */}
              <p className="text-sm text-gray-600 mb-3 flex-1 line-clamp-3 whitespace-pre-wrap">
                {snippet.content}
              </p>

              {/* Card footer */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  {snippet.createdBy?.name || snippet.createdBy?.email || ''}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copyContent(snippet.content)}
                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    title={t('admin.crm.snippets.copy') || 'Copy content'}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openEdit(snippet)}
                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-teal-600"
                    title={t('common.edit') || 'Edit'}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(snippet.id)}
                    disabled={deletingId === snippet.id}
                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-red-600 disabled:opacity-50"
                    title={t('common.delete') || 'Delete'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
            {/* Modal header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId
                  ? (t('admin.crm.snippets.editTitle') || 'Edit Snippet')
                  : (t('admin.crm.snippets.createTitle') || 'New Snippet')}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-gray-100 rounded-md"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.crm.snippets.titleLabel') || 'Title'} *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder={t('admin.crm.snippets.titlePlaceholder') || 'e.g. Greeting Template'}
                autoFocus
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.crm.snippets.contentLabel') || 'Content'} *
              </label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                rows={5}
                placeholder={t('admin.crm.snippets.contentPlaceholder') || 'Write your snippet content here...'}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {form.content.length}/5000
              </p>
            </div>

            {/* Category + Shortcut row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.crm.snippets.categoryLabel') || 'Category'}
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.crm.snippets.shortcutLabel') || 'Shortcut'}
                </label>
                <input
                  type="text"
                  value={form.shortcut}
                  onChange={(e) => setForm((f) => ({ ...f, shortcut: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="/greet"
                />
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="snippetActive"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="snippetActive" className="text-sm text-gray-700">
                {t('admin.crm.snippets.activeLabel') || 'Active'}
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {saving
                  ? (t('common.saving') || 'Saving...')
                  : editingId
                    ? (t('common.save') || 'Save')
                    : (t('admin.crm.snippets.create') || 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
