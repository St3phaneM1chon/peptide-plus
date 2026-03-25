# AUDIT: lms-service.ts (1,067 LOC, 25 exported functions)

**File**: `/Volumes/AI_Project/peptide-plus/src/lib/lms/lms-service.ts`
**Date**: 2026-03-24
**Auditor**: Claude Opus 4.6
**Schema ref**: `prisma/schema/lms.prisma`

---

## getCourses (line 9-47)

### P2: No upper-bound cap on `limit` parameter — line 16
User-supplied `limit` is used directly with no maximum. A malicious or buggy caller can pass `limit=1000000` to dump the entire table.
Code: `const { status, categoryId, search, page = 1, limit = 20 } = options ?? {};`
Fix:
```ts
const { status, categoryId, search, page = 1, limit: rawLimit = 20 } = options ?? {};
const limit = Math.min(Math.max(rawLimit, 1), 100);
```

### P2: `search` param used directly in Prisma `contains` without length guard — line 25
No validation on `search` string length. An extremely long search string (e.g., 10KB) will be sent verbatim to PostgreSQL, increasing query cost.
Code: `{ title: { contains: search, mode: 'insensitive' as const } },`
Fix:
```ts
const sanitizedSearch = search?.slice(0, 200);
```

### P3: `page` parameter not validated — line 16-17
Negative or zero `page` values produce negative `skip`, which Prisma silently converts to 0 but creates confusing behavior. `page=0` produces `skip=-20`.
Code: `const skip = (page - 1) * limit;`
Fix:
```ts
const safePage = Math.max(page, 1);
const skip = (safePage - 1) * limit;
```

### P2: Over-fetching on category and instructor includes — line 34-37
`category` and `instructor` are included with selected fields, but `_count` fetches counts that may not always be needed by the caller.
Code: `_count: { select: { chapters: true, enrollments: true, reviews: true } },`
Fix: Accept an optional `includeStats` flag; only include `_count` when needed.

---

## getCourseBySlug (line 49-82)

### P2: Full `category`, `instructor`, `certificateTemplate` fetched without select — line 53-55
`include: { category: true, instructor: true, certificateTemplate: true }` loads ALL columns from these relations, including potentially large fields like `htmlTemplate` (certificate template contains full HTML).
Code:
```ts
include: {
  category: true,
  instructor: true,
  certificateTemplate: true,
```
Fix:
```ts
category: { select: { id: true, name: true, slug: true } },
instructor: { select: { id: true, userId: true, title: true, bio: true, avatarUrl: true } },
certificateTemplate: { select: { id: true, name: true } },
```

### P1: No verification that returned course is published — line 50-51
`getCourseBySlug` returns ANY course (DRAFT, ARCHIVED, etc.). If called from a student-facing page, unpublished courses leak.
Code: `where: { tenantId_slug: { tenantId, slug } },`
Fix: Either add `status: 'PUBLISHED'` to the where clause, or create a separate `getPublishedCourseBySlug` function.

---

## getCourseById (line 84-101)

### P2: Full relations fetched without select — line 87-98
Similar to `getCourseBySlug`, all of `category`, `instructor`, `certificateTemplate`, and ALL lessons (including unpublished) are loaded.
Code:
```ts
chapters: {
  orderBy: { sortOrder: 'asc' },
  include: {
    lessons: {
      orderBy: { sortOrder: 'asc' },
    },
  },
},
```
Fix: Add `select` clauses to limit fetched fields. For admin use, this may be intentional, but lessons include full `content` field.

---

## createCourse (line 103-105)

### P0: No input validation — the entire `Prisma.CourseCreateInput` is accepted raw — line 103-104
The caller can set arbitrary fields including `enrollmentCount`, `completionCount`, `averageRating`, `reviewCount` (denormalized stats), or `status: 'PUBLISHED'` bypassing any workflow.
Code: `return prisma.course.create({ data: { ...data, tenantId } });`
Fix:
```ts
export async function createCourse(tenantId: string, data: Prisma.CourseCreateInput) {
  const { enrollmentCount, completionCount, averageRating, reviewCount, ...safeData } = data as any;
  return prisma.course.create({ data: { ...safeData, tenantId, status: 'DRAFT' } });
}
```

### P1: `tenantId` from `data` could override the intended tenant — line 104
If `data` contains a `tenantId` field, the spread `{ ...data, tenantId }` correctly overwrites it (tenantId comes last). However, TypeScript `CourseCreateInput` includes `tenantId` as optional. A caller could also inject `id` to control the primary key.
Code: `data: { ...data, tenantId }`
Fix: Destructure and whitelist only allowed fields.

