import { prisma } from '@/lib/db';
import type { Prisma, CourseStatus } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { buildCertificateIssuedEmail } from '@/lib/email/templates/lms-emails';
import { awardXp, updateStreak } from '@/lib/lms/xp-service';
import { logAudit } from '@/lib/lms/audit-trail';

// ── Courses ──────────────────────────────────────────────────

export async function getCourses(tenantId: string, options?: {
  status?: CourseStatus;
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { status, categoryId, search, page = 1, limit: rawLimit = 20 } = options ?? {};
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const safePage = Math.max(page, 1);
  const skip = (safePage - 1) * limit;

  const where: Prisma.CourseWhereInput = {
    tenantId,
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        instructor: { select: { id: true, userId: true, title: true, avatarUrl: true } },
        _count: { select: { chapters: true, enrollments: true, reviews: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.course.count({ where }),
  ]);

  return { courses, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getCourseBySlug(tenantId: string, slug: string) {
  return prisma.course.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      instructor: { select: { id: true, userId: true, title: true, bio: true, avatarUrl: true } },
      certificateTemplate: { select: { id: true, name: true } },
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
              isFree: true,
              videoDuration: true,
              estimatedMinutes: true,
            },
          },
        },
      },
      prerequisites: {
        include: {
          prerequisite: { select: { id: true, title: true, slug: true } },
        },
      },
    },
  });
}

export async function getCourseById(tenantId: string, id: string) {
  return prisma.course.findFirst({
    where: { id, tenantId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      instructor: { select: { id: true, userId: true, title: true, bio: true, avatarUrl: true } },
      certificateTemplate: { select: { id: true, name: true } },
      chapters: {
        orderBy: { sortOrder: 'asc' },
        include: {
          lessons: {
            orderBy: { sortOrder: 'asc' },
            // FIX P2: Don't fetch full content (manualText, supplementaryTexts can be huge)
            select: {
              id: true, title: true, type: true, sortOrder: true, isPublished: true, isFree: true,
              description: true, estimatedMinutes: true, videoDuration: true, quizId: true,
              videoUrl: true, videoExplainerUrl: true, visualAnchorUrl: true,
            },
          },
        },
      },
    },
  });
}

// FIX P0: Strip protected denormalized fields that callers must not manipulate
const PROTECTED_COURSE_FIELDS = ['enrollmentCount', 'completionCount', 'averageRating', 'reviewCount'] as const;

function sanitizeCourseInput<T extends Record<string, unknown>>(data: T): T {
  const sanitized = { ...data };
  for (const field of PROTECTED_COURSE_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}

export async function createCourse(tenantId: string, data: Prisma.CourseCreateInput) {
  const safeData = sanitizeCourseInput(data as Record<string, unknown>);
  delete safeData.id; // FIX P1: prevent PK injection
  return prisma.course.create({ data: { ...safeData as Prisma.CourseCreateInput, tenantId, status: 'DRAFT' } });
}

export async function updateCourse(tenantId: string, id: string, data: Prisma.CourseUpdateInput) {
  // C3-SEC-S-001 FIX: Verify tenant ownership before update
  const course = await prisma.course.findFirst({ where: { id, tenantId } });
  if (!course) throw new Error('Course not found');
  return prisma.course.update({
    where: { id },
    data: sanitizeCourseInput(data as Record<string, unknown>) as Prisma.CourseUpdateInput,
  });
}

export async function deleteCourse(tenantId: string, id: string) {
  const course = await prisma.course.findFirst({ where: { id, tenantId } });
  if (!course) throw new Error('Course not found');
  // FIX P1: Prevent deletion of courses with enrollments (data loss prevention)
  const enrollmentCount = await prisma.enrollment.count({ where: { courseId: id } });
  if (enrollmentCount > 0) {
    throw new Error('Cannot delete course with existing enrollments. Archive it instead.');
  }
  return prisma.course.delete({ where: { id } });
}

// ── Enrollments ──────────────────────────────────────────────

export async function enrollUser(tenantId: string, courseId: string, userId: string, enrolledBy?: string) {
  // FIX P1: Wrap enrollment in transaction to prevent race conditions
  return prisma.$transaction(async (tx) => {
    // Check for duplicate enrollment
    const existing = await tx.enrollment.findUnique({
      where: { tenantId_courseId_userId: { tenantId, courseId, userId } },
      select: { id: true },
    });
    if (existing) throw new Error('Already enrolled');

    const course = await tx.course.findFirst({
      where: { id: courseId, tenantId, status: 'PUBLISHED' },
      include: { _count: { select: { enrollments: true } }, chapters: { include: { lessons: { where: { isPublished: true } } } } },
    });
    if (!course) throw new Error('Course not found or not published');

    // Check max enrollments
    if (course.maxEnrollments && course._count.enrollments >= course.maxEnrollments) {
      throw new Error('Course is full');
    }

    // Check enrollment deadline
    if (course.enrollmentDeadline && new Date() > course.enrollmentDeadline) {
      throw new Error('Enrollment closed');
    }

    const totalLessons = course.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);

    let complianceDeadline: Date | undefined;
    if (course.isCompliance && course.complianceDeadlineDays) {
      complianceDeadline = new Date();
      complianceDeadline.setDate(complianceDeadline.getDate() + course.complianceDeadlineDays);
    }

    const enrollment = await tx.enrollment.create({
      data: {
        tenantId,
        courseId,
        userId,
        totalLessons,
        enrolledBy: enrolledBy ?? null,
        enrollmentSource: enrolledBy ? 'admin' : 'self',
        complianceStatus: course.isCompliance ? 'NOT_STARTED' : null,
        complianceDeadline: complianceDeadline ?? null,
      },
    });

    // Increment enrollment count atomically within transaction
    await tx.course.update({
      where: { id: courseId },
      data: { enrollmentCount: { increment: 1 } },
    });

    return enrollment;
  });
}

