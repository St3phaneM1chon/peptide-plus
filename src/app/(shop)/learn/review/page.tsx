'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

// ── Types ───────────────────────────────────────────────────────────

interface ReviewQuestion {
 id: string;
 question: string;
 type: string;
 options: unknown;
 bloomLevel: number;
 difficulty: number;
}

interface ReviewItem {
 conceptId: string;
 conceptName: string;
 domain: string | null;
 description: string | null;
 currentLevel: number;
 targetLevel: number;
 confidence: number;
 daysSinceReview: number | null;
 nextReviewAt: string | null;
 overdueBy: number;
 reviewCount: number;
 accuracyRate: number;
 questions: ReviewQuestion[];
}

interface ReviewQueueData {
 dueNow: number;
 upcomingThisWeek: number;
 items: ReviewItem[];
}

interface MasteryStats {
 total: number;
 mastered: number;
 inProgress: number;
 weak: number;
 untested: number;
 dueForReview: number;
}

type Rating = 1 | 2 | 3 | 4;

// ── Constants ───────────────────────────────────────────────────────

const RATING_CONFIG: Record<Rating, { color: string; bg: string; border: string; hoverBg: string }> = {
 1: { color: 'text-red-400', bg: 'bg-[rgba(244,63,94,0.1)]', border: 'border-[rgba(244,63,94,0.25)]', hoverBg: 'hover:bg-[rgba(244,63,94,0.15)]' },
 2: { color: 'text-orange-400', bg: 'bg-[rgba(245,158,11,0.1)]', border: 'border-[rgba(245,158,11,0.25)]', hoverBg: 'hover:bg-[rgba(245,158,11,0.15)]' },
 3: { color: 'text-green-400', bg: 'bg-[rgba(16,185,129,0.1)]', border: 'border-[rgba(16,185,129,0.25)]', hoverBg: 'hover:bg-[rgba(16,185,129,0.15)]' },
 4: { color: 'text-blue-400', bg: 'bg-[rgba(99,102,241,0.1)]', border: 'border-[rgba(99,102,241,0.25)]', hoverBg: 'hover:bg-[rgba(99,102,241,0.15)]' },
};

const DOMAIN_LABELS: Record<string, string> = {
 iard: 'IARD',
 vie: 'Assurance vie',
 ethique: 'Ethique',
 conformite: 'Conformite',
 collectif: 'Collectif',
 ldpsf: 'LDPSF',
};

// ── Main Page ───────────────────────────────────────────────────────

