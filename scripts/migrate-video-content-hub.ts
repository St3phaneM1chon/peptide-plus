/**
 * Migration Script: Existing Video data → Content Hub structure
 *
 * Performs the following migrations:
 * 1. Parses Video.category (legacy string) → VideoCategory FK (videoCategoryId)
 * 2. Parses Video.tags (legacy CSV/JSON string) → VideoTag records
 * 3. Sets Content Hub fields (status, source, visibility) based on existing data
 * 4. Adds VIDEO_LIBRARY placement for all published videos
 *
 * Safe to run multiple times (uses upsert / findFirst guards).
 *
 * Usage: npx tsx scripts/migrate-video-content-hub.ts
 *        npx tsx scripts/migrate-video-content-hub.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseTags(raw: string): string[] {
  // Try JSON array first
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((t: unknown) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
        .filter((t) => t.length > 0);
    }
  } catch {
    // Not JSON, fall through to CSV
  }

  // CSV split
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

function detectSource(videoUrl: string | null): 'YOUTUBE' | 'VIMEO' | null {
  if (!videoUrl) return null;
  const lower = videoUrl.toLowerCase();
  if (lower.includes('youtube') || lower.includes('youtu.be')) return 'YOUTUBE';
  if (lower.includes('vimeo')) return 'VIMEO';
  return null;
}

// ──────────────────────────────────────────────
// Main migration
// ──────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN MODE (no changes) ===\n' : '=== LIVE MODE ===\n');
  console.log('Starting Content Hub migration...\n');

  const videos = await prisma.video.findMany({
    select: {
      id: true,
      title: true,
      category: true,
      tags: true,
      videoUrl: true,
      isPublished: true,
      status: true,
      source: true,
      visibility: true,
      videoCategoryId: true,
    },
  });

  console.log(`Found ${videos.length} videos to process.\n`);

  if (videos.length === 0) {
    console.log('No videos found. Nothing to migrate.');
    return;
  }

  // Pre-load all existing VideoCategory records (by slug and name)
  const existingCategories = await prisma.videoCategory.findMany();
  const categoryBySlug = new Map(existingCategories.map((c) => [c.slug, c]));
  const categoryByNameLower = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c]));

  let stats = {
    categoryLinked: 0,
    categoryCreated: 0,
    tagsCreated: 0,
    statusUpdated: 0,
    sourceUpdated: 0,
    visibilityUpdated: 0,
    placementsCreated: 0,
    skippedAlreadyLinked: 0,
  };

  for (const video of videos) {
    console.log(`--- ${video.title} (${video.id}) ---`);

    // ──────────────────────────────────────────
    // Step 1: category string → VideoCategory FK
    // ──────────────────────────────────────────
    if (video.category && !video.videoCategoryId) {
      const catString = video.category.trim();
      const catSlug = slugify(catString);
      const catNameLower = catString.toLowerCase();

      // Try slug match first, then name match (case-insensitive)
      let matchedCategory =
        categoryBySlug.get(catSlug) || categoryByNameLower.get(catNameLower) || null;

      if (!matchedCategory) {
        // Create a new VideoCategory from the string
        console.log(`  [category] Creating new category: "${catString}" (slug: ${catSlug})`);
        if (!DRY_RUN) {
          const maxSort = existingCategories.length > 0
            ? Math.max(...existingCategories.map((c) => c.sortOrder)) + 1
            : 100;

          matchedCategory = await prisma.videoCategory.create({
            data: {
              name: catString,
              slug: catSlug,
              description: `Auto-migrated from legacy category "${catString}"`,
              sortOrder: maxSort,
            },
          });
          // Update local caches
          categoryBySlug.set(catSlug, matchedCategory);
          categoryByNameLower.set(catNameLower, matchedCategory);
          existingCategories.push(matchedCategory);
        }
        stats.categoryCreated++;
      }

      if (matchedCategory) {
        console.log(`  [category] Linked to: ${matchedCategory.name} (${matchedCategory.slug})`);
        if (!DRY_RUN) {
          await prisma.video.update({
            where: { id: video.id },
            data: { videoCategoryId: matchedCategory.id },
          });
        }
        stats.categoryLinked++;
      }
    } else if (video.videoCategoryId) {
      console.log('  [category] Already linked, skipping.');
      stats.skippedAlreadyLinked++;
    } else {
      console.log('  [category] No legacy category string, skipping.');
    }

    // ──────────────────────────────────────────
    // Step 2: tags string → VideoTag records
    // ──────────────────────────────────────────
    if (video.tags) {
      const tagList = parseTags(video.tags);
      if (tagList.length > 0) {
        console.log(`  [tags] Parsed ${tagList.length} tags: ${tagList.join(', ')}`);
        if (!DRY_RUN) {
          for (const tag of tagList) {
            await prisma.videoTag.upsert({
              where: {
                videoId_tag: {
                  videoId: video.id,
                  tag,
                },
              },
              update: {}, // already exists, no change needed
              create: {
                videoId: video.id,
                tag,
              },
            });
          }
        }
        stats.tagsCreated += tagList.length;
      } else {
        console.log('  [tags] Tags field present but empty after parsing.');
      }
    } else {
      console.log('  [tags] No legacy tags string.');
    }

    // ──────────────────────────────────────────
    // Step 3: Set Content Hub default fields
    // ──────────────────────────────────────────
    const updates: Record<string, unknown> = {};

    // 3a. status based on isPublished
    if (video.isPublished && video.status === 'DRAFT') {
      updates.status = 'PUBLISHED';
      stats.statusUpdated++;
      console.log('  [status] DRAFT -> PUBLISHED (was isPublished=true)');
    }

    // 3b. source based on videoUrl
    const detectedSource = detectSource(video.videoUrl);
    if (detectedSource && video.source === 'YOUTUBE' && detectedSource !== 'YOUTUBE') {
      // Only update if source was left at default and actual source differs
      updates.source = detectedSource;
      stats.sourceUpdated++;
      console.log(`  [source] Default -> ${detectedSource}`);
    } else if (detectedSource && video.source !== detectedSource) {
      // Source was explicitly set to something else (possibly default), update if URL tells us
      updates.source = detectedSource;
      stats.sourceUpdated++;
      console.log(`  [source] ${video.source} -> ${detectedSource}`);
    }

    // 3c. visibility for published videos
    if (video.isPublished && video.visibility === 'PUBLIC') {
      // Already PUBLIC, nothing to do
    } else if (video.isPublished && video.visibility !== 'PUBLIC') {
      updates.visibility = 'PUBLIC';
      stats.visibilityUpdated++;
      console.log(`  [visibility] ${video.visibility} -> PUBLIC (published video)`);
    }

    if (Object.keys(updates).length > 0 && !DRY_RUN) {
      await prisma.video.update({
        where: { id: video.id },
        data: updates,
      });
    }

    // ──────────────────────────────────────────
    // Step 4: Add VIDEO_LIBRARY placement for published videos
    // ──────────────────────────────────────────
    if (video.isPublished) {
      // Check if placement already exists
      const existingPlacement = await prisma.videoPlacement.findFirst({
        where: {
          videoId: video.id,
          placement: 'VIDEO_LIBRARY',
          contextId: null,
        },
      });

      if (!existingPlacement) {
        console.log('  [placement] Adding VIDEO_LIBRARY placement');
        if (!DRY_RUN) {
          await prisma.videoPlacement.create({
            data: {
              videoId: video.id,
              placement: 'VIDEO_LIBRARY',
              sortOrder: 0,
              isActive: true,
            },
          });
        }
        stats.placementsCreated++;
      } else {
        console.log('  [placement] VIDEO_LIBRARY already exists.');
      }
    }

    console.log('');
  }

  // ──────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────

  console.log('=== Migration Summary ===');
  console.log(`  Videos processed:          ${videos.length}`);
  console.log(`  Categories linked:         ${stats.categoryLinked}`);
  console.log(`  Categories auto-created:   ${stats.categoryCreated}`);
  console.log(`  Already linked (skipped):  ${stats.skippedAlreadyLinked}`);
  console.log(`  Tags created:              ${stats.tagsCreated}`);
  console.log(`  Status updates (->PUB):    ${stats.statusUpdated}`);
  console.log(`  Source updates:             ${stats.sourceUpdated}`);
  console.log(`  Visibility updates:         ${stats.visibilityUpdated}`);
  console.log(`  Placements created:         ${stats.placementsCreated}`);

  if (DRY_RUN) {
    console.log('\n  (DRY RUN - no changes were made to the database)');
  }

  console.log('\nMigration complete!');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
