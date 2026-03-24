/**
 * AI Course Recommendations — Suggest courses based on student profile and progress
 *
 * Uses rule-based engine (no external API call needed) analyzing:
 * - Current enrollments and completion status
 * - Concept mastery gaps
 * - Compliance requirements (UFC deadlines)
 * - Student profile preferences (province, specialization)
 */

import { prisma } from '@/lib/db';

export interface CourseRecommendation {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  reason: string;
  priority: 'urgent' | 'recommended' | 'suggested';
  score: number; // 0-100, higher = more relevant
}

/**
 * Generate personalized course recommendations for a student.
 * Returns up to `limit` recommendations sorted by relevance.
 */
export async function getRecommendations(
  tenantId: string,
  userId: string,
  limit: number = 5
): Promise<CourseRecommendation[]> {
  const recommendations: CourseRecommendation[] = [];

  // 1. Fetch student data
  const [enrollments, profile, publishedCourses] = await Promise.all([
    prisma.enrollment.findMany({
      where: { tenantId, userId },
      select: { courseId: true, status: true, progress: true, complianceDeadline: true, complianceStatus: true },
    }),
    prisma.studentProfile.findFirst({
      where: { tenantId, userId },
      select: { workProvince: true, specializations: true, primaryGoal: true, licenseTypes: true },
    }),
    prisma.course.findMany({
      where: { tenantId, status: 'PUBLISHED' },
      select: { id: true, title: true, slug: true, tags: true, level: true, isCompliance: true, complianceDeadlineDays: true, categoryId: true },
    }),
  ]);

  const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
  const availableCourses = publishedCourses.filter(c => !enrolledCourseIds.has(c.id));

  // 2. Compliance urgency — courses needed for UFC deadlines
  const cePeriods = await prisma.cePeriod.findMany({
    where: { tenantId, userId, status: { in: ['ACTIVE', 'GRACE_PERIOD'] } },
    select: { endDate: true, earnedUfc: true, requiredUfc: true },
  });

  for (const period of cePeriods) {
    const ufcGap = Number(period.requiredUfc) - Number(period.earnedUfc);
    if (ufcGap > 0) {
      const daysLeft = Math.ceil((period.endDate.getTime() - Date.now()) / 86400000);
      const complianceCourses = availableCourses.filter(c => c.isCompliance);
      for (const course of complianceCourses.slice(0, 2)) {
        recommendations.push({
          courseId: course.id,
          courseTitle: course.title,
          courseSlug: course.slug,
          reason: `${ufcGap} UFC manquants, echeance dans ${daysLeft} jours`,
          priority: daysLeft < 30 ? 'urgent' : 'recommended',
          score: Math.min(100, 80 + (30 - Math.min(daysLeft, 30)) * 2),
        });
      }
    }
  }

  // 3. Concept mastery gaps — suggest courses that teach weak concepts
  const weakConcepts = await prisma.lmsConceptMastery.findMany({
    where: { tenantId, userId, currentLevel: { lt: 2 } },
    select: { conceptId: true },
    take: 10,
  });

  if (weakConcepts.length > 0) {
    const conceptIds = weakConcepts.map(c => c.conceptId);
    const conceptLessonMaps = await prisma.lmsConceptLessonMap.findMany({
      where: { conceptId: { in: conceptIds } },
      select: { lessonId: true },
    });

    // Find courses that contain these lessons
    const lessonIds = conceptLessonMaps.map(m => m.lessonId);
    if (lessonIds.length > 0) {
      const lessons = await prisma.lesson.findMany({
        where: { id: { in: lessonIds } },
        select: { chapter: { select: { courseId: true } } },
      });
      const courseIdsForWeakConcepts = new Set(lessons.map(l => l.chapter.courseId));
      for (const course of availableCourses) {
        if (courseIdsForWeakConcepts.has(course.id)) {
          recommendations.push({
            courseId: course.id,
            courseTitle: course.title,
            courseSlug: course.slug,
            reason: 'Renforce des concepts ou vous avez des lacunes',
            priority: 'recommended',
            score: 65,
          });
        }
      }
    }
  }

  // 4. Profile-based — match tags with student specializations
  const studentTags = [
    ...(profile?.specializations ?? []),
    ...(profile?.licenseTypes ?? []),
    profile?.workProvince ?? '',
  ].filter(Boolean).map(s => (s as string).toLowerCase());

  for (const course of availableCourses) {
    const courseTags = course.tags.map(t => t.toLowerCase());
    const matchCount = studentTags.filter(t => courseTags.some(ct => ct.includes(t) || t.includes(ct))).length;
    if (matchCount > 0) {
      const existing = recommendations.find(r => r.courseId === course.id);
      if (!existing) {
        recommendations.push({
          courseId: course.id,
          courseTitle: course.title,
          courseSlug: course.slug,
          reason: `Correspond a votre profil (${matchCount} critere(s))`,
          priority: 'suggested',
          score: 30 + matchCount * 15,
        });
      }
    }
  }

  // 5. Popular courses not yet taken
  const popularNotTaken = availableCourses
    .filter(c => !recommendations.some(r => r.courseId === c.id))
    .slice(0, 3);
  for (const course of popularNotTaken) {
    recommendations.push({
      courseId: course.id,
      courseTitle: course.title,
      courseSlug: course.slug,
      reason: 'Cours populaire',
      priority: 'suggested',
      score: 20,
    });
  }

  // Deduplicate and sort
  const seen = new Set<string>();
  const deduped = recommendations.filter(r => {
    if (seen.has(r.courseId)) return false;
    seen.add(r.courseId);
    return true;
  });

  return deduped.sort((a, b) => b.score - a.score).slice(0, limit);
}