export async function getEnrollment(tenantId: string, courseId: string, userId: string) {
  return prisma.enrollment.findUnique({
    where: { tenantId_courseId_userId: { tenantId, courseId, userId } },
    include: {
      course: { select: { id: true, title: true, slug: true, thumbnailUrl: true } },
      lessonProgress: true,
    },
  });
}

export async function getUserEnrollments(tenantId: string, userId: string) {
  return prisma.enrollment.findMany({
    where: { tenantId, userId },
    include: {
      course: {
        select: {
          id: true, title: true, slug: true, thumbnailUrl: true,
          level: true, estimatedHours: true, instructor: { select: { title: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
}

// ── Progress ─────────────────────────────────────────────────

export async function updateLessonProgress(
  tenantId: string,
  enrollmentId: string,
  lessonId: string,
  userId: string,
  data: {
    isCompleted?: boolean;
    videoProgress?: number;
    videoCompleted?: boolean;
    timeSpent?: number;
    quizScore?: number;
    quizPassed?: boolean;
  }
) {
  // C2-FEAT-I-002 FIX: Server-side validation of progress claims
  // Verify the enrollment belongs to this user and tenant
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, tenantId, userId },
    select: { id: true, status: true, tenantId: true, userId: true, courseId: true },
  });
  if (!enrollment) {
    throw new Error('Enrollment not found or access denied');
  }
  if (enrollment.status === 'COMPLETED') {
    throw new Error('Course already completed');
  }

  // FIX P1: Validate lessonId belongs to the enrollment's course
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, chapter: { courseId: enrollment.courseId } },
    select: { id: true },
  });
  if (!lesson) {
    throw new Error('Lesson does not belong to this course');
  }

  // Validate: if videoCompleted is true, videoProgress must be > 0
  if (data.videoCompleted && (data.videoProgress === undefined || data.videoProgress <= 0)) {
    throw new Error('Cannot mark video as completed without video progress');
  }

  // FIX P2: Validate quizScore and videoProgress ranges
  if (data.quizScore !== undefined && (data.quizScore < 0 || data.quizScore > 100)) {
    throw new Error("Quiz score must be between 0 and 100");
  }
  if (data.videoProgress !== undefined && data.videoProgress < 0) {
    throw new Error("Video progress cannot be negative");
  }  // Validate: timeSpent must be reasonable (max 8 hours per update)
  if (data.timeSpent && data.timeSpent > 28800) {
    throw new Error('Time spent per update cannot exceed 8 hours');
  }

  const progress = await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    create: {
      tenantId,
      enrollmentId,
      lessonId,
      userId,
      ...data,
      completedAt: data.isCompleted ? new Date() : null,
      lastAccessedAt: new Date(),
    },
    update: {
      ...data,
      completedAt: data.isCompleted ? new Date() : undefined,
      lastAccessedAt: new Date(),
      timeSpent: data.timeSpent ? { increment: data.timeSpent } : undefined,
    },
  });

  // C3-BIZ-B-007 FIX: Recalculate on both isCompleted=true AND isCompleted=false
  // so that revoking a lesson completion also decrements progress
  if (data.isCompleted !== undefined) {
    await recalculateEnrollmentProgress(enrollmentId);
  }

  // Award XP for lesson completion
  if (data.isCompleted === true) {
    try {
      await awardXp(enrollment.tenantId, enrollment.userId, 'lesson_complete', lessonId);
    } catch { /* XP failure should not block progress */ }
    // FIX P7-11: Update daily streak on lesson completion
    updateStreak(enrollment.tenantId, enrollment.userId).catch(() => {});
  }

  return progress;
}