export default function ReviewQueuePage() {
 const { t, formatDate } = useI18n();

 const [queueData, setQueueData] = useState<ReviewQueueData | null>(null);
 const [stats, setStats] = useState<MasteryStats | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 // Review session state
 const [currentIndex, setCurrentIndex] = useState(0);
 const [flipped, setFlipped] = useState(false);
 const [reviewedCount, setReviewedCount] = useState(0);
 const [submitting, setSubmitting] = useState(false);
 const [sessionComplete, setSessionComplete] = useState(false);
 const [sessionResults, setSessionResults] = useState<Array<{ conceptName: string; rating: Rating }>>([]);

 // ── Fetch data ──────────────────────────────────────────────────

 const fetchQueue = useCallback(async () => {
 try {
 setError(null);
 const [queueRes, statsRes] = await Promise.all([
 fetch('/api/lms/review-queue'),
 fetch('/api/lms/mastery?view=dashboard'),
 ]);

 if (queueRes.ok) {
 const data: ReviewQueueData = await queueRes.json();
 setQueueData(data);
 } else {
 setError(t('learn.review.loadError'));
 }

 if (statsRes.ok) {
 const data = await statsRes.json();
 setStats(data.stats ?? null);
 }
 } catch {
 setError(t('learn.review.loadError'));
 } finally {
 setLoading(false);
 }
 }, [t]);

 useEffect(() => {
 fetchQueue();
 }, [fetchQueue]);

 // ── Rating handler ──────────────────────────────────────────────

 const handleRate = useCallback(async (rating: Rating) => {
 if (!queueData || submitting) return;
 const item = queueData.items[currentIndex];
 if (!item) return;

 setSubmitting(true);

 // Map rating to a quizScore for the mastery API
 const scoreMap: Record<Rating, number> = { 1: 20, 2: 55, 3: 80, 4: 100 };

 try {
 await fetch('/api/lms/mastery', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 conceptId: item.conceptId,
 quizScore: scoreMap[rating],
 rating,
 }),
 });
 } catch {
 // Continue even if API fails
 }

 setSessionResults(prev => [...prev, { conceptName: item.conceptName, rating }]);
 setReviewedCount(prev => prev + 1);

 if (currentIndex + 1 >= queueData.items.length) {
 setSessionComplete(true);
 } else {
 setCurrentIndex(prev => prev + 1);
 setFlipped(false);
 }

 setSubmitting(false);
 }, [queueData, currentIndex, submitting]);

 // ── Loading state ───────────────────────────────────────────────

 if (loading) {
 return (
 <div className="min-h-screen bg-[var(--k-bg-base)] flex items-center justify-center">
 <div className="text-center">
 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--k-accent-indigo)] mx-auto" />
 <p className="mt-4 text-sm text-[var(--k-text-secondary)]">{t('learn.review.loading')}</p>
 </div>
 </div>
 );
 }

 // ── Error state ─────────────────────────────────────────────────

 if (error) {
 return (
 <div className="min-h-screen bg-[var(--k-bg-base)] flex items-center justify-center">
 <div className="text-center max-w-md px-4">
 <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
 <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
 </svg>
 </div>
 <p className="text-[var(--k-text-secondary)] mb-4">{error}</p>
 <button
 onClick={() => { setLoading(true); fetchQueue(); }}
 className="px-4 py-2 bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white rounded-lg hover:from-[#5558e6] hover:to-[#737de6] transition-colors text-sm font-medium"
 >
 {t('learn.review.retry')}
 </button>
 </div>
 </div>
 );
 }

 const items = queueData?.items ?? [];
 const currentItem = items[currentIndex] ?? null;
 const totalDue = queueData?.dueNow ?? 0;
 const upcomingCount = queueData?.upcomingThisWeek ?? 0;

 return (
 <div className="min-h-screen bg-[var(--k-bg-base)]">
 {/* Header */}
 <section className="bg-[var(--k-bg-surface)] border-b border-[var(--k-border-subtle)] text-white py-10">
 <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
 <Link
 href="/learn"
 className="inline-flex items-center gap-2 text-[var(--k-text-tertiary)] hover:text-[var(--k-text-secondary)] mb-5 text-sm"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 {t('learn.backToLearning')}
 </Link>
 <h1 className="text-2xl md:text-3xl font-bold mb-2">
 {t('learn.review.title')}
 </h1>
 <p className="text-[var(--k-text-secondary)] max-w-2xl">
 {t('learn.review.subtitle')}
 </p>
 </div>
 </section>

 <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
 {/* Stats bar */}
 {stats && (
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
 <StatCard
 label={t('learn.review.statsMastered')}
 value={stats.mastered}
 icon={
 <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 }
 />
 <StatCard
 label={t('learn.review.statsLearning')}
 value={stats.inProgress + stats.weak}
 icon={
 <svg className="h-5 w-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
 </svg>
 }
 />
 <StatCard
 label={t('learn.review.statsDueNow')}
 value={totalDue}
 icon={
 <svg className="h-5 w-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 }
 />
 <StatCard
 label={t('learn.review.statsUpcoming')}
 value={upcomingCount}
 icon={
 <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 }
 />
 </div>
 )}

 {/* Session complete */}
 {sessionComplete && (
 <SessionSummary
 results={sessionResults}
 t={t}
 onRestart={() => {
 setSessionComplete(false);
 setSessionResults([]);
 setCurrentIndex(0);
 setReviewedCount(0);
 setFlipped(false);
 setLoading(true);
 fetchQueue();
 }}
 />
 )}

 {/* Empty state */}
 {!sessionComplete && totalDue === 0 && (
 <div className="text-center py-16">
 <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
 <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 </div>
 <h2 className="text-xl font-bold text-[var(--k-text-primary)] mb-2">
 {t('learn.review.allDone')}
 </h2>
 <p className="text-[var(--k-text-secondary)] max-w-md mx-auto mb-6">
 {t('learn.review.allDoneDescription')}
 </p>
 {upcomingCount > 0 && (
 <p className="text-sm text-[var(--k-text-tertiary)] mb-6">
 {t('learn.review.upcomingInfo', { count: String(upcomingCount) })}
 </p>
 )}
 <div className="flex items-center justify-center gap-3">
 <Link
 href="/learn/mastery"
 className="px-5 py-2.5 bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white font-medium rounded-lg hover:from-[#5558e6] hover:to-[#737de6] transition-colors text-sm"
 >
 {t('learn.review.viewMastery')}
 </Link>
 <Link
 href="/learn"
 className="px-5 py-2.5 bg-[var(--k-glass-thin)] text-[var(--k-text-secondary)] font-medium rounded-lg border border-[var(--k-border-default)] hover:bg-[var(--k-glass-regular)] transition-colors text-sm"
 >
 {t('learn.backToLearning')}
 </Link>
 </div>
 </div>
 )}

 {/* Flashcard review */}
 {!sessionComplete && totalDue > 0 && currentItem && (
 <div className="space-y-6">
 {/* Progress bar */}
 <div className="flex items-center gap-4">
 <div className="flex-1 bg-[var(--k-glass-thin)] rounded-full h-2.5 overflow-hidden">
 <div
 className="h-full bg-gradient-to-r from-[#6366f1] to-[#06b6d4] rounded-full transition-all duration-500 ease-out"
 style={{ width: `${totalDue > 0 ? (reviewedCount / totalDue) * 100 : 0}%` }}
 />
 </div>
 <span className="text-sm font-medium text-[var(--k-text-secondary)] whitespace-nowrap">
 {t('learn.review.progress', { current: String(reviewedCount + 1), total: String(totalDue) })}
 </span>
 </div>

 {/* Flashcard */}
 <div className="max-w-2xl mx-auto">
 <div
 className={`relative rounded-2xl border-2 transition-all duration-300 cursor-pointer select-none ${
 flipped
 ? 'border-[var(--k-accent-indigo)] bg-[var(--k-accent-indigo-10)] shadow-[var(--k-shadow-lg)]'
 : 'border-[var(--k-border-subtle)] bg-[var(--k-glass-regular)] backdrop-blur-xl shadow-[var(--k-shadow-md)] hover:shadow-[var(--k-shadow-xl)] hover:border-[var(--k-border-default)]'
 }`}
 onClick={() => !flipped && setFlipped(true)}
 role="button"
 tabIndex={0}
 onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!flipped) setFlipped(true); } }}
 aria-label={flipped ? t('learn.review.cardBack') : t('learn.review.cardFront')}
 >
 {/* Domain badge */}
 <div className="absolute top-4 right-4">
 <span className="px-2.5 py-1 text-xs font-medium bg-[var(--k-glass-thin)] text-[var(--k-text-secondary)] rounded-full">
 {DOMAIN_LABELS[currentItem.domain ?? ''] ?? currentItem.domain ?? ''}
 </span>
 </div>

 <div className="p-8 sm:p-10 min-h-[280px] flex flex-col justify-center">
 {!flipped ? (
 /* Front: concept name */
 <div className="text-center">
 <p className="text-xs uppercase tracking-wider text-[var(--k-text-tertiary)] mb-3">
 {t('learn.review.concept')}
 </p>
 <h2 className="text-2xl sm:text-3xl font-bold text-[var(--k-text-primary)] mb-4">
 {currentItem.conceptName}
 </h2>
 <div className="flex items-center justify-center gap-4 text-xs text-[var(--k-text-tertiary)]">
 {currentItem.reviewCount > 0 && (
 <span>{t('learn.review.reviewed', { count: String(currentItem.reviewCount) })}</span>
 )}
 {currentItem.accuracyRate > 0 && (
 <span>{currentItem.accuracyRate}% {t('learn.mastery.accuracy').toLowerCase()}</span>
 )}
 </div>
 <p className="mt-6 text-sm text-[var(--k-text-tertiary)] animate-pulse">
 {t('learn.review.tapToReveal')}
 </p>
 </div>
 ) : (
 /* Back: description + question */
 <div>
 <p className="text-xs uppercase tracking-wider text-blue-500 mb-3">
 {t('learn.review.answer')}
 </p>
 <h3 className="text-xl font-bold text-[var(--k-text-primary)] mb-3">
 {currentItem.conceptName}
 </h3>
 {currentItem.description && (
 <p className="text-[var(--k-text-secondary)] leading-relaxed mb-5">
 {currentItem.description}
 </p>
 )}
 {currentItem.questions.length > 0 && (
 <div className="mt-4 p-4 bg-[var(--k-glass-thin)] rounded-xl border border-[rgba(99,102,241,0.2)]">
 <p className="text-xs uppercase tracking-wider text-blue-400 mb-2">
 {t('learn.review.practiceQuestion')}
 </p>
 <p className="text-sm text-[var(--k-text-primary)] font-medium">
 {currentItem.questions[0].question}
 </p>
 </div>
 )}
 </div>
 )}
 </div>
 </div>

 {/* Rating buttons - only visible when flipped */}
 {flipped && (
 <div className="mt-5">
 <p className="text-center text-sm text-[var(--k-text-secondary)] mb-3">
 {t('learn.review.howWell')}
 </p>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 {([1, 2, 3, 4] as Rating[]).map((rating) => {
 const cfg = RATING_CONFIG[rating];
 const labels: Record<Rating, string> = {
 1: t('learn.review.ratingAgain'),
 2: t('learn.review.ratingHard'),
 3: t('learn.review.ratingGood'),
 4: t('learn.review.ratingEasy'),
 };
 const descriptions: Record<Rating, string> = {
 1: t('learn.review.ratingAgainDesc'),
 2: t('learn.review.ratingHardDesc'),
 3: t('learn.review.ratingGoodDesc'),
 4: t('learn.review.ratingEasyDesc'),
 };
 return (
 <button
 key={rating}
 onClick={() => handleRate(rating)}
 disabled={submitting}
 className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all disabled:opacity-50 ${cfg.bg} ${cfg.border} ${cfg.hoverBg}`}
 >
 <span className={`text-base font-bold ${cfg.color}`}>
 {labels[rating]}
 </span>
 <span className="text-[11px] text-[var(--k-text-secondary)] leading-tight text-center">
 {descriptions[rating]}
 </span>
 </button>
 );
 })}
 </div>
 </div>
 )}
 </div>

 {/* Keyboard shortcuts hint */}
 <div className="hidden sm:flex items-center justify-center gap-4 text-xs text-[var(--k-text-tertiary)] mt-4">
 <span>{t('learn.review.shortcutSpace')}</span>
 <span>{t('learn.review.shortcutNumbers')}</span>
 </div>
 </div>
 )}

 {/* Upcoming section */}
 {!sessionComplete && upcomingCount > 0 && totalDue === 0 && (
 <UpcomingSection count={upcomingCount} t={t} formatDate={formatDate} />
 )}
 </div>
 </div>
 );
}

// ── Sub-components ──────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
 return (
 <div className="bg-[var(--k-glass-regular)] backdrop-blur-xl rounded-xl p-4 border border-[var(--k-border-subtle)] shadow-[var(--k-shadow-md)] flex items-center gap-3">
 <div className="shrink-0">{icon}</div>
 <div>
 <p className="text-2xl font-bold text-[var(--k-text-primary)]">{value}</p>
 <p className="text-xs text-[var(--k-text-secondary)]">{label}</p>
 </div>
 </div>
 );
}

function SessionSummary({
 results,
 t,
 onRestart,
}: {
 results: Array<{ conceptName: string; rating: Rating }>;
 t: (key: string, params?: Record<string, string | number>) => string;
 onRestart: () => void;
}) {
 const ratingLabels: Record<Rating, string> = {
 1: t('learn.review.ratingAgain'),
 2: t('learn.review.ratingHard'),
 3: t('learn.review.ratingGood'),
 4: t('learn.review.ratingEasy'),
 };

 const goodCount = results.filter(r => r.rating >= 3).length;
 const total = results.length;
 const percentage = total > 0 ? Math.round((goodCount / total) * 100) : 0;

 return (
 <div className="max-w-2xl mx-auto text-center py-8">
 <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-5">
 <svg className="h-8 w-8 text-[var(--k-accent-indigo)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
 </svg>
 </div>
 <h2 className="text-2xl font-bold text-[var(--k-text-primary)] mb-2">
 {t('learn.review.sessionComplete')}
 </h2>
 <p className="text-[var(--k-text-secondary)] mb-6">
 {t('learn.review.sessionSummary', { total: String(total), good: String(goodCount), percent: String(percentage) })}
 </p>

 {/* Results list */}
 <div className="bg-[var(--k-glass-regular)] backdrop-blur-xl rounded-xl border border-[var(--k-border-subtle)] divide-y divide-[var(--k-border-subtle)] text-left mb-6">
 {results.map((result, i) => {
 const cfg = RATING_CONFIG[result.rating];
 return (
 <div key={i} className="flex items-center justify-between px-4 py-3">
 <span className="text-sm text-[var(--k-text-secondary)] font-medium">{result.conceptName}</span>
 <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
 {ratingLabels[result.rating]}
 </span>
 </div>
 );
 })}
 </div>

 <div className="flex items-center justify-center gap-3">
 <button
 onClick={onRestart}
 className="px-5 py-2.5 bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white font-medium rounded-lg hover:from-[#5558e6] hover:to-[#737de6] transition-colors text-sm"
 >
 {t('learn.review.reviewAgain')}
 </button>
 <Link
 href="/learn/mastery"
 className="px-5 py-2.5 bg-[var(--k-glass-thin)] text-[var(--k-text-secondary)] font-medium rounded-lg border border-[var(--k-border-default)] hover:bg-[var(--k-glass-regular)] transition-colors text-sm"
 >
 {t('learn.review.viewMastery')}
 </Link>
 </div>
 </div>
 );
}

function UpcomingSection({
 count,
 t,
}: {
 count: number;
 t: (key: string, params?: Record<string, string | number>) => string;
 formatDate: (date: Date | string) => string;
}) {
 return (
 <div className="mt-8 bg-[var(--k-accent-indigo-10)] border border-[rgba(99,102,241,0.2)] rounded-xl p-6">
 <div className="flex items-center gap-3 mb-2">
 <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 <h3 className="text-base font-semibold text-[var(--k-accent-indigo)]">
 {t('learn.review.upcomingTitle')}
 </h3>
 </div>
 <p className="text-sm text-[var(--k-accent-indigo)]">
 {t('learn.review.upcomingDescription', { count: String(count) })}
 </p>
 </div>
 );
}
