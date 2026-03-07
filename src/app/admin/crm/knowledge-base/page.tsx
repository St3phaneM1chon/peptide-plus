'use client';

/**
 * Knowledge Base Admin Page (E17)
 * Manage KB articles: list, search, create/edit, category filter
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Search, Plus, BookOpen, Eye, ThumbsUp,
  FileText, X, Save, Tag,
} from 'lucide-react';
import { addCSRFHeader } from '@/lib/csrf';

interface KBArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  category: { id: string; name: string; slug: string } | null;
  tags: string[];
  viewCount: number;
  helpfulYes: number;
  helpfulNo: number;
  isPublic: boolean;
  contentPreview: string;
  createdAt: string;
  updatedAt: string;
}

interface KBCategory {
  id: string;
  name: string;
  slug: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-gray-100 text-gray-600',
};

export default function KnowledgeBasePage() {
  const { t, locale } = useI18n();
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formExcerpt, setFormExcerpt] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [formTags, setFormTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('categoryId', categoryFilter);

      const res = await fetch(`/api/admin/crm/knowledge-base?${params}`);
      const data = await res.json();

      if (data.success) {
        setArticles(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);

        // Parse categories from header
        const catHeader = res.headers.get('X-KB-Categories');
        if (catHeader) {
          try { setCategories(JSON.parse(catHeader)); } catch { /* ignore */ }
        }
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, categoryFilter, t]);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error(t('admin.kb.titleContentRequired') || 'Title and content are required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/crm/knowledge-base', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: formTitle,
          content: formContent,
          excerpt: formExcerpt || undefined,
          categoryId: formCategory || undefined,
          status: formStatus,
          tags: formTags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(t('admin.kb.articleCreated') || 'Article created');
        setShowModal(false);
        resetForm();
        loadArticles();
      } else {
        toast.error(data.error?.message || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormExcerpt('');
    setFormCategory('');
    setFormStatus('DRAFT');
    setFormTags('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-purple-600" />
            {t('admin.kb.title') || 'Knowledge Base'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('admin.kb.subtitle') || 'Manage help articles for agents and customers'}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('admin.kb.newArticle') || 'New Article'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('admin.kb.searchPlaceholder') || 'Search articles...'}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">{t('admin.kb.allStatuses') || 'All statuses'}</option>
          <option value="DRAFT">{t('admin.kb.draft') || 'Draft'}</option>
          <option value="PUBLISHED">{t('admin.kb.published') || 'Published'}</option>
          <option value="ARCHIVED">{t('admin.kb.archived') || 'Archived'}</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">{t('admin.kb.allCategories') || 'All categories'}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        {(search || statusFilter || categoryFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setCategoryFilter(''); setPage(1); }}
            className="p-2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Articles Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">{t('common.loading') || 'Loading...'}</div>
        ) : articles.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{t('admin.kb.noArticles') || 'No articles found'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{t('admin.kb.articleTitle') || 'Title'}</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{t('admin.kb.category') || 'Category'}</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">{t('admin.kb.status') || 'Status'}</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600"><Eye className="w-4 h-4 inline" /></th>
                <th className="px-4 py-3 text-center font-medium text-slate-600"><ThumbsUp className="w-4 h-4 inline" /></th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{t('admin.kb.tags') || 'Tags'}</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{t('admin.kb.updated') || 'Updated'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{article.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">/{article.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{article.category?.name || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[article.status] || ''}`}>
                      {article.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{article.viewCount}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-green-600">{article.helpfulYes}</span>
                    <span className="text-slate-300 mx-1">/</span>
                    <span className="text-red-500">{article.helpfulNo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {article.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                          <Tag className="w-3 h-3" />{tag}
                        </span>
                      ))}
                      {article.tags.length > 3 && (
                        <span className="text-xs text-slate-400">+{article.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(article.updatedAt).toLocaleDateString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              {t('common.previous') || 'Previous'}
            </button>
            <span className="text-sm text-slate-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              {t('common.next') || 'Next'}
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">
                {t('admin.kb.createArticle') || 'Create Article'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.kb.articleTitle') || 'Title'} *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  placeholder={t('admin.kb.titlePlaceholder') || 'Article title...'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.kb.content') || 'Content'} * ({t('admin.kb.markdown') || 'Markdown supported'})
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-purple-500"
                  placeholder={t('admin.kb.contentPlaceholder') || 'Write article content in Markdown...'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.kb.excerpt') || 'Excerpt'}
                </label>
                <input
                  type="text"
                  value={formExcerpt}
                  onChange={(e) => setFormExcerpt(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder={t('admin.kb.excerptPlaceholder') || 'Short description...'}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('admin.kb.category') || 'Category'}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">{t('admin.kb.noCategory') || 'No category'}</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('admin.kb.status') || 'Status'}
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="DRAFT">{t('admin.kb.draft') || 'Draft'}</option>
                    <option value="PUBLISHED">{t('admin.kb.published') || 'Published'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.kb.tags') || 'Tags'} ({t('admin.kb.commaSeparated') || 'comma separated'})
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="peptide, bpc-157, research"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleCreate}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? (t('common.saving') || 'Saving...') : (t('admin.kb.create') || 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