export async function recalculateEnrollmentProgress(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { lessonProgress: true },
  });
  if (!enrollment) return;

  const completed = enrollment.lessonProgress.filter(lp => lp.isCompleted).length;
  const total = enrollment.totalLessons || 1;
  const progressPercent = Math.round((completed / total) * 10000) / 100;

  const updateData: Prisma.EnrollmentUpdateInput = {
    lessonsCompleted: completed,
    progress: progressPercent,
    lastAccessedAt: new Date(),
  };

  if (progressPercent >= 100 && !enrollment.completedAt) {
    updateData.completedAt = new Date();
    updateData.status = 'COMPLETED';
    if (enrollment.complianceStatus) {
      updateData.complianceStatus = 'COMPLETED';
    }

    // Increment course completion count + award XP
    await prisma.course.update({
      where: { id: enrollment.courseId },
      data: { completionCount: { increment: 1 } },
    });

    // Award XP for course completion
    try {
      await awardXp(enrollment.tenantId, enrollment.userId, 'course_complete', enrollment.courseId);
    } catch { /* XP failure should not block completion */ }

    // C3-LMS FIX: Auto-issue certificate on course completion
    const course = await prisma.course.findUnique({
      where: { id: enrollment.courseId },
      select: { certificateTemplateId: true, title: true },
    });
    if (course?.certificateTemplateId) {
      try {
        // Look up student name
        const user = await prisma.user.findUnique({
          where: { id: enrollment.userId },
          select: { name: true, email: true },
        });
        const studentName = user?.name || user?.email || 'Student';
        await issueCertificate(enrollment.tenantId, enrollmentId, enrollment.userId, studentName);
      } catch {
        // Certificate issuance failure should not block completion
      }

      // Auto-award badges on course completion
      try {
        await checkAndAwardBadges(enrollment.tenantId, enrollment.userId);
      } catch {
        // Badge award failure should not block completion
      }
    }
  }

  await prisma.enrollment.update({ where: { id: enrollmentId }, data: updateData });
}

// ── Quiz ─────────────────────────────────────────────────────

export async function submitQuizAttempt(
  tenantId: string,
  quizId: string,
  userId: string,
  answers: Array<{ questionId: string; answer: string | string[] }>,
  attemptId?: string
) {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, tenantId },
    include: { questions: true, lesson: { select: { id: true, chapter: { select: { courseId: true } } } } },
  });
  if (!quiz) throw new Error('Quiz not found');

  // FIX P1: Verify user is enrolled in the course this quiz belongs to
  if (quiz.lesson?.chapter?.courseId) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { tenantId_courseId_userId: { tenantId, courseId: quiz.lesson.chapter.courseId, userId } },
      select: { status: true },
    });
    if (!enrollment || enrollment.status === 'SUSPENDED' || enrollment.status === 'CANCELLED') {
      throw new Error('Not enrolled in this course');
    }
  }

  // V2 P0 FIX (P6-01): Server-side timer enforcement
  // Find the in-progress attempt (created when student started the quiz)
  const existingAttempt = attemptId
    ? await prisma.quizAttempt.findFirst({
        where: { id: attemptId, quizId, userId, tenantId, completedAt: null },
        select: { id: true, startedAt: true },
      })
    : await prisma.quizAttempt.findFirst({
        where: { quizId, userId, tenantId, completedAt: null },
        orderBy: { startedAt: 'desc' },
        select: { id: true, startedAt: true },
      });

  if (existingAttempt && quiz.timeLimit) {
    const elapsedSeconds = (Date.now() - existingAttempt.startedAt.getTime()) / 1000;
    const timeLimitSeconds = quiz.timeLimit * 60;
    // Allow 10% grace for network latency
    if (elapsedSeconds > timeLimitSeconds * 1.1) {
      // Mark the attempt as completed with 0 score (time expired)
      await prisma.quizAttempt.update({
        where: { id: existingAttempt.id },
        data: { score: 0, totalPoints: 0, earnedPoints: 0, passed: false, completedAt: new Date(), timeTaken: Math.round(elapsedSeconds) },
      });
      throw new Error('Time limit exceeded');
    }
  }

  // Check max COMPLETED attempts (in-progress ones don't count against limit for submission)
  const completedAttemptCount = await prisma.quizAttempt.count({
    where: { quizId, userId, tenantId, completedAt: { not: null } },
  });
  if (completedAttemptCount >= quiz.maxAttempts) {
    throw new Error('Maximum attempts reached');
  }

  // C3-BIZ-B-006 FIX: Validate that ALL submitted questionIds exist in the quiz
  const quizQuestionIds = new Set(quiz.questions.map(q => q.id));
  const invalidIds = answers.filter(a => !quizQuestionIds.has(a.questionId));
  if (invalidIds.length > 0) {
    throw new Error('Invalid question IDs submitted');
  }

  // C3-BIZ-B-001 FIX: totalPoints from ALL quiz questions, not just answered ones.
  const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);
  let earnedPoints = 0;
  const gradedAnswers = quiz.questions.map(question => {
    const studentAnswer = answers.find(a => a.questionId === question.id);
    if (!studentAnswer) {
      return { questionId: question.id, answer: null, isCorrect: false, points: 0 };
    }

    const isCorrect = gradeQuestion(question, studentAnswer.answer);
    if (isCorrect) earnedPoints += question.points;

    return { ...studentAnswer, isCorrect, points: isCorrect ? question.points : 0 };
  });

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = score >= quiz.passingScore;
  const now = new Date();
  const timeTaken = existingAttempt ? Math.round((now.getTime() - existingAttempt.startedAt.getTime()) / 1000) : null;

  // V2 P0 FIX: Update existing in-progress attempt instead of creating duplicate
  let result;
  if (existingAttempt) {
    result = await prisma.quizAttempt.update({
      where: { id: existingAttempt.id },
      data: { score, totalPoints, earnedPoints, answers: gradedAnswers, passed, completedAt: now, timeTaken },
    });
  } else {
    // Fallback: create new attempt (for backward compatibility with attempts started before this fix)
    result = await prisma.quizAttempt.create({
      data: { tenantId, quizId, userId, score, totalPoints, earnedPoints, answers: gradedAnswers, passed, completedAt: now, timeTaken },
    });
  }

  // Award XP for passing a quiz (non-blocking)
  if (passed) {
    try { await awardXp(tenantId, userId, 'quiz_pass', quizId); } catch { /* non-blocking */ }
  }

  // V2 P1 FIX: Update LessonProgress.quizPassed + quizScore (was never written)
  // This is required for sequential gate (canAccessLesson checks quizPassed)
  if (quiz.lesson?.id) {
    const lessonId = quiz.lesson.id;
    const updateData: Record<string, unknown> = { quizScore: score };
    if (passed) updateData.quizPassed = true; // Only set to true, never revert to false
    await prisma.lessonProgress.updateMany({
      where: { tenantId, lessonId, userId },
      data: updateData,
    }).catch(() => { /* lesson progress may not exist yet */ });
  }

  return result;
}

