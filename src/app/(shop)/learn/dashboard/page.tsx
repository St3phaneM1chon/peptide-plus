'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CourseEnrollment {
  id: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  courseThumbnail: string | null;
  progress: number;
  lessonsCompleted: number;
  totalLessons: number;
  lastAccessedAt: string | null;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
  nextChapterId: string | null;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
}

interface DashboardData {
  enrollments: CourseEnrollment[];
  stats: {
    totalCourses: number;
    completedCourses: number;
    inProgressCourses: number;
    hoursStudied: number;
    conceptsMastered: number;
    quizzesCompleted: number;
    streakDays: number;
    reviewDueCount: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    courseTitle?: string;
  }>;
  deadlines: Array<{
    courseTitle: string;
    deadline: string;
    ufcCredits: number;
  }>;
  badges: Array<{
    id: string;
    name: string;
    icon: string;
    earnedAt: string;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Progress Ring                                                       */
/* ------------------------------------------------------------------ */

function ProgressRing({ progress, size = 80, strokeWidth = 6 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#22c55e"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Streak Counter                                                      */
/* ------------------------------------------------------------------ */

function StreakCounter({ days, t }: { days: number; t: (k: string, p?: Record<string, string | number>) => string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-2xl ${days > 0 ? 'animate-pulse' : ''}`}
        role="img"
        aria-label={t('learn.dashboard.streakLabel')}
      >
        {days > 0 ? '\uD83D\uDD25' : '\u2744\uFE0F'}
      </span>
      <div>
        <p className="text-2xl font-bold text-gray-900">{days}</p>
        <p className="text-xs text-gray-500">{t('learn.dashboard.streakDays')}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function LearningDashboardPage() {
  const { t } = useTranslations();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/lms/student-dashboard');
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        setData(json);
      } catch {
        setError(t('learn.dashboard.loadError'));
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [t]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin w-8 h-8 text-blue-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500">{t('learn.dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-gray-700 font-medium mb-1">{error || t('learn.dashboard.loadError')}</p>
          <button onClick={() => window.location.reload()} className="text-blue-600 text-sm hover:underline">
            {t('learn.dashboard.retry')}
          </button>
        </div>
      </div>
    );
  }

  // Find the most recent in-progress enrollment for "Continue Learning" hero
  const continueCourse = data.enrollments
    .filter((e) => e.status === 'ACTIVE' && e.progress < 100)
    .sort((a, b) => {
      const aTime = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
      const bTime = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
      return bTime - aTime;
    })[0] || null;

  const activeCourses = data.enrollments.filter((e) => e.status === 'ACTIVE' && e.progress < 100);
  const completedCourses = data.enrollments.filter((e) => e.status === 'COMPLETED' || e.progress >= 100);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/learn" className="text-blue-200 hover:text-white text-sm">
              {t('learn.dashboard.backToCatalog')}
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">{t('learn.dashboard.title')}</h1>
          <p className="text-blue-200 mt-1">{t('learn.dashboard.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ---------------------------------------------------------- */}
        {/*  Continue Learning Hero                                      */}
        {/* ---------------------------------------------------------- */}
        {continueCourse && (
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
              <div className="relative flex-shrink-0">
                <ProgressRing progress={continueCourse.progress} size={100} strokeWidth={8} />
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">
                  {Math.round(continueCourse.progress)}%
                </span>
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="text-sm text-blue-600 font-medium mb-1">{t('learn.dashboard.continueLearning')}</p>
                <h2 className="text-xl font-bold text-gray-900 mb-1">{continueCourse.courseTitle}</h2>
                <p className="text-sm text-gray-500 mb-4">
                  {continueCourse.lessonsCompleted}/{continueCourse.totalLessons} {t('learn.dashboard.lessonsCompleted')}
                  {continueCourse.nextLessonTitle && (
                    <> &middot; {t('learn.dashboard.nextUp')}: {continueCourse.nextLessonTitle}</>
                  )}
                </p>
                {continueCourse.nextLessonId && continueCourse.nextChapterId && (
                  <Link
                    href={`/learn/${continueCourse.courseSlug}/${continueCourse.nextChapterId}/${continueCourse.nextLessonId}`}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('learn.dashboard.continueButton')}
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------- */}
        {/*  Stats Row                                                   */}
        {/* ---------------------------------------------------------- */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t('learn.dashboard.statCourses'), value: data.stats.totalCourses, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', color: 'blue' },
            { label: t('learn.dashboard.statCompleted'), value: data.stats.completedCourses, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'green' },
            { label: t('learn.dashboard.statHours'), value: data.stats.hoursStudied, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'purple' },
            { label: t('learn.dashboard.statMastered'), value: data.stats.conceptsMastered, icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', color: 'yellow' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-${stat.color}-50`}>
                  <svg className={`w-5 h-5 text-${stat.color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Main Grid: Courses + Sidebar                                */}
        {/* ---------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Active + Completed Courses */}
          <div className="lg:col-span-2 space-y-8">
            {/* Weekly Stats */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{t('learn.dashboard.weeklyStats')}</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-blue-600">{data.stats.hoursStudied}h</p>
                  <p className="text-xs text-gray-500">{t('learn.dashboard.timeStudied')}</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-600">{data.stats.conceptsMastered}</p>
                  <p className="text-xs text-gray-500">{t('learn.dashboard.conceptsMasteredLabel')}</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-purple-600">{data.stats.quizzesCompleted}</p>
                  <p className="text-xs text-gray-500">{t('learn.dashboard.quizzesCompleted')}</p>
                </div>
              </div>
            </section>

            {/* Active Courses */}
            {activeCourses.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-4">{t('learn.dashboard.activeCourses')}</h2>
                <div className="space-y-3">
                  {activeCourses.map((course) => (
                    <Link
                      key={course.id}
                      href={
                        course.nextLessonId && course.nextChapterId
                          ? `/learn/${course.courseSlug}/${course.nextChapterId}/${course.nextLessonId}`
                          : `/learn/${course.courseSlug}`
                      }
                      className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                          {course.courseThumbnail ? (
                            <img src={course.courseThumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{course.courseTitle}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {course.lessonsCompleted}/{course.totalLessons} {t('learn.dashboard.lessonsCompleted')}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${course.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 font-medium">{Math.round(course.progress)}%</span>
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Completed Courses */}
            {completedCourses.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-4">{t('learn.dashboard.completedCourses')}</h2>
                <div className="space-y-3">
                  {completedCourses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/learn/${course.courseSlug}`}
                      className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{course.courseTitle}</h3>
                          <p className="text-xs text-green-600 mt-0.5">
                            {t('learn.dashboard.courseCompleted')}
                            {course.completedAt && ` - ${new Date(course.completedAt).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* No Courses */}
            {data.enrollments.length === 0 && (
              <section className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('learn.dashboard.noCourses')}</h3>
                <p className="text-gray-500 mb-6">{t('learn.dashboard.noCoursesDesc')}</p>
                <Link
                  href="/learn"
                  className="inline-flex items-center px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('learn.dashboard.browseCatalog')}
                </Link>
              </section>
            )}

            {/* Recent Activity Feed */}
            {data.recentActivity.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-4">{t('learn.dashboard.recentActivity')}</h2>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {data.recentActivity.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="px-4 py-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activity.type === 'lesson_completed' ? 'bg-green-50' :
                        activity.type === 'quiz_passed' ? 'bg-purple-50' :
                        activity.type === 'badge_earned' ? 'bg-yellow-50' :
                        'bg-blue-50'
                      }`}>
                        {activity.type === 'lesson_completed' && (
                          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                        {activity.type === 'quiz_passed' && (
                          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                        )}
                        {activity.type === 'badge_earned' && (
                          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        )}
                        {!['lesson_completed', 'quiz_passed', 'badge_earned'].includes(activity.type) && (
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{activity.description}</p>
                        {activity.courseTitle && (
                          <p className="text-xs text-gray-400">{activity.courseTitle}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* -------------------------------------------------------- */}
          {/*  Right Sidebar                                             */}
          {/* -------------------------------------------------------- */}
          <div className="space-y-6">
            {/* Streak + Review */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
              <StreakCounter days={data.stats.streakDays} t={t} />

              {/* Review Queue */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">{t('learn.dashboard.reviewQueue')}</p>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    {data.stats.reviewDueCount} {t('learn.dashboard.due')}
                  </span>
                </div>
                {data.stats.reviewDueCount > 0 ? (
                  <Link
                    href="/learn/review"
                    className="block w-full text-center px-4 py-2 bg-orange-50 text-orange-700 font-medium rounded-lg hover:bg-orange-100 transition-colors text-sm"
                  >
                    {t('learn.dashboard.startReview')}
                  </Link>
                ) : (
                  <p className="text-xs text-gray-400">{t('learn.dashboard.noReviewsDue')}</p>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('learn.dashboard.quickLinks')}</h3>
              <nav className="space-y-1">
                {[
                  { href: '/learn/review', label: t('learn.dashboard.linkReview'), icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
                  { href: '/learn/mastery', label: t('learn.dashboard.linkMastery'), icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                  { href: '/learn/roleplay', label: t('learn.dashboard.linkRoleplay'), icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
                  { href: '/learn/preferences', label: t('learn.dashboard.linkPreferences'), icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
                    </svg>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Compliance Deadlines */}
            {data.deadlines.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('learn.dashboard.complianceDeadlines')}
                </h3>
                <div className="space-y-3">
                  {data.deadlines.map((dl, i) => {
                    const deadline = new Date(dl.deadline);
                    const isOverdue = deadline < new Date();
                    return (
                      <div key={i} className={`p-3 rounded-lg text-sm ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                        <p className="font-medium text-gray-900">{dl.courseTitle}</p>
                        <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {isOverdue ? t('learn.dashboard.overdue') : t('learn.dashboard.dueDate')}: {deadline.toLocaleDateString()}
                        </p>
                        {dl.ufcCredits > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">{dl.ufcCredits} {t('learn.dashboard.ufcCredits')}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Badges */}
            {data.badges.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('learn.dashboard.badges')}</h3>
                <div className="flex flex-wrap gap-2">
                  {data.badges.map((badge) => (
                    <div
                      key={badge.id}
                      className="w-10 h-10 rounded-full bg-yellow-50 border border-yellow-200 flex items-center justify-center text-lg"
                      title={`${badge.name} - ${new Date(badge.earnedAt).toLocaleDateString()}`}
                    >
                      {badge.icon}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
