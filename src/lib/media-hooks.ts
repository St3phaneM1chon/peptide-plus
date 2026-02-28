/**
 * SWR Hooks for Media Admin Pages
 * Provides cached data fetching with automatic revalidation.
 * Chantier 1.1: Replace raw fetch() calls with SWR hooks.
 */

import useSWR, { type SWRConfiguration } from 'swr';

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error('Fetch failed') as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Common SWR config
// ---------------------------------------------------------------------------

const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 5_000, // Dedupe requests within 5s
  errorRetryCount: 2,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
  pages?: number;
  hasMore?: boolean;
}

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
  createdBy?: { id: string; name: string | null; email: string };
}

interface MediaItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  alt: string | null;
  folder: string;
  createdAt: string;
}

interface MediaStats {
  totalMedia: number;
  imageCount: number;
  videoFileCount: number;
  pdfCount: number;
}

// ---------------------------------------------------------------------------
// Videos Hook
// ---------------------------------------------------------------------------

interface UseVideosParams {
  page?: number;
  limit?: number;
  search?: string;
  isPublished?: string;
  contentType?: string;
  status?: string;
  source?: string;
}

export function useVideos(params: UseVideosParams = {}) {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page || 1));
  qs.set('limit', String(params.limit || 20));
  if (params.search) qs.set('search', params.search);
  if (params.isPublished) qs.set('isPublished', params.isPublished);
  if (params.contentType) qs.set('contentType', params.contentType);
  if (params.status) qs.set('status', params.status);
  if (params.source) qs.set('source', params.source);

  const key = `/api/admin/videos?${qs.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<{
    videos: VideoItem[];
    pagination: Pagination;
  }>(key, fetcher, defaultConfig);

  return {
    videos: data?.videos || [],
    pagination: data?.pagination || null,
    isLoading,
    error,
    mutate,
  };
}

// ---------------------------------------------------------------------------
// Social Posts Hook
// ---------------------------------------------------------------------------

interface UseSocialPostsParams {
  page?: number;
  limit?: number;
  platform?: string;
  status?: string;
}

export function useSocialPosts(params: UseSocialPostsParams = {}) {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page || 1));
  qs.set('limit', String(params.limit || 20));
  if (params.platform) qs.set('platform', params.platform);
  if (params.status) qs.set('status', params.status);

  const key = `/api/admin/social-posts?${qs.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<{
    posts: SocialPost[];
    pagination: Pagination;
  }>(key, fetcher, defaultConfig);

  return {
    posts: data?.posts || [],
    pagination: data?.pagination || null,
    isLoading,
    error,
    mutate,
  };
}

// ---------------------------------------------------------------------------
// Media Library Hook
// ---------------------------------------------------------------------------

interface UseMediasParams {
  page?: number;
  limit?: number;
  folder?: string;
  mimeType?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export function useMedias(params: UseMediasParams = {}) {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page || 1));
  qs.set('limit', String(params.limit || 50));
  if (params.folder) qs.set('folder', params.folder);
  if (params.mimeType) qs.set('mimeType', params.mimeType);
  if (params.search) qs.set('search', params.search);
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.sortDir) qs.set('sortDir', params.sortDir);

  const key = `/api/admin/medias?${qs.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<{
    media: MediaItem[];
    pagination: Pagination;
  }>(key, fetcher, defaultConfig);

  return {
    media: data?.media || [],
    pagination: data?.pagination || null,
    isLoading,
    error,
    mutate,
  };
}

// ---------------------------------------------------------------------------
// Media Stats Hook
// ---------------------------------------------------------------------------

export function useMediaStats() {
  const key = '/api/admin/medias?stats=true';

  const { data, error, isLoading, mutate } = useSWR<MediaStats>(
    key,
    fetcher,
    { ...defaultConfig, refreshInterval: 60_000 }, // Refresh stats every minute
  );

  return {
    stats: data || null,
    isLoading,
    error,
    mutate,
  };
}

// ---------------------------------------------------------------------------
// Single Video Hook
// ---------------------------------------------------------------------------

export function useVideo(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ video: VideoItem }>(
    id ? `/api/admin/videos/${id}` : null,
    fetcher,
    defaultConfig,
  );

  return {
    video: data?.video || null,
    isLoading,
    error,
    mutate,
  };
}

// ---------------------------------------------------------------------------
// Ads Hook
// ---------------------------------------------------------------------------

interface AdCampaignSnapshot {
  id: string;
  platform: string;
  campaignId: string;
  campaignName: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  currency: string;
}

interface UseAdsParams {
  platform?: string;
  page?: number;
  limit?: number;
}

export function useAds(params: UseAdsParams = {}) {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page || 1));
  qs.set('limit', String(params.limit || 50));
  if (params.platform) qs.set('platform', params.platform);

  const key = `/api/admin/ads?${qs.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<{
    campaigns: AdCampaignSnapshot[];
    pagination: Pagination;
  }>(key, fetcher, defaultConfig);

  return {
    campaigns: data?.campaigns || [],
    pagination: data?.pagination || null,
    isLoading,
    error,
    mutate,
  };
}

// ---------------------------------------------------------------------------
// Platform Connections Hook
// ---------------------------------------------------------------------------

interface PlatformConnection {
  platform: string;
  name: string;
  icon: string;
  description: string;
  isConnected: boolean;
  isEnabled: boolean;
  autoImport: boolean;
  syncStatus: string | null;
  syncError: string | null;
  importCount: number;
}

export function usePlatformConnections() {
  const key = '/api/admin/platform-connections';

  const { data, error, isLoading, mutate } = useSWR<{
    platforms: PlatformConnection[];
  }>(key, fetcher, defaultConfig);

  return {
    platforms: data?.platforms || [],
    isLoading,
    error,
    mutate,
  };
}