---

## updateCourse (line 107-115)

### P0: Unvalidated `data` allows modifying denormalized counters — line 113
Same as `createCourse`: the caller can set `enrollmentCount: 99999`, `averageRating: 5.00`, etc.
Code: `return prisma.course.update({ where: { id }, data, });`
Fix: Whitelist allowed fields in `data` before passing to Prisma.

### P1: No audit trail for course changes — line 111-114
Admin modifications to courses (title, status, pricing) are not logged. For compliance courses this is a regulatory issue.
Code: No logging anywhere in the function.
Fix: Add audit log entry before returning.

---

## deleteCourse (line 117-122)

### P1: No cascade check — soft-delete not used — line 121
Hard-deleting a course cascades to all enrollments (schema: `onDelete: Cascade`), destroying student progress, quiz attempts, and certificates permanently.
Code: `return prisma.course.delete({ where: { id } });`
Fix:
```ts
export async function deleteCourse(tenantId: string, id: string) {
  const course = await prisma.course.findFirst({ where: { id, tenantId } });
  if (!course) throw new Error('Course not found');
  // Prevent deletion of courses with enrollments
  const enrollmentCount = await prisma.enrollment.count({ where: { courseId: id } });
  if (enrollmentCount > 0) throw new Error('Cannot delete course with existing enrollments. Archive it instead.');
  return prisma.course.delete({ where: { id } });
}
```

### P1: `enrollmentCount` denormalized counter on course NOT decremented — line 121
When a course is deleted, the parent `enrollmentCount` disappears with it. But any `courseBundle` referencing it via `CourseBundleItem` will have stale item counts.
Code: No cleanup of bundle references.
Fix: Check and remove `CourseBundleItem` entries referencing this course before deletion.

---

## enrollUser (line 126-175)

### P1: Race condition — concurrent enrollment creates duplicates — line 128-132, 155-166
Between the `findUnique` check (line 128) and the `create` (line 155), a concurrent request can also pass the check. The `@@unique` constraint will throw a raw Prisma error (P2002) instead of a clean "Already enrolled" message.
Code:
```ts
const existing = await prisma.enrollment.findUnique({...});
if (existing) throw new Error('Already enrolled');
// ... gap ...
const enrollment = await prisma.enrollment.create({...});
```
Fix: Wrap in try/catch for P2002, or use `$transaction` with serializable isolation:
```ts
try {
  const enrollment = await prisma.enrollment.create({...});
} catch (e: any) {
  if (e.code === 'P2002') throw new Error('Already enrolled');
  throw e;
}
```

### P1: No `$transaction` — enrollment + course counter update are not atomic — line 155-172
If the enrollment is created but the `course.update` (line 169) fails, the `enrollmentCount` on the course will be wrong.
Code:
```ts
const enrollment = await prisma.enrollment.create({...});
await prisma.course.update({
  where: { id: courseId },
  data: { enrollmentCount: { increment: 1 } },
});
```
Fix:
```ts
const [enrollment] = await prisma.$transaction([
  prisma.enrollment.create({ data: {...} }),
  prisma.course.update({ where: { id: courseId }, data: { enrollmentCount: { increment: 1 } } }),
]);
```

### P2: `maxEnrollments` check has TOCTOU race — line 141-143
The enrollment count is read (line 136), then checked (line 141), then a new enrollment is created (line 155). Between read and create, another enrollment can slip through.
Code:
```ts
if (course.maxEnrollments && course._count.enrollments >= course.maxEnrollments) {
  throw new Error('Course is full');
}
```
Fix: Use a database-level check or optimistic locking:
```ts
const updated = await prisma.course.updateMany({
  where: { id: courseId, enrollmentCount: { lt: course.maxEnrollments! } },
  data: { enrollmentCount: { increment: 1 } },
});
if (updated.count === 0) throw new Error('Course is full');
```

### P2: No check for enrollment deadline — line 126
Schema has `enrollmentDeadline: DateTime?` on Course, but `enrollUser` never checks it.
Code: No deadline check present.
Fix:
```ts
if (course.enrollmentDeadline && new Date() > course.enrollmentDeadline) {
  throw new Error('Enrollment deadline has passed');
}
```

### P2: `totalLessons` counts unpublished lessons — line 136, 146
The `chapters` include is done without filtering for `isPublished`, so `totalLessons` includes draft/unpublished lessons.
Code:
```ts
include: { _count: { select: { enrollments: true } }, chapters: { include: { lessons: true } } },
```
Fix:
```ts
chapters: { include: { lessons: { where: { isPublished: true } } } },
```

