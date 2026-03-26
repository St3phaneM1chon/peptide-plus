'use client';

import { useState, useEffect } from 'react';
import { Zap, Trophy, Target, TrendingUp } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

interface XpSummary {
 balance: number;
 totalEarned: number;
 level: number;
 xpToNextLevel: number;
 recentTransactions: Array<{ id: string; amount: number; reason: string; createdAt: string }>;
 activeChallenges: Array<{ id: string; title: string; xpReward: number; progress: number; criteria: { count?: number } }>;
}

export default function XpPage() {
 const { t } = useTranslations();
 const [xp, setXp] = useState<XpSummary | null>(null);
 // challenges state reserved for future use
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 // FIX P2-09: Fetch real XP data instead of mock
 fetch('/api/lms/xp')
 .then(r => r.json())
 .then(d => setXp(d.data ?? { balance: 0, totalEarned: 0, level: 1, xpToNextLevel: 500, recentTransactions: [], activeChallenges: [] }))
 .catch(() => setXp({ balance: 0, totalEarned: 0, level: 1, xpToNextLevel: 500, recentTransactions: [], activeChallenges: [] }))
 .finally(() => setLoading(false));
 }, []);

 if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--k-text-secondary)]">{t('lms.xp.loading')}</div>;

 return (
 <div className="max-w-4xl mx-auto px-4 py-12">
 <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><Zap className="h-8 w-8 text-yellow-500" /> {t('lms.xp.title')}</h1>
 <p className="text-[var(--k-text-secondary)] mb-8">{t('lms.xp.subtitle')}</p>

 {xp && (
 <div className="grid md:grid-cols-4 gap-4 mb-8">
 <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-regular)] backdrop-blur-xl p-4 text-center">
 <Zap className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
 <p className="text-3xl font-bold">{xp.balance}</p>
 <p className="text-xs text-[var(--k-text-secondary)]">{t('lms.xp.totalXp')}</p>
 </div>
 <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-regular)] backdrop-blur-xl p-4 text-center">
 <Trophy className="h-6 w-6 text-purple-500 mx-auto mb-2" />
 <p className="text-3xl font-bold">{t('lms.xp.levelPrefix')} {xp.level}</p>
 <p className="text-xs text-[var(--k-text-secondary)]">{xp.xpToNextLevel} {t('lms.xp.xpToNext')}</p>
 </div>
 <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-regular)] backdrop-blur-xl p-4 text-center">
 <Target className="h-6 w-6 text-blue-500 mx-auto mb-2" />
 <p className="text-3xl font-bold">{xp.activeChallenges?.length ?? 0}</p>
 <p className="text-xs text-[var(--k-text-secondary)]">{t('lms.xp.activeChallenges')}</p>
 </div>
 <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-regular)] backdrop-blur-xl p-4 text-center">
 <TrendingUp className="h-6 w-6 text-green-500 mx-auto mb-2" />
 <p className="text-3xl font-bold">{xp.totalEarned}</p>
 <p className="text-xs text-[var(--k-text-secondary)]">{t('lms.xp.cumulativeXp')}</p>
 </div>
 </div>
 )}

 {/* Active challenges */}
 {xp && xp.activeChallenges && xp.activeChallenges.length > 0 && (
 <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-regular)] backdrop-blur-xl p-6 mb-6">
 <h2 className="font-semibold mb-4 flex items-center gap-2"><Target className="h-5 w-5 text-blue-500" /> {t('lms.xp.activeChallenges')}</h2>
 <div className="space-y-3">
 {xp.activeChallenges.map(c => (
 <div key={c.id} className="flex items-center justify-between p-3 bg-[var(--k-glass-thin)] rounded-lg">
 <div>
 <p className="font-medium text-sm">{c.title}</p>
 <p className="text-xs text-[var(--k-text-secondary)]">{c.progress}/{c.criteria?.count ?? '?'}</p>
 </div>
 <span className="text-sm font-semibold text-yellow-600">+{c.xpReward} XP</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Recent XP transactions */}
 {xp && xp.recentTransactions && xp.recentTransactions.length > 0 && (
 <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-regular)] backdrop-blur-xl p-6 mb-6">
 <h2 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-green-500" /> Historique XP</h2>
 <div className="space-y-2">
 {xp.recentTransactions.slice(0, 10).map(tx => (
 <div key={tx.id} className="flex items-center justify-between py-2 border-b border-[var(--k-border-subtle)] last:border-0">
 <div>
 <p className="text-sm font-medium">{tx.reason.replace(/_/g, ' ')}</p>
 <p className="text-xs text-[var(--k-text-secondary)]">{new Date(tx.createdAt).toLocaleDateString('fr-CA')}</p>
 </div>
 <span className={`text-sm font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
 {tx.amount > 0 ? '+' : ''}{tx.amount} XP
 </span>
 </div>
 ))}
 </div>
 </div>
 )}

 <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-regular)] backdrop-blur-xl p-6">
 <h2 className="font-semibold mb-4">{t('lms.xp.scaleTitle')}</h2>
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
 {[
 [t('lms.xp.lessonCompleted'), '10 XP'],
 [t('lms.xp.quizPassed'), '25 XP'],
 [t('lms.xp.courseFinished'), '100 XP'],
 [t('lms.xp.sevenDayStreak'), '50 XP'],
 [t('lms.xp.dailyLogin'), '5 XP'],
 [t('lms.xp.challengeCompleted'), t('lms.xp.variable')],
 ].map(([action, xp]) => (
 <div key={action} className="flex justify-between p-2 bg-[var(--k-glass-thin)] rounded">
 <span>{action}</span>
 <span className="font-medium text-yellow-600">{xp}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
}
