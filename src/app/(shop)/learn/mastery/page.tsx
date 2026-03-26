'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

interface ConceptMastery {
 currentLevel: number;
 confidence: number;
 reviewCount: number;
 nextReviewAt: string | null;
 lastTestedAt: string | null;
 totalAttempts: number;
 totalCorrect: number;
 strengthHistory: unknown;
}

interface ConceptItem {
 id: string;
 slug: string;
 name: string;
 description: string | null;
 domain: string;
 targetBloomLevel: number;
 difficulty: number;
 estimatedMinutes: number;
 mastery: ConceptMastery | null;
 status: 'untested' | 'weak' | 'in_progress' | 'mastered';
}

interface Stats {
 total: number;
 mastered: number;
 inProgress: number;
 weak: number;
 untested: number;
 dueForReview: number;
}

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string }> = {
 mastered: { color: 'text-emerald-400', bgColor: 'bg-[rgba(16,185,129,0.1)]', borderColor: 'border-[rgba(16,185,129,0.3)]' },
 in_progress: { color: 'text-yellow-400', bgColor: 'bg-[rgba(245,158,11,0.1)]', borderColor: 'border-[rgba(245,158,11,0.3)]' },
 weak: { color: 'text-red-400', bgColor: 'bg-[rgba(244,63,94,0.1)]', borderColor: 'border-[rgba(244,63,94,0.3)]' },
 untested: { color: 'text-[var(--k-text-tertiary)]', bgColor: 'bg-[var(--k-glass-thin)]', borderColor: 'border-[var(--k-border-subtle)]' },
};

const DOMAIN_LABELS: Record<string, string> = {
 iard: 'IARD',
 vie: 'Assurance vie',
 ethique: 'Ethique',
 conformite: 'Conformite',
 collectif: 'Collectif',
 ldpsf: 'LDPSF',
};

const LEVEL_LABELS = ['untested', 'beginner', 'intermediate', 'advanced', 'expert', 'master'];