---

## getEnrollment (line 177-185)

### P3: Loads ALL `lessonProgress` records without limit — line 182
For a course with hundreds of lessons, this returns all progress records. No pagination.
Code: `lessonProgress: true,`
Fix: Use `select` to limit fields, or paginate if the use case allows it.

---

## getUserEnrollments (line 187-201)

### P3: Hard-coded `take: 100` without pagination support — line 199
If a user has more than 100 enrollments across all courses, old ones are silently dropped.
Code: `take: 100,`
Fix: Add pagination params similar to `getCourses`.

---

## updateLessonProgress (line 205-275)

### P1: `lessonId` not validated against the course — line 208, 242
The function accepts any `lessonId` and creates a `LessonProgress` record for it, even if the lesson does not belong to the enrollment's course. A student could mark progress on lessons from other courses.
Code:
```ts
const progress = await prisma.lessonProgress.upsert({
  where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
  create: { tenantId, enrollmentId, lessonId, userId, ...data },
```
Fix:
```ts
const lessonBelongsToCourse = await prisma.lesson.findFirst({
  where: { id: lessonId, chapter: { courseId: enrollment.courseId } },
  select: { id: true },
});
if (!lessonBelongsToCourse) throw new Error('Lesson does not belong to this course');
```

### P2: `quizScore` not validated — line 216
`quizScore` can be any number including negative values or values > 100.
Code: `quizScore?: number;`
Fix:
```ts
if (data.quizScore !== undefined && (data.quizScore < 0 || data.quizScore > 100)) {
  throw new Error('Quiz score must be between 0 and 100');
}
```

### P2: `videoProgress` not validated for negative values — line 213
`videoProgress` can be negative.
Code: `videoProgress?: number;`
Fix:
```ts
if (data.videoProgress !== undefined && data.videoProgress < 0) {
  throw new Error('Video progress cannot be negative');
}
```

### P2: `timeSpent` can be zero or negative — line 238
Only checks `> 28800` but not `<= 0`.
Code: `if (data.timeSpent && data.timeSpent > 28800)`
Fix:
```ts
if (data.timeSpent !== undefined && (data.timeSpent <= 0 || data.timeSpent > 28800)) {
  throw new Error('Time spent must be between 1 and 28800 seconds');
}
```

### P3: Swallowed XP error with empty catch — line 271
XP award failure is silently swallowed with no logging.
Code: `catch { /* XP failure should not block progress */ }`
Fix:
```ts
catch (e) { console.error('[LMS] XP award failed for lesson', lessonId, e); }
```

---

## recalculateEnrollmentProgress (line 277-340)

### P0: No tenant validation — function takes only `enrollmentId` — line 277
This is a private function, but it is called from `updateLessonProgress` which validates tenant. However, the function itself loads enrollment without tenant check, then performs multiple writes. If called from another context, it would be unsafe.
Code: `async function recalculateEnrollmentProgress(enrollmentId: string)`
Fix: Add tenantId parameter: `async function recalculateEnrollmentProgress(enrollmentId: string, tenantId: string)` and use it in the where clause.

### P1: No `$transaction` for multi-step completion — line 294-339
When a course is completed, the function: (1) updates course completion count (302), (2) awards XP (309), (3) looks up user (320), (4) issues certificate (325), (5) awards badges (332), (6) updates enrollment (339). If any intermediate step fails after the course counter was incremented, the counter is wrong.
Code: Steps 302 through 339 are all separate DB operations.
Fix: Wrap the completion logic (enrollment update + course counter) in `$transaction`, and leave XP/cert/badge as fire-and-forget.

### P1: `totalLessons || 1` masks data issues — line 285
If `totalLessons` is 0 (e.g., new course with no lessons), division by 1 makes progress = 0% even though there's nothing to do. When lessons are later added, the `totalLessons` on existing enrollments is never updated.
Code: `const total = enrollment.totalLessons || 1;`
Fix: If `totalLessons === 0`, either skip recalculation or update it from the actual course. Also, the `totalLessons` field on enrollment is stale and never re-synced when lessons are added/removed from the course.

### P2: Certificate auto-issued only when `certificateTemplateId` exists — line 317
But the condition checks `course?.certificateTemplateId` which was loaded from the DB. If the template was just added to the course AFTER the student completed lessons (but before recalculation), the cert might not be issued because the enrollment's course include doesn't have it.
Code:
```ts
const course = await prisma.course.findUnique({
  where: { id: enrollment.courseId },
  select: { certificateTemplateId: true, title: true },
});
if (course?.certificateTemplateId) {
```
This is correct since it re-fetches. No actual bug here, just noting the re-fetch is necessary.