function gradeQuestion(
  question: { type: string; options: unknown; correctAnswer: string | null; caseSensitive: boolean },
  answer: string | string[]
): boolean {
  switch (question.type) {
    case 'MULTIPLE_CHOICE': {
      const options = question.options as Array<{ id: string; isCorrect: boolean }>;
      const correctIds = options.filter(o => o.isCorrect).map(o => o.id).sort();
      const selectedIds = (Array.isArray(answer) ? answer : [answer]).sort();
      return JSON.stringify(correctIds) === JSON.stringify(selectedIds);
    }
    case 'TRUE_FALSE': {
      const options = question.options as Array<{ id: string; isCorrect: boolean }>;
      const correct = options.find(o => o.isCorrect);
      return correct?.id === answer;
    }
    case 'FILL_IN': {
      if (!question.correctAnswer) return false;
      const userAnswer = (Array.isArray(answer) ? answer[0] : answer).trim().normalize('NFC');
      const correct = question.correctAnswer.trim().normalize('NFC');
      return question.caseSensitive
        ? userAnswer === correct
        : userAnswer.toLowerCase() === correct.toLowerCase();
    }
    default:
      return false;
  }
}

// ── Certificates ─────────────────────────────────────────────

export async function issueCertificate(
  tenantId: string,
  enrollmentId: string,
  userId: string,
  studentName: string
) {
  // P11-01 FIX: Entire certificate issuance wrapped in $transaction to prevent
  // TOCTOU race condition (duplicate check + create are now atomic)
  const { certificate, course, verificationCode } = await prisma.$transaction(async (tx) => {
    // 1. Fetch enrollment with course data
    const enrollment = await tx.enrollment.findFirst({
      where: { id: enrollmentId, tenantId, userId, status: 'COMPLETED' },
      include: {
        course: {
          include: {
            chapters: { include: { lessons: { select: { quizId: true } } } },
          },
        },
      },
    });
    if (!enrollment) throw new Error('Enrollment not found or not completed');

    const txCourse = enrollment.course;
    const templateId = txCourse.certificateTemplateId;
    if (!templateId) throw new Error('No certificate template configured for this course');

    // 2. Duplicate check (atomic — inside transaction)
    const existingCert = await tx.certificate.findFirst({
      where: { tenantId, userId, enrollment: { courseId: enrollment.courseId } },
      select: { id: true },
    });
    if (existingCert) throw new Error('Certificate already issued for this course');

    // 3. Verify quiz completion
    const courseQuizIds = txCourse.chapters
      .flatMap(ch => ch.lessons)
      .map(l => l.quizId)
      .filter((id): id is string => id !== null);
    if (courseQuizIds.length > 0) {
      const passingAttempts = await tx.quizAttempt.findMany({
        where: { userId, quizId: { in: courseQuizIds }, tenantId, passed: true },
        select: { quizId: true },
      });
      const passedQuizIds = new Set(passingAttempts.map(a => a.quizId));
      const unpassedQuizzes = courseQuizIds.filter(id => !passedQuizIds.has(id));
      if (unpassedQuizzes.length > 0) throw new Error('Required quizzes not passed');
    }

    // 4. Create certificate + link to enrollment (atomic)
    const vCode = crypto.randomUUID();
    const cert = await tx.certificate.create({
      data: {
        tenantId, templateId, userId,
        courseTitle: txCourse.title, studentName, verificationCode: vCode,
        expiresAt: null,
      },
    });
    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: { certificateId: cert.id },
    });

    // 5. Auto-create CeCredits for accredited courses (inside transaction for consistency)
    try {
      const accreditations = await tx.courseAccreditation.findMany({
        where: { tenantId, courseId: enrollment.courseId, status: 'APPROVED' },
        select: { regulatoryBodyId: true, ufcCredits: true, ceCategory: true },
      });
      for (const acc of accreditations) {
        const license = await tx.representativeLicense.findFirst({
          where: { tenantId, userId, regulatoryBodyId: acc.regulatoryBodyId, isActive: true },
          select: { id: true },
        });
        if (!license) continue;
        const activePeriod = await tx.cePeriod.findFirst({
          where: { tenantId, userId, regulatoryBodyId: acc.regulatoryBodyId, status: { in: ['ACTIVE', 'GRACE_PERIOD'] } },
          select: { id: true },
        });
        if (activePeriod) {
          await tx.ceCredit.create({
            data: {
              tenantId, userId, licenseId: license.id, cePeriodId: activePeriod.id,
              courseId: enrollment.courseId, enrollmentId, certificateId: cert.id,
              ufcCredits: acc.ufcCredits, ceCategory: acc.ceCategory,
              description: `Cours complete: ${txCourse.title}`,
              isVerified: true, verifiedAt: new Date(), earnedAt: new Date(),
            },
          });
          await tx.cePeriod.update({
            where: { id: activePeriod.id },
            data: { earnedUfc: { increment: Number(acc.ufcCredits) } },
          });
        }
      }
    } catch {
      // UFC credit creation should not block certificate issuance
    }

    return { certificate: cert, course: txCourse, verificationCode: vCode };
  });

  // Non-blocking operations OUTSIDE transaction
  logAudit({
    tenantId, userId, action: 'create', entity: 'certificate',
    entityId: certificate.id,
    details: { courseTitle: course.title, enrollmentId, verificationCode },
  }).catch(() => {});

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (user?.email) {
    const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://attitudes.vip'}/learn/certificates/verify/${verificationCode}`;
    const email = buildCertificateIssuedEmail({
      studentName, courseName: course.title, verificationCode, verificationUrl,
    });
    sendEmail({ to: { email: user.email, name: user.name ?? undefined }, subject: email.subject, html: email.html, text: email.text }).catch((e) => { if (typeof console !== "undefined") console.warn("[LMS] Non-blocking op failed:", e instanceof Error ? e.message : e); });
  }

  return certificate;
}

