'use client';

import { useState, useEffect } from 'react';
import { Zap, Trophy, Target, TrendingUp } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

interface XpSummary {
  balance: number;
  totalEarned: number;
  level: number;
  xpToNextLevel: number;
  recentTransactions: Array<{ amount: number; reason: string; createdAt: string }>;
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
      .then(d => setXp(d.data ?? { balance: 0, totalEarned: 0, level: 1, xpToNextLevel: 500, recentTransactions: [] }))
      .catch(() => setXp({ balance: 0, totalEarned: 0, level: 1, xpToNextLevel: 500, recentTransactions: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t('lms.xp.loading')}</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><Zap className="h-8 w-8 text-yellow-500" /> {t('lms.xp.title')}</h1>
      <p className="text-muted-foreground mb-8">{t('lms.xp.subtitle')}</p>

      {xp && (
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border p-4 text-center">
            <Zap className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-3xl font-bold">{xp.balance}</p>
            <p className="text-xs text-muted-foreground">{t('lms.xp.totalXp')}</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <Trophy className="h-6 w-6 text-purple-500 mx-auto mb-2" />
            <p className="text-3xl font-bold">{t('lms.xp.levelPrefix')} {xp.level}</p>
            <p className="text-xs text-muted-foreground">{xp.xpToNextLevel} {t('lms.xp.xpToNext')}</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <Target className="h-6 w-6 text-blue-500 mx-auto mb-2" />
            <p className="text-3xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">{t('lms.xp.activeChallenges')}</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <TrendingUp className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="text-3xl font-bold">{xp.totalEarned}</p>
            <p className="text-xs text-muted-foreground">{t('lms.xp.cumulativeXp')}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border p-6">
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
            <div key={action} className="flex justify-between p-2 bg-muted/50 rounded">
              <span>{action}</span>
              <span className="font-medium text-yellow-600">{xp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