### P3: Multiple swallowed errors with empty catches — line 310, 326, 334
Three separate `catch {}` blocks with no logging.
Code:
```ts
catch { /* XP failure should not block completion */ }
catch { /* Certificate issuance failure should not block completion */ }
catch { /* Badge award failure should not block completion */ }
```
Fix: Add `console.error` with context in each.

---

## submitQuizAttempt (line 344-404)

### P1: No enrollment check — any user can submit quiz answers — line 344-348
The function checks that the quiz belongs to the tenant, but does NOT verify that the user is enrolled in the course that contains this quiz. An unenrolled user can submit attempts.
Code:
```ts
const quiz = await prisma.quiz.findFirst({
  where: { id: quizId, tenantId },
  include: { questions: true },
});
```
Fix: Verify enrollment:
```ts
const quiz = await prisma.quiz.findFirst({
  where: { id: quizId, tenantId },
  include: { questions: true, lesson: { select: { chapter: { select: { courseId: true } } } } },
});
const enrollment = await prisma.enrollment.findFirst({
  where: { tenantId, userId, courseId: quiz.lesson.chapter.courseId },
});
if (!enrollment) throw new Error('Not enrolled in this course');
```

### P2: `answers` array not validated for size — line 348
No max length on the `answers` array. A malicious user could send thousands of entries, causing the grading loop to take longer than necessary.
Code: `answers: Array<{ questionId: string; answer: string | string[] }>`
Fix:
```ts
if (answers.length > quiz.questions.length * 2) {
  throw new Error('Too many answers submitted');
}
```

### P2: No time limit enforcement — line 344-404
Many quizzes have `timeLimit` (seconds). The function does not verify that the attempt was completed within the time limit. A student could start a quiz, take hours, and submit.
Code: No time limit check exists.
Fix:
```ts
if (quiz.timeLimit) {
  const lastAttemptStart = await prisma.quizAttempt.findFirst({
    where: { quizId, userId, tenantId },
    orderBy: { startedAt: 'desc' },
    select: { startedAt: true },
  });
  // Or pass startedAt from client and validate
}
```

### P1: `maxAttempts` race condition — line 357-362
Between counting existing attempts and creating the new one, a concurrent request could also pass. Two requests at `attemptCount === maxAttempts - 1` both pass and create, exceeding the limit.
Code:
```ts
const attemptCount = await prisma.quizAttempt.count({
  where: { quizId, userId, tenantId },
});
if (attemptCount >= quiz.maxAttempts) {
  throw new Error('Maximum attempts reached');
}
```
Fix: Use a transaction or handle unique constraint. Alternatively, check after insert and rollback.

### P0: `gradeQuestion` answer values not sanitized — line 412-432
For `MULTIPLE_CHOICE`, the `answer` is cast to array and compared via `JSON.stringify`. An attacker could pass non-string values in the answer array (e.g., objects) that cause JSON.stringify to produce unexpected results.
Code:
```ts
const selectedIds = (Array.isArray(answer) ? answer : [answer]).sort();
return JSON.stringify(correctIds) === JSON.stringify(selectedIds);
```
Fix:
```ts
const selectedIds = (Array.isArray(answer) ? answer : [answer])
  .filter(a => typeof a === 'string')
  .sort();
```

### P1: `FILL_IN` answer comparison vulnerable to Unicode normalization attacks — line 422-428
Two visually identical strings with different Unicode codepoints (e.g., Latin "a" vs Cyrillic "a") would not match, confusing users. More critically, `trim()` only removes ASCII whitespace, not zero-width characters.
Code:
```ts
return question.caseSensitive
  ? userAnswer.trim() === question.correctAnswer.trim()
  : userAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
```
Fix:
```ts
const normalize = (s: string) => s.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
```

---

## issueCertificate (line 436-513)

### P1: Duplicate certificate issuance not prevented — line 482-492
If `issueCertificate` is called twice for the same enrollment (e.g., by a retry or race condition in `recalculateEnrollmentProgress`), two certificates are created with different `verificationCode`s. There is no unique constraint on `(userId, courseTitle)` or similar.
Code:
```ts
const certificate = await prisma.certificate.create({
  data: { tenantId, templateId, userId, courseTitle: course.title, studentName, verificationCode, expiresAt: null },
});
```
Fix:
```ts
const existingCert = await prisma.certificate.findFirst({
  where: { tenantId, userId, courseTitle: course.title },
});
if (existingCert) return existingCert;
```

