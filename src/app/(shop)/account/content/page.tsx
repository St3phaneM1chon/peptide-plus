'use client';

/**
 * Ma Mediatheque — Client's personal content library
 * Shows all videos accessible to the authenticated client
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Video, Search, Loader2, ChevronLeft, ChevronRight,
  Play, Clock, Eye, Filter, X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface VideoItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  duration: string | null;
  views: number;
  contentType: string;
  source: string;
  createdAt: string;
  tags: string[];
  videoCategory: { id: string; name: string; slug: string } | null;
}

const typeLabels: Record<string, string> = {
  PODCAST: 'Podcast',
  TRAINING: 'Training',
  PERSONAL_SESSION: 'Session',
  PRODUCT_DEMO: 'Demo',
  TESTIMONIAL: 'Testimonial',
  FAQ_VIDEO: 'FAQ',
  WEBINAR_RECORDING: 'Webinar',
  TUTORIAL: 'Tutorial',
  BRAND_STORY: 'Brand',
  LIVE_STREAM: 'Live',
  OTHER: 'Video',
};

export default function AccountContentPage() {
  const { t } = useI18n();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (search) params.set('search', search);

      const res = await fetch(`/api/account/content?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setVideos(data.videos);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch {
      // Silent error
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Video className="h-6 w-6 text-orange-600" />
          {t('account.content.title') !== 'account.content.title' ? t('account.content.title') : 'My Content Library'}
        </h1>
        <p className="text-gray-500 mt-1">
          {t('account.content.description') !== 'account.content.description'
            ? t('account.content.description')
            : 'Videos, training sessions, and content available to you.'}
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={t('common.search') !== 'common.search' ? t('common.search') : 'Search videos...'}
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm"
          />
        </div>
        <button onClick={handleSearch} className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm">
          <Search className="h-4 w-4" />
        </button>
        {search && (
          <button
            onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
            className="px-3 py-2.5 text-gray-500 hover:text-gray-700 text-sm"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500">
        {total} {total === 1 ? 'video' : 'videos'}
        {search && ` matching "${search}"`}
      </p>

      {/* Videos Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl">
          <Video className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {search
              ? t('account.content.noResults') !== 'account.content.noResults' ? t('account.content.noResults') : 'No videos found matching your search.'
              : t('account.content.empty') !== 'account.content.empty' ? t('account.content.empty') : 'No content available yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map(video => (
            <Link
              key={video.id}
              href={`/videos/${video.slug}`}
              className="group bg-white border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-100">
                {video.thumbnailUrl ? (
                  <Image
                    src={video.thumbnailUrl}
                    alt={video.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
                    <Play className="h-10 w-10 text-orange-400" />
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                    <Play className="h-5 w-5 text-orange-600 ml-0.5" />
                  </div>
                </div>
                {/* Duration */}
                {video.duration && (
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {video.duration}
                  </div>
                )}
                {/* Type badge */}
                <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {typeLabels[video.contentType] || video.contentType}
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-2">
                  {video.title}
                </h3>
                {video.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{video.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  {video.videoCategory && (
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                      {video.videoCategory.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {video.views}
                  </span>
                  <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('common.previous') !== 'common.previous' ? t('common.previous') : 'Previous'}
          </button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            {t('common.next') !== 'common.next' ? t('common.next') : 'Next'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
