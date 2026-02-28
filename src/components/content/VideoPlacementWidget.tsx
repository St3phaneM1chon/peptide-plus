'use client';

/**
 * VideoPlacementWidget — Embeddable widget that displays videos assigned to a specific placement
 * Used by product pages, blog posts, FAQ, etc.
 */

import { useState, useEffect } from 'react';
import { Play, Clock, Eye } from 'lucide-react';
import Image from 'next/image';
import dynamic from 'next/dynamic';

const VideoPlayer = dynamic(() => import('./VideoPlayer'), { ssr: false });

interface PlacementVideo {
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
  videoCategory: { id: string; name: string; slug: string } | null;
}

interface Props {
  placement: string;
  contextId?: string;
  title?: string;
  limit?: number;
  className?: string;
}

export default function VideoPlacementWidget({ placement, contextId, title, limit = 6, className = '' }: Props) {
  const [videos, setVideos] = useState<PlacementVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<PlacementVideo | null>(null);

  useEffect(() => {
    async function fetchVideos() {
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (contextId) params.set('contextId', contextId);

        const res = await fetch(`/api/videos/placements/${placement}?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        setVideos(data.videos || []);
      } catch {
        // Silent fail for widget
      } finally {
        setLoading(false);
      }
    }
    fetchVideos();
  }, [placement, contextId, limit]);

  if (loading || videos.length === 0) return null;

  return (
    <div className={className}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Play className="h-5 w-5 text-orange-500" />
          {title}
        </h3>
      )}

      {/* Video Modal */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPlayingVideo(null)}>
          <div className="bg-white rounded-xl overflow-hidden max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <VideoPlayer
              videoUrl={playingVideo.videoUrl || ''}
              thumbnailUrl={playingVideo.thumbnailUrl || undefined}
              title={playingVideo.title}
              source={playingVideo.source as 'YOUTUBE' | 'VIMEO'}
            />
            <div className="p-4">
              <h4 className="font-semibold text-gray-900">{playingVideo.title}</h4>
              {playingVideo.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{playingVideo.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Videos list */}
      {videos.length === 1 ? (
        // Single video — show larger
        <div
          className="cursor-pointer group"
          onClick={() => setPlayingVideo(videos[0])}
        >
          <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
            {videos[0].thumbnailUrl ? (
              <Image
                src={videos[0].thumbnailUrl}
                alt={videos[0].title}
                fill
                className="object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
                <Play className="h-12 w-12 text-orange-400" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity w-14 h-14 bg-white/90 rounded-full flex items-center justify-center">
                <Play className="h-6 w-6 text-orange-600 ml-0.5" />
              </div>
            </div>
            {videos[0].duration && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                <Clock className="h-3 w-3" />{videos[0].duration}
              </div>
            )}
          </div>
          <p className="mt-2 font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
            {videos[0].title}
          </p>
        </div>
      ) : (
        // Multiple videos — horizontal scroll
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {videos.map(video => (
              <div
                key={video.id}
                className="flex-shrink-0 w-64 cursor-pointer group"
                onClick={() => setPlayingVideo(video)}
              >
                <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  {video.thumbnailUrl ? (
                    <Image
                      src={video.thumbnailUrl}
                      alt={video.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
                      <Play className="h-8 w-8 text-orange-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                      <Play className="h-4 w-4 text-orange-600 ml-0.5" />
                    </div>
                  </div>
                  {video.duration && (
                    <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1 py-0.5 rounded flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />{video.duration}
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-sm font-medium text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-2">
                  {video.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                  <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{video.views}</span>
                  {video.videoCategory && <span>{video.videoCategory.name}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
