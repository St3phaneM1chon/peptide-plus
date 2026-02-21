'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Video, Plus, Search, Eye, EyeOff, Star, Trash2, Edit2,
  Loader2, ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react';

interface VideoItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  duration: string | null;
  category: string | null;
  tags: string[];
  instructor: string | null;
  views: number;
  isFeatured: boolean;
  isPublished: boolean;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export default function MediaVideosPage() {
  const { t } = useI18n();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPublished, setFilterPublished] = useState<string>('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', videoUrl: '', thumbnailUrl: '',
    duration: '', category: '', tags: '', instructor: '',
    isFeatured: false, isPublished: false,
  });

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (filterPublished) params.set('isPublished', filterPublished);
      const res = await fetch(`/api/admin/videos?${params}`);
      const data = await res.json();
      setVideos(data.videos || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error('Failed to load videos:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterPublished]);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      const res = await fetch('/api/admin/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tags }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ title: '', description: '', videoUrl: '', thumbnailUrl: '', duration: '', category: '', tags: '', instructor: '', isFeatured: false, isPublished: false });
        loadVideos();
      }
    } catch (err) {
      console.error('Failed to create video:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.media.videosTitle')}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('common.add')}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder="Video URL" value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} />
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder="Thumbnail URL" value={form.thumbnailUrl} onChange={e => setForm({ ...form, thumbnailUrl: e.target.value })} />
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder="Duration (e.g. 12:30)" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} />
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder="Instructor" value={form.instructor} onChange={e => setForm({ ...form, instructor: e.target.value })} />
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder="Tags (comma-separated)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
          </div>
          <textarea className="w-full border border-slate-300 rounded px-3 py-2 text-sm" placeholder="Description" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={e => setForm({ ...form, isPublished: e.target.checked })} /> Published</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={e => setForm({ ...form, isFeatured: e.target.checked })} /> Featured</label>
            <button type="submit" disabled={saving} className="ml-auto px-4 py-2 bg-sky-600 text-white rounded text-sm hover:bg-sky-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
            </button>
          </div>
        </form>
      )}

      {/* Search & filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder={t('common.search')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={filterPublished}
          onChange={e => { setFilterPublished(e.target.value); setPage(1); }}
        >
          <option value="">All</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </select>
      </div>

      {/* Video list */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-slate-500">{t('admin.media.videosDesc')}</div>
      ) : (
        <div className="space-y-2">
          {videos.map(v => (
            <div key={v.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
              {v.thumbnailUrl ? (
                <img src={v.thumbnailUrl} alt={v.title} className="w-20 h-14 rounded object-cover bg-slate-100" />
              ) : (
                <div className="w-20 h-14 rounded bg-slate-100 flex items-center justify-center"><Video className="w-6 h-6 text-slate-300" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{v.title}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {v.duration && <span>{v.duration}</span>}
                  {v.category && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{v.category}</span>}
                  <span>{v.views} views</span>
                  {v.instructor && <span>by {v.instructor}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {v.isFeatured && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                {v.isPublished ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                {v.videoUrl && (
                  <a href={v.videoUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-600">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded hover:bg-slate-100 disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-600">{page} / {pagination.totalPages}</span>
          <button disabled={!pagination.hasMore} onClick={() => setPage(p => p + 1)} className="p-2 rounded hover:bg-slate-100 disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
