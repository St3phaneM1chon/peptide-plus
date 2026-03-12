// IMP-022: DONE: Inline video player modal is implemented (playingVideo state + modal with YouTube/Vimeo/native embed)
// IMP-023: TODO: Add direct video file upload (currently only accepts URL); requires server-side storage + transcoding
// IMP-024: TODO: Add analytics tracking for media views/downloads/shares (view count exists but no tracking endpoint)
// IMP-036: TODO: Implement OAuth flow for social integrations instead of manual token copy-paste
// IMP-037: TODO: Add post scheduling functionality for social media integrations
'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useI18n } from '@/i18n/client';
import {
  Video, Plus, Search, Eye, EyeOff, Star, Trash2, Play,
  Loader2, ChevronLeft, ChevronRight, ExternalLink, X,
  ImageIcon, BarChart3, House, Edit2, FileText, CheckCircle, Archive,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fetchWithCSRF } from '@/lib/csrf';

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
  contentType: string;
  source: string;
  sourceUrl: string | null;
  visibility: string;
  status: string;
  videoCategoryId: string | null;
  featuredClientId: string | null;
  videoCategory: { id: string; name: string; slug: string } | null;
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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterPublished, setFilterPublished] = useState<string>('');
  const [filterContentType, setFilterContentType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  // FIX: F51 - Track form-level error message for display within the form
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', videoUrl: '', thumbnailUrl: '',
    duration: '', category: '', tags: '', instructor: '',
    isFeatured: false, isPublished: false,
    contentType: 'GENERAL', source: 'YOUTUBE', visibility: 'PUBLIC', status: 'DRAFT',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);
  // Lazy-load embed preview state
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [loadedEmbeds, setLoadedEmbeds] = useState<Set<string>>(new Set());
  // F32 FIX: Edit state for inline video editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '', description: '', videoUrl: '', thumbnailUrl: '',
    duration: '', category: '', tags: '', instructor: '',
    isFeatured: false, isPublished: false,
    contentType: 'GENERAL', source: 'YOUTUBE', visibility: 'PUBLIC', status: 'DRAFT',
  });
  const [updating, setUpdating] = useState(false);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (filterPublished) params.set('isPublished', filterPublished);
      if (filterContentType) params.set('contentType', filterContentType);
      if (filterStatus) params.set('status', filterStatus);
      if (filterSource) params.set('source', filterSource);
      const res = await fetch(`/api/admin/videos?${params}`);
      const data = await res.json();
      setVideos(data.videos || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error('Failed to load videos:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterPublished, filterContentType, filterStatus, filterSource]);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  // F73 FIX: Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Helper: Extract YouTube video ID from URL for auto-thumbnail
  const getYoutubeId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
    return match ? match[1] : null;
  };

  // Helper: Get auto-generated thumbnail URL
  const getAutoThumbnail = (v: VideoItem): string | null => {
    if (v.thumbnailUrl) return v.thumbnailUrl;
    if (!v.videoUrl) return null;
    const ytId = getYoutubeId(v.videoUrl);
    if (ytId) return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
    return null;
  };

  // Helper: Get embed preview URL (lazy-loaded)
  const getEmbedUrl = (v: VideoItem): string | null => {
    if (!v.videoUrl) return null;
    if (v.videoUrl.includes('youtube.com') || v.videoUrl.includes('youtu.be')) {
      const ytId = getYoutubeId(v.videoUrl);
      if (ytId) return `https://www.youtube.com/embed/${ytId}`;
    }
    if (v.videoUrl.includes('vimeo.com')) {
      const vimeoId = v.videoUrl.split('/').pop();
      if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
    }
    return null;
  };

  // Toggle lazy-load embed preview
  const toggleEmbedPreview = useCallback((id: string) => {
    if (previewVideoId === id) {
      setPreviewVideoId(null);
    } else {
      setPreviewVideoId(id);
      setLoadedEmbeds(prev => new Set(prev).add(id));
    }
  }, [previewVideoId]);

  // F32 FIX: Start editing a video - populate edit form with existing values
  const startEdit = useCallback((v: VideoItem) => {
    setEditingId(v.id);
    setEditForm({
      title: v.title,
      description: v.description || '',
      videoUrl: v.videoUrl || '',
      thumbnailUrl: v.thumbnailUrl || '',
      duration: v.duration || '',
      category: v.category || '',
      tags: v.tags ? v.tags.join(', ') : '',
      instructor: v.instructor || '',
      isFeatured: v.isFeatured,
      isPublished: v.isPublished,
      contentType: v.contentType || 'GENERAL',
      source: v.source || 'YOUTUBE',
      visibility: v.visibility || 'PUBLIC',
      status: v.status || 'DRAFT',
    });
    setFormError(null);
  }, []);

  // F32 FIX: Submit video update via PATCH endpoint
  const handleUpdate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setUpdating(true);
    setFormError(null);
    try {
      const tags = editForm.tags ? editForm.tags.split(',').map(t => t.trim().replace(/\s+/g, ' ')).filter(Boolean) : [];
      if (editForm.videoUrl && !/^https?:\/\/.+/i.test(editForm.videoUrl)) {
        const msg = t('admin.media.invalidVideoUrl');
        toast.error(msg);
        setFormError(msg);
        setUpdating(false);
        return;
      }
      if (editForm.thumbnailUrl && !/^https?:\/\/.+/i.test(editForm.thumbnailUrl)) {
        const msg = t('admin.media.invalidThumbnailUrl');
        toast.error(msg);
        setFormError(msg);
        setUpdating(false);
        return;
      }
      const res = await fetchWithCSRF(`/api/admin/videos/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, tags }),
      });
      if (res.ok) {
        setEditingId(null);
        setFormError(null);
        loadVideos();
        toast.success(t('admin.media.videoUpdated'));
      } else {
        const data = await res.json().catch(() => ({}));
        const errorMsg = data.error || t('admin.media.videoUpdateFailed');
        toast.error(errorMsg);
        setFormError(errorMsg);
      }
    } catch (err) {
      console.error('Failed to update video:', err);
      const errorMsg = t('admin.media.videoUpdateFailed');
      toast.error(errorMsg);
      setFormError(errorMsg);
    } finally {
      setUpdating(false);
    }
  }, [editingId, editForm, t, loadVideos]);

  // Format view count with locale
  const formatViews = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null); // FIX: F51 - Clear previous errors
    try {
      // F89 FIX: Normalize multiple spaces within tags and filter empty entries
      const tags = form.tags ? form.tags.split(',').map(t => t.trim().replace(/\s+/g, ' ')).filter(Boolean) : [];
      // F33 FIX: Validate video URL format before submission
      if (form.videoUrl && !/^https?:\/\/.+/i.test(form.videoUrl)) {
        const msg = t('admin.media.invalidVideoUrl');
        toast.error(msg);
        setFormError(msg); // FIX: F51 - Show error in form
        setSaving(false);
        return;
      }
      if (form.thumbnailUrl && !/^https?:\/\/.+/i.test(form.thumbnailUrl)) {
        const msg = t('admin.media.invalidThumbnailUrl');
        toast.error(msg);
        setFormError(msg); // FIX: F51 - Show error in form
        setSaving(false);
        return;
      }

      const res = await fetchWithCSRF('/api/admin/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tags }),
      });
      // F31 FIX: Show error/success feedback on video creation
      if (res.ok) {
        setShowForm(false);
        setFormError(null);
        setForm({ title: '', description: '', videoUrl: '', thumbnailUrl: '', duration: '', category: '', tags: '', instructor: '', isFeatured: false, isPublished: false, contentType: 'GENERAL', source: 'YOUTUBE', visibility: 'PUBLIC', status: 'DRAFT' });
        loadVideos();
        toast.success(t('admin.media.videoCreated'));
      } else {
        const data = await res.json().catch(() => ({}));
        const errorMsg = data.error || t('admin.media.videoCreateFailed');
        toast.error(errorMsg);
        // FIX: F51 - Show error inside form so user sees it without toast
        setFormError(errorMsg);
      }
    } catch (err) {
      console.error('Failed to create video:', err);
      const errorMsg = t('admin.media.videoCreateFailed');
      toast.error(errorMsg);
      setFormError(errorMsg); // FIX: F51
    } finally {
      setSaving(false);
    }
  };

  // ---- Selection handling ----
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ---- Delete selected videos ----
  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    let successCount = 0;
    let failCount = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetchWithCSRF(`/api/admin/videos/${id}`, { method: 'DELETE' });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
    setSelectedIds(new Set());
    if (successCount > 0) {
      toast.success(`${successCount} ${t('admin.media.videosTitle')} ${t('common.deleted')}`);
      loadVideos();
    }
    if (failCount > 0) {
      toast.error(`${failCount} ${t('admin.media.deleteFailed')}`);
    }
  }, [selectedIds, t, loadVideos]);

  // ---- Bulk publish selected videos ----
  const handlePublishSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true); // reuse loading state
    let successCount = 0;
    let failCount = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetchWithCSRF(`/api/admin/videos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublished: true, status: 'PUBLISHED' }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setDeleting(false);
    setSelectedIds(new Set());
    if (successCount > 0) {
      toast.success(`${successCount} ${t('admin.media.videosTitle')} ${t('admin.media.bulkPublished')}`);
      loadVideos();
    }
    if (failCount > 0) {
      toast.error(`${failCount} ${t('admin.media.deleteFailed')}`);
    }
  }, [selectedIds, t, loadVideos]);

  // ---- Bulk archive selected videos ----
  const handleArchiveSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    let successCount = 0;
    let failCount = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetchWithCSRF(`/api/admin/videos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublished: false, status: 'ARCHIVED' }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setDeleting(false);
    setSelectedIds(new Set());
    if (successCount > 0) {
      toast.success(`${successCount} ${t('admin.media.videosTitle')} ${t('admin.media.bulkArchived')}`);
      loadVideos();
    }
    if (failCount > 0) {
      toast.error(`${failCount} ${t('admin.media.deleteFailed')}`);
    }
  }, [selectedIds, t, loadVideos]);

  // ---- Export CSV ----
  const handleExportCsv = useCallback(() => {
    if (videos.length === 0) {
      toast.info(t('admin.media.noDataToExport'));
      return;
    }
    const BOM = '\uFEFF';
    const headers = ['ID', 'Title', 'Slug', 'Category', 'Duration', 'Instructor', 'Views', 'Featured', 'Published', 'Video URL', 'Created At'];
    const rows = videos.map(v => [
      v.id, v.title, v.slug, v.category || '', v.duration || '',
      v.instructor || '', String(v.views), v.isFeatured ? 'Yes' : 'No',
      v.isPublished ? 'Yes' : 'No', v.videoUrl || '',
      new Date(v.createdAt).toISOString(),
    ]);
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `videos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.media.exportSuccess'));
  }, [videos, t]);

  // ---- Ribbon action handlers (media.management) ----
  const handleUploadRibbon = useCallback(() => { setShowForm(true); }, []);
  const handleDeleteRibbon = useCallback(() => {
    if (selectedIds.size === 0) { toast.info(t('admin.media.selectToDelete')); return; }
    setShowDeleteConfirm(true);
  }, [selectedIds, t]);
  const handleRenameRibbon = useCallback(() => toast.info(t('admin.media.renameHint')), [t]);
  const handleOrganizeRibbon = useCallback(() => toast.info(t('admin.media.organizeHint')), [t]);
  const handleOptimizeRibbon = useCallback(() => toast.info(t('admin.media.optimizeHint')), [t]);
  const handleExportRibbon = useCallback(() => { handleExportCsv(); }, [handleExportCsv]);

  useRibbonAction('upload', handleUploadRibbon);
  useRibbonAction('delete', handleDeleteRibbon);
  useRibbonAction('rename', handleRenameRibbon);
  useRibbonAction('organize', handleOrganizeRibbon);
  useRibbonAction('optimize', handleOptimizeRibbon);
  useRibbonAction('export', handleExportRibbon);

  return (
    <div className="p-6 max-w-5xl space-y-4">
      {/* A95 FIX: Breadcrumbs for navigation context in media sub-pages */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-indigo-600 transition-colors flex items-center gap-1"><House className="w-3 h-3" />{t('admin.nav.dashboard')}</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/media" className="hover:text-indigo-600 transition-colors">{t('admin.nav.media')}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-700 font-medium">{t('admin.media.videosTitle')}</span>
      </nav>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.media.videosTitle')}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('common.add')}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          {/* FIX: F51 - Display form-level error message */}
          {formError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{formError}</div>
          )}
          {/* FIX: F39 - Use i18n for all form placeholders and labels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.videoTitlePlaceholder')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.videoUrlPlaceholder')} value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} />
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.thumbnailUrlPlaceholder')} value={form.thumbnailUrl} onChange={e => setForm({ ...form, thumbnailUrl: e.target.value })} />
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.durationPlaceholder')} value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} />
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.categoryPlaceholder')} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.instructorPlaceholder')} value={form.instructor} onChange={e => setForm({ ...form, instructor: e.target.value })} />
            <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.tagsPlaceholder')} value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
          </div>
          <textarea className="w-full border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.descriptionPlaceholder')} rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          {/* Content Hub fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select className="border border-slate-300 rounded px-3 py-2 text-sm" value={form.contentType} onChange={e => setForm({ ...form, contentType: e.target.value })} aria-label={t('admin.media.videos.contentType')}>
              <option value="GENERAL">General</option>
              <option value="PODCAST">Podcast</option>
              <option value="TRAINING">Training</option>
              <option value="WEBINAR">Webinar</option>
              <option value="TESTIMONIAL">Testimonial</option>
              <option value="PRODUCT_DEMO">Product Demo</option>
              <option value="RESEARCH">Research</option>
              <option value="TUTORIAL">Tutorial</option>
              <option value="INTERVIEW">Interview</option>
              <option value="CONFERENCE">Conference</option>
            </select>
            <select className="border border-slate-300 rounded px-3 py-2 text-sm" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} aria-label={t('admin.media.videos.source')}>
              <option value="YOUTUBE">YouTube</option>
              <option value="VIMEO">Vimeo</option>
              <option value="TEAMS">Teams</option>
              <option value="ZOOM">Zoom</option>
              <option value="UPLOAD">Upload</option>
              <option value="EXTERNAL">External</option>
            </select>
            <select className="border border-slate-300 rounded px-3 py-2 text-sm" value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })} aria-label="Visibility">
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
              <option value="INTERNAL">Internal</option>
              <option value="CLIENTS_ONLY">Clients Only</option>
            </select>
            <select className="border border-slate-300 rounded px-3 py-2 text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} aria-label={t('admin.media.videos.status')}>
              <option value="DRAFT">Draft</option>
              <option value="REVIEW">Review</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={t('admin.media.videoPublishedLabel')} checked={form.isPublished} onChange={e => setForm({ ...form, isPublished: e.target.checked })} /> {t('admin.media.published')}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={t('admin.media.videoFeaturedLabel')} checked={form.isFeatured} onChange={e => setForm({ ...form, isFeatured: e.target.checked })} /> {t('admin.media.featured')}</label>
            <button type="submit" disabled={saving} className="ms-auto px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
            </button>
          </div>
        </form>
      )}

      {/* Selection toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
          <span className="text-indigo-700 font-medium">{selectedIds.size} {t('common.selected')}</span>
          <button onClick={handlePublishSelected} disabled={deleting} className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs">
            <CheckCircle className="w-3 h-3" /> {t('admin.media.bulkPublish')}
          </button>
          <button onClick={handleArchiveSelected} disabled={deleting} className="flex items-center gap-1 px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 text-xs">
            <Archive className="w-3 h-3" /> {t('admin.media.bulkArchive')}
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting} className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-xs">
            <Trash2 className="w-3 h-3" /> {t('common.delete')}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ms-auto text-slate-500 hover:text-slate-700 text-xs">
            {t('common.clearSelection')}
          </button>
        </div>
      )}

      {/* Search & filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full ps-9 pe-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder={t('common.search')}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        {/* FIX: F41 - Use i18n for filter option labels */}
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={filterPublished}
          onChange={e => { setFilterPublished(e.target.value); setPage(1); }}
        >
          <option value="">{t('common.all')}</option>
          <option value="true">{t('admin.media.published')}</option>
          <option value="false">{t('admin.media.draft')}</option>
        </select>
        {/* Content Hub filters */}
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={filterContentType}
          onChange={e => { setFilterContentType(e.target.value); setPage(1); }}
          aria-label="Filter by content type"
        >
          <option value="">Content Type</option>
          <option value="GENERAL">General</option>
          <option value="PODCAST">Podcast</option>
          <option value="TRAINING">Training</option>
          <option value="WEBINAR">Webinar</option>
          <option value="TESTIMONIAL">Testimonial</option>
          <option value="PRODUCT_DEMO">Product Demo</option>
          <option value="RESEARCH">Research</option>
          <option value="TUTORIAL">Tutorial</option>
          <option value="INTERVIEW">Interview</option>
          <option value="CONFERENCE">Conference</option>
        </select>
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          aria-label="Filter by status"
        >
          <option value="">Status</option>
          <option value="DRAFT">Draft</option>
          <option value="REVIEW">Review</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={filterSource}
          onChange={e => { setFilterSource(e.target.value); setPage(1); }}
          aria-label="Filter by source"
        >
          <option value="">Source</option>
          <option value="YOUTUBE">YouTube</option>
          <option value="VIMEO">Vimeo</option>
          <option value="TEAMS">Teams</option>
          <option value="ZOOM">Zoom</option>
          <option value="UPLOAD">Upload</option>
          <option value="EXTERNAL">External</option>
        </select>
      </div>

      {/* Video list */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-slate-500">{t('admin.media.videosDesc')}</div>
      ) : (
        <div className="space-y-2">
          {videos.map(v => {
            const autoThumb = getAutoThumbnail(v);
            const embedUrl = getEmbedUrl(v);

            return (
              <div key={v.id} className="bg-white rounded-lg border transition-colors overflow-hidden ${selectedIds.has(v.id) ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'}">
                <div className={`flex items-center gap-3 p-3 ${selectedIds.has(v.id) ? 'border-indigo-400 ring-2 ring-indigo-200' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(v.id)}
                    onChange={() => toggleSelect(v.id)}
                    className="rounded border-slate-300 flex-shrink-0"
                    aria-label={`Select ${v.title}`}
                  />
                  {/* Auto-thumbnail display */}
                  {autoThumb ? (
                    <div className="relative w-24 h-16 rounded overflow-hidden bg-slate-100 flex-shrink-0 cursor-pointer group/thumb" onClick={() => embedUrl && toggleEmbedPreview(v.id)}>
                      <Image src={autoThumb} alt={v.title} className="w-full h-full object-cover" width={96} height={64} />
                      {embedUrl && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                      )}
                      {!v.thumbnailUrl && (
                        <span className="absolute bottom-0.5 start-0.5 text-[8px] bg-black/60 text-white px-1 rounded">
                          Auto
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="w-24 h-16 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Video className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{v.title}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      {v.duration && <span>{v.duration}</span>}
                      {v.category && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{v.category}</span>}
                      {v.instructor && <span>{t('admin.media.videoBy')} {v.instructor}</span>}
                      {/* Content Hub badges */}
                      {v.status && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          v.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
                          v.status === 'REVIEW' ? 'bg-amber-100 text-amber-700' :
                          v.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
                          v.status === 'ARCHIVED' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {v.status}
                        </span>
                      )}
                      {v.contentType && v.contentType !== 'GENERAL' && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-medium">
                          {v.contentType.replace('_', ' ')}
                        </span>
                      )}
                      {v.source && v.source !== 'YOUTUBE' && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-medium">
                          {v.source}
                        </span>
                      )}
                      {v.visibility && v.visibility !== 'PUBLIC' && (
                        <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-medium">
                          {v.visibility}
                        </span>
                      )}
                      {v.videoCategory && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-medium">
                          {v.videoCategory.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* View tracking count display - F40 FIX: Use i18n for "views" */}
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg" title={`${v.views} ${t('admin.media.videoViews')}`}>
                      <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-xs font-semibold text-slate-700">{formatViews(v.views)}</span>
                      <span className="text-[10px] text-slate-400">{t('admin.media.videoViews')}</span>
                    </div>
                    {v.isFeatured && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    {v.isPublished ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                    {/* View Detail link */}
                    <Link
                      href={`/admin/media/videos/${v.id}`}
                      className="text-slate-400 hover:text-indigo-600"
                      aria-label={t('admin.media.viewDetail')}
                      title={t('admin.media.viewDetail')}
                    >
                      <FileText className="w-4 h-4" />
                    </Link>
                    {/* F32 FIX: Edit button for inline video editing */}
                    <button
                      onClick={() => editingId === v.id ? setEditingId(null) : startEdit(v)}
                      className={`text-slate-400 hover:text-indigo-600 ${editingId === v.id ? 'text-indigo-600' : ''}`}
                      aria-label={editingId === v.id ? (t('admin.media.cancelEdit')) : (t('admin.media.editVideo'))}
                      title={editingId === v.id ? (t('admin.media.cancelEdit')) : (t('admin.media.editVideo'))}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {v.videoUrl && (
                      <>
                        {embedUrl && (
                          <button
                            onClick={() => toggleEmbedPreview(v.id)}
                            className={`text-slate-400 hover:text-indigo-600 ${previewVideoId === v.id ? 'text-indigo-600' : ''}`}
                            aria-label={t('admin.media.videoEmbeddedPreview')}
                            title={t('admin.media.videoEmbeddedPreview')}
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => setPlayingVideo(v)} className="text-slate-400 hover:text-indigo-600" aria-label={t('admin.media.videoPlayVideo')}>
                          <Play className="w-4 h-4" />
                        </button>
                        <a href={v.videoUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600" aria-label={t('admin.media.videoOpenNewTab')}>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* F32 FIX: Inline edit form */}
                {editingId === v.id && (
                  <div className="border-t border-indigo-200 p-4 bg-indigo-50/50">
                    <form onSubmit={handleUpdate} className="space-y-3">
                      {formError && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{formError}</div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.videoTitlePlaceholder')} value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} required />
                        <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.videoUrlPlaceholder')} value={editForm.videoUrl} onChange={e => setEditForm({ ...editForm, videoUrl: e.target.value })} />
                        <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.thumbnailUrlPlaceholder')} value={editForm.thumbnailUrl} onChange={e => setEditForm({ ...editForm, thumbnailUrl: e.target.value })} />
                        <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.durationPlaceholder')} value={editForm.duration} onChange={e => setEditForm({ ...editForm, duration: e.target.value })} />
                        <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.categoryPlaceholder')} value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} />
                        <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.instructorPlaceholder')} value={editForm.instructor} onChange={e => setEditForm({ ...editForm, instructor: e.target.value })} />
                        <input className="border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.tagsPlaceholder')} value={editForm.tags} onChange={e => setEditForm({ ...editForm, tags: e.target.value })} />
                      </div>
                      <textarea className="w-full border border-slate-300 rounded px-3 py-2 text-sm" placeholder={t('admin.media.descriptionPlaceholder')} rows={2} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                      {/* Content Hub fields */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <select className="border border-slate-300 rounded px-3 py-2 text-sm" value={editForm.contentType} onChange={e => setEditForm({ ...editForm, contentType: e.target.value })} aria-label={t('admin.media.videos.contentType')}>
                          <option value="GENERAL">General</option>
                          <option value="PODCAST">Podcast</option>
                          <option value="TRAINING">Training</option>
                          <option value="WEBINAR">Webinar</option>
                          <option value="TESTIMONIAL">Testimonial</option>
                          <option value="PRODUCT_DEMO">Product Demo</option>
                          <option value="RESEARCH">Research</option>
                          <option value="TUTORIAL">Tutorial</option>
                          <option value="INTERVIEW">Interview</option>
                          <option value="CONFERENCE">Conference</option>
                        </select>
                        <select className="border border-slate-300 rounded px-3 py-2 text-sm" value={editForm.source} onChange={e => setEditForm({ ...editForm, source: e.target.value })} aria-label={t('admin.media.videos.source')}>
                          <option value="YOUTUBE">YouTube</option>
                          <option value="VIMEO">Vimeo</option>
                          <option value="TEAMS">Teams</option>
                          <option value="ZOOM">Zoom</option>
                          <option value="UPLOAD">Upload</option>
                          <option value="EXTERNAL">External</option>
                        </select>
                        <select className="border border-slate-300 rounded px-3 py-2 text-sm" value={editForm.visibility} onChange={e => setEditForm({ ...editForm, visibility: e.target.value })} aria-label="Visibility">
                          <option value="PUBLIC">Public</option>
                          <option value="PRIVATE">Private</option>
                          <option value="INTERNAL">Internal</option>
                          <option value="CLIENTS_ONLY">Clients Only</option>
                        </select>
                        <select className="border border-slate-300 rounded px-3 py-2 text-sm" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} aria-label={t('admin.media.videos.status')}>
                          <option value="DRAFT">Draft</option>
                          <option value="REVIEW">Review</option>
                          <option value="PUBLISHED">Published</option>
                          <option value="ARCHIVED">Archived</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={t('admin.media.videoPublishedLabel')} checked={editForm.isPublished} onChange={e => setEditForm({ ...editForm, isPublished: e.target.checked })} /> {t('admin.media.published')}</label>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={t('admin.media.videoFeaturedLabel')} checked={editForm.isFeatured} onChange={e => setEditForm({ ...editForm, isFeatured: e.target.checked })} /> {t('admin.media.featured')}</label>
                        <div className="ms-auto flex items-center gap-2">
                          <button type="button" onClick={() => setEditingId(null)} className="px-3 py-2 text-slate-600 border border-slate-300 rounded text-sm hover:bg-slate-50">
                            {t('common.cancel')}
                          </button>
                          <button type="submit" disabled={updating} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
                            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}

                {/* Lazy-load embed preview */}
                {previewVideoId === v.id && embedUrl && (
                  <div className="border-t border-slate-200 p-3 bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500">{t('admin.media.videoEmbeddedPreview')}</span>
                      <button onClick={() => setPreviewVideoId(null)} className="text-xs text-slate-400 hover:text-slate-600">
                        {t('admin.media.videoClosePreview')}
                      </button>
                    </div>
                    {loadedEmbeds.has(v.id) ? (
                      <iframe
                        src={embedUrl}
                        className="w-full aspect-video rounded-lg"
                        allow="encrypted-media"
                        allowFullScreen
                        title={`${t('admin.media.videoEmbeddedPreview')}: ${v.title}`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full aspect-video rounded-lg bg-slate-200 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded hover:bg-slate-100 disabled:opacity-30" aria-label="Page precedente">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-600">{page} / {pagination.totalPages}</span>
          {/* FIX: F93 - Use page >= totalPages for consistency with other pagination components */}
          <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded hover:bg-slate-100 disabled:opacity-30" aria-label="Page suivante">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Video player modal */}
      {playingVideo && playingVideo.videoUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setPlayingVideo(null)}>
          <div className="relative max-w-4xl w-full bg-black rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPlayingVideo(null)} className="absolute top-3 end-3 p-1.5 bg-white/80 rounded-full hover:bg-white z-10" aria-label="Close video">
              <X className="w-5 h-5" />
            </button>
            {playingVideo.videoUrl.includes('youtube.com') || playingVideo.videoUrl.includes('youtu.be') ? (
              <iframe
                src={playingVideo.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/') + '?autoplay=1'}
                className="w-full aspect-video"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={playingVideo.title}
              />
            ) : playingVideo.videoUrl.includes('vimeo.com') ? (
              <iframe
                src={`https://player.vimeo.com/video/${playingVideo.videoUrl.split('/').pop()}?autoplay=1`}
                className="w-full aspect-video"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={playingVideo.title}
              />
            ) : (
              <video src={playingVideo.videoUrl} controls autoPlay className="w-full aspect-video" />
            )}
            <div className="p-4 bg-slate-900 text-white">
              <p className="font-medium">{playingVideo.title}</p>
              <p className="text-sm text-slate-400">{playingVideo.duration || ''} {playingVideo.instructor ? `- ${playingVideo.instructor}` : ''}</p>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('admin.media.deleteConfirmTitle')}
        message={`${t('admin.media.deleteConfirmMessage')} ${selectedIds.size} ${t('admin.media.videosTitle')}? ${t('admin.media.deleteIrreversible')}`}
        confirmLabel={deleting ? '...' : (t('common.delete'))}
        onConfirm={handleDeleteSelected}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </div>
  );
}
