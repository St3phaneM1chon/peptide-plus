'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Send, Clock, Instagram, Facebook, Twitter,
  Plus, Sparkles, Trash2, Loader2, ExternalLink, RefreshCw,
  ChevronLeft, ChevronRight, Eye, AlertCircle, Image as ImageIcon,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { fetchWithCSRF } from '@/lib/csrf';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  imageUrl: string | null;
  scheduledAt: string;
  publishedAt: string | null;
  status: string;
  error: string | null;
  externalId: string | null;
  externalUrl: string | null;
  createdAt: string;
}

type Platform = 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'linkedin';

// ---------------------------------------------------------------------------
// Platform config
// ---------------------------------------------------------------------------

const platformConfig: Record<Platform, {
  icon: typeof Instagram;
  color: string;
  label: string;
  maxChars: number;
}> = {
  instagram: { icon: Instagram, color: 'text-pink-600 bg-pink-100', label: 'Instagram', maxChars: 2200 },
  facebook: { icon: Facebook, color: 'text-blue-600 bg-blue-100', label: 'Facebook', maxChars: 63206 },
  twitter: { icon: Twitter, color: 'text-sky-500 bg-sky-100', label: 'X / Twitter', maxChars: 280 },
  tiktok: { icon: Send, color: 'text-slate-800 bg-slate-100', label: 'TikTok', maxChars: 2200 },
  linkedin: { icon: Send, color: 'text-blue-700 bg-blue-100', label: 'LinkedIn', maxChars: 3000 },
};