export default function MasteryDashboardPage() {
 const { t, formatDate } = useI18n();
 const [concepts, setConcepts] = useState<ConceptItem[]>([]);
 const [reviewQueue, setReviewQueue] = useState<ConceptItem[]>([]);
 const [stats, setStats] = useState<Stats | null>(null);
 const [domains, setDomains] = useState<string[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedDomain, setSelectedDomain] = useState<string>('all');
 const [selectedConcept, setSelectedConcept] = useState<ConceptItem | null>(null);

 const fetchData = useCallback(async () => {
 try {
 const res = await fetch('/api/lms/mastery?view=dashboard');
 if (res.ok) {
 const data = await res.json();
 setConcepts(data.concepts ?? []);
 setReviewQueue(data.reviewQueue ?? []);
 setStats(data.stats ?? null);
 setDomains(data.domains ?? []);
 }
 } catch {
 // silent
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 fetchData();
 }, [fetchData]);

 const filteredConcepts = selectedDomain === 'all'
 ? concepts
 : concepts.filter(c => c.domain === selectedDomain);

 const groupedByDomain = filteredConcepts.reduce((acc, concept) => {
 const d = concept.domain;
 if (!acc[d]) acc[d] = [];
 acc[d].push(concept);
 return acc;
 }, {} as Record<string, ConceptItem[]>);

 if (loading) {
 return (
 <div className="min-h-screen bg-[var(--k-bg-base)] flex items-center justify-center">
 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--k-accent-indigo)]" />
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-[var(--k-bg-base)]">
 {/* Header */}
 <section className="bg-[var(--k-bg-surface)] border-b border-[var(--k-border-subtle)] text-white py-12">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
 <Link
 href="/learn"
 className="inline-flex items-center gap-2 text-[var(--k-text-tertiary)] hover:text-[var(--k-text-secondary)] mb-6"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 {t('learn.backToLearning')}
 </Link>
 <h1 className="text-3xl md:text-4xl font-bold mb-3">
 {t('learn.mastery.title')}
 </h1>
 <p className="text-lg text-[var(--k-text-secondary)] max-w-2xl">
 {t('learn.mastery.subtitle')}
 </p>
 </div>
 </section>

 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
 {/* Stats cards */}
 {stats && (
 <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
 <StatCard
 label={t('learn.mastery.statsTotal')}
 value={stats.total}
 color="text-[var(--k-text-primary)]"
 bgColor="bg-white"
 />
 <StatCard
 label={t('learn.mastery.statsMastered')}
 value={stats.mastered}
 color="text-green-700"
 bgColor="bg-green-50"
 />
 <StatCard
 label={t('learn.mastery.statsInProgress')}
 value={stats.inProgress}
 color="text-yellow-700"
 bgColor="bg-yellow-50"
 />
 <StatCard
 label={t('learn.mastery.statsWeak')}
 value={stats.weak}
 color="text-red-700"
 bgColor="bg-red-50"
 />
 <StatCard
 label={t('learn.mastery.statsUntested')}
 value={stats.untested}
 color="text-[var(--k-text-secondary)]"
 bgColor="bg-[var(--k-glass-ultra-thin)]"
 />
 </div>
 )}

 {/* Review Queue */}
 {reviewQueue.length > 0 && (
 <div className="bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] rounded-xl p-6 mb-8">
 <h2 className="text-lg font-bold text-orange-800 mb-1">
 {t('learn.mastery.reviewQueue')}
 </h2>
 <p className="text-sm text-orange-600 mb-4">
 {reviewQueue.length} {t('learn.mastery.dueForReview')}
 </p>
 <div className="flex flex-wrap gap-2">
 {reviewQueue.map(concept => (
 <button
 key={concept.id}
 onClick={() => setSelectedConcept(concept)}
 className="px-3 py-1.5 bg-white border border-orange-200 rounded-lg text-sm text-orange-800 hover:bg-orange-100 transition-colors"
 >
 {concept.name}
 </button>
 ))}
 </div>
 <button className="mt-4 px-5 py-2.5 bg-gradient-to-r from-[#f59e0b] to-[#f97316] text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors text-sm">
 {t('learn.mastery.startReview')}
 </button>
 </div>
 )}

 {/* Domain filter */}
 <div className="flex flex-wrap gap-2 mb-6">
 <button
 onClick={() => setSelectedDomain('all')}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
 selectedDomain === 'all'
 ? 'bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white'
 : 'bg-white text-[var(--k-text-secondary)] border border-[var(--k-border-default)] hover:bg-[var(--k-glass-thin)]'
 }`}
 >
 {t('learn.allArticles')} ({concepts.length})
 </button>
 {domains.map(domain => {
 const count = concepts.filter(c => c.domain === domain).length;
 return (
 <button
 key={domain}
 onClick={() => setSelectedDomain(domain)}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
 selectedDomain === domain
 ? 'bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white'
 : 'bg-white text-[var(--k-text-secondary)] border border-[var(--k-border-default)] hover:bg-[var(--k-glass-thin)]'
 }`}
 >
 {DOMAIN_LABELS[domain] ?? domain} ({count})
 </button>
 );
 })}
 </div>

 {/* Concept grid */}
 {Object.entries(groupedByDomain).map(([domain, domainConcepts]) => (
 <div key={domain} className="mb-8">
 <h2 className="text-lg font-bold text-[var(--k-text-primary)] mb-4">
 {DOMAIN_LABELS[domain] ?? domain}
 </h2>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
 {domainConcepts.map(concept => {
 const cfg = STATUS_CONFIG[concept.status];
 return (
 <button
 key={concept.id}
 onClick={() => setSelectedConcept(concept)}
 className={`p-3 rounded-xl border-2 text-start hover:shadow-[var(--k-shadow-lg)] transition-all ${cfg.bgColor} ${cfg.borderColor}`}
 >
 <p className={`text-sm font-medium ${cfg.color} truncate`}>
 {concept.name}
 </p>
 <p className={`text-xs mt-1 ${cfg.color} opacity-70`}>
 {t(`learn.mastery.${LEVEL_LABELS[concept.mastery?.currentLevel ?? 0]}`)}
 </p>
 {concept.mastery && (
 <div className="mt-2 w-full bg-white/50 rounded-full h-1.5">
 <div
 className={`h-1.5 rounded-full ${
 concept.status === 'mastered' ? 'bg-green-500' :
 concept.status === 'in_progress' ? 'bg-yellow-500' :
 concept.status === 'weak' ? 'bg-red-500' : 'bg-gray-300'
 }`}
 style={{ width: `${Math.min(100, concept.mastery.confidence * 100)}%` }}
 />
 </div>
 )}
 </button>
 );
 })}
 </div>
 </div>
 ))}

 {concepts.length === 0 && (
 <div className="text-center py-20 text-[var(--k-text-secondary)]">
 <p className="text-lg">{t('learn.mastery.noConcepts')}</p>
 </div>
 )}
 </div>

 {/* Concept detail modal */}
 {selectedConcept && (
 <ConceptDetailModal
 concept={selectedConcept}
 onClose={() => setSelectedConcept(null)}
 t={t}
 formatDate={formatDate}
 />
 )}
 </div>
 );
}

