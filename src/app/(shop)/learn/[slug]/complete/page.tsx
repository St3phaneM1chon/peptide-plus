'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/hooks/useTranslations';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CompletionData {
  courseName: string;
  courseSlug: string;
  studentName: string;
  completedAt: string;
  verificationCode: string;
  certificateId: string | null;
  timeSpentHours: number;
  quizAverageScore: number | null;
  conceptsMastered: number;
  lessonsCompleted: number;
  totalLessons: number;
  recommendedCourses: Array<{
    slug: string;
    title: string;
    level: string;
    thumbnailUrl: string | null;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Confetti Animation (CSS-only)                                       */
/* ------------------------------------------------------------------ */

function Confetti() {
  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 2 + Math.random() * 3,
    color: colors[i % colors.length],
    size: 4 + Math.random() * 6,
    rotation: Math.random() * 360,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50" aria-hidden="true">
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes confetti-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-15px); }
          75% { transform: translateX(15px); }
        }
      `}</style>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.left}%`,
            top: '-2%',
            width: `${p.size}px`,
            height: `${p.size * 1.5}px`,
            backgroundColor: p.color,
            borderRadius: '2px',
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards, confetti-shake ${p.duration * 0.5}s ease-in-out ${p.delay}s infinite`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Star Rating                                                         */
/* ------------------------------------------------------------------ */

function StarRating({
  rating,
  onChange,
  t,
}: {
  rating: number;
  onChange: (r: number) => void;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={t('learn.complete.rateLabel')}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-transform hover:scale-110"
          role="radio"
          aria-checked={rating === star}
          aria-label={`${star} ${t('learn.complete.stars')}`}
        >
          <svg
            className={`w-8 h-8 transition-colors ${
              star <= (hover || rating) ? 'text-yellow-400' : 'text-gray-200'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function CourseCompletePage() {
  const { t } = useTranslations();
  const params = useParams();
  const slug = params.slug as string;

  const [data, setData] = useState<CompletionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    async function fetchCompletion() {
      try {
        const res = await fetch(`/api/lms/course-completion?slug=${slug}`);
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        setData(json);
      } catch {
        setError(t('learn.complete.loadError'));
      } finally {
        setLoading(false);
      }
    }
    fetchCompletion();
  }, [slug, t]);

  // Hide confetti after animation
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmitReview = async () => {
    if (rating === 0 || !data) return;
    setReviewSubmitting(true);
    try {
      await fetch('/api/lms/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseSlug: slug,
          rating,
          comment: reviewText || undefined,
        }),
      });
      setReviewSubmitted(true);
    } catch {
      // silent
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!data) return;
    const url = `${window.location.origin}/learn/verify/${data.verificationCode}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  };

  const handleShareLinkedIn = () => {
    if (!data) return;
    const url = encodeURIComponent(`${window.location.origin}/learn/verify/${data.verificationCode}`);
    const title = encodeURIComponent(`${t('learn.complete.linkedinTitle')}: ${data.courseName}`);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700 mb-2">{error || t('learn.complete.loadError')}</p>
          <Link href={`/learn/${slug}`} className="text-blue-600 hover:underline text-sm">
            {t('learn.complete.backToCourse')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {showConfetti && <Confetti />}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        {/* ---------------------------------------------------------- */}
        {/*  Celebration Header                                          */}
        {/* ---------------------------------------------------------- */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {t('learn.complete.congratulations')}
          </h1>
          <p className="text-lg text-gray-600">
            {t('learn.complete.completedMessage', { course: data.courseName })}
          </p>
        </div>

        {/* ---------------------------------------------------------- */}
        {/*  Certificate Preview                                         */}
        {/* ---------------------------------------------------------- */}
        <section className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-1" />
          <div className="p-8 md:p-12 text-center">
            <p className="text-sm text-gray-400 uppercase tracking-widest mb-4">{t('learn.complete.certificateOf')}</p>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{data.courseName}</h2>
            <div className="w-20 h-0.5 bg-blue-500 mx-auto my-6" />
            <p className="text-gray-600 mb-1">{t('learn.complete.awardedTo')}</p>
            <p className="text-xl font-semibold text-gray-900 mb-6">{data.studentName}</p>
            <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
              <span>{t('learn.complete.completedOn')}: {new Date(data.completedAt).toLocaleDateString()}</span>
              <span className="hidden sm:inline">&middot;</span>
              <span className="hidden sm:inline">{t('learn.complete.verifyCode')}: {data.verificationCode}</span>
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-1" />
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={`/api/lms/certificate-pdf?code=${data.verificationCode}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t('learn.complete.downloadPdf')}
          </a>
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {linkCopied ? t('learn.complete.linkCopied') : t('learn.complete.copyLink')}
          </button>
          <button
            onClick={handleShareLinkedIn}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
            {t('learn.complete.shareLinkedIn')}
          </button>
        </div>

        {/* ---------------------------------------------------------- */}
        {/*  Course Stats                                                */}
        {/* ---------------------------------------------------------- */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-bold text-blue-600">{data.timeSpentHours}h</p>
            <p className="text-xs text-gray-500 mt-1">{t('learn.complete.timeSpent')}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-bold text-green-600">{data.lessonsCompleted}/{data.totalLessons}</p>
            <p className="text-xs text-gray-500 mt-1">{t('learn.complete.lessonsCompleted')}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-bold text-purple-600">{data.quizAverageScore != null ? `${data.quizAverageScore}%` : '--'}</p>
            <p className="text-xs text-gray-500 mt-1">{t('learn.complete.quizAverage')}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-bold text-yellow-600">{data.conceptsMastered}</p>
            <p className="text-xs text-gray-500 mt-1">{t('learn.complete.conceptsMastered')}</p>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Review Form                                                 */}
        {/* ---------------------------------------------------------- */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
          {reviewSubmitted ? (
            <div className="text-center py-4">
              <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-semibold text-gray-900">{t('learn.complete.reviewThanks')}</p>
              <p className="text-sm text-gray-500 mt-1">{t('learn.complete.reviewThanksDesc')}</p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-2">{t('learn.complete.rateTitle')}</h2>
              <p className="text-sm text-gray-500 mb-4">{t('learn.complete.rateDesc')}</p>
              <div className="mb-4">
                <StarRating rating={rating} onChange={setRating} t={t} />
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="w-full h-24 p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                placeholder={t('learn.complete.reviewPlaceholder')}
              />
              <button
                onClick={handleSubmitReview}
                disabled={rating === 0 || reviewSubmitting}
                className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {reviewSubmitting ? t('learn.complete.submitting') : t('learn.complete.submitReview')}
              </button>
            </>
          )}
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Recommended Courses                                         */}
        {/* ---------------------------------------------------------- */}
        {data.recommendedCourses.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('learn.complete.whatsNext')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.recommendedCourses.map((course) => (
                <Link
                  key={course.slug}
                  href={`/learn/${course.slug}`}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                    {course.thumbnailUrl ? (
                      <img src={course.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-10 h-10 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    )}
                  </div>
                  <div className="p-4">
                    <span className="text-xs text-gray-400 uppercase">{course.level}</span>
                    <h3 className="font-semibold text-gray-900 text-sm mt-1">{course.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Back links */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <Link href="/learn/dashboard" className="text-blue-600 hover:underline">
            {t('learn.complete.backToDashboard')}
          </Link>
          <span className="text-gray-300">&middot;</span>
          <Link href="/learn" className="text-blue-600 hover:underline">
            {t('learn.complete.browseCourses')}
          </Link>
        </div>
      </div>
    </div>
  );
}