export async function verifyCertificate(verificationCode: string) {
  // V2 FIX: Don't expose tenantId in public verification response
  return prisma.certificate.findUnique({
    where: { verificationCode },
    select: {
      id: true,
      courseTitle: true,
      studentName: true,
      status: true,
      issuedAt: true,
      expiresAt: true,
      // tenantId removed — internal info should not be in public endpoint
    },
  });
}

// ── Analytics ────────────────────────────────────────────────

export async function getLmsDashboardStats(tenantId: string) {
  const [
    totalCourses,
    publishedCourses,
    totalEnrollments,
    activeEnrollments,
    completedEnrollments,
    totalCertificates,
    overdueCompliance,
  ] = await Promise.all([
    prisma.course.count({ where: { tenantId } }),
    prisma.course.count({ where: { tenantId, status: 'PUBLISHED' } }),
    prisma.enrollment.count({ where: { tenantId } }),
    prisma.enrollment.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.enrollment.count({ where: { tenantId, status: 'COMPLETED' } }),
    prisma.certificate.count({ where: { tenantId, status: 'ISSUED' } }),
    prisma.enrollment.count({
      where: {
        tenantId,
        complianceStatus: 'OVERDUE',
      },
    }),
  ]);

  const completionRate = totalEnrollments > 0
    ? Math.round((completedEnrollments / totalEnrollments) * 100)
    : 0;

  return {
    totalCourses,
    publishedCourses,
    totalEnrollments,
    activeEnrollments,
    completedEnrollments,
    completionRate,
    totalCertificates,
    overdueCompliance,
  };
}

// ── Categories ───────────────────────────────────────────────

export async function getCourseCategories(tenantId: string) {
  return prisma.courseCategory.findMany({
    where: { tenantId, isActive: true },
    include: {
      _count: { select: { courses: true, children: true } },
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { courses: true } } },
      },
    },
    orderBy: { sortOrder: 'asc' },
    take: 100,
  });
}

// ── Instructors ──────────────────────────────────────────────

