'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useI18n } from '@/i18n/client';
import { Play, Eye, Clock, ExternalLink } from 'lucide-react';

interface VideoCardVideo {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  videoUrl: string;
  duration: string | null;
  views: number;
  contentType: string;
  source: string;
  videoCategory?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  createdAt: string | Date;
}

interface VideoCardProps {
  video: VideoCardVideo;
  onClick?: (video: VideoCardVideo) => void;
}

function formatDuration(duration: string | null): string | null {
  if (!duration) return null;
  // If already formatted (e.g. "12:30", "1:00:00"), return as-is
  if (duration.includes(':')) return duration;
  // If numeric string (seconds), format it
  const seconds = parseInt(duration, 10);
  if (isNaN(seconds) || seconds <= 0) return duration;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatViews(views: number): string {
  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1)}M`;
  }
  if (views >= 1_000) {
    return `${(views / 1_000).toFixed(1)}K`;
  }
  return String(views);
}

function getSourceLabel(source: string): string {
  switch (source.toLowerCase()) {
    case 'youtube':
      return 'YouTube';
    case 'vimeo':
      return 'Vimeo';
    case 'upload':
      return 'Upload';
    case 'external':
      return 'External';
    default:
      return source;
  }
}

function getSourceColor(source: string): string {
  switch (source.toLowerCase()) {
    case 'youtube':
      return 'bg-red-100 text-red-700';
    case 'vimeo':
      return 'bg-blue-100 text-blue-700';
    case 'upload':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export default function VideoCard({ video, onClick }: VideoCardProps) {
  const { t } = useI18n();

  const duration = formatDuration(video.duration);
  const viewCount = formatViews(video.views);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(video);
    }
  };

  return (
    <Link
      href={`/videos/${video.slug}`}
      onClick={handleClick}
      className="group block bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <Play className="w-12 h-12 text-gray-400" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors duration-300">
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg">
            <Play className="w-6 h-6 text-gray-900 ml-1" />
          </div>
        </div>

        {/* Duration badge */}
        {duration && (
          <div className="absolute bottom-2 end-2 bg-black/80 text-white text-xs font-medium px-2 py-1 rounded flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {duration}
          </div>
        )}

        {/* Source badge */}
        {video.source && video.source !== 'upload' && (
          <div className="absolute top-2 end-2 flex items-center gap-1">
            <span className={`text-xs font-medium px-2 py-1 rounded ${getSourceColor(video.source)}`}>
              <ExternalLink className="w-3 h-3 inline-block mr-1" />
              {getSourceLabel(video.source)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {video.title}
        </h3>

        {/* Description */}
        {video.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {video.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Category badge */}
          {video.videoCategory && (
            <span className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-700">
              {video.videoCategory.name}
            </span>
          )}

          {/* View count */}
          <span className="inline-flex items-center text-xs text-gray-500 gap-1">
            <Eye className="w-3.5 h-3.5" />
            {viewCount} {t('common.views')}
          </span>
        </div>
      </div>
    </Link>
  );
}
