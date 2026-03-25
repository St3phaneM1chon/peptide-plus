/**
 * Import PQAP manual content into LMS lesson manualText fields.
 * Maps extracted chapter content to existing course lessons.
 *
 * Usage: npx tsx scripts/import-pqap-content.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ManualContent {
  [manualId: string]: {
    title: string;
    chapters: { [chapterNum: string]: string };
  };
}

// Mapping: manual ID → course slug pattern
const MANUAL_COURSE_MAP: Record<string, string> = {
  'F-111': 'deontologie',
  'F-312': 'accident-maladie',
  'F-311': 'assurance-vie',
  'F-313': 'fonds-distincts',
};

async function main() {
  const contentPath = path.join(__dirname, 'pqap-manual-content.json');
  if (!fs.existsSync(contentPath)) {
    console.error('ERROR: Run extract-pqap-content.py first to generate pqap-manual-content.json');
    process.exit(1);
  }

  const content: ManualContent = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const [manualId, manual] of Object.entries(content)) {
    const slugPattern = MANUAL_COURSE_MAP[manualId];
    if (!slugPattern) {
      console.warn(`No course mapping for manual ${manualId}`);
      continue;
    }

    console.log(`\n📘 ${manualId}: ${manual.title}`);

    // Find the course by slug pattern
    const course = await prisma.course.findFirst({
      where: { slug: { contains: slugPattern } },
      include: {
        chapters: {
          orderBy: { sortOrder: 'asc' },
          include: {
            lessons: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!course) {
      console.warn(`  ⚠ No course found with slug containing "${slugPattern}"`);
      totalSkipped += Object.keys(manual.chapters).length;
      continue;
    }

    console.log(`  Found course: "${course.title}" (${course.chapters.length} chapters)`);

    // Map manual chapters to course chapters (by order)
    const sortedManualChapters = Object.entries(manual.chapters).sort(
      ([a], [b]) => parseInt(a) - parseInt(b)
    );

    for (let i = 0; i < sortedManualChapters.length; i++) {
      const [chapNum, chapText] = sortedManualChapters[i];

      if (i >= course.chapters.length) {
        console.warn(`  ⚠ Manual chapter ${chapNum} has no matching course chapter (only ${course.chapters.length} chapters)`);
        totalSkipped++;
        continue;
      }

      const courseChapter = course.chapters[i];
      const lessons = courseChapter.lessons;

      if (lessons.length === 0) {
        console.warn(`  ⚠ Course chapter "${courseChapter.title}" has no lessons`);
        totalSkipped++;
        continue;
      }

      // Put the full chapter content into the FIRST lesson's manualText
      const firstLesson = lessons[0];

      // Split content across lessons if chapter has multiple lessons
      if (lessons.length > 1) {
        const chunkSize = Math.ceil(chapText.length / lessons.length);
        for (let j = 0; j < lessons.length; j++) {
          const lesson = lessons[j];
          const start = j * chunkSize;
          const end = Math.min((j + 1) * chunkSize, chapText.length);

          // Find clean break point (paragraph boundary)
          let actualEnd = end;
          if (end < chapText.length) {
            const nextPara = chapText.indexOf('\n\n', end - 200);
            if (nextPara > 0 && nextPara < end + 200) {
              actualEnd = nextPara;
            }
          }

          const lessonText = chapText.slice(start, actualEnd).trim();
          if (lessonText) {
            await prisma.lesson.update({
              where: { id: lesson.id },
              data: { manualText: lessonText },
            });
            totalUpdated++;
            console.log(`  ✓ Ch${chapNum} → Lesson "${lesson.title.slice(0, 50)}..." (${lessonText.length} chars)`);
          }
        }
      } else {
        await prisma.lesson.update({
          where: { id: firstLesson.id },
          data: { manualText: chapText },
        });
        totalUpdated++;
        console.log(`  ✓ Ch${chapNum} → Lesson "${firstLesson.title.slice(0, 50)}..." (${chapText.length} chars)`);
      }
    }
  }

  console.log(`\n✅ Done: ${totalUpdated} lessons updated, ${totalSkipped} skipped`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
