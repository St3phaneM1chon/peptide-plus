'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useI18n } from '@/i18n/client';
import {
  Search,
  Play,
  Eye,
  Clock,
  Star,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Film,
  BookOpen,
  HelpCircle,
  Calculator,
  FlaskConical,
  Tag,
} from 'lucide-react';

// Lazy-load the VideoPlayer (heavy iframe logic, not needed at initial paint)
const VideoPlayer = dynamic(
  () => import('@/components/content/VideoPlayer'),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Types (matching the /api/videos response)
// ---------------------------------------------------------------------------

interface VideoCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

interface ApiVideo {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  duration: string | null;
  views: number;
  isFeatured: boolean;
  contentType: string;
  source: string;
  instructor: string | null;
  createdAt: string;
  videoCategory: VideoCategory | null;
  tags: string[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface ApiResponse {
  videos: ApiVideo[];
  pagination: Pagination;
  categories: VideoCategory[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

/** Map a content-type enum to a human-readable label */
function contentTypeLabel(ct: string): string {
  const map: Record<string, string> = {
    PODCAST: 'Podcast',
    TRAINING: 'Training',
    PERSONAL_SESSION: 'Personal Session',
    PRODUCT_DEMO: 'Product Demo',
    TESTIMONIAL: 'Testimonial',
    FAQ_VIDEO: 'FAQ',
    WEBINAR_RECORDING: 'Webinar',
    TUTORIAL: 'Tutorial',
    BRAND_STORY: 'Brand Story',
    LIVE_STREAM: 'Live Stream',
    OTHER: 'Other',
  };
  return map[ct] || ct;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideosPage() {
  const { t, locale } = useI18n();

  // --- State ---------------------------------------------------------------
  const [videos, setVideos] = useState<ApiVideo[]>([]);
  const [featuredVideos, setFeaturedVideos] = useState<ApiVideo[]>([]);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<string>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [playingVideo, setPlayingVideo] = useState<ApiVideo | null>(null);

  // Debounce timer ref for search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Data fetching -------------------------------------------------------
  const fetchVideos = useCallback(
    async (page: number, search: string, categoryId: string, sort: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', '18');
        params.set('sort', sort);
        params.set('locale', locale);
        if (search) params.set('search', search);
        if (categoryId && categoryId !== 'all') params.set('categoryId', categoryId);

        const res = await fetch(`/api/videos?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data: ApiResponse = await res.json();

        setVideos(data.videos);
        setPagination(data.pagination);

        // Only update categories on first load or when they arrive
        if (data.categories.length > 0) {
          setCategories(data.categories);
        }

        // Extract featured from the first page when no filters are active
        if (page === 1 && !search && categoryId === 'all') {
          setFeaturedVideos(data.videos.filter((v) => v.isFeatured));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load videos');
      } finally {
        setIsLoading(false);
      }
    },
    [locale]
  );

  // Initial load + refetch on filter change
  useEffect(() => {
    fetchVideos(currentPage, searchQuery, activeCategoryId, sortOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, activeCategoryId, sortOrder]);

  // Debounced search (300ms)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setCurrentPage(1);
      fetchVideos(1, searchQuery, activeCategoryId, sortOrder);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // --- Handlers ------------------------------------------------------------
  const handleCategoryChange = (catId: string) => {
    setActiveCategoryId(catId);
    setCurrentPage(1);
  };

  const handleSortChange = (newSort: string) => {
    setSortOrder(newSort);
    setCurrentPage(1);
  };

  const openVideoModal = (video: ApiVideo) => {
    setPlayingVideo(video);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  };

  const closeVideoModal = () => {
    setPlayingVideo(null);
    document.body.style.overflow = '';
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && playingVideo) closeVideoModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingVideo]);

  // Whether we should show the featured section
  const showFeatured =
    !searchQuery && activeCategoryId === 'all' && featuredVideos.length > 0 && currentPage === 1;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ====== Hero ====== */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <Film className="w-9 h-9 text-orange-400" />
            <h1 className="text-3xl md:text-4xl font-bold">
              {t('videos.title') || 'Video Library'}
            </h1>
          </div>
          <p className="text-xl text-neutral-300 max-w-2xl">
            {t('videos.subtitle') || 'Learn everything about peptide handling, storage, and research with our comprehensive video library.'}
          </p>

          {/* Search + Sort row */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8 max-w-2xl">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('videos.searchPlaceholder') || 'Search videos...'}
                className="w-full ps-12 pe-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Sort */}
            <select
              value={sortOrder}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
            >
              <option value="newest" className="text-black">{t('videos.sortNewest') || 'Newest'}</option>
              <option value="popular" className="text-black">{t('videos.sortPopular') || 'Most Popular'}</option>
              <option value="oldest" className="text-black">{t('videos.sortOldest') || 'Oldest'}</option>
              <option value="title" className="text-black">{t('videos.sortTitle') || 'A - Z'}</option>
            </select>
          </div>

          {/* Results count */}
          {pagination && !isLoading && (
            <p className="mt-4 text-sm text-neutral-400">
              {pagination.total === 0
                ? (t('videos.noResultsCount') || 'No videos found')
                : `${pagination.total} ${pagination.total === 1 ? (t('videos.videoSingular') || 'video') : (t('videos.videoPlural') || 'videos')}`}
            </p>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ====== Category Pills ====== */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-thin">
          {/* "All" pill */}
          <button
            onClick={() => handleCategoryChange('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeCategoryId === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            <Film className="w-4 h-4" />
            {t('videos.allVideos') || 'All Videos'}
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeCategoryId === cat.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
              }`}
            >
              {cat.icon ? (
                <span className="text-base">{cat.icon}</span>
              ) : (
                <Tag className="w-4 h-4" />
              )}
              {cat.name}
            </button>
          ))}
        </div>

        {/* ====== Loading Spinner ====== */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <span className="ml-3 text-neutral-500">{t('common.loading') || 'Loading...'}</span>
          </div>
        )}

        {/* ====== Error State ====== */}
        {error && !isLoading && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">&#9888;&#65039;</div>
            <h3 className="text-lg font-bold mb-2 text-red-600">{t('common.error') || 'Error'}</h3>
            <p className="text-neutral-500 mb-4">{error}</p>
            <button
              onClick={() => fetchVideos(currentPage, searchQuery, activeCategoryId, sortOrder)}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              {t('common.retry') || 'Retry'}
            </button>
          </div>
        )}

        {/* ====== Content (not loading, no error) ====== */}
        {!isLoading && !error && (
          <>
            {/* ---- Featured Videos ---- */}
            {showFeatured && (
              <section className="mb-12">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-orange-500" />
                  <h2 className="text-xl font-bold">{t('videos.featured') || 'Featured Videos'}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {featuredVideos.slice(0, 4).map((video) => (
                    <button
                      key={video.id}
                      onClick={() => openVideoModal(video)}
                      className="text-left bg-white rounded-xl overflow-hidden shadow-sm border border-neutral-200 hover:shadow-lg transition-shadow cursor-pointer group"
                    >
                      <div className="relative aspect-video bg-neutral-200 overflow-hidden">
                        {video.thumbnailUrl ? (
                          <Image
                            src={video.thumbnailUrl}
                            alt={video.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300">
                            <Play className="w-12 h-12 text-neutral-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center">
                            <Play className="w-8 h-8 text-white ms-1" fill="currentColor" />
                          </div>
                        </div>
                        {video.duration && (
                          <span className="absolute bottom-2 end-2 px-2 py-1 bg-black/80 text-white text-xs rounded flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {video.duration}
                          </span>
                        )}
                        <span className="absolute top-2 start-2 px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          {t('videos.featuredBadge') || 'Featured'}
                        </span>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold line-clamp-2 group-hover:text-orange-600 transition-colors">
                          {video.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-2 text-sm text-neutral-500">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            {formatViews(video.views)} {t('common.views') || 'views'}
                          </span>
                          {video.videoCategory && (
                            <>
                              <span>&#183;</span>
                              <span>{video.videoCategory.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ---- Main Video Grid ---- */}
            {videos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => openVideoModal(video)}
                    className="text-left bg-white rounded-xl overflow-hidden shadow-sm border border-neutral-200 hover:shadow-lg transition-shadow cursor-pointer group"
                  >
                    <div className="relative aspect-video bg-neutral-200 overflow-hidden">
                      {video.thumbnailUrl ? (
                        <Image
                          src={video.thumbnailUrl}
                          alt={video.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300">
                          <Play className="w-12 h-12 text-neutral-400" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center">
                          <Play className="w-8 h-8 text-white ms-1" fill="currentColor" />
                        </div>
                      </div>
                      {video.duration && (
                        <span className="absolute bottom-2 end-2 px-2 py-1 bg-black/80 text-white text-xs rounded flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {video.duration}
                        </span>
                      )}
                      {video.isFeatured && (
                        <span className="absolute top-2 start-2 px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded">
                          <Star className="w-3 h-3 inline-block mr-1" />
                          {t('videos.featuredBadge') || 'Featured'}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      {/* Category + Content type badges */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {video.videoCategory && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                            {video.videoCategory.name}
                          </span>
                        )}
                        <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-1 rounded-full">
                          {contentTypeLabel(video.contentType)}
                        </span>
                      </div>
                      <h3 className="font-semibold line-clamp-2 group-hover:text-orange-600 transition-colors">
                        {video.title}
                      </h3>
                      {video.description && (
                        <p className="text-sm text-neutral-500 mt-2 line-clamp-2">{video.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-sm text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {formatViews(video.views)}
                        </span>
                        {video.instructor && (
                          <>
                            <span>&#183;</span>
                            <span className="truncate max-w-[120px]">{video.instructor}</span>
                          </>
                        )}
                        {video.tags.length > 0 && (
                          <>
                            <span>&#183;</span>
                            <span className="flex items-center gap-1 truncate max-w-[120px]">
                              <Tag className="w-3 h-3" />
                              {video.tags.slice(0, 2).join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* ---- Empty State ---- */
              <div className="text-center py-16">
                <Search className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">{t('videos.noResults') || 'No videos found'}</h3>
                <p className="text-neutral-500 mb-4">
                  {t('videos.tryDifferent') || 'Try a different search or category'}
                </p>
                {(searchQuery || activeCategoryId !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setActiveCategoryId('all');
                      setCurrentPage(1);
                    }}
                    className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    {t('videos.clearFilters') || 'Clear Filters'}
                  </button>
                )}
              </div>
            )}

            {/* ---- Pagination ---- */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-10">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-neutral-200 rounded-lg font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t('common.previous') || 'Previous'}
                </button>

                <span className="text-sm text-neutral-500">
                  {t('common.pageOf') || 'Page'} {pagination.page} / {pagination.totalPages}
                </span>

                <button
                  disabled={!pagination.hasMore}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-neutral-200 rounded-lg font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('common.next') || 'Next'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ====== Quick Links ====== */}
        <div className="mt-12 bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h3 className="text-lg font-bold mb-4">{t('videos.quickLinks') || 'Quick Links'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/learn"
              className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <BookOpen className="w-6 h-6 text-orange-500" />
              <span className="font-medium">{t('videos.learningCenter') || 'Learning Center'}</span>
            </Link>
            <Link
              href="/faq"
              className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <HelpCircle className="w-6 h-6 text-orange-500" />
              <span className="font-medium">{t('videos.faq') || 'FAQ'}</span>
            </Link>
            <Link
              href="/#calculator"
              className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <Calculator className="w-6 h-6 text-orange-500" />
              <span className="font-medium">{t('videos.calculator') || 'Calculator'}</span>
            </Link>
            <Link
              href="/lab-results"
              className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <FlaskConical className="w-6 h-6 text-orange-500" />
              <span className="font-medium">{t('videos.labResults') || 'Lab Results'}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ====== Video Player Modal ====== */}
      {playingVideo && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-player-modal-title"
          onClick={(e) => {
            // Close when clicking the backdrop
            if (e.target === e.currentTarget) closeVideoModal();
          }}
        >
          <div className="w-full max-w-5xl">
            {/* Header row */}
            <div className="flex items-start justify-between mb-4 gap-4">
              <div className="min-w-0">
                <h3
                  id="video-player-modal-title"
                  className="text-white font-bold text-xl truncate"
                >
                  {playingVideo.title}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-neutral-400 flex-wrap">
                  {playingVideo.videoCategory && (
                    <span className="bg-white/10 px-2 py-0.5 rounded text-xs">
                      {playingVideo.videoCategory.name}
                    </span>
                  )}
                  <span className="bg-white/10 px-2 py-0.5 rounded text-xs">
                    {contentTypeLabel(playingVideo.contentType)}
                  </span>
                  {playingVideo.instructor && <span>{playingVideo.instructor}</span>}
                </div>
              </div>
              <button
                onClick={closeVideoModal}
                aria-label={t('common.close') || 'Close'}
                className="p-2 text-white hover:bg-white/10 rounded-lg shrink-0"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Player */}
            {playingVideo.videoUrl ? (
              <VideoPlayer
                videoUrl={playingVideo.videoUrl}
                thumbnailUrl={playingVideo.thumbnailUrl || undefined}
                title={playingVideo.title}
                source={playingVideo.source as import('@/components/content/VideoPlayer').VideoSource}
              />
            ) : (
              <div className="aspect-video bg-neutral-800 rounded-xl flex items-center justify-center">
                <p className="text-neutral-400">{t('videos.noVideoUrl') || 'No video URL available'}</p>
              </div>
            )}

            {/* Description + meta below the player */}
            <div className="mt-4 text-white">
              {playingVideo.description && (
                <p className="text-neutral-300 line-clamp-4">{playingVideo.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-neutral-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {formatViews(playingVideo.views)} {t('common.views') || 'views'}
                </span>
                {playingVideo.duration && (
                  <>
                    <span>&#183;</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {playingVideo.duration}
                    </span>
                  </>
                )}
                <span>&#183;</span>
                <span>
                  {new Date(playingVideo.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              {playingVideo.tags.length > 0 && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {playingVideo.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-white/10 text-neutral-300 px-2 py-1 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