function StatCard({ label, value, color, bgColor }: {
 label: string; value: number; color: string; bgColor: string;
}) {
 return (
 <div className={`${bgColor} rounded-xl p-4 border border-gray-100 shadow-sm`}>
 <p className={`text-3xl font-bold ${color}`}>{value}</p>
 <p className="text-xs text-[var(--k-text-secondary)] mt-1">{label}</p>
 </div>
 );
}

function ConceptDetailModal({ concept, onClose, t, formatDate }: {
 concept: ConceptItem;
 onClose: () => void;
 t: (key: string) => string;
 formatDate: (date: Date | string) => string;
}) {
 const cfg = STATUS_CONFIG[concept.status];
 const levelLabel = LEVEL_LABELS[concept.mastery?.currentLevel ?? 0];

 return (
 <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
 <div
 className="bg-[var(--k-bg-raised)] rounded-2xl shadow-[var(--k-shadow-xl)] border border-[var(--k-border-subtle)] max-w-md w-full max-h-[80vh] overflow-y-auto"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="p-6">
 <div className="flex items-start justify-between mb-4">
 <div>
 <h2 className="text-xl font-bold text-[var(--k-text-primary)]">{concept.name}</h2>
 <p className="text-sm text-[var(--k-text-secondary)]">{DOMAIN_LABELS[concept.domain] ?? concept.domain}</p>
 </div>
 <button
 onClick={onClose}
 className="text-[var(--k-text-tertiary)] hover:text-[var(--k-text-secondary)] p-1"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {concept.description && (
 <p className="text-sm text-[var(--k-text-secondary)] mb-4">{concept.description}</p>
 )}

 {/* Status */}
 <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-4 ${cfg.bgColor} ${cfg.color}`}>
 {t(`learn.mastery.${levelLabel}`)}
 </div>

 {/* Mastery details */}
 {concept.mastery ? (
 <div className="space-y-3">
 <DetailRow
 label={t('learn.mastery.level')}
 value={`${concept.mastery.currentLevel} / ${concept.targetBloomLevel}`}
 />
 <DetailRow
 label={t('learn.mastery.confidence')}
 value={`${Math.round(concept.mastery.confidence * 100)}%`}
 />
 <DetailRow
 label={t('learn.mastery.reviewCount')}
 value={`${concept.mastery.reviewCount}`}
 />
 {concept.mastery.totalAttempts > 0 && (
 <DetailRow
 label={t('learn.mastery.accuracy')}
 value={`${Math.round((concept.mastery.totalCorrect / concept.mastery.totalAttempts) * 100)}%`}
 />
 )}
 {concept.mastery.lastTestedAt && (
 <DetailRow
 label={t('learn.mastery.lastTested')}
 value={formatDate(concept.mastery.lastTestedAt)}
 />
 )}
 {concept.mastery.nextReviewAt && (
 <DetailRow
 label={t('learn.mastery.nextReview')}
 value={formatDate(concept.mastery.nextReviewAt)}
 />
 )}
 </div>
 ) : (
 <p className="text-sm text-[var(--k-text-secondary)] italic">
 {t('learn.mastery.notTestedYet')}
 </p>
 )}

 {/* Meta */}
 <div className="mt-4 pt-4 border-t border-[var(--k-border-subtle)] flex justify-between text-xs text-[var(--k-text-tertiary)]">
 <span>{t('learn.mastery.estimatedTime')}: {concept.estimatedMinutes} min</span>
 <span>{t('learn.mastery.difficultyLabel')}: {Math.round(concept.difficulty * 100)}%</span>
 </div>
 </div>
 </div>
 </div>
 );
}

function DetailRow({ label, value }: { label: string; value: string }) {
 return (
 <div className="flex items-center justify-between text-sm">
 <span className="text-[var(--k-text-secondary)]">{label}</span>
 <span className="font-medium text-[var(--k-text-primary)]">{value}</span>
 </div>
 );
}