### P2: `studentName` is caller-supplied, not validated — line 440
The `studentName` parameter can contain any string including scripts or very long names that will be embedded in the certificate.
Code: `studentName: string`
Fix:
```ts
if (!studentName || studentName.length > 200) throw new Error('Invalid student name');
const safeName = studentName.replace(/<[^>]*>/g, ''); // Strip HTML
```

### P2: Email send failure silently swallowed — line 509
If `sendEmail` fails, the student never knows they got a certificate.
Code: `sendEmail({...}).catch(() => {});`
Fix:
```ts
sendEmail({...}).catch((e) => console.error('[LMS] Certificate email failed for user', userId, e));
```

### P3: `NEXT_PUBLIC_BASE_URL` fallback to hardcoded domain — line 502
Hardcoded fallback URL will break if the app runs on a different domain.
Code: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://attitudes.vip'}`
Fix: Use a centralized config module for base URL.

---

## verifyCertificate (line 515-528)

### P0: No tenant isolation — any tenant's certificate is verifiable — line 516-528
The function takes only `verificationCode` with no `tenantId`. While returning `tenantId` in the response, it queries across all tenants. This is intentional for public verification, but `tenantId` is leaked in the response.
Code:
```ts
select: {
  id: true,
  courseTitle: true,
  studentName: true,
  status: true,
  issuedAt: true,
  expiresAt: true,
  tenantId: true,
},
```
Fix: If cross-tenant verification is intended, remove `tenantId` from the response to avoid information leakage:
```ts
select: { id: true, courseTitle: true, studentName: true, status: true, issuedAt: true, expiresAt: true },
```

### P2: No check for certificate status — line 515-528
Returns revoked certificates with status=REVOKED. Caller must check, but a UI displaying "Certificate Valid" could mishandle this.
Code: Returns all statuses including REVOKED.
Fix: Either filter `status: 'ISSUED'` or include clear documentation that caller must check status.

---

## getLmsDashboardStats (line 532-570)

### P2: 7 parallel COUNT queries — line 533-554
Seven separate COUNT queries to the database, even though some could be combined.
Code:
```ts
const [totalCourses, publishedCourses, totalEnrollments, activeEnrollments, completedEnrollments, totalCertificates, overdueCompliance] = await Promise.all([...]);
```
Fix: Use raw SQL with a single query:
```sql
SELECT
  COUNT(*) FILTER (WHERE type='course') as total_courses,
  COUNT(*) FILTER (WHERE type='course' AND status='PUBLISHED') as published
FROM ...
```
Or use `groupBy` to reduce query count.

---

## getCourseCategories (line 574-588)

### P2: Nested children loaded only 1 level deep — line 579-583
If categories have deeper nesting (grandchildren), they are not loaded. This is a limitation, not a bug, but should be documented.
Code:
```ts
children: {
  where: { isActive: true },
  orderBy: { sortOrder: 'asc' },
  include: { _count: { select: { courses: true } } },
},
```
Fix: Document the 1-level depth limitation or use recursive CTE for deep trees.

---

## getInstructors (line 592-598)

### P3: No pagination — line 597
Hard-coded `take: 100`. If a tenant has more than 100 instructors, they are silently dropped.
Code: `take: 100,`
Fix: Add pagination parameters.

---

## canAccessLesson (line 607-670)

### P1: No tenant check on enrollment — only post-hoc comparison — line 612-629
The enrollment is loaded by ID alone (no `tenantId` in where clause). Tenant check happens after the full data load (line 629). This means the full course structure of another tenant is loaded into memory before rejection.
Code:
```ts
const enrollment = await prisma.enrollment.findUnique({
  where: { id: enrollmentId },
  include: { course: { include: { chapters: { ... } } } },
});
if (!enrollment || enrollment.tenantId !== tenantId) {
  return { allowed: false, reason: 'Enrollment not found' };
}
```
Fix:
```ts
const enrollment = await prisma.enrollment.findFirst({
  where: { id: enrollmentId, tenantId },
  include: { course: { include: { chapters: { ... } } } },
});
```

### P2: Full course structure loaded every time — line 612-627
Every call to `canAccessLesson` loads the entire course with all chapters and lessons. For frequent calls (student navigating between lessons), this is excessive.
Code: `include: { course: { include: { chapters: { ... } } } }`
Fix: Cache the ordered lesson list per enrollment, or accept `courseId` and load the structure once at the page level.

---

## canAccessExam (line 676-731)

