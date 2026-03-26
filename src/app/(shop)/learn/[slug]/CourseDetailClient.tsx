'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from '@/hooks/useTranslations';

interface CourseLesson {
 id: string;
 title: string;
 type: string;
 isFree: boolean;
 videoDuration: number | null;
 estimatedMinutes: number | null;
 chapterId: string;
}

interface CourseChapter {
 id: string;
 title: string;
 description: string | null;
 lessons: CourseLesson[];
}

interface CourseData {
 id: string;
 slug: string;
 title: string;
 subtitle: string | null;
 description: string | null;
 longDescription: string | null;
 thumbnailUrl: string | null;
 trailerVideoUrl: string | null;
 level: string;
 isFree: boolean;
 price: number | null;
 currency: string;
 estimatedHours: number | null;
 enrollmentCount: number;
 averageRating: number | null;
 reviewCount: number;
 tags: string[];
 category: { name: string; slug: string } | null;
 instructor: { id: string; title: string | null; bio: string | null; avatarUrl: string | null; expertise: string[] } | null;
 chapters: CourseChapter[];
 prerequisites: { id: string; title: string; slug: string }[];
 reviews: { id: string; rating: number; title: string | null; comment: string | null; createdAt: string }[];
 totalLessons: number;
}

interface EnrollmentData {
 id: string;
 status: string;
 progress: number;
 lessonsCompleted: number;
 totalLessons: number;
 completedLessonIds: string[];
}

interface Props {
 course: CourseData;
 enrollment: EnrollmentData | null;
 isAuthenticated: boolean;
}

