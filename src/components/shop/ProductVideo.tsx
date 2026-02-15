'use client';

import { useState } from 'react';

interface ProductVideoProps {
  videoUrl: string;
}

/**
 * Extract video ID from YouTube or Vimeo URLs
 */
function parseVideoUrl(url: string): { platform: 'youtube' | 'vimeo' | null; videoId: string | null } {
  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return { platform: 'youtube', videoId: match[1] };
    }
  }

  // Vimeo patterns
  const vimeoPatterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ];

  for (const pattern of vimeoPatterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return { platform: 'vimeo', videoId: match[1] };
    }
  }

  return { platform: null, videoId: null };
}

/**
 * ProductVideo - Responsive video embed component with lazy loading
 * Supports YouTube and Vimeo URLs
 */
export default function ProductVideo({ videoUrl }: ProductVideoProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const parsed = parseVideoUrl(videoUrl);

  // Invalid URL - return null
  if (!parsed.platform || !parsed.videoId) {
    return null;
  }

  const { platform, videoId } = parsed;

  // Build embed URL
  const embedUrl = platform === 'youtube'
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${videoId}?autoplay=1`;

  // Build thumbnail URL
  const thumbnailUrl = platform === 'youtube'
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : null; // Vimeo thumbnails require API call, we'll use a placeholder

  const handleLoadVideo = () => {
    setIsLoaded(true);
  };

  return (
    <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
      {!isLoaded ? (
        // Thumbnail with play button overlay
        <button
          onClick={handleLoadVideo}
          className="absolute inset-0 w-full h-full bg-black rounded-lg overflow-hidden group cursor-pointer"
          aria-label="Load video player"
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt="Video thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
              <svg
                className="w-16 h-16 text-white/50"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path
                  fillRule="evenodd"
                  d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
            <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center group-hover:bg-orange-600 transition-all transform group-hover:scale-110 shadow-2xl">
              <svg
                className="w-10 h-10 text-white ml-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
          </div>

          {/* Platform badge */}
          <div className="absolute top-3 right-3 px-3 py-1 bg-black/70 text-white text-xs font-semibold rounded-full uppercase">
            {platform}
          </div>
        </button>
      ) : (
        // Actual iframe embed
        <iframe
          className="absolute inset-0 w-full h-full rounded-lg"
          src={embedUrl}
          title="Product video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  );
}
