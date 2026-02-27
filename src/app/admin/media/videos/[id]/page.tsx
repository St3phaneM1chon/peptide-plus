'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { fetchWithCSRF } from '@/lib/csrf';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, ChevronRight, House, Loader2, Save,
  Tag, X, Plus, MapPin, ShieldCheck, Package,
  Video as VideoIcon, ExternalLink, Clock, Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoCategory {
  id: string;
  name: string;
  slug: string;
  children?: VideoCategory[];
}

interface VideoPlacement {
  id: string;
  placement: string;
  sortOrder: number;
  isActive: boolean;
  contextId: string | null;
  contextType: string | null;
}

interface ProductLink {
  id: string;
  productId: string;
  sortOrder: number;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    price: number | null;
  };
}

interface ConsentEntry {
  id: string;
  clientId: string;
  status: string;
  type: string;
  grantedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  client: { id: string; name: string | null; email: string | null };
  formTemplate?: { id: string; name: string } | null;
  requestedBy?: { id: string; name: string | null } | null;
}

interface VideoDetail {
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
  locale: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  contentType: string;
  source: string;
  sourceUrl: string | null;
  visibility: string;
  status: string;
  videoCategoryId: string | null;
  createdById: string | null;
  featuredClientId: string | null;
  videoCategory: { id: string; name: string; slug: string } | null;
  createdBy: { id: string; name: string | null; email: string | null } | null;
  featuredClient: { id: string; name: string | null; email: string | null } | null;
  placements: VideoPlacement[];
  productLinks: ProductLink[];
  videoTags: { id: string; tag: string }[];
  consents: ConsentEntry[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTENT_TYPES = [
  'PODCAST', 'TRAINING', 'PERSONAL_SESSION', 'PRODUCT_DEMO', 'TESTIMONIAL',
  'FAQ_VIDEO', 'WEBINAR_RECORDING', 'TUTORIAL', 'BRAND_STORY', 'LIVE_STREAM', 'OTHER',
] as const;

const SOURCES = [
  'YOUTUBE', 'VIMEO', 'TEAMS', 'ZOOM', 'WEBEX', 'GOOGLE_MEET',
  'WHATSAPP', 'X_TWITTER', 'TIKTOK', 'NATIVE_UPLOAD', 'OTHER',
] as const;

const STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;

const VISIBILITIES = ['PUBLIC', 'CUSTOMERS_ONLY', 'CLIENTS_ONLY', 'EMPLOYEES_ONLY', 'PRIVATE'] as const;

const PLACEMENTS = [
  'HOMEPAGE_HERO', 'HOMEPAGE_FEATURED', 'PRODUCT_PAGE', 'VIDEO_LIBRARY',
  'WEBINAR_ARCHIVE', 'LEARNING_CENTER', 'BLOG_EMBED', 'FAQ_SECTION',
  'CUSTOMER_ACCOUNT', 'AMBASSADOR_PAGE', 'CALCULATOR_HELP', 'LAB_RESULTS', 'COMMUNITY',
] as const;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  REVIEW: 'bg-amber-100 text-amber-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

const CONSENT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  GRANTED: 'bg-green-100 text-green-700',
  REVOKED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-slate-100 text-slate-600',
};

// ---------------------------------------------------------------------------
// Helper: format enum for display
// ---------------------------------------------------------------------------
function formatEnum(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = params.id as string;

  // -- Data state --
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // -- Form state (tracks only edited fields) --
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // -- Tags state --
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // -- Placements state --
  const [placements, setPlacements] = useState<VideoPlacement[]>([]);
  const [togglingPlacement, setTogglingPlacement] = useState<string | null>(null);

  // -- Consent state --
  const [consentData, setConsentData] = useState<{
    requiresConsent: boolean;
    hasGrantedConsent: boolean;
    canPublish: boolean;
    consents: ConsentEntry[];
  } | null>(null);
  const [requestingConsent, setRequestingConsent] = useState(false);

  // -- Product links state --
  const [productLinks, setProductLinks] = useState<ProductLink[]>([]);
  const [removingProduct, setRemovingProduct] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const loadVideo = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/videos/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error('Failed to load video');
      const data = await res.json();
      const v = data.video as VideoDetail;
      setVideo(v);
      setTags(v.tags || []);
      setPlacements(v.placements || []);
      setProductLinks(v.productLinks || []);
    } catch (err) {
      console.error('Failed to load video:', err);
      toast.error(t('admin.media.videoLoadError') || 'Failed to load video');
    }
  }, [id, t]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/video-categories?flat=true');
      if (!res.ok) return;
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      // non-critical
    }
  }, []);

  const loadConsent = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/videos/${id}/consent`);
      if (!res.ok) return;
      const data = await res.json();
      setConsentData(data);
    } catch {
      // non-critical
    }
  }, [id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadVideo(), loadCategories(), loadConsent()]);
      setLoading(false);
    };
    init();
  }, [loadVideo, loadCategories, loadConsent]);

  // -----------------------------------------------------------------------
  // Form helpers
  // -----------------------------------------------------------------------

  const getFormValue = <T,>(field: string, fallback: T): T => {
    if (field in form) return form[field] as T;
    if (!video) return fallback;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((video as any)[field] as T) ?? fallback;
  };

  const setField = (field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const hasChanges = Object.keys(form).length > 0;

  // -----------------------------------------------------------------------
  // Save main form
  // -----------------------------------------------------------------------

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const res = await fetchWithCSRF(`/api/admin/videos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success(t('admin.media.videoUpdated') || 'Video updated successfully');
        setForm({});
        await loadVideo();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.media.videoUpdateFailed') || 'Failed to update video');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error(t('admin.media.videoUpdateFailed') || 'Failed to update video');
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Tags
  // -----------------------------------------------------------------------

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || tags.includes(tag)) {
      setTagInput('');
      return;
    }
    setTags(prev => [...prev, tag]);
    setTagInput('');
    tagInputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t2 => t2 !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const saveTags = async () => {
    setSavingTags(true);
    try {
      const res = await fetchWithCSRF(`/api/admin/videos/${id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || tags);
        toast.success(t('admin.media.tagsSaved') || 'Tags saved');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to save tags');
      }
    } catch {
      toast.error('Failed to save tags');
    } finally {
      setSavingTags(false);
    }
  };

  // -----------------------------------------------------------------------
  // Placements
  // -----------------------------------------------------------------------

  const isPlacementActive = (placement: string): boolean => {
    return placements.some(p => p.placement === placement);
  };

  const getPlacementRecord = (placement: string): VideoPlacement | undefined => {
    return placements.find(p => p.placement === placement);
  };

  const togglePlacement = async (placement: string) => {
    const existing = getPlacementRecord(placement);
    setTogglingPlacement(placement);
    try {
      if (existing) {
        // Remove
        const res = await fetchWithCSRF(`/api/admin/videos/${id}/placements`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placementId: existing.id }),
        });
        if (res.ok) {
          setPlacements(prev => prev.filter(p => p.id !== existing.id));
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || 'Failed to remove placement');
        }
      } else {
        // Add
        const res = await fetchWithCSRF(`/api/admin/videos/${id}/placements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placement }),
        });
        if (res.ok) {
          const data = await res.json();
          setPlacements(prev => [...prev, data.placement]);
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || 'Failed to add placement');
        }
      }
    } catch {
      toast.error('Failed to toggle placement');
    } finally {
      setTogglingPlacement(null);
    }
  };

  // -----------------------------------------------------------------------
  // Consent
  // -----------------------------------------------------------------------

  const handleRequestConsent = async () => {
    // Simplified: in real usage, a modal would let admin pick formTemplateId & clientId
    // For now, we show a placeholder message
    if (!video?.featuredClientId) return;
    setRequestingConsent(true);
    try {
      toast.info(
        t('admin.media.consentRequestInfo') ||
        'Consent request flow requires selecting a form template. This feature is coming soon.',
      );
    } finally {
      setRequestingConsent(false);
    }
  };

  // -----------------------------------------------------------------------
  // Product links
  // -----------------------------------------------------------------------

  const removeProductLink = async (productId: string) => {
    setRemovingProduct(productId);
    try {
      const res = await fetchWithCSRF(`/api/admin/videos/${id}/products`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        setProductLinks(prev => prev.filter(pl => pl.product.id !== productId));
        toast.success(t('admin.media.productUnlinked') || 'Product unlinked');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to unlink product');
      }
    } catch {
      toast.error('Failed to unlink product');
    } finally {
      setRemovingProduct(null);
    }
  };

  // -----------------------------------------------------------------------
  // Render: loading / not found
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (notFound || !video) {
    return (
      <div className="p-6 max-w-3xl space-y-4">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-sky-600 transition-colors flex items-center gap-1">
            <House className="w-3 h-3" />{t('admin.nav.dashboard') || 'Admin'}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/admin/media" className="hover:text-sky-600 transition-colors">{t('admin.nav.media') || 'Media'}</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/admin/media/videos" className="hover:text-sky-600 transition-colors">{t('admin.media.videosTitle') || 'Videos'}</Link>
        </nav>
        <div className="text-center py-16">
          <VideoIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700">{t('admin.media.videoNotFound') || 'Video not found'}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('admin.media.videoNotFoundDesc') || 'The video you are looking for does not exist or has been deleted.'}</p>
          <Link
            href="/admin/media/videos"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('admin.media.backToVideos') || 'Back to Videos'}
          </Link>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: main page
  // -----------------------------------------------------------------------

  const flatCategories = categories.flatMap((c: VideoCategory) => {
    const items: VideoCategory[] = [c];
    if (c.children) {
      for (const child of c.children) {
        items.push(child);
      }
    }
    return items;
  });

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-sky-600 transition-colors flex items-center gap-1">
          <House className="w-3 h-3" />{t('admin.nav.dashboard') || 'Admin'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/media" className="hover:text-sky-600 transition-colors">{t('admin.nav.media') || 'Media'}</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/media/videos" className="hover:text-sky-600 transition-colors">{t('admin.media.videosTitle') || 'Videos'}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-700 font-medium truncate max-w-[200px]">{video.title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/media/videos"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          title={t('admin.media.backToVideos') || 'Back to Videos'}
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 truncate">{video.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('admin.media.slug') || 'Slug'}: <span className="font-mono text-slate-600">{video.slug}</span>
            {video.createdBy && (
              <> &middot; {t('admin.media.createdBy') || 'Created by'}: {video.createdBy.name || video.createdBy.email}</>
            )}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[video.status] || STATUS_COLORS.DRAFT}`}>
          {formatEnum(video.status)}
        </span>
      </div>

      {/* ============================================================ */}
      {/* SECTION 1: Main Form (two-column) */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Main info */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              {t('admin.media.videoInfo') || 'Video Information'}
            </h2>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('admin.media.videoTitleLabel') || 'Title'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                value={getFormValue('title', video.title)}
                onChange={e => setField('title', e.target.value)}
                required
              />
            </div>

            {/* Slug (read-only) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('admin.media.slug') || 'Slug'}
              </label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
                value={video.slug}
                readOnly
                tabIndex={-1}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('admin.media.descriptionLabel') || 'Description'}
              </label>
              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                rows={4}
                value={getFormValue('description', video.description || '')}
                onChange={e => setField('description', e.target.value)}
              />
            </div>

            {/* Video URL */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('admin.media.videoUrlLabel') || 'Video URL'}
              </label>
              <input
                type="url"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                placeholder="https://youtube.com/watch?v=..."
                value={getFormValue('videoUrl', video.videoUrl || '')}
                onChange={e => setField('videoUrl', e.target.value)}
              />
            </div>

            {/* Thumbnail URL + preview */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('admin.media.thumbnailUrlLabel') || 'Thumbnail URL'}
              </label>
              <input
                type="url"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                placeholder="https://..."
                value={getFormValue('thumbnailUrl', video.thumbnailUrl || '')}
                onChange={e => setField('thumbnailUrl', e.target.value)}
              />
              {(getFormValue('thumbnailUrl', video.thumbnailUrl || '') as string) && (
                <div className="mt-2 relative w-40 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                  <Image
                    src={getFormValue('thumbnailUrl', video.thumbnailUrl || '') as string}
                    alt={t('admin.media.thumbnailPreview') || 'Thumbnail preview'}
                    className="object-cover"
                    fill
                    unoptimized
                  />
                </div>
              )}
            </div>

            {/* Source URL */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('admin.media.sourceUrlLabel') || 'Source URL (original platform link)'}
              </label>
              <input
                type="url"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                placeholder="https://..."
                value={getFormValue('sourceUrl', video.sourceUrl || '')}
                onChange={e => setField('sourceUrl', e.target.value)}
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {t('admin.media.durationLabel') || 'Duration'}
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                placeholder="e.g. 12:30"
                value={getFormValue('duration', video.duration || '')}
                onChange={e => setField('duration', e.target.value)}
              />
            </div>
          </div>

          {/* Right column: Metadata */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              {t('admin.media.videoMetadata') || 'Metadata'}
            </h2>

            {/* Content Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('admin.media.contentTypeLabel') || 'Content Type'}
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white"
                value={getFormValue('contentType', video.contentType)}
                onChange={e => setField('contentType', e.target.value)}
              >
                {CONTENT_TYPES.map(ct => (
                  <option key={ct} value={ct}>{formatEnum(ct)}</option>
                ))}
              </select>
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('admin.media.sourceLabel') || 'Source'}
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white"
                value={getFormValue('source', video.source)}
                onChange={e => setField('source', e.target.value)}
              >
                {SOURCES.map(s => (
                  <option key={s} value={s}>{formatEnum(s)}</option>
                ))}
              </select>
            </div>

            {/* Video Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('admin.media.videoCategoryLabel') || 'Video Category'}
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white"
                value={getFormValue('videoCategoryId', video.videoCategoryId || '')}
                onChange={e => setField('videoCategoryId', e.target.value || null)}
              >
                <option value="">{t('admin.media.noCategorySelected') || '-- No category --'}</option>
                {flatCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('admin.media.statusLabel') || 'Status'}
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white"
                value={getFormValue('status', video.status)}
                onChange={e => setField('status', e.target.value)}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{formatEnum(s)}</option>
                ))}
              </select>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                {t('admin.media.visibilityLabel') || 'Visibility'}
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white"
                value={getFormValue('visibility', video.visibility)}
                onChange={e => setField('visibility', e.target.value)}
              >
                {VISIBILITIES.map(v => (
                  <option key={v} value={v}>{formatEnum(v)}</option>
                ))}
              </select>
            </div>

            {/* Instructor */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('admin.media.instructorLabel') || 'Instructor'}
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                value={getFormValue('instructor', video.instructor || '')}
                onChange={e => setField('instructor', e.target.value)}
              />
            </div>

            {/* Published (legacy) */}
            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={getFormValue('isPublished', video.isPublished) as boolean}
                  onChange={e => setField('isPublished', e.target.checked)}
                />
                {t('admin.media.published') || 'Published'} <span className="text-xs text-slate-400">({t('admin.media.legacy') || 'legacy'})</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={getFormValue('isFeatured', video.isFeatured) as boolean}
                  onChange={e => setField('isFeatured', e.target.checked)}
                />
                {t('admin.media.featured') || 'Featured'} <span className="text-xs text-slate-400">({t('admin.media.legacy') || 'legacy'})</span>
              </label>
            </div>

            {/* Meta info (read-only) */}
            <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
              <p>{t('admin.media.videoId') || 'ID'}: <span className="font-mono">{video.id}</span></p>
              <p>{t('admin.media.views') || 'Views'}: <span className="font-semibold text-slate-700">{video.views.toLocaleString()}</span></p>
              <p>{t('admin.media.createdAt') || 'Created'}: {new Date(video.createdAt).toLocaleString()}</p>
              <p>{t('admin.media.updatedAt') || 'Updated'}: {new Date(video.updatedAt).toLocaleString()}</p>
              {video.videoUrl && (
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t('admin.media.openVideo') || 'Open video'}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Save button for main form */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
          {hasChanges && (
            <span className="text-xs text-amber-600 mr-auto">
              {t('admin.media.unsavedChanges') || 'You have unsaved changes'}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('common.save') || 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 2: Tags */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
          <Tag className="w-4 h-4 text-slate-400" />
          {t('admin.media.tagsSection') || 'Tags'}
        </h2>

        {/* Tag pills */}
        <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
          {tags.length === 0 && (
            <span className="text-sm text-slate-400 italic">{t('admin.media.noTags') || 'No tags yet'}</span>
          )}
          {tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-slate-400 hover:text-red-500 transition-colors"
                aria-label={`${t('common.remove') || 'Remove'} ${tag}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        {/* Add tag input */}
        <div className="flex items-center gap-2">
          <input
            ref={tagInputRef}
            type="text"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
            placeholder={t('admin.media.addTagPlaceholder') || 'Type a tag and press Enter'}
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
          />
          <button
            onClick={addTag}
            disabled={!tagInput.trim()}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={saveTags}
            disabled={savingTags}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 disabled:opacity-50"
          >
            {savingTags ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('admin.media.saveTags') || 'Save Tags'}
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 3: Placements */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-slate-400" />
          {t('admin.media.placementsSection') || 'Content Placements'}
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          {t('admin.media.placementsDesc') || 'Select where this video should appear on the site. Changes are saved immediately.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {PLACEMENTS.map(placement => {
            const active = isPlacementActive(placement);
            const toggling = togglingPlacement === placement;
            return (
              <label
                key={placement}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                  active
                    ? 'bg-sky-50 border-sky-200 text-sky-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {toggling ? (
                  <Loader2 className="w-4 h-4 animate-spin text-sky-500 flex-shrink-0" />
                ) : (
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 flex-shrink-0"
                    checked={active}
                    onChange={() => togglePlacement(placement)}
                  />
                )}
                <span className="truncate">{formatEnum(placement)}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 4: Linked Products */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-slate-400" />
          {t('admin.media.linkedProducts') || 'Linked Products'}
        </h2>

        {productLinks.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            {t('admin.media.noLinkedProducts') || 'No products linked to this video.'}
          </p>
        ) : (
          <div className="space-y-2">
            {productLinks.map(pl => (
              <div
                key={pl.id}
                className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
              >
                {pl.product.imageUrl ? (
                  <div className="relative w-10 h-10 rounded overflow-hidden bg-slate-100 flex-shrink-0">
                    <Image
                      src={pl.product.imageUrl}
                      alt={pl.product.name}
                      className="object-cover"
                      fill
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-slate-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{pl.product.name}</p>
                  {pl.product.price !== null && (
                    <p className="text-xs text-slate-500">${Number(pl.product.price).toFixed(2)}</p>
                  )}
                </div>
                <button
                  onClick={() => removeProductLink(pl.product.id)}
                  disabled={removingProduct === pl.product.id}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1 disabled:opacity-50"
                  aria-label={`${t('common.remove') || 'Remove'} ${pl.product.name}`}
                >
                  {removingProduct === pl.product.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SECTION 5: Consent (only if featuredClientId is set) */}
      {/* ============================================================ */}
      {video.featuredClientId && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            {t('admin.media.consentSection') || 'Client Consent'}
          </h2>

          {/* Featured client info */}
          <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm">
            <p className="text-slate-600">
              <span className="font-medium text-slate-700">{t('admin.media.featuredClient') || 'Featured client'}:</span>{' '}
              {video.featuredClient?.name || video.featuredClient?.email || video.featuredClientId}
            </p>
          </div>

          {/* Consent status */}
          {consentData ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">{t('admin.media.canPublish') || 'Can publish'}:</span>
                {consentData.canPublish ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    {t('common.yes') || 'Yes'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                    {t('common.no') || 'No'} &mdash; {t('admin.media.consentRequired') || 'consent required'}
                  </span>
                )}
              </div>

              {consentData.consents.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  {t('admin.media.noConsentRequested') || 'No consent has been requested yet.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {consentData.consents.map(consent => (
                    <div
                      key={consent.id}
                      className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg text-sm"
                    >
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONSENT_STATUS_COLORS[consent.status] || CONSENT_STATUS_COLORS.PENDING}`}>
                        {formatEnum(consent.status)}
                      </span>
                      <span className="text-slate-600 flex-1">
                        {consent.client.name || consent.client.email}
                        {consent.formTemplate && (
                          <span className="text-slate-400 ml-2">({consent.formTemplate.name})</span>
                        )}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(consent.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Request consent button */}
              {!consentData.hasGrantedConsent && (
                <button
                  onClick={handleRequestConsent}
                  disabled={requestingConsent}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-sky-300 text-sky-700 rounded-lg text-sm hover:bg-sky-50 disabled:opacity-50 mt-2"
                >
                  {requestingConsent ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  {t('admin.media.requestConsent') || 'Request Consent'}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.loading') || 'Loading...'}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* BOTTOM: Prominent Save */}
      {/* ============================================================ */}
      <div className="flex items-center justify-end gap-3 pb-4">
        <Link
          href="/admin/media/videos"
          className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
        >
          {t('common.cancel') || 'Cancel'}
        </Link>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('common.save') || 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