### P1: Same tenant isolation issue as canAccessLesson — line 680-700
Enrollment loaded without `tenantId` in where clause. Cross-tenant data loaded before rejection.
Code:
```ts
const enrollment = await prisma.enrollment.findUnique({
  where: { id: enrollmentId },
  include: { course: { include: { chapters: { ... } } } },
});
```
Fix: Use `findFirst` with `tenantId` in where clause.

### P2: Quiz pass check uses `lessonProgress.quizPassed` not actual `QuizAttempt` — line 709, 716
`quizPassed` on `LessonProgress` could be stale (set by `updateLessonProgress` but never un-set if the quiz is later modified). Actual quiz attempt records are the source of truth.
Code:
```ts
const quizPassedSet = new Set(
  enrollment.lessonProgress.filter(p => p.quizPassed).map(p => p.lessonId)
);
```
Fix: Cross-reference with actual `QuizAttempt` records like `issueCertificate` does (line 469-477).

---

## getBundles (line 735-746)

### P3: No pagination — line 735
Returns all active bundles for a tenant with no limit.
Code: No `take` clause.
Fix: Add `take: 50` or pagination params.

---

## getBundleBySlug (line 748-767)

### P2: Nested includes fetch full course data — line 751-763
Includes full chapter data with `_count` for every course in the bundle. For bundles with many courses, this is a heavy query.
Code:
```ts
course: {
  select: { ..., chapters: { select: { id: true, title: true, _count: { select: { lessons: true } } } } },
},
```
This is actually already using `select`. Minor concern only.

---

## enrollUserInBundle (line 773-847)

### P0: N+1 query pattern — individual DB queries in a loop — line 807-838
For each course in the bundle, the function: (1) checks existing enrollment, (2) counts lessons, (3) creates enrollment. That's 3 queries per course. A bundle with 10 courses = 30+ queries.
Code:
```ts
for (const item of bundle.items) {
  const existing = await prisma.enrollment.findUnique({...});
  const totalLessons = await prisma.lesson.count({...});
  const enrollment = await prisma.enrollment.create({...});
}
```
Fix: Batch the operations:
```ts
const existingEnrollments = await prisma.enrollment.findMany({
  where: { tenantId, userId, courseId: { in: bundle.items.map(i => i.courseId) } },
  select: { courseId: true },
});
const existingSet = new Set(existingEnrollments.map(e => e.courseId));
// Then batch create with $transaction
```

### P1: No `$transaction` — partial enrollment possible — line 807-847
If the loop fails mid-way (e.g., on course 5 of 10), the first 4 enrollments are created but the bundle `enrollmentCount` is incremented. The student is partially enrolled with no way to retry cleanly.
Code: Each `prisma.enrollment.create` is independent.
Fix: Wrap all enrollment creates and the bundle counter update in a `$transaction`.

### P1: Bundle `enrollmentCount` always incremented, even if all courses were skipped — line 841-844
If the user is already enrolled in ALL courses of the bundle, `skippedCourseIds` contains all courses but `enrollmentCount` is still incremented by 1.
Code:
```ts
await prisma.courseBundle.update({
  where: { id: bundleId },
  data: { enrollmentCount: { increment: 1 } },
});
```
Fix:
```ts
if (enrollmentIds.length > 0) {
  await prisma.courseBundle.update({...});
}
```

### P1: Course `enrollmentCount` NOT incremented — line 823-835
Unlike `enrollUser` which increments `course.enrollmentCount`, `enrollUserInBundle` does NOT. The denormalized counter on each course will be wrong.
Code: No `prisma.course.update` with increment inside the loop.
Fix: Add `prisma.course.update({ where: { id: item.courseId }, data: { enrollmentCount: { increment: 1 } } })` for each new enrollment.

### P2: `bundle.tenantId` not checked in `items` include — line 784-787
The `bundle` is loaded by `id` alone and then post-checked for tenant. Bundle items load courses without tenant verification. If the bundle ID is guessed, the course data of another tenant is loaded.
Code:
```ts
const bundle = await prisma.courseBundle.findUnique({
  where: { id: bundleId },
  include: { items: { include: { course: true }, orderBy: { sortOrder: 'asc' } } },
});
if (!bundle || bundle.tenantId !== tenantId) {
  throw new Error('Bundle not found');
}
```
Fix: Use `findFirst` with `tenantId` in where clause.

---

## getCorporateAccounts (line 851-859)

### P3: No pagination — line 852
Returns all active corporate accounts with no limit.
Code: No `take` clause.
Fix: Add pagination or a reasonable limit.

---

## getCorporateAccountById (line 861-869)

### P2: All employees loaded without pagination — line 865
`employees: { orderBy: { addedAt: 'desc' } }` loads ALL employees. A corporate account with thousands of employees would cause memory issues.
Code: `employees: { orderBy: { addedAt: 'desc' } },`
Fix: Add `take: 50` and pagination support.

