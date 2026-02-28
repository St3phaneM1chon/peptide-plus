/**
 * Social Publisher Service
 * Publishes posts to social media platforms (Meta, X, TikTok, LinkedIn).
 * Reads credentials from SiteSetting table.
 * Tokens are encrypted at rest with AES-256-GCM (V-041 fix).
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { encrypt, decrypt } from '@/lib/platform/crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SocialPostData {
  id: string;
  platform: string;
  content: string;
  imageUrl?: string | null;
}

interface PublishResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Token setting keys that store encrypted values
const ENCRYPTED_SETTING_KEYS = new Set([
  'meta_page_access_token',
  'x_bearer_token',
  'tiktok_access_token',
  'linkedin_access_token',
]);

/**
 * Get a site setting value. Automatically decrypts token values.
 */
async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.siteSetting.findUnique({ where: { key } });
  if (!setting?.value) return null;

  // Decrypt token values stored encrypted at rest
  if (ENCRYPTED_SETTING_KEYS.has(key)) {
    try {
      return decrypt(setting.value);
    } catch {
      // Fallback: value may be plaintext (pre-migration), return as-is
      logger.warn(`[Social] Setting ${key} not encrypted, returning plaintext`);
      return setting.value;
    }
  }

  return setting.value;
}

/**
 * Store a social token encrypted at rest.
 */
export async function storeSocialToken(key: string, plaintext: string): Promise<void> {
  const encrypted = encrypt(plaintext);
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: encrypted },
    update: { value: encrypted },
  });
}

// ---------------------------------------------------------------------------
// Meta (Facebook + Instagram)
// ---------------------------------------------------------------------------

async function publishToFacebook(post: SocialPostData): Promise<PublishResult> {
  const pageId = await getSetting('meta_page_id');
  const accessToken = await getSetting('meta_page_access_token');

  if (!pageId || !accessToken) {
    return { success: false, error: 'Meta credentials not configured. Set meta_page_id and meta_page_access_token in Site Settings.' };
  }

  try {
    const body: Record<string, string> = {
      message: post.content,
      access_token: accessToken,
    };
    if (post.imageUrl) {
      body.link = post.imageUrl;
    }

    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.id) {
      return {
        success: true,
        externalId: data.id,
        externalUrl: `https://www.facebook.com/${data.id}`,
      };
    }
    return { success: false, error: data.error?.message || 'Facebook publish failed' };
  } catch (error) {
    logger.error('[Social] Facebook publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Facebook publish failed' };
  }
}

async function publishToInstagram(post: SocialPostData): Promise<PublishResult> {
  const igUserId = await getSetting('meta_instagram_user_id');
  const accessToken = await getSetting('meta_page_access_token');

  if (!igUserId || !accessToken) {
    return { success: false, error: 'Instagram credentials not configured. Set meta_instagram_user_id in Site Settings.' };
  }

  if (!post.imageUrl) {
    return { success: false, error: 'Instagram requires an image URL' };
  }

  try {
    // Step 1: Create media container
    const createRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: post.imageUrl,
        caption: post.content,
        access_token: accessToken,
      }),
    });

    const createData = await createRes.json();
    if (!createData.id) {
      return { success: false, error: createData.error?.message || 'Instagram media creation failed' };
    }

    // Step 2: Publish media
    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: createData.id,
        access_token: accessToken,
      }),
    });

    const publishData = await publishRes.json();
    if (publishData.id) {
      return {
        success: true,
        externalId: publishData.id,
        externalUrl: `https://www.instagram.com/p/${publishData.id}/`,
      };
    }
    return { success: false, error: publishData.error?.message || 'Instagram publish failed' };
  } catch (error) {
    logger.error('[Social] Instagram publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Instagram publish failed' };
  }
}

// ---------------------------------------------------------------------------
// X / Twitter
// ---------------------------------------------------------------------------