export async function getInstructors(tenantId: string) {
  return prisma.instructorProfile.findMany({
    where: { tenantId, isActive: true },
    include: { _count: { select: { courses: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

// ── Sequential Completion Gate ──────────────────────────────────

/**
 * Checks if a student can access a specific lesson based on sequential completion.
 * All previous lessons (by chapter sortOrder then lesson sortOrder) must be completed.
 */
export async function canAccessLesson(
  tenantId: string,
  enrollmentId: string,
  lessonId: string
): Promise<{ allowed: boolean; reason?: string; nextRequiredLessonId?: string }> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      course: {
        include: {
          chapters: {
            orderBy: { sortOrder: 'asc' },
            include: {
              lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true } },
            },
          },
        },
      },
      lessonProgress: { select: { lessonId: true, isCompleted: true } },
    },
  });

  if (!enrollment || enrollment.tenantId !== tenantId) {
    return { allowed: false, reason: 'Enrollment not found' };
  }

  // If sequential completion not required, always allow
  if (!enrollment.course.requireSequentialCompletion) {
    return { allowed: true };
  }

  // Build ordered list of all lesson IDs
  const orderedLessonIds: string[] = [];
  for (const chapter of enrollment.course.chapters) {
    for (const lesson of chapter.lessons) {
      orderedLessonIds.push(lesson.id);
    }
  }

  const targetIndex = orderedLessonIds.indexOf(lessonId);
  if (targetIndex === -1) {
    return { allowed: false, reason: 'Lesson not found in this course' };
  }

  // First lesson is always accessible
  if (targetIndex === 0) return { allowed: true };

  // Check all previous lessons are completed
  const completedSet = new Set(
    enrollment.lessonProgress.filter(p => p.isCompleted).map(p => p.lessonId)
  );

  for (let i = 0; i < targetIndex; i++) {
    if (!completedSet.has(orderedLessonIds[i])) {
      return {
        allowed: false,
        reason: 'Previous lessons not completed',
        nextRequiredLessonId: orderedLessonIds[i],
      };
    }
  }

  return { allowed: true };
}

/**
 * Checks if a student can access the final qualifying exam.
 * Requires 100% lesson completion + all lesson quizzes passed.
 */
