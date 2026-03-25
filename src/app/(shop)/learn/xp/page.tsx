'use client';

import { useState, useEffect } from 'react';
import { Zap, Trophy, Target, TrendingUp } from 'lucide-react';

interface XpSummary {
  balance: number;
  totalEarned: number;
  level: number;
  xpToNextLevel: number;
  recentTransactions: Array<{ amount: number; reason: string; createdAt: string }>;
}

export default function XpPage() {
  const [xp, setXp] = useState<XpSummary | null>(null);
  // challenges state reserved for future use
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/lms/recommendations').then(r => r.json()).catch(() => ({ data: [] })),
    ]).finally(() => setLoading(false));
    // XP summary would come from a dedicated endpoint
    setXp({ balance: 0, totalEarned: 0, level: 1, xpToNextLevel: 500, recentTransactions: [] });
    setLoading(false);
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><Zap className="h-8 w-8 text-yellow-500" /> Points d&apos;experience</h1>
      <p className="text-muted-foreground mb-8">Gagnez des XP en completant des lecons, quiz et defis.</p>

      {xp && (
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border p-4 text-center">
            <Zap className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-3xl font-bold">{xp.balance}</p>
            <p className="text-xs text-muted-foreground">XP Total</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <Trophy className="h-6 w-6 text-purple-500 mx-auto mb-2" />
            <p className="text-3xl font-bold">Niv. {xp.level}</p>
            <p className="text-xs text-muted-foreground">{xp.xpToNextLevel} XP au prochain</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <Target className="h-6 w-6 text-blue-500 mx-auto mb-2" />
            <p className="text-3xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">Defis actifs</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <TrendingUp className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="text-3xl font-bold">{xp.totalEarned}</p>
            <p className="text-xs text-muted-foreground">XP cumules</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border p-6">
        <h2 className="font-semibold mb-4">Baremes XP</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            ['Lecon completee', '10 XP'],
            ['Quiz reussi', '25 XP'],
            ['Cours termine', '100 XP'],
            ['Serie 7 jours', '50 XP'],
            ['Connexion quotidienne', '5 XP'],
            ['Defi complete', 'Variable'],
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
