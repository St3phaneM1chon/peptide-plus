'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Video,
  Play,
  Calendar,
  Clock,
  Monitor,
  Film,
  ExternalLink,
  Search,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoItem {
  id: string;
  type: 'session' | 'featured';
  contentType: string;
  title: string;
  platform: string | null;
  status: string;
  scheduledAt: string | null;
  duration: number | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  videoTitle: string | null;
  videoSlug: string | null;
  videoSource: string | null;
  videoStatus: string | null;
  createdBy: { id: string; name: string | null } | null;
  createdAt: string;
}

interface CustomerVideosData {
  grouped: Record<string, VideoItem[]>;
  totalCount: number;
  contentTypes: string[];
}

// ---------------------------------------------------------------------------
// Content type ordering & icons
// ---------------------------------------------------------------------------

const CONTENT_TYPE_ORDER = [
  'TRAINING',
  'PERSONAL_SESSION',
  'PRODUCT_DEMO',
  'TUTORIAL',
  'WEBINAR_RECORDING',
  'TESTIMONIAL',
  'PODCAST',
  'FAQ_VIDEO',
  'BRAND_STORY',
  'LIVE_STREAM',
  'OTHER',
];

const CONTENT_TYPE_COLORS: Record<string, string> = {
  TRAINING: 'bg-blue-100 text-blue-700',
  PERSONAL_SESSION: 'bg-purple-100 text-purple-700',
  PRODUCT_DEMO: 'bg-emerald-100 text-emerald-700',
  TUTORIAL: 'bg-amber-100 text-amber-700',
  WEBINAR_RECORDING: 'bg-indigo-100 text-indigo-700',
  TESTIMONIAL: 'bg-pink-100 text-pink-700',
  PODCAST: 'bg-orange-100 text-orange-700',
  FAQ_VIDEO: 'bg-teal-100 text-teal-700',
  BRAND_STORY: 'bg-rose-100 text-rose-700',
  LIVE_STREAM: 'bg-red-100 text-red-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

const PLATFORM_BADGES: Record<string, { label: string; color: string }> = {
  zoom: { label: 'Zoom', color: 'bg-blue-50 text-blue-600' },
  teams: { label: 'Teams', color: 'bg-violet-50 text-violet-600' },
  'google-meet': { label: 'Google Meet', color: 'bg-green-50 text-green-600' },
  webex: { label: 'Webex', color: 'bg-cyan-50 text-cyan-600' },
};

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-yellow-50 text-yellow-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700',
  NO_SHOW: 'bg-slate-50 text-slate-500',
  PUBLISHED: 'bg-green-50 text-green-700',
  DRAFT: 'bg-slate-50 text-slate-500',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CustomerVideos({ clientId }: { clientId: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<CustomerVideosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContentType, setSelectedContentType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedContentType) params.set('contentType', selectedContentType);
      if (searchQuery) params.set('search', searchQuery);
      const qs = params.toString();
      const res = await fetch(`/api/admin/customers/${clientId}/videos${qs ? `?${qs}` : ''}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clientId, selectedContentType, searchQuery]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Format helpers
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return null;
    if (minutes < 60) return `${minutes}min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  // Sort content types by predefined order
  const sortedContentTypes = data
    ? Object.keys(data.grouped).sort((a, b) => {
        const idxA = CONTENT_TYPE_ORDER.indexOf(a);
        const idxB = CONTENT_TYPE_ORDER.indexOf(b);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      })
    : [];

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 rounded-xl border border-red-200 p-6 text-center text-red-600">
        <p>{error}</p>
        <button
          onClick={fetchVideos}
          className="mt-2 text-sm underline hover:text-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (!data || data.totalCount === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Video className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500 font-medium">{t('admin.customerVideos.noVideos')}</p>
        <p className="text-sm text-slate-400 mt-1">{t('admin.customerVideos.noVideosDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admin.customerVideos.searchPlaceholder') || 'Search videos...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
        </div>

        {/* Category filter */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">
              {selectedContentType
                ? t(`admin.customerVideos.${selectedContentType}`)
                : t('admin.customerVideos.allCategories')}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {filterOpen && (
            <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20">
              <button
                onClick={() => { setSelectedContentType(''); setFilterOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${!selectedContentType ? 'font-medium text-sky-600' : 'text-slate-600'}`}
              >
                {t('admin.customerVideos.allCategories')}
              </button>
              {CONTENT_TYPE_ORDER.map((ct) => (
                <button
                  key={ct}
                  onClick={() => { setSelectedContentType(ct); setFilterOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${selectedContentType === ct ? 'font-medium text-sky-600' : 'text-slate-600'}`}
                >
                  {t(`admin.customerVideos.${ct}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-slate-500">
        {data.totalCount} {data.totalCount === 1 ? 'video' : 'videos'}
        {selectedContentType && (
          <span> &middot; {t(`admin.customerVideos.${selectedContentType}`)}</span>
        )}
      </p>

      {/* Grouped video sections */}
      {sortedContentTypes.map((contentType) => {
        const videos = data.grouped[contentType];
        if (!videos || videos.length === 0) return null;

        return (
          <div key={contentType} className="space-y-3">
            {/* Category Header */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${CONTENT_TYPE_COLORS[contentType] || CONTENT_TYPE_COLORS.OTHER}`}>
                <Film className="w-3 h-3" />
                {t(`admin.customerVideos.${contentType}`)}
              </span>
              <span className="text-xs text-slate-400">({videos.length})</span>
            </div>

            {/* Video Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {videos.map((item) => (
                <VideoCard
                  key={item.id}
                  item={item}
                  t={t}
                  formatDate={formatDate}
                  formatDuration={formatDuration}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VideoCard sub-component
// ---------------------------------------------------------------------------

function VideoCard({
  item,
  t,
  formatDate,
  formatDuration,
}: {
  item: VideoItem;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (d: string) => string;
  formatDuration: (m: number | null) => string | null;
}) {
  const hasRecording = !!item.videoUrl;
  const displayTitle = item.videoTitle || item.title;
  const dateStr = item.scheduledAt || item.createdAt;
  const durationStr = formatDuration(item.duration);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all">
      {/* Thumbnail / Placeholder */}
      <div className="relative h-36 bg-slate-100 flex items-center justify-center">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={displayTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <Video className="w-10 h-10 text-slate-300" />
        )}

        {/* Play overlay when recording exists */}
        {hasRecording && (
          <a
            href={item.videoUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          >
            <div className="bg-white/90 rounded-full p-3 shadow-lg">
              <Play className="w-6 h-6 text-slate-800 fill-slate-800" />
            </div>
          </a>
        )}

        {/* Duration badge */}
        {durationStr && (
          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
            {durationStr}
          </span>
        )}

        {/* Platform badge */}
        {item.platform && PLATFORM_BADGES[item.platform] && (
          <span className={`absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded font-medium ${PLATFORM_BADGES[item.platform].color}`}>
            {PLATFORM_BADGES[item.platform].label}
          </span>
        )}

        {/* Video source badge (for featured videos) */}
        {item.type === 'featured' && item.videoSource && (
          <span className="absolute top-2 left-2 bg-white/80 text-slate-600 text-xs px-1.5 py-0.5 rounded font-medium">
            {item.videoSource}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="text-sm font-medium text-slate-900 truncate" title={displayTitle}>
          {displayTitle}
        </h4>

        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(dateStr)}
          </span>
          {durationStr && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {durationStr}
            </span>
          )}
        </div>

        {/* Status + Actions */}
        <div className="flex items-center justify-between mt-2.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[item.status] || STATUS_STYLES.DRAFT}`}>
            {item.status}
          </span>

          {hasRecording ? (
            <a
              href={item.videoUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 font-medium"
            >
              <ExternalLink className="w-3 h-3" />
              {t('admin.customerVideos.viewRecording')}
            </a>
          ) : (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Monitor className="w-3 h-3" />
              {t('admin.customerVideos.noRecording')}
            </span>
          )}
        </div>

        {/* Created by */}
        {item.createdBy?.name && (
          <p className="text-xs text-slate-400 mt-1.5 truncate">
            {item.createdBy.name}
          </p>
        )}
      </div>
    </div>
  );
}