async function publishToX(post: SocialPostData): Promise<PublishResult> {
  const bearerToken = await getSetting('x_bearer_token');

  if (!bearerToken) {
    return { success: false, error: 'X/Twitter credentials not configured. Set x_bearer_token in Site Settings.' };
  }

  try {
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: post.content }),
    });

    const data = await res.json();
    if (data.data?.id) {
      return {
        success: true,
        externalId: data.data.id,
        externalUrl: `https://x.com/i/status/${data.data.id}`,
      };
    }
    return { success: false, error: data.detail || data.title || 'X/Twitter publish failed' };
  } catch (error) {
    logger.error('[Social] X publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'X publish failed' };
  }
}

// ---------------------------------------------------------------------------
// TikTok
// ---------------------------------------------------------------------------

async function publishToTikTok(post: SocialPostData): Promise<PublishResult> {
  const accessToken = await getSetting('tiktok_access_token');

  if (!accessToken) {
    return { success: false, error: 'TikTok credentials not configured. Set tiktok_access_token in Site Settings.' };
  }

  try {
    // TikTok Content Posting API - text/image posts
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: post.content.slice(0, 150),
          description: post.content,
          disable_comment: false,
          privacy_level: 'SELF_ONLY', // Start private, user can change
        },
        source_info: {
          source: 'PULL_FROM_URL',
          ...(post.imageUrl ? { photo_images: [post.imageUrl] } : {}),
        },
      }),
    });

    const data = await res.json();
    if (data.data?.publish_id) {
      return {
        success: true,
        externalId: data.data.publish_id,
        externalUrl: `https://www.tiktok.com/@biocyclepeptides`,
      };
    }
    return { success: false, error: data.error?.message || 'TikTok publish failed' };
  } catch (error) {
    logger.error('[Social] TikTok publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'TikTok publish failed' };
  }
}

// ---------------------------------------------------------------------------
// LinkedIn
// ---------------------------------------------------------------------------

async function publishToLinkedIn(post: SocialPostData): Promise<PublishResult> {
  const accessToken = await getSetting('linkedin_access_token');
  const authorId = await getSetting('linkedin_author_id');

  if (!accessToken || !authorId) {
    return { success: false, error: 'LinkedIn credentials not configured. Set linkedin_access_token and linkedin_author_id in Site Settings.' };
  }

  try {
    const res = await fetch('https://api.linkedin.com/v2/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: `urn:li:organization:${authorId}`,
        commentary: post.content,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
      }),
    });

    if (res.status === 201) {
      const postId = res.headers.get('x-restli-id') || '';
      return {
        success: true,
        externalId: postId,
        externalUrl: `https://www.linkedin.com/feed/update/${postId}/`,
      };
    }

    const data = await res.json().catch(() => ({}));
    return { success: false, error: (data as Record<string, string>).message || `LinkedIn publish failed (${res.status})` };
  } catch (error) {
    logger.error('[Social] LinkedIn publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'LinkedIn publish failed' };
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const PUBLISHERS: Record<string, (post: SocialPostData) => Promise<PublishResult>> = {
  facebook: publishToFacebook,
  instagram: publishToInstagram,
  twitter: publishToX,
  tiktok: publishToTikTok,
  linkedin: publishToLinkedIn,
};

/**
 * Publish a social post by ID — dispatches to the right platform publisher.
 */
export async function publishPost(postId: string): Promise<PublishResult> {
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return { success: false, error: 'Post not found' };

  const publisher = PUBLISHERS[post.platform];
  if (!publisher) return { success: false, error: `Unsupported platform: ${post.platform}` };

  // Mark as publishing
  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: 'publishing', error: null },
  });

  const result = await publisher({
    id: post.id,
    platform: post.platform,
    content: post.content,
    imageUrl: post.imageUrl,
  });

  // Update DB with result
  await prisma.socialPost.update({
    where: { id: postId },
    data: result.success
      ? {
          status: 'published',
          publishedAt: new Date(),
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          error: null,
        }
      : {
          status: 'failed',
          error: result.error,
        },
  });

  return result;
}

/**
 * Mark a post as scheduled.
 */
export async function schedulePost(postId: string): Promise<void> {
  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: 'scheduled' },
  });
}
