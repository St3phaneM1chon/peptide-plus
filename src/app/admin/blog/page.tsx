'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText, Eye, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  author: { name: string | null } | null;
  _count?: { comments: number };
}

export default function AdminBlogPage() {
  const { t, locale } = useI18n();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('status', filter);
      const res = await fetch(`/api/admin/blog?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPosts(json.data || json.posts || []);
    } catch {
      toast.error(t('admin.blog.loadError'));
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const filteredPosts = posts.filter(p => {
    if (filter === 'published') return p.isPublished;
    if (filter === 'draft') return !p.isPublished;
    return true;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title={t('admin.blog.title')}
        subtitle={t('admin.blog.subtitle')}
        actions={
          <Link
            href="/admin/blog/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white rounded-lg hover:from-[#5558e6] hover:to-[#7580f2] text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {t('admin.blog.newArticle')}
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('admin.blog.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full ps-10 pe-4 py-2 border border-[var(--k-border-subtle)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-1 bg-white/10 rounded-lg p-1">
          {(['all', 'published', 'draft'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f ? 'bg-white/20 text-[var(--k-text-primary)] shadow-sm' : 'text-[var(--k-text-secondary)] hover:text-[var(--k-text-primary)]'
              }`}
            >
              {f === 'all' ? t('admin.blog.filterAll') : f === 'published' ? t('admin.blog.filterPublished') : t('admin.blog.filterDraft')}
            </button>
          ))}
        </div>
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20 bg-[var(--k-glass-thin)] rounded-xl border border-[var(--k-border-subtle)]">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-[var(--k-text-secondary)]">{t('admin.blog.noArticles')}</p>
        </div>
      ) : (
        <div className="bg-[var(--k-glass-thin)] rounded-xl border border-[var(--k-border-subtle)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--k-border-subtle)] bg-white/5">
                <th className="text-start px-4 py-3 text-xs font-semibold text-[var(--k-text-secondary)] uppercase">{t('admin.blog.colArticle')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-[var(--k-text-secondary)] uppercase">{t('admin.blog.colStatus')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-[var(--k-text-secondary)] uppercase">{t('admin.blog.colDate')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-[var(--k-text-secondary)] uppercase">{t('admin.blog.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPosts.map(post => (
                <tr key={post.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--k-text-primary)]">{post.title}</p>
                    {post.excerpt && <p className="text-xs text-[var(--k-text-secondary)] mt-0.5 line-clamp-1">{post.excerpt}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      post.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-white/10 text-[var(--k-text-secondary)]'
                    }`}>
                      {post.isPublished ? t('admin.blog.filterPublished') : t('admin.blog.filterDraft')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--k-text-secondary)]">
                    {new Date(post.publishedAt || post.createdAt).toLocaleDateString(locale)}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/blog/${post.slug}`} className="p-1.5 text-slate-400 hover:text-[var(--k-text-secondary)] rounded">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link href={`/admin/blog/${post.id}/edit`} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded">
                        <Pencil className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
