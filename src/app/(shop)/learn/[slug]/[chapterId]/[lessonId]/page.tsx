export const dynamic = 'force-dynamic';

/**
 * LESSON VIEWER PAGE
 * Renders lesson content (text/video/quiz) and tracks progress
 * Enhanced: passes full course outline for sidebar navigation
 */

import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { getCurrentTenantIdFromContext } from '@/lib/db';
import LessonViewerClient from './LessonViewerClient';

interface PageProps {
  params: Promise<{ slug: string; chapterId: string; lessonId: string }>;
}

export default async function LessonPage({ params }: PageProps) {
  const { slug, chapterId, lessonId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  let tenantId: string | null = null;
  try {
    tenantId = getCurrentTenantIdFromContext();
  } catch {
    // no tenant
  }

  // Fetch the course with all published chapters/lessons
  const course = await prisma.course.findFirst({
    where: {
      slug,
      status: 'PUBLISHED',
      ...(tenantId ? { tenantId } : {}),
    },
    include: {
      chapters: {
        where: { isPublished: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          lessons: {
            where: { isPublished: true },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              title: true,
              type: true,
              sortOrder: true,
              chapterId: true,
              textContent: true,
              videoUrl: true,
              videoDuration: true,
              quizId: true,
              estimatedMinutes: true,
              isFree: true,
              description: true,
              // 4 volets contenu par notion
              manualText: true,
              visualAnchorUrl: true,
              visualAnchorAlt: true,
              videoExplainerUrl: true,
              videoExplainerDuration: true,
              supplementaryTexts: true,
            },
          },
        },
      },
    },
  });

  if (!course) {
    notFound();
  }

  // Find the enrollment
  const enrollment = tenantId
    ? await prisma.enrollment.findUnique({
        where: {
          tenantId_courseId_userId: {
            tenantId,
            courseId: course.id,
            userId: session.user.id,
          },
        },
        include: {
          lessonProgress: {
            select: { lessonId: true, isCompleted: true },
          },
        },
      })
    : null;

  if (!enrollment) {
    redirect(`/learn/${slug}`);
  }

  // Find the current lesson
  const currentChapter = course.chapters.find((ch) => ch.id === chapterId);
  if (!currentChapter) {
    notFound();
  }

  const currentLesson = currentChapter.lessons.find((l) => l.id === lessonId);
  if (!currentLesson) {
    notFound();
  }

  // Build flat ordered list of all lessons for prev/next navigation
  const allLessons: Array<{ id: string; title: string; chapterId: string; chapterTitle: string }> = [];
  for (const ch of course.chapters) {
    for (const l of ch.lessons) {
      allLessons.push({ id: l.id, title: l.title, chapterId: ch.id, chapterTitle: ch.title });
    }
  }

  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const completedLessonIds = enrollment.lessonProgress
    .filter((lp) => lp.isCompleted)
    .map((lp) => lp.lessonId);

  const isCompleted = completedLessonIds.includes(lessonId);

  // Build course outline for sidebar
  const courseOutline = course.chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    lessons: ch.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      type: l.type,
      chapterId: ch.id,
      estimatedMinutes: l.estimatedMinutes,
      videoDuration: l.videoDuration,
    })),
  }));

  // Calculate total estimated minutes for reading time
  const totalEstimatedMinutes = allLessons.reduce((acc, l) => {
    const lesson = course.chapters
      .flatMap((ch) => ch.lessons)
      .find((cl) => cl.id === l.id);
    return acc + (lesson?.estimatedMinutes || 0);
  }, 0);

  return (
    <LessonViewerClient
      courseSlug={slug}
      courseTitle={course.title}
      enrollmentId={enrollment.id}
      lesson={{
        id: currentLesson.id,
        title: currentLesson.title,
        type: currentLesson.type,
        textContent: currentLesson.textContent,
        videoUrl: currentLesson.videoUrl,
        quizId: currentLesson.quizId,
        description: currentLesson.description,
        estimatedMinutes: currentLesson.estimatedMinutes,
        // 4 volets contenu par notion
        manualText: currentLesson.manualText,
        visualAnchorUrl: currentLesson.visualAnchorUrl,
        visualAnchorAlt: currentLesson.visualAnchorAlt,
        videoExplainerUrl: currentLesson.videoExplainerUrl,
        videoExplainerDuration: currentLesson.videoExplainerDuration,
        supplementaryTexts: currentLesson.supplementaryTexts as Array<{ title: string; content: string; source?: string }> | null,
      }}
      requireSequentialCompletion={course.requireSequentialCompletion ?? true}
      chapter={{
        id: currentChapter.id,
        title: currentChapter.title,
      }}
      navigation={{
        prev: prevLesson ? { id: prevLesson.id, title: prevLesson.title, chapterId: prevLesson.chapterId } : null,
        next: nextLesson ? { id: nextLesson.id, title: nextLesson.title, chapterId: nextLesson.chapterId } : null,
        currentIndex: currentIndex + 1,
        totalLessons: allLessons.length,
      }}
      isCompleted={isCompleted}
      courseOutline={courseOutline}
      completedLessonIds={completedLessonIds}
      courseProgress={allLessons.length > 0 ? Math.round((completedLessonIds.length / allLessons.length) * 100) : 0}
      totalEstimatedMinutes={totalEstimatedMinutes}
    />
  );
}
