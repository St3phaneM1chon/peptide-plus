/**
 * Best Time to Post Suggestion Service
 * C-12: Analyzes past post performance to suggest optimal posting times.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeSlot {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  hour: number;      // 0-23
  score: number;     // Engagement score
  postCount: number; // Number of historical posts
}

interface BestTimeResult {
  platform: string;
  slots: TimeSlot[];
  suggestedNext: Date;
  confidence: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Default industry-standard times by platform (fallback when no data)
// ---------------------------------------------------------------------------

const DEFAULT_BEST_TIMES: Record<string, Array<{ day: number; hour: number }>> = {
  facebook:  [{ day: 2, hour: 10 }, { day: 3, hour: 11 }, { day: 4, hour: 14 }],
  instagram: [{ day: 1, hour: 11 }, { day: 2, hour: 10 }, { day: 4, hour: 14 }, { day: 5, hour: 10 }],
  twitter:   [{ day: 1, hour: 9 }, { day: 2, hour: 11 }, { day: 3, hour: 12 }, { day: 4, hour: 9 }],
  tiktok:    [{ day: 2, hour: 19 }, { day: 4, hour: 12 }, { day: 5, hour: 17 }],
  linkedin:  [{ day: 2, hour: 8 }, { day: 3, hour: 10 }, { day: 4, hour: 12 }],
};

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Get best posting times for a platform based on historical performance.
 */
export async function getBestTimesToPost(platform: string): Promise<BestTimeResult> {
  try {
    // Fetch published posts for this platform in the last 90 days
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const posts = await prisma.socialPost.findMany({
      where: {
        platform,
        status: 'published',
        publishedAt: { gte: since },
      },
      select: {
        id: true,
        publishedAt: true,
        externalId: true,
      },
      orderBy: { publishedAt: 'desc' },
    });

    // If we have enough data (10+ posts), analyze patterns
    if (posts.length >= 10) {
      // Count interactions per post from ContentInteraction table
      const postIds = posts.map((p) => p.id);
      const interactions = await prisma.contentInteraction.groupBy({
        by: ['contentId'],
        _count: { id: true },
        where: { contentId: { in: postIds }, contentType: 'social_post' },
      });

      const interactionMap = new Map(interactions.map((i) => [i.contentId, i._count.id]));

      // Build time slot performance map
      const slotMap = new Map<string, { total: number; count: number }>();

      for (const post of posts) {
        if (!post.publishedAt) continue;
        const d = new Date(post.publishedAt);
        const key = `${d.getDay()}-${d.getHours()}`;
        const score = interactionMap.get(post.id) || 1; // At least 1 for being published
        const existing = slotMap.get(key) || { total: 0, count: 0 };
        existing.total += score;
        existing.count += 1;
        slotMap.set(key, existing);
      }

      const slots: TimeSlot[] = Array.from(slotMap.entries())
        .map(([key, val]) => {
          const [day, hour] = key.split('-').map(Number);
          return {
            dayOfWeek: day,
            hour,
            score: val.total / val.count,
            postCount: val.count,
          };
        })
        .sort((a, b) => b.score - a.score);

      return {
        platform,
        slots: slots.slice(0, 7),
        suggestedNext: getNextOccurrence(slots[0]?.dayOfWeek ?? 2, slots[0]?.hour ?? 10),
        confidence: posts.length >= 30 ? 'high' : 'medium',
      };
    }

    // Not enough data: use industry defaults
    const defaults = DEFAULT_BEST_TIMES[platform] || DEFAULT_BEST_TIMES.facebook!;
    const slots: TimeSlot[] = defaults.map((d, i) => ({
      dayOfWeek: d.day,
      hour: d.hour,
      score: defaults.length - i, // Higher score for first entries
      postCount: 0,
    }));

    return {
      platform,
      slots,
      suggestedNext: getNextOccurrence(slots[0].dayOfWeek, slots[0].hour),
      confidence: 'low',
    };
  } catch (error) {
    logger.error('[BestTime] Error', { error: error instanceof Error ? error.message : String(error) });

    // Fallback to defaults
    const defaults = DEFAULT_BEST_TIMES[platform] || DEFAULT_BEST_TIMES.facebook!;
    return {
      platform,
      slots: defaults.map((d, i) => ({ dayOfWeek: d.day, hour: d.hour, score: defaults.length - i, postCount: 0 })),
      suggestedNext: getNextOccurrence(defaults[0].day, defaults[0].hour),
      confidence: 'low',
    };
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getNextOccurrence(dayOfWeek: number, hour: number): Date {
  const now = new Date();
  const result = new Date(now);
  result.setHours(hour, 0, 0, 0);

  // Find the next occurrence of the target day/hour
  while (result <= now || result.getDay() !== dayOfWeek) {
    result.setDate(result.getDate() + 1);
    result.setHours(hour, 0, 0, 0);
  }

  return result;
}