---

## getCorporateDashboardStats (line 874-948)

### P2: All enrollments loaded into memory — line 877-888
Loads ALL enrollments for a corporate account into memory, then computes stats in JavaScript. For a company with 1000 employees x 20 courses = 20,000 enrollments with full `lessonProgress`, this is a memory bomb.
Code:
```ts
prisma.enrollment.findMany({
  where: { tenantId, corporateAccountId },
  include: {
    course: { select: { title: true, slug: true } },
    lessonProgress: { select: { isCompleted: true, quizScore: true, quizPassed: true } },
  },
}),
```
Fix: Use aggregation queries instead of loading all data into JS:
```ts
const stats = await prisma.enrollment.aggregate({
  where: { tenantId, corporateAccountId },
  _count: { _all: true },
  _avg: { progress: true },
});
```

### P1: `corporateAccountId` not verified against tenant before loading data — line 875-888
All three parallel queries load data before checking `if (!account)` on line 890. If `corporateAccountId` belongs to another tenant, enrollments and employees are still loaded.
Code:
```ts
const [account, enrollments, employees] = await Promise.all([
  prisma.corporateAccount.findFirst({ where: { id: corporateAccountId, tenantId } }),
  prisma.enrollment.findMany({ where: { tenantId, corporateAccountId } }),
  prisma.corporateEmployee.findMany({ where: { corporateAccountId, isActive: true } }),
]);
if (!account) throw new Error('Corporate account not found');
```
Fix: The `enrollment` query already filters by `tenantId`, so this is safe. But the `employees` query does NOT filter by `tenantId` — it only filters by `corporateAccountId`. This is a cross-tenant data leak.

### P0: Cross-tenant data leak in employee query — line 884-887
The `corporateEmployee` query filters only by `corporateAccountId`, NOT by `tenantId`. If a `corporateAccountId` from another tenant is passed, the employees of that other tenant's corporate account are returned.
Code:
```ts
prisma.corporateEmployee.findMany({
  where: { corporateAccountId, isActive: true },
  select: { userId: true, department: true },
}),
```
Fix:
```ts
prisma.corporateEmployee.findMany({
  where: { corporateAccountId, tenantId, isActive: true },
  select: { userId: true, department: true },
}),
```

### P2: Per-employee summary computed in O(employees x enrollments) — line 916-930
For each employee, all enrollments are filtered. If 500 employees and 5000 enrollments, that's 2.5M iterations.
Code:
```ts
const employeeSummaries = employees.map(emp => {
  const empEnrollments = enrollments.filter(e => e.userId === emp.userId);
```
Fix: Pre-build a `Map<string, Enrollment[]>` grouped by userId:
```ts
const enrollmentsByUser = new Map<string, typeof enrollments>();
for (const e of enrollments) {
  const arr = enrollmentsByUser.get(e.userId) ?? [];
  arr.push(e);
  enrollmentsByUser.set(e.userId, arr);
}
```

---

## resolvePricing (line 955-994)

### P1: `corporateAccountId` not verified against tenant — line 977-979
The corporate account is loaded by ID without tenant check. Pricing from another tenant's corporate account can be applied.
Code:
```ts
const account = await prisma.corporateAccount.findFirst({
  where: { id: corporateAccountId },
  select: { discountPercent: true },
});
```
Fix:
```ts
where: { id: corporateAccountId, tenantId },
```
But `tenantId` is not a parameter of this function. Add it:
```ts
export async function resolvePricing(
  tenantId: string,
  item: { price: unknown; corporatePrice: unknown; currency: string },
  corporateAccountId?: string | null
)
```

### P2: `price` and `corporatePrice` typed as `unknown` — line 956
These are `Decimal` from Prisma, cast to `Number`. If the caller passes a string like `"abc"`, `Number("abc") = NaN`, and all math returns `NaN`.
Code:
```ts
const originalPrice = Number(item.price ?? 0);
const corpPrice = Number(item.corporatePrice ?? 0);
```
Fix:
```ts
const originalPrice = Number(item.price ?? 0);
if (isNaN(originalPrice)) throw new Error('Invalid price');
```

### P2: Negative discount possible — line 984
If `discountPercent > 100`, the discounted price becomes negative.
Code:
```ts
const discountRate = Number(account.discountPercent) / 100;
const discountedPrice = Math.round(originalPrice * (1 - discountRate) * 100) / 100;
```
Fix:
```ts
const discountRate = Math.min(Number(account.discountPercent), 100) / 100;
const discountedPrice = Math.max(0, Math.round(originalPrice * (1 - discountRate) * 100) / 100);
```