export default function CourseDetailClient({ course, enrollment, isAuthenticated }: Props) {
 const { t } = useTranslations();
 const [enrolling, setEnrolling] = useState(false);
 const [enrollmentState, setEnrollmentState] = useState(enrollment);
 const [enrollError, setEnrollError] = useState<string | null>(null);
 const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
 new Set(course.chapters.length > 0 ? [course.chapters[0].id] : [])
 );

 const handleEnroll = async () => {
 setEnrolling(true);
 setEnrollError(null);
 try {
 const res = await fetch('/api/lms/enroll', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ courseId: course.id }),
 });
 if (!res.ok) {
 const data = await res.json();
 throw new Error(data.error || 'Enrollment failed');
 }
 const data = await res.json();
 setEnrollmentState({
 id: data.enrollment.id,
 status: 'ACTIVE',
 progress: 0,
 lessonsCompleted: 0,
 totalLessons: course.totalLessons,
 completedLessonIds: [],
 });
 } catch (err) {
 setEnrollError(err instanceof Error ? err.message : t('lms.courseDetail.enrollError'));
 } finally {
 setEnrolling(false);
 }
 };

 const toggleChapter = (chapterId: string) => {
 setExpandedChapters((prev) => {
 const next = new Set(prev);
 if (next.has(chapterId)) next.delete(chapterId);
 else next.add(chapterId);
 return next;
 });
 };

 const formatDuration = (seconds: number | null) => {
 if (!seconds) return null;
 const m = Math.floor(seconds / 60);
 return `${m} min`;
 };

 // Find the first incomplete lesson for "Continue Learning"
 const findNextLesson = () => {
 if (!enrollmentState) return null;
 for (const ch of course.chapters) {
 for (const l of ch.lessons) {
 if (!enrollmentState.completedLessonIds.includes(l.id)) {
 return { chapterId: ch.id, lessonId: l.id };
 }
 }
 }
 return course.chapters[0]?.lessons[0]
 ? { chapterId: course.chapters[0].id, lessonId: course.chapters[0].lessons[0].id }
 : null;
 };

 const nextLesson = findNextLesson();

 const lessonTypeIcon = (type: string) => {
 switch (type) {
 case 'VIDEO':
 return (
 <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 );
 case 'TEXT':
 return (
 <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 );
 case 'QUIZ':
 return (
 <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 );
 default:
 return (
 <svg className="w-4 h-4 text-[var(--k-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
 </svg>
 );
 }
 };

 return (
 <div className="min-h-screen bg-[var(--k-bg-base)]">
 {/* Hero */}
 <section className="bg-gray-900 text-white">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
 <div>
 <Link
 href="/learn"
 className="inline-flex items-center gap-2 text-[var(--k-text-tertiary)] hover:text-white mb-6 text-sm"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 {t('learn.backToLearning')}
 </Link>

 {course.category && (
 <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 text-sm font-medium rounded-full mb-4">
 {course.category.name}
 </span>
 )}

 <h1 className="text-3xl md:text-4xl font-bold mb-3">{course.title}</h1>
 {course.subtitle && (
 <p className="text-xl text-[var(--k-text-tertiary)] mb-4">{course.subtitle}</p>
 )}

 <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--k-text-tertiary)] mb-6">
 <span className="flex items-center gap-1">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
 </svg>
 {t('lms.courseDetail.chaptersCount', { count: course.chapters.length })} &middot;{' '}
 {t('lms.courseDetail.lessonsCount', { count: course.totalLessons })}
 </span>
 {course.estimatedHours && (
 <span>{t('lms.courseDetail.estimatedHours', { hours: course.estimatedHours })}</span>
 )}
 <span className="px-2 py-0.5 bg-gray-700 text-[var(--k-text-tertiary)] rounded text-xs">
 {t(`lms.levels.${course.level}`)}
 </span>
 {course.averageRating && (
 <span className="flex items-center gap-1 text-yellow-400">
 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
 <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
 </svg>
 {course.averageRating.toFixed(1)} ({course.reviewCount})
 </span>
 )}
 {course.instructor?.title && (
 <span className="text-[var(--k-text-tertiary)]">
 {t('lms.courseDetail.instructor')}: {course.instructor.title}
 </span>
 )}
 </div>

 {/* Enrollment CTA */}
 {enrollmentState ? (
 <div className="space-y-3">
 <div className="flex items-center gap-3">
 <div className="flex-1 bg-gray-700 rounded-full h-2.5">
 <div
 className="bg-green-500 h-2.5 rounded-full transition-all"
 style={{ width: `${enrollmentState.progress}%` }}
 />
 </div>
 <span className="text-sm text-[var(--k-text-tertiary)] whitespace-nowrap">
 {Math.round(enrollmentState.progress)}%
 </span>
 </div>
 {nextLesson && (
 <Link
 href={`/learn/${course.slug}/${nextLesson.chapterId}/${nextLesson.lessonId}`}
 className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
 >
 <svg className="w-5 h-5 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 {t('lms.courseDetail.continueLearning')}
 </Link>
 )}
 </div>
 ) : isAuthenticated ? (
 <div>
 <button
 onClick={handleEnroll}
 disabled={enrolling}
 className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white font-semibold rounded-lg hover:from-[#5558e6] hover:to-[#737de6] disabled:opacity-50 transition-colors"
 >
 {enrolling ? (
 <svg className="animate-spin w-5 h-5 me-2" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 ) : null}
 {course.isFree
 ? t('lms.courseDetail.enrollNow')
 : `${t('lms.courseDetail.enrollNow')} - ${course.price ? `$${course.price.toFixed(2)} ${course.currency}` : t('lms.courseDetail.free')}`}
 </button>
 {enrollError && (
 <p className="mt-2 text-red-400 text-sm">{enrollError}</p>
 )}
 </div>
 ) : (
 <Link
 href="/auth/signin"
 className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white font-semibold rounded-lg hover:from-[#5558e6] hover:to-[#737de6] transition-colors"
 >
 {t('lms.courseDetail.loginToEnroll')}
 </Link>
 )}
 </div>

 {/* Thumbnail / Trailer */}
 <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl bg-gray-800">
 {course.trailerVideoUrl ? (
 <iframe
 src={course.trailerVideoUrl}
 className="absolute inset-0 w-full h-full"
 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
 allowFullScreen
 title={course.title}
 />
 ) : course.thumbnailUrl ? (
 <Image
 src={course.thumbnailUrl}
 alt={course.title}
 fill
 sizes="(max-width: 768px) 100vw, 50vw"
 className="object-cover"
 />
 ) : (
 <div className="absolute inset-0 flex items-center justify-center">
 <svg className="w-20 h-20 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
 </svg>
 </div>
 )}
 </div>
 </div>
 </div>
 </section>

 {/* Content */}
 <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
 <div className="lg:col-span-2 space-y-8">
 {/* Description */}
 {course.description && (
 <div className="bg-[var(--k-glass-regular)] backdrop-blur-xl rounded-xl p-6 border border-[var(--k-border-subtle)]">
 <h2 className="text-xl font-bold text-[var(--k-text-primary)] mb-4">
 {t('lms.courseDetail.aboutCourse')}
 </h2>
 <div className="prose max-w-none text-[var(--k-text-secondary)]">
 <p>{course.description}</p>
 {course.longDescription && <p className="mt-3">{course.longDescription}</p>}
 </div>
 </div>
 )}

 {/* Chapters / Lessons Outline */}
 <div className="bg-[var(--k-glass-regular)] backdrop-blur-xl rounded-xl border border-[var(--k-border-subtle)]">
 <div className="p-6 border-b border-[var(--k-border-subtle)]">
 <h2 className="text-xl font-bold text-[var(--k-text-primary)]">
 {t('lms.courseDetail.chapters')}
 </h2>
 <p className="text-[var(--k-text-secondary)] text-sm mt-1">
 {t('lms.courseDetail.chaptersCount', { count: course.chapters.length })} &middot;{' '}
 {t('lms.courseDetail.lessonsCount', { count: course.totalLessons })}
 </p>
 </div>
 <div className="divide-y divide-[var(--k-border-subtle)]">
 {course.chapters.map((chapter, ci) => (
 <div key={chapter.id}>
 <button
 onClick={() => toggleChapter(chapter.id)}
 className="w-full flex items-center justify-between p-4 hover:bg-[var(--k-glass-ultra-thin)] transition-colors text-left"
 >
 <div className="flex items-center gap-3">
 <span className="w-7 h-7 bg-blue-100 text-[var(--k-accent-indigo)] rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
 {ci + 1}
 </span>
 <div>
 <h3 className="font-semibold text-[var(--k-text-primary)] text-sm">{chapter.title}</h3>
 <span className="text-xs text-[var(--k-text-secondary)]">{chapter.lessons.length} {chapter.lessons.length === 1 ? 'lesson' : 'lessons'}</span>
 </div>
 </div>
 <svg
 className={`w-5 h-5 text-[var(--k-text-tertiary)] transition-transform ${expandedChapters.has(chapter.id) ? 'rotate-180' : ''}`}
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 {expandedChapters.has(chapter.id) && (
 <div className="border-t border-[var(--k-border-subtle)] bg-[var(--k-glass-ultra-thin)]">
 {chapter.lessons.map((lesson) => {
 const isComplete = enrollmentState?.completedLessonIds.includes(lesson.id);
 return (
 <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 ps-14">
 {isComplete ? (
 <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
 </svg>
 ) : (
 lessonTypeIcon(lesson.type)
 )}
 {enrollmentState ? (
 <Link
 href={`/learn/${course.slug}/${chapter.id}/${lesson.id}`}
 className="text-sm text-[var(--k-text-secondary)] hover:text-[var(--k-accent-indigo)] flex-1"
 >
 {lesson.title}
 </Link>
 ) : (
 <span className="text-sm text-[var(--k-text-secondary)] flex-1">{lesson.title}</span>
 )}
 {lesson.videoDuration && (
 <span className="text-xs text-[var(--k-text-tertiary)]">{formatDuration(lesson.videoDuration)}</span>
 )}
 {lesson.estimatedMinutes && !lesson.videoDuration && (
 <span className="text-xs text-[var(--k-text-tertiary)]">{lesson.estimatedMinutes} min</span>
 )}
 {lesson.isFree && !enrollmentState && (
 <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
 {t('lms.courseDetail.free')}
 </span>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>

 {/* Reviews */}
 {course.reviews.length > 0 && (
 <div className="bg-[var(--k-glass-regular)] backdrop-blur-xl rounded-xl p-6 border border-[var(--k-border-subtle)]">
 <h2 className="text-xl font-bold text-[var(--k-text-primary)] mb-4">
 {t('lms.courseDetail.reviews')} ({course.reviewCount})
 </h2>
 <div className="space-y-4">
 {course.reviews.map((review) => (
 <div key={review.id} className="border-b border-[var(--k-border-subtle)] pb-4 last:border-0 last:pb-0">
 <div className="flex items-center gap-2 mb-1">
 <div className="flex">
 {Array.from({ length: 5 }).map((_, i) => (
 <svg
 key={i}
 className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400' : 'text-gray-200'}`}
 fill="currentColor"
 viewBox="0 0 20 20"
 >
 <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
 </svg>
 ))}
 </div>
 <span className="text-xs text-[var(--k-text-tertiary)]">
 {new Date(review.createdAt).toLocaleDateString()}
 </span>
 </div>
 {review.title && <p className="font-medium text-[var(--k-text-primary)] text-sm">{review.title}</p>}
 {review.comment && <p className="text-sm text-[var(--k-text-secondary)] mt-1">{review.comment}</p>}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Sidebar */}
 <div className="lg:col-span-1">
 <div className="bg-[var(--k-glass-regular)] backdrop-blur-xl rounded-xl p-6 border border-[var(--k-border-subtle)] sticky top-24 space-y-6">
 <h3 className="font-semibold text-[var(--k-text-primary)]">{t('lms.courseDetail.includes')}</h3>
 <ul className="space-y-3 text-sm text-[var(--k-text-secondary)]">
 <li className="flex items-center gap-2">
 <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 {t('lms.courseDetail.chaptersCount', { count: course.chapters.length })}
 </li>
 <li className="flex items-center gap-2">
 <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 {t('lms.courseDetail.lessonsCount', { count: course.totalLessons })}
 </li>
 <li className="flex items-center gap-2">
 <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 {t('lms.courseDetail.lifetimeAccess')}
 </li>
 <li className="flex items-center gap-2">
 <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 {t('lms.courseDetail.certificate')}
 </li>
 </ul>

 {course.instructor && (
 <div className="border-t border-[var(--k-border-subtle)] pt-4">
 <h4 className="text-sm font-medium text-[var(--k-text-secondary)] mb-2">{t('lms.courseDetail.instructor')}</h4>
 <div className="flex items-center gap-3">
 {course.instructor.avatarUrl ? (
 <Image
 src={course.instructor.avatarUrl}
 alt={course.instructor.title || ''}
 width={40}
 height={40}
 className="rounded-full"
 />
 ) : (
 <div className="w-10 h-10 bg-[var(--k-glass-thin)] rounded-full flex items-center justify-center">
 <svg className="w-5 h-5 text-[var(--k-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
 </svg>
 </div>
 )}
 <div>
 <p className="text-sm font-medium text-[var(--k-text-primary)]">{course.instructor.title}</p>
 {course.instructor.expertise.length > 0 && (
 <p className="text-xs text-[var(--k-text-secondary)]">{course.instructor.expertise.join(', ')}</p>
 )}
 </div>
 </div>
 </div>
 )}

 {course.prerequisites.length > 0 && (
 <div className="border-t border-[var(--k-border-subtle)] pt-4">
 <h4 className="text-sm font-medium text-[var(--k-text-secondary)] mb-2">{t('lms.courseDetail.prerequisites')}</h4>
 <ul className="space-y-1">
 {course.prerequisites.map((prereq) => (
 <li key={prereq.id}>
 <Link href={`/learn/${prereq.slug}`} className="text-sm text-[var(--k-accent-indigo)] hover:underline">
 {prereq.title}
 </Link>
 </li>
 ))}
 </ul>
 </div>
 )}

 {course.tags.length > 0 && (
 <div className="border-t border-[var(--k-border-subtle)] pt-4">
 <div className="flex flex-wrap gap-2">
 {course.tags.map((tag) => (
 <span key={tag} className="px-2 py-1 bg-[var(--k-glass-thin)] text-[var(--k-text-secondary)] text-xs rounded-full">
 {tag}
 </span>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </section>
 </div>
 );
}
