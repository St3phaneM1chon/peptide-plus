'use client';

import { useState, useCallback, useRef } from 'react';
import { Play, ExternalLink, Maximize } from 'lucide-react';
import { useI18n } from '@/i18n/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Must match prisma enum VideoSource */
export type VideoSource =
  | 'YOUTUBE'
  | 'VIMEO'
  | 'TEAMS'
  | 'ZOOM'
  | 'WEBEX'
  | 'GOOGLE_MEET'
  | 'WHATSAPP'
  | 'X_TWITTER'
  | 'TIKTOK'
  | 'NATIVE_UPLOAD'
  | 'OTHER';

export interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
  title?: string;
  source?: VideoSource;
  className?: string;
}

// ---------------------------------------------------------------------------
// URL parsing helpers
// ---------------------------------------------------------------------------

function extractYouTubeId(url: string): string | null {
  const patterns = [
    // https://www.youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    // https://youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // https://www.youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // https://www.youtube.com/shorts/VIDEO_ID
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    // https://www.youtube.com/v/VIDEO_ID
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractVimeoId(url: string): string | null {
  const patterns = [
    // https://vimeo.com/123456789
    /vimeo\.com\/(\d+)/,
    // https://player.vimeo.com/video/123456789
    /player\.vimeo\.com\/video\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Auto-detect the video source from the URL when source prop is not provided.
 */
function detectSource(url: string): VideoSource {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YOUTUBE';
  if (lower.includes('vimeo.com')) return 'VIMEO';
  if (lower.includes('teams.microsoft.com') || lower.includes('teams.live.com')) return 'TEAMS';
  if (lower.includes('zoom.us') || lower.includes('zoom.com')) return 'ZOOM';
  if (lower.includes('webex.com')) return 'WEBEX';
  if (lower.includes('meet.google.com')) return 'GOOGLE_MEET';
  if (lower.includes('wa.me') || lower.includes('whatsapp.com')) return 'WHATSAPP';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'X_TWITTER';
  if (lower.includes('tiktok.com')) return 'TIKTOK';
  // Relative path or our own domain -> native upload
  if (url.startsWith('/') || lower.includes('/uploads/')) return 'NATIVE_UPLOAD';
  return 'OTHER';
}

// ---------------------------------------------------------------------------
// Platform display info
// ---------------------------------------------------------------------------

const PLATFORM_LABELS: Record<VideoSource, string> = {
  YOUTUBE: 'YouTube',
  VIMEO: 'Vimeo',
  TEAMS: 'Teams',
  ZOOM: 'Zoom',
  WEBEX: 'Webex',
  GOOGLE_MEET: 'Google Meet',
  WHATSAPP: 'WhatsApp',
  X_TWITTER: 'X / Twitter',
  TIKTOK: 'TikTok',
  NATIVE_UPLOAD: 'Video',
  OTHER: 'Video',
};

/** Tiny inline SVG icons per platform (kept minimal to avoid external deps). */
function PlatformIcon({ source }: { source: VideoSource }) {
  const size = 14;
  const cls = 'inline-block shrink-0';

  switch (source) {
    case 'YOUTUBE':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'VIMEO':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.541 2.449 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z" />
        </svg>
      );
    case 'TIKTOK':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.03a8.35 8.35 0 004.04 1.03v-3.45a4.85 4.85 0 01-.28.08z" />
        </svg>
      );
    case 'X_TWITTER':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    default:
      // Generic video camera icon for Teams, Zoom, Webex, Google Meet, WhatsApp, etc.
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="14" height="14" rx="2" />
          <path d="M16 10l4.553-2.276A1 1 0 0122 8.618v6.764a1 1 0 01-1.447.894L16 14" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  title,
  source,
  className = '',
}: VideoPlayerProps) {
  const { t } = useI18n();
  const [isPlaying, setIsPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const resolvedSource = source ?? detectSource(videoUrl);

  // ---- Embeddable platforms (YouTube, Vimeo, Native Upload) ----
  const isEmbeddable = resolvedSource === 'YOUTUBE' || resolvedSource === 'VIMEO' || resolvedSource === 'NATIVE_UPLOAD';

  // Build embed URL for embeddable sources
  const getEmbedUrl = useCallback((): string | null => {
    if (resolvedSource === 'YOUTUBE') {
      const id = extractYouTubeId(videoUrl);
      if (!id) return null;
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    }
    if (resolvedSource === 'VIMEO') {
      const id = extractVimeoId(videoUrl);
      if (!id) return null;
      return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
    if (resolvedSource === 'NATIVE_UPLOAD') {
      return videoUrl;
    }
    return null;
  }, [resolvedSource, videoUrl]);

  // Auto-generate thumbnail for YouTube when none is provided
  const resolvedThumbnail = thumbnailUrl ?? (() => {
    if (resolvedSource === 'YOUTUBE') {
      const id = extractYouTubeId(videoUrl);
      if (id) return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
    }
    return null;
  })();

  // ---- Handlers ----
  const handlePlay = useCallback(() => {
    if (isEmbeddable) {
      setIsPlaying(true);
    } else {
      // External platforms: open in a new tab
      window.open(videoUrl, '_blank', 'noopener,noreferrer');
    }
  }, [isEmbeddable, videoUrl]);

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  }, []);

  // ---- Render: playing state (iframe / native video) ----
  if (isPlaying && isEmbeddable) {
    const embedUrl = getEmbedUrl();

    return (
      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden rounded-lg bg-black ${className}`}
        style={{ paddingBottom: '56.25%' /* 16:9 */ }}
      >
        {resolvedSource === 'NATIVE_UPLOAD' ? (
          <video
            className="absolute inset-0 h-full w-full"
            src={videoUrl}
            controls
            autoPlay
            title={title}
          />
        ) : embedUrl ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={embedUrl}
            title={title ?? 'Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : null}

        {/* Fullscreen button */}
        <button
          onClick={handleFullscreen}
          className="absolute bottom-3 right-3 z-10 rounded-md bg-black/60 p-1.5 text-white/80 transition-colors hover:bg-black/80 hover:text-white"
          aria-label="Fullscreen"
        >
          <Maximize className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ---- Render: thumbnail / idle state ----
  const playLabel = t('video.play') ?? 'Play video';

  return (
    <div
      ref={containerRef}
      className={`group relative w-full overflow-hidden rounded-lg bg-neutral-900 ${className}`}
      style={{ paddingBottom: '56.25%' /* 16:9 */ }}
    >
      {/* Thumbnail */}
      {resolvedThumbnail ? (
        <img
          src={resolvedThumbnail}
          alt={title ?? playLabel}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
          <Play className="h-16 w-16 text-white/20" />
        </div>
      )}

      {/* Dark overlay on hover */}
      <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/50" />

      {/* Play button */}
      <button
        onClick={handlePlay}
        className="absolute inset-0 flex cursor-pointer items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
        aria-label={playLabel}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 shadow-2xl transition-all group-hover:scale-110 group-hover:bg-orange-600 sm:h-20 sm:w-20">
          {isEmbeddable ? (
            <Play className="h-8 w-8 text-white ms-0.5 sm:h-10 sm:w-10" fill="currentColor" />
          ) : (
            <ExternalLink className="h-8 w-8 text-white sm:h-10 sm:w-10" />
          )}
        </span>
      </button>

      {/* Platform badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
        <PlatformIcon source={resolvedSource} />
        <span>{PLATFORM_LABELS[resolvedSource]}</span>
      </div>

      {/* Title overlay (bottom) */}
      {title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
          <p className="truncate text-sm font-medium text-white">{title}</p>
        </div>
      )}

      {/* External link hint for non-embeddable sources */}
      {!isEmbeddable && (
        <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white/70">
          {t('video.opensInNewTab') ?? 'Opens in new tab'}
        </div>
      )}
    </div>
  );
}
