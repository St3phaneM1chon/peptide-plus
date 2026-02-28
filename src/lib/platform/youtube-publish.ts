/**
 * YouTube Publishing Service
 * Upload videos to YouTube channel from the Content Hub.
 */

import { getValidAccessToken } from './oauth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface YouTubeUploadOptions {
  title: string;
  description?: string;
  tags?: string[];
  privacyStatus?: 'public' | 'unlisted' | 'private';
  categoryId?: string; // YouTube category ID (22 = People & Blogs, 27 = Education, etc.)
}

interface YouTubeUploadResult {
  success: boolean;
  youtubeVideoId?: string;
  youtubeUrl?: string;
  error?: string;
}

/**
 * Upload a video to YouTube from its blob URL.
 * Uses resumable upload protocol for reliability with large files.
 */
export async function publishToYouTube(
  videoId: string,
  options?: Partial<YouTubeUploadOptions>
): Promise<YouTubeUploadResult> {
  const token = await getValidAccessToken('youtube');
  if (!token) {
    return { success: false, error: 'YouTube not connected' };
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      title: true,
      description: true,
      videoUrl: true,
      videoTags: { select: { tag: true } },
    },
  });

  if (!video) {
    return { success: false, error: 'Video not found' };
  }

  if (!video.videoUrl) {
    return { success: false, error: 'Video has no file URL' };
  }

  const title = options?.title || video.title;
  const description = options?.description || video.description || '';
  const tags = options?.tags || video.videoTags.map((t) => t.tag);
  const privacyStatus = options?.privacyStatus || 'unlisted';
  const categoryId = options?.categoryId || '27'; // Education

  try {
    // Step 1: Initiate resumable upload
    const metadata = {
      snippet: {
        title,
        description,
        tags,
        categoryId,
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    };

    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const errorText = await initRes.text();
      logger.error('[YouTube] Upload init failed:', errorText);
      return { success: false, error: `YouTube API error: ${initRes.status}` };
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      return { success: false, error: 'No upload URL returned' };
    }

    // Step 2: Download video file
    const fileRes = await fetch(video.videoUrl);
    if (!fileRes.ok) {
      return { success: false, error: 'Failed to download video file' };
    }

    const fileBuffer = await fileRes.arrayBuffer();

    // Step 3: Upload to YouTube
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(fileBuffer.byteLength),
      },
      body: Buffer.from(fileBuffer),
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      logger.error('[YouTube] Upload failed:', errorText);
      return { success: false, error: `Upload failed: ${uploadRes.status}` };
    }

    const result = await uploadRes.json();
    const youtubeVideoId = result.id;
    const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;

    logger.info(`[YouTube] Successfully uploaded video ${videoId} as ${youtubeVideoId}`);

    return {
      success: true,
      youtubeVideoId,
      youtubeUrl,
    };
  } catch (error) {
    logger.error('[YouTube] Publish error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    };
  }
}