export async function canAccessExam(
  tenantId: string,
  enrollmentId: string
): Promise<{ allowed: boolean; progress: number; threshold: number; missingLessons: string[] }> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      course: {
        include: {
          chapters: {
            include: {
              lessons: {
                select: { id: true, title: true, quizId: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      lessonProgress: { select: { lessonId: true, isCompleted: true, quizPassed: true } },
    },
  });

  if (!enrollment || enrollment.tenantId !== tenantId) {
    return { allowed: false, progress: 0, threshold: 100, missingLessons: [] };
  }

  const allLessons = enrollment.course.chapters.flatMap(c => c.lessons);
  const completedSet = new Set(
    enrollment.lessonProgress.filter(p => p.isCompleted).map(p => p.lessonId)
  );
  const quizPassedSet = new Set(
    enrollment.lessonProgress.filter(p => p.quizPassed).map(p => p.lessonId)
  );

  const missingLessons: string[] = [];
  for (const lesson of allLessons) {
    if (!completedSet.has(lesson.id)) {
      missingLessons.push(lesson.title);
    } else if (lesson.quizId && !quizPassedSet.has(lesson.id)) {
      missingLessons.push(`${lesson.title} (quiz non reussi)`);
    }
  }

  const progress = allLessons.length > 0
    ? Math.round((completedSet.size / allLessons.length) * 100)
    : 0;

  return {
    allowed: missingLessons.length === 0,
    progress,
    threshold: 100,
    missingLessons,
  };
}

// ── Bundles (Forfaits) ──────────────────────────────────────────

export async function getBundles(tenantId: string) {
  return prisma.courseBundle.findMany({
    where: { tenantId, isActive: true },
    include: {
      items: {
        include: { course: { select: { id: true, title: true, slug: true, thumbnailUrl: true, estimatedHours: true, level: true } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
    take: 100, // FIX P3: Limit query result
  });
}

export async function getBundleBySlug(tenantId: string, slug: string) {
  return prisma.courseBundle.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
    include: {
      items: {
        include: {
          course: {
            select: {
              id: true, title: true, slug: true, subtitle: true, thumbnailUrl: true,
              estimatedHours: true, level: true, price: true, corporatePrice: true,
              enrollmentCount: true, averageRating: true, passingScore: true,
              chapters: { select: { id: true, title: true, _count: { select: { lessons: true } } } },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

/**
 * Enrolls a user in all courses of a bundle.
 * Skips courses where the user is already enrolled.
 */
export async function enrollUserInBundle(
  tenantId: string,
  bundleId: string,
  userId: string,
  options?: {
    enrolledBy?: string;
    corporateAccountId?: string;
    paymentType?: string;
    bundleOrderId?: string;
  }
): Promise<{ enrollmentIds: string[]; skippedCourseIds: string[] }> {
  const bundle = await prisma.courseBundle.findUnique({
    where: { id: bundleId },
    include: { items: { include: { course: true }, orderBy: { sortOrder: 'asc' } } },
  });

  if (!bundle || bundle.tenantId !== tenantId) {
    throw new Error('Bundle not found');
  }

  // Cross-tenant validation for corporate account
  if (options?.corporateAccountId) {
    const corp = await prisma.corporateAccount.findFirst({
      where: { id: options.corporateAccountId, tenantId },
      select: { id: true },
    });
    if (!corp) {
      throw new Error('Corporate account does not belong to this tenant');
    }
  }

  const enrollmentIds: string[] = [];
  const skippedCourseIds: string[] = [];

  for (const item of bundle.items) {
    // Check if already enrolled
    const existing = await prisma.enrollment.findUnique({
      where: { tenantId_courseId_userId: { tenantId, courseId: item.courseId, userId } },
    });

    if (existing) {
      skippedCourseIds.push(item.courseId);
      continue;
    }

    // Count lessons
    const totalLessons = await prisma.lesson.count({
      where: { chapter: { courseId: item.courseId }, isPublished: true },
    });

    const enrollment = await prisma.enrollment.create({
      data: {
        tenantId,
        courseId: item.courseId,
        userId,
        totalLessons,
        enrolledBy: options?.enrolledBy ?? null,
        enrollmentSource: options?.corporateAccountId ? 'corporate' : 'purchase',
        corporateAccountId: options?.corporateAccountId ?? null,
        paymentType: options?.paymentType ?? 'individual',
        bundleOrderId: options?.bundleOrderId ?? null,
      },
    });

    enrollmentIds.push(enrollment.id);
  }

  // FIX P1: Only increment bundle enrollment count if at least 1 new enrollment was created
  if (enrollmentIds.length > 0) {
    await prisma.courseBundle.update({
      where: { id: bundleId },
      data: { enrollmentCount: { increment: 1 } },
    });
  }

  return { enrollmentIds, skippedCourseIds };
}

// ── Corporate Accounts ──────────────────────────────────────────

export async function getCorporateAccounts(tenantId: string) {
  return prisma.corporateAccount.findMany({
    where: { tenantId, isActive: true },
    include: {
      _count: { select: { employees: true, enrollments: true, bundleOrders: true } },
    },
    orderBy: { companyName: 'asc' },
    take: 200, // FIX P3: Limit query result
  });
}

export async function getCorporateAccountById(tenantId: string, id: string) {
  return prisma.corporateAccount.findFirst({
    where: { id, tenantId },
    include: {
      employees: { orderBy: { addedAt: 'desc' } },
      _count: { select: { employees: true, enrollments: true, bundleOrders: true } },
    },
  });
}

/**
 * Get corporate dashboard stats: completion rates, scores, compliance.
 */
export async function getCorporateDashboardStats(tenantId: string, corporateAccountId: string) {
  const [account, enrollments, employees] = await Promise.all([
    prisma.corporateAccount.findFirst({ where: { id: corporateAccountId, tenantId } }),
    // FIX P2: Limit enrollments loaded into memory (large companies could have 10K+)
    prisma.enrollment.findMany({
      where: { tenantId, corporateAccountId },
      include: {
        course: { select: { title: true, slug: true } },
        lessonProgress: { select: { isCompleted: true, quizScore: true, quizPassed: true } },
      },
      take: 1000, // Cap at 1000 most recent enrollments
      orderBy: { enrolledAt: 'desc' },
    }),
    prisma.corporateEmployee.findMany({
      where: { tenantId, corporateAccountId, isActive: true },
      select: { userId: true, department: true },
    }),
  ]);

  if (!account) throw new Error('Corporate account not found');

  const totalEmployees = employees.length;
  const enrolledEmployeeIds = new Set(enrollments.map(e => e.userId));
  const completedEnrollments = enrollments.filter(e => e.status === 'COMPLETED');
  const activeEnrollments = enrollments.filter(e => e.status === 'ACTIVE');

  // Average progress
  const avgProgress = activeEnrollments.length > 0
    ? activeEnrollments.reduce((sum, e) => sum + Number(e.progress), 0) / activeEnrollments.length
    : 0;

  // Average quiz scores
  const allScores = enrollments.flatMap(e =>
    e.lessonProgress.filter(p => p.quizScore !== null).map(p => Number(p.quizScore))
  );
  const avgQuizScore = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0;

  // Overdue compliance
  const overdueCount = enrollments.filter(
    e => e.complianceDeadline && e.complianceDeadline < new Date() && e.status !== 'COMPLETED'
  ).length;

  // V2 FIX: Use Map for O(n+m) instead of O(n*m) employee-enrollment lookup
  const enrollmentsByUser = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    const list = enrollmentsByUser.get(e.userId) ?? [];
    list.push(e);
    enrollmentsByUser.set(e.userId, list);
  }

  const employeeSummaries = employees.map(emp => {
    const empEnrollments = enrollmentsByUser.get(emp.userId) ?? [];
    const completed = empEnrollments.filter(e => e.status === 'COMPLETED').length;
    const inProgress = empEnrollments.filter(e => e.status === 'ACTIVE').length;
    return {
      userId: emp.userId,
      department: emp.department,
      coursesEnrolled: empEnrollments.length,
      coursesCompleted: completed,
      coursesInProgress: inProgress,
      averageProgress: empEnrollments.length > 0
        ? empEnrollments.reduce((s, e) => s + Number(e.progress), 0) / empEnrollments.length
        : 0,
    };
  });

  return {
    companyName: account.companyName,
    totalEmployees,
    enrolledEmployees: enrolledEmployeeIds.size,
    totalEnrollments: enrollments.length,
    completedEnrollments: completedEnrollments.length,
    completionRate: enrollments.length > 0
      ? Math.round((completedEnrollments.length / enrollments.length) * 100)
      : 0,
    averageProgress: Math.round(avgProgress),
    averageQuizScore: Math.round(avgQuizScore),
    overdueCompliance: overdueCount,
    budgetUsed: Number(account.budgetUsed),
    budgetTotal: account.budgetAmount ? Number(account.budgetAmount) : null,
    employeeSummaries,
  };
}

// ── Pricing Resolution ──────────────────────────────────────────

/**
 * Resolves the price for a course or bundle based on corporate sponsorship.
 */
export async function resolvePricing(
  item: { price: unknown; corporatePrice: unknown; currency: string },
  corporateAccountId?: string | null,
  tenantId?: string // P9-01 FIX: Cross-tenant isolation
): Promise<{ price: number; originalPrice: number; discount: number; isCorporate: boolean }> {
  const originalPrice = Number(item.price ?? 0);

  if (!corporateAccountId) {
    return { price: originalPrice, originalPrice, discount: 0, isCorporate: false };
  }

  // Check for item-level corporate price first
  const corpPrice = Number(item.corporatePrice ?? 0);
  if (corpPrice > 0) {
    return {
      price: corpPrice,
      originalPrice,
      discount: originalPrice - corpPrice,
      isCorporate: true,
    };
  }

  // Fall back to account-level discount
  // P9-01 FIX: Add tenantId to where clause to prevent cross-tenant data access
  const accountWhere: { id: string; tenantId?: string } = { id: corporateAccountId };
  if (tenantId) accountWhere.tenantId = tenantId;
  const account = await prisma.corporateAccount.findFirst({
    where: accountWhere,
    select: { discountPercent: true },
  });

  if (account && Number(account.discountPercent) > 0) {
    const discountRate = Number(account.discountPercent) / 100;
    const discountedPrice = Math.round(originalPrice * (1 - discountRate) * 100) / 100;
    return {
      price: discountedPrice,
      originalPrice,
      discount: originalPrice - discountedPrice,
      isCorporate: true,
    };
  }

  return { price: originalPrice, originalPrice, discount: 0, isCorporate: true };
}

// ── Badge Auto-Award ────────────────────────────────────────────

/**
 * Checks and awards badges automatically based on student activity.
 * Call after course completion, quiz pass, or streak update.
 */
export async function checkAndAwardBadges(tenantId: string, userId: string) {
  const badges = await prisma.lmsBadge.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true, criteria: true },
  });

  if (badges.length === 0) return [];

  // Load student stats
  const [completedCourses, quizAttempts, streak, existingAwards] = await Promise.all([
    prisma.enrollment.count({ where: { tenantId, userId, status: 'COMPLETED' } }),
    prisma.quizAttempt.findMany({
      where: { tenantId, userId, passed: true },
      select: { id: true, score: true },
    }),
    prisma.lmsStreak.findFirst({ where: { tenantId, userId }, select: { currentStreak: true, longestStreak: true } }),
    prisma.lmsBadgeAward.findMany({ where: { tenantId, userId }, select: { badgeId: true } }),
  ]);

  const awardedBadgeIds = new Set(existingAwards.map(a => a.badgeId));
  const newAwards: string[] = [];

  for (const badge of badges) {
    if (awardedBadgeIds.has(badge.id)) continue;

    const criteria = badge.criteria as { type?: string; value?: number } | null;
    if (!criteria?.type) continue;

    let qualifies = false;

    switch (criteria.type) {
      case 'course_completion':
        qualifies = completedCourses >= (criteria.value ?? 1);
        break;
      case 'courses_completed':
        qualifies = completedCourses >= (criteria.value ?? 5);
        break;
      case 'quiz_score':
        qualifies = quizAttempts.some(q => Number(q.score) >= (criteria.value ?? 90));
        break;
      case 'streak_days':
        qualifies = (streak?.currentStreak ?? 0) >= (criteria.value ?? 7);
        break;
      case 'manual':
        // Manual badges are awarded by admin only
        break;
    }

    if (qualifies) {
      await prisma.lmsBadgeAward.create({
        data: { tenantId, badgeId: badge.id, userId },
      });
      await prisma.lmsNotification.create({
        data: { tenantId, userId, type: 'badge_earned', title: 'Nouveau badge obtenu!', message: badge.name },
      }).catch(() => {});
      newAwards.push(badge.id);
    }
  }

  // Update leaderboard badge count if new awards
  if (newAwards.length > 0) {
    await prisma.lmsLeaderboard.updateMany({
      where: { tenantId, userId },
      data: { badgeCount: { increment: newAwards.length } },
    });
  }

  return newAwards;
}