---

## checkAndAwardBadges (line 1002-1067)

### P1: N+1 badge award — individual creates in loop — line 1051-1054
Each qualifying badge triggers an individual `prisma.lmsBadgeAward.create`. If 10 badges qualify at once, that's 10 separate writes.
Code:
```ts
for (const badge of badges) {
  if (qualifies) {
    await prisma.lmsBadgeAward.create({
      data: { tenantId, badgeId: badge.id, userId },
    });
```
Fix: Collect all qualifying badges, then use `createMany`:
```ts
await prisma.lmsBadgeAward.createMany({
  data: newAwards.map(badgeId => ({ tenantId, badgeId, userId })),
  skipDuplicates: true,
});
```

### P1: Race condition — duplicate badge awards — line 1024-1054
Between loading `existingAwards` (line 1018) and creating new awards (line 1051), concurrent calls can both determine the same badge qualifies and create duplicates. The `@@unique([badgeId, userId])` constraint will throw a raw Prisma P2002 error.
Code:
```ts
const awardedBadgeIds = new Set(existingAwards.map(a => a.badgeId));
// ... loop ...
await prisma.lmsBadgeAward.create({...});
```
Fix: Use `createMany` with `skipDuplicates: true`, or wrap each create in try/catch for P2002.

### P2: `leaderboard.updateMany` may match 0 rows — line 1060-1063
If no leaderboard entry exists for this user (not yet created), the `updateMany` silently does nothing and the badge count is lost.
Code:
```ts
await prisma.lmsLeaderboard.updateMany({
  where: { tenantId, userId },
  data: { badgeCount: { increment: newAwards.length } },
});
```
Fix: Use `upsert` or check if leaderboard exists first.

### P2: `criteria` type assertion unsafe — line 1027
The JSON `criteria` field is cast without validation. Malformed JSON stored in the DB could cause runtime errors.
Code:
```ts
const criteria = badge.criteria as { type?: string; value?: number } | null;
if (!criteria?.type) continue;
```
Fix: Add defensive parsing:
```ts
const criteria = typeof badge.criteria === 'object' && badge.criteria !== null
  ? (badge.criteria as { type?: string; value?: number })
  : null;
```

---

## CROSS-CUTTING CONCERNS

### P1: No global error handling pattern — entire file
No function wraps its operations in try/catch with contextual error logging. Prisma errors (connection timeouts, constraint violations) propagate as raw errors with internal field names visible to callers.
Fix: Add a wrapper or middleware that catches Prisma-specific errors and translates them to domain errors.

### P2: `import { prisma }` singleton — no connection pooling awareness — line 1
All queries use the global Prisma singleton. Under high concurrent load, all LMS queries share the same connection pool, potentially starving other services.
Fix: Consider using `prisma.$transaction` interactive mode for multi-step operations to use a single connection.

### P1: Denormalized counters (`enrollmentCount`, `completionCount`, `badgeCount`) managed manually — multiple functions
These counters are incremented/decremented individually across multiple functions without a single source of truth. Over time, they will drift from actual counts. No reconciliation mechanism exists.
Fix: Add a periodic reconciliation job:
```ts
await prisma.course.update({
  where: { id: courseId },
  data: { enrollmentCount: await prisma.enrollment.count({ where: { courseId } }) },
});
```

### P2: `crypto.randomUUID()` used for certificate verification — line 480
UUIDs are not cryptographically unpredictable in all environments. For verification codes that serve as authentication tokens, a more secure random generator should be used.
Fix:
```ts
import { randomBytes } from 'crypto';
const verificationCode = randomBytes(32).toString('hex');
```

---

## SUMMARY

| Severity | Count | Examples |
|----------|-------|---------|
| **P0** | 5 | createCourse unvalidated input, cross-tenant employee leak, gradeQuestion unsanitized input, N+1 in enrollUserInBundle, updateCourse unvalidated data |
| **P1** | 16 | Race conditions (enrollUser, submitQuiz, badges), missing $transaction (enrollUser, recalculate, bundle), cross-tenant leaks (resolvePricing, canAccessLesson), lessonId not validated, duplicate cert, denormalized counters drift |
| **P2** | 18 | No limit cap, over-fetching, totalLessons includes unpublished, enrollment deadline unchecked, memory-heavy corporate stats, negative discount, quiz time limit unenforced |
| **P3** | 7 | Swallowed errors, no pagination, hardcoded URL, stale totalLessons |
| **TOTAL** | **46** | |