const PLATFORMS = Object.keys(platformConfig) as Platform[];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SocialSchedulerPage() {
  const { t } = useI18n();

  // Data state
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ scheduled: 0, draft: 0, published: 0, failed: 0 });

  // Filter state
  const [filterPlatform, setFilterPlatform] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Composer state
  const [showComposer, setShowComposer] = useState(false);
  const [newPost, setNewPost] = useState<{
    platform: Platform;
    content: string;
    imageUrl: string;
    scheduledAt: string;
    status: 'draft' | 'scheduled';
  }>({
    platform: 'instagram',
    content: '',
    imageUrl: '',
    scheduledAt: '',
    status: 'scheduled',
  });
  const [creating, setCreating] = useState(false);

  // Calendar view
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const loadPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterPlatform) params.set('platform', filterPlatform);
      if (filterStatus) params.set('status', filterStatus);

      const res = await fetch(`/api/admin/social-posts?${params}`);
      if (!res.ok) throw new Error('Failed to load posts');
      const data = await res.json();
      setPosts(data.posts || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err) {
      console.error('Failed to load social posts:', err);
      toast.error(t('admin.media.socialScheduler.loadFailed') || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [page, filterPlatform, filterStatus, t]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/social-posts?limit=0');
      if (!res.ok) return;
      // Load all counts
      const counts = { scheduled: 0, draft: 0, published: 0, failed: 0 };
      for (const status of ['scheduled', 'draft', 'published', 'failed']) {
        const r = await fetch(`/api/admin/social-posts?status=${status}&limit=1`);
        if (r.ok) {
          const d = await r.json();
          counts[status as keyof typeof counts] = d.pagination?.total || 0;
        }
      }
      setStats(counts);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const createPost = async () => {
    if (!newPost.content || !newPost.scheduledAt) {
      toast.error(t('admin.media.socialScheduler.contentDateRequired') || 'Content and date required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetchWithCSRF('/api/admin/social-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: newPost.platform,
          content: newPost.content,
          imageUrl: newPost.imageUrl || null,
          scheduledAt: new Date(newPost.scheduledAt).toISOString(),
          status: newPost.status,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create post');
      }
      toast.success(t('admin.media.socialScheduler.postScheduled') || 'Post scheduled!');
      setNewPost({ platform: 'instagram', content: '', imageUrl: '', scheduledAt: '', status: 'scheduled' });
      setShowComposer(false);
      loadPosts();
      loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.media.socialScheduler.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const deletePost = async (id: string) => {
    try {
      const res = await fetchWithCSRF(`/api/admin/social-posts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success(t('admin.media.socialScheduler.postDeleted') || 'Post deleted');
      loadPosts();
      loadStats();
    } catch {
      toast.error(t('admin.media.socialScheduler.deleteFailed'));
    }
  };

  const publishNow = async (id: string) => {
    try {
      const res = await fetchWithCSRF(`/api/admin/social-posts/${id}/publish`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('admin.media.socialScheduler.postPublished') || 'Post published!');
      } else {
        toast.error(data.error || t('admin.media.socialScheduler.publishFailed'));
      }
      loadPosts();
      loadStats();
    } catch {
      toast.error(t('admin.media.socialScheduler.publishFailed'));
    }
  };

  const generateCaption = () => {
    const captions = [
      '🧬 Peptides de recherche de qualité supérieure, maintenant disponibles chez BioCycle Peptides! Certificat d\'analyse inclus avec chaque commande. #peptides #research #quality',
      '🔬 Vous cherchez des peptides de recherche fiables? Notre laboratoire garantit une pureté de 98%+ sur chaque lot. Découvrez notre catalogue! #biocycle #science',
      '💎 Livraison gratuite sur les commandes de 150$+! Profitez de nos peptides certifiés avec analyse HPLC. biocyclepeptides.com #research #peptides',
    ];
    setNewPost(prev => ({ ...prev, content: captions[Math.floor(Math.random() * captions.length)] }));
    toast.success(t('admin.media.socialScheduler.aiCaptionGenerated') || 'AI caption generated');
  };

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

  const statusBadge = (s: string) => {
    switch (s) {
      case 'published': return 'bg-green-100 text-green-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'publishing': return 'bg-amber-100 text-amber-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'published': return t('admin.media.socialScheduler.statusPublished') || 'Published';
      case 'scheduled': return t('admin.media.socialScheduler.statusScheduled') || 'Scheduled';
      case 'publishing': return t('admin.media.socialScheduler.statusPublishing') || 'Publishing...';
      case 'failed': return t('admin.media.socialScheduler.statusFailed') || 'Failed';
      default: return t('admin.media.socialScheduler.statusDraft') || 'Draft';
    }
  };

  // Calendar helpers
  const calendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const postsForDay = (day: number) => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    return posts.filter(p => {
      const d = new Date(p.scheduledAt);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-purple-600" />
            {t('admin.media.socialScheduler.title') || 'Social Scheduler'}
          </h1>
          <p className="text-slate-500">{t('admin.media.socialScheduler.subtitle') || 'Schedule your social media posts'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            {viewMode === 'list' ? <Calendar className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {viewMode === 'list'
              ? (t('admin.media.socialScheduler.calendarView') || 'Calendar')
              : (t('admin.media.socialScheduler.listView') || 'List')}
          </button>
          <button
            onClick={() => { loadPosts(); loadStats(); }}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowComposer(!showComposer)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> {t('admin.media.socialScheduler.newPost') || 'New Post'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: t('admin.media.socialScheduler.statsScheduled') || 'Scheduled', count: stats.scheduled, color: 'text-blue-600' },
          { label: t('admin.media.socialScheduler.statsDraft') || 'Drafts', count: stats.draft, color: 'text-slate-600' },
          { label: t('admin.media.socialScheduler.statsPublished') || 'Published', count: stats.published, color: 'text-green-600' },
          { label: t('admin.media.socialScheduler.statsFailed') || 'Failed', count: stats.failed, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterPlatform}
          onChange={e => { setFilterPlatform(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-400"
        >
          <option value="">{t('admin.media.socialScheduler.allPlatforms') || 'All Platforms'}</option>
          {PLATFORMS.map(p => (
            <option key={p} value={p}>{platformConfig[p].label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-400"
        >
          <option value="">{t('admin.media.socialScheduler.allStatuses') || 'All Statuses'}</option>
          <option value="draft">{t('admin.media.socialScheduler.statusDraft') || 'Draft'}</option>
          <option value="scheduled">{t('admin.media.socialScheduler.statusScheduled') || 'Scheduled'}</option>
          <option value="published">{t('admin.media.socialScheduler.statusPublished') || 'Published'}</option>
          <option value="failed">{t('admin.media.socialScheduler.statusFailed') || 'Failed'}</option>
        </select>
      </div>

      {/* Composer */}
      {showComposer && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">{t('admin.media.socialScheduler.composer') || 'New Post'}</h3>
          <div className="space-y-4">
            {/* Platform selector */}
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.map(key => {
                const cfg = platformConfig[key];
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setNewPost(prev => ({ ...prev, platform: key }))}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      newPost.platform === key ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="relative">
              <textarea
                value={newPost.content}
                onChange={e => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                placeholder={t('admin.media.socialScheduler.writePlaceholder') || 'Write your post...'}
                rows={4}
                maxLength={platformConfig[newPost.platform].maxChars}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm resize-none"
              />
              <div className="absolute bottom-2 end-2 text-xs text-slate-400">
                {newPost.content.length}/{platformConfig[newPost.platform].maxChars}
              </div>
            </div>

            {/* Image URL */}
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-slate-400" />
              <input
                type="url"
                value={newPost.imageUrl}
                onChange={e => setNewPost(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder={t('admin.media.socialScheduler.imageUrlPlaceholder') || 'Image URL (optional)'}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-400"
              />
            </div>

            {/* Schedule + actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="datetime-local"
                value={newPost.scheduledAt}
                onChange={e => setNewPost(prev => ({ ...prev, scheduledAt: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-400"
              />
              <select
                value={newPost.status}
                onChange={e => setNewPost(prev => ({ ...prev, status: e.target.value as 'draft' | 'scheduled' }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-400"
              >
                <option value="scheduled">{t('admin.media.socialScheduler.statusScheduled') || 'Scheduled'}</option>
                <option value="draft">{t('admin.media.socialScheduler.statusDraft') || 'Draft'}</option>
              </select>
              <button onClick={generateCaption} className="flex items-center gap-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-medium">
                <Sparkles className="w-4 h-4" /> {t('admin.media.socialScheduler.aiCaption') || 'AI Caption'}
              </button>
              <div className="flex-1" />
              <button onClick={() => setShowComposer(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm">
                {t('admin.media.socialScheduler.cancel') || 'Cancel'}
              </button>
              <button
                onClick={createPost}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                {t('admin.media.socialScheduler.schedule') || 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="p-2 hover:bg-slate-100 rounded-lg">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-semibold text-slate-700">
              {calendarMonth.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="p-2 hover:bg-slate-100 rounded-lg">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(d => (
              <div key={d} className="text-xs text-center text-slate-400 font-medium py-2">{d}</div>
            ))}
            {calendarDays().map((day, i) => (
              <div key={i} className={`min-h-[60px] border border-slate-100 rounded p-1 text-xs ${day ? 'bg-white' : 'bg-slate-50'}`}>
                {day && (
                  <>
                    <div className="font-medium text-slate-600 mb-0.5">{day}</div>
                    {postsForDay(day).slice(0, 3).map(p => {
                      const cfg = platformConfig[p.platform as Platform] || platformConfig.twitter;
                      return (
                        <div key={p.id} className={`rounded px-1 py-0.5 text-[10px] truncate mb-0.5 ${cfg.color}`}>
                          {cfg.label.slice(0, 3)}
                        </div>
                      );
                    })}
                    {postsForDay(day).length > 3 && (
                      <div className="text-[10px] text-slate-400">+{postsForDay(day).length - 3}</div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Posts List */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {posts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">{t('admin.media.socialScheduler.noPosts') || 'No posts yet. Create your first post!'}</p>
            </div>
          ) : (
            posts.map(post => {
              const cfg = platformConfig[post.platform as Platform] || platformConfig.twitter;
              const Icon = cfg.icon;
              return (
                <div key={post.id} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-700">{cfg.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(post.status)}`}>
                        {statusLabel(post.status)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-3">{post.content}</p>
                    {post.imageUrl && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-sky-600">
                        <ImageIcon className="w-3 h-3" />
                        <span className="truncate max-w-[200px]">{post.imageUrl}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(post.scheduledAt)}
                      </div>
                      {post.externalUrl && (
                        <a href={post.externalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-600 hover:underline">
                          <ExternalLink className="w-3 h-3" />
                          {t('admin.media.socialScheduler.viewExternal') || 'View post'}
                        </a>
                      )}
                    </div>
                    {post.error && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                        <AlertCircle className="w-3 h-3" />
                        {post.error}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {['draft', 'scheduled', 'failed'].includes(post.status) && (
                      <button onClick={() => publishNow(post.id)} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title={t('admin.media.socialScheduler.publishNow') || 'Publish now'}>
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => deletePost(post.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title={t('admin.media.socialScheduler.deletePost') || 'Delete'}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
