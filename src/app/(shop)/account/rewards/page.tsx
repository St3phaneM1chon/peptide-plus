'use client';

/**
 * PAGE RÉCOMPENSES & FIDÉLITÉ - BioCycle Peptides
 * Programme de fidélité avec points et niveaux
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Types
interface LoyaltyLevel {
  name: string;
  minPoints: number;
  color: string;
  icon: string;
  benefits: string[];
  discount: number;
  pointsMultiplier: number;
}

interface PointTransaction {
  id: string;
  type: 'earned' | 'redeemed' | 'expired' | 'bonus';
  points: number;
  description: string;
  date: string;
  orderId?: string;
}

interface Reward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  type: 'discount' | 'product' | 'shipping' | 'exclusive';
  value?: number;
  available: boolean;
}

// Configuration des niveaux
const LOYALTY_LEVELS: LoyaltyLevel[] = [
  {
    name: 'Bronze',
    minPoints: 0,
    color: 'from-amber-600 to-amber-700',
    icon: '🥉',
    benefits: ['1 point par $ dépensé', 'Accès aux offres membres'],
    discount: 0,
    pointsMultiplier: 1,
  },
  {
    name: 'Silver',
    minPoints: 500,
    color: 'from-gray-400 to-gray-500',
    icon: '🥈',
    benefits: ['1.25 points par $ dépensé', '5% de réduction permanente', 'Accès prioritaire nouveautés'],
    discount: 5,
    pointsMultiplier: 1.25,
  },
  {
    name: 'Gold',
    minPoints: 1500,
    color: 'from-yellow-500 to-amber-500',
    icon: '🥇',
    benefits: ['1.5 points par $ dépensé', '10% de réduction permanente', 'Livraison gratuite', 'Support prioritaire'],
    discount: 10,
    pointsMultiplier: 1.5,
  },
  {
    name: 'Platinum',
    minPoints: 5000,
    color: 'from-slate-600 to-slate-800',
    icon: '💎',
    benefits: ['2 points par $ dépensé', '15% de réduction permanente', 'Livraison express gratuite', 'Accès VIP exclusif', 'Conseiller dédié'],
    discount: 15,
    pointsMultiplier: 2,
  },
];

// Récompenses disponibles
const AVAILABLE_REWARDS: Reward[] = [
  {
    id: 'discount-5',
    name: '5$ de réduction',
    description: 'Valable sur votre prochaine commande',
    pointsCost: 100,
    type: 'discount',
    value: 5,
    available: true,
  },
  {
    id: 'discount-15',
    name: '15$ de réduction',
    description: 'Valable sur votre prochaine commande',
    pointsCost: 250,
    type: 'discount',
    value: 15,
    available: true,
  },
  {
    id: 'discount-50',
    name: '50$ de réduction',
    description: 'Valable sur votre prochaine commande',
    pointsCost: 750,
    type: 'discount',
    value: 50,
    available: true,
  },
  {
    id: 'free-shipping',
    name: 'Livraison gratuite',
    description: 'Sur votre prochaine commande',
    pointsCost: 150,
    type: 'shipping',
    available: true,
  },
  {
    id: 'bac-water-free',
    name: 'Eau bactériostatique gratuite',
    description: '10ml offert',
    pointsCost: 200,
    type: 'product',
    available: true,
  },
  {
    id: 'vip-consultation',
    name: 'Consultation VIP',
    description: '30 min avec un expert peptides',
    pointsCost: 1000,
    type: 'exclusive',
    available: true,
  },
];

export default function RewardsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State - Mock data (would come from API in production)
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/rewards');
    }
  }, [status, router]);

  // Load data from real API
  useEffect(() => {
    if (session?.user) {
      fetch('/api/loyalty')
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            setPoints(data.points ?? 0);
            setLifetimePoints(data.lifetimePoints ?? 0);
            setReferralCode(data.referralCode ?? '');
            setReferralCount(data.referralCount ?? 0);
            // Mapper les transactions de la DB vers le format attendu
            if (data.transactions?.length) {
              setTransactions(data.transactions.map((t: { id: string; type: string; points: number; description: string; createdAt: string; orderId?: string }) => ({
                id: t.id,
                type: t.type.startsWith('EARN') ? 'earned' :
                      t.type === 'REDEEM_DISCOUNT' || t.type === 'REDEEM_PRODUCT' ? 'redeemed' :
                      t.type === 'EXPIRE' ? 'expired' : 'bonus',
                points: t.points,
                description: t.description || t.type,
                date: t.createdAt,
                orderId: t.orderId,
              })));
            }
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [session]);

  // Calculate current level
  const currentLevel = useMemo(() => {
    for (let i = LOYALTY_LEVELS.length - 1; i >= 0; i--) {
      if (lifetimePoints >= LOYALTY_LEVELS[i].minPoints) {
        return LOYALTY_LEVELS[i];
      }
    }
    return LOYALTY_LEVELS[0];
  }, [lifetimePoints]);

  // Calculate next level
  const nextLevel = useMemo(() => {
    const currentIndex = LOYALTY_LEVELS.findIndex(l => l.name === currentLevel.name);
    return currentIndex < LOYALTY_LEVELS.length - 1 ? LOYALTY_LEVELS[currentIndex + 1] : null;
  }, [currentLevel]);

  // Progress to next level
  const progressToNext = useMemo(() => {
    if (!nextLevel) return 100;
    const pointsInLevel = lifetimePoints - currentLevel.minPoints;
    const pointsNeeded = nextLevel.minPoints - currentLevel.minPoints;
    return Math.min((pointsInLevel / pointsNeeded) * 100, 100);
  }, [lifetimePoints, currentLevel, nextLevel]);

  // Redeem reward
  const redeemReward = (reward: Reward) => {
    if (points >= reward.pointsCost) {
      setPoints(p => p - reward.pointsCost);
      setTransactions(t => [{
        id: `txn_${Date.now()}`,
        type: 'redeemed',
        points: -reward.pointsCost,
        description: `Échange: ${reward.name}`,
        date: new Date().toISOString(),
      }, ...t]);
      alert(`🎉 Récompense "${reward.name}" échangée avec succès! Vérifiez votre email.`);
    }
  };

  // Copy referral code
  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    alert('Code copié!');
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-orange-600">Accueil</Link>
            <span className="mx-2">/</span>
            <Link href="/account" className="hover:text-orange-600">Mon compte</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Récompenses</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">⭐ Mes Récompenses</h1>
          <p className="text-gray-600 mt-1">Programme de fidélité BioCycle Peptides</p>
        </div>

        {/* Level Card */}
        <div className={`bg-gradient-to-r ${currentLevel.color} rounded-2xl p-6 md:p-8 text-white mb-8`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{currentLevel.icon}</span>
                <div>
                  <p className="text-white/80 text-sm">Votre niveau</p>
                  <h2 className="text-2xl font-bold">{currentLevel.name}</h2>
                </div>
              </div>
              <p className="text-white/90">
                Multiplicateur: <strong>×{currentLevel.pointsMultiplier}</strong> points
                {currentLevel.discount > 0 && (
                  <> • Réduction permanente: <strong>{currentLevel.discount}%</strong></>
                )}
              </p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-5xl font-bold">{points.toLocaleString()}</p>
              <p className="text-white/80">points disponibles</p>
            </div>
          </div>

          {/* Progress to next level */}
          {nextLevel && (
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span>{currentLevel.name}</span>
                <span>{nextLevel.name} ({nextLevel.minPoints - lifetimePoints} points restants)</span>
              </div>
              <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${progressToNext}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Available Rewards */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">🎁 Récompenses disponibles</h3>
                <p className="text-sm text-gray-500">Échangez vos points contre des avantages</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {AVAILABLE_REWARDS.map(reward => (
                    <div
                      key={reward.id}
                      className={`border rounded-xl p-4 transition-all ${
                        points >= reward.pointsCost
                          ? 'border-orange-200 bg-orange-50 hover:border-orange-400'
                          : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{reward.name}</h4>
                          <p className="text-sm text-gray-500">{reward.description}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          reward.type === 'discount' ? 'bg-green-100 text-green-700' :
                          reward.type === 'shipping' ? 'bg-blue-100 text-blue-700' :
                          reward.type === 'product' ? 'bg-purple-100 text-purple-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {reward.type === 'discount' && '💰'}
                          {reward.type === 'shipping' && '🚚'}
                          {reward.type === 'product' && '🧪'}
                          {reward.type === 'exclusive' && '⭐'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-orange-600 font-bold">{reward.pointsCost} points</span>
                        <button
                          onClick={() => redeemReward(reward)}
                          disabled={points < reward.pointsCost}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            points >= reward.pointsCost
                              ? 'bg-orange-500 hover:bg-orange-600 text-white'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Échanger
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">📜 Historique des points</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Aucune transaction pour le moment
                  </div>
                ) : (
                  transactions.map(txn => (
                    <div key={txn.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                          txn.type === 'earned' ? 'bg-green-100' :
                          txn.type === 'bonus' ? 'bg-purple-100' :
                          txn.type === 'redeemed' ? 'bg-orange-100' :
                          'bg-gray-100'
                        }`}>
                          {txn.type === 'earned' && '💰'}
                          {txn.type === 'bonus' && '🎁'}
                          {txn.type === 'redeemed' && '🎯'}
                          {txn.type === 'expired' && '⏰'}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{txn.description}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(txn.date).toLocaleDateString('fr-CA', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <span className={`font-bold ${txn.points > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {txn.points > 0 ? '+' : ''}{txn.points}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">📊 Statistiques</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Points disponibles</span>
                  <span className="font-bold text-gray-900">{points.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Points totaux gagnés</span>
                  <span className="font-bold text-gray-900">{lifetimePoints.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Niveau actuel</span>
                  <span className="font-bold text-gray-900">{currentLevel.icon} {currentLevel.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Réduction permanente</span>
                  <span className="font-bold text-green-600">{currentLevel.discount}%</span>
                </div>
              </div>
            </div>

            {/* Referral Program */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-6">
              <h3 className="font-bold text-purple-900 mb-2">👥 Programme de parrainage</h3>
              <p className="text-sm text-purple-700 mb-4">
                Gagnez 100 points pour chaque ami parrainé!
              </p>
              <div className="bg-white rounded-lg p-3 flex items-center justify-between mb-4">
                <code className="font-mono text-purple-700">{referralCode}</code>
                <button
                  onClick={copyReferralCode}
                  className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-sm transition-colors"
                >
                  Copier
                </button>
              </div>
              <p className="text-sm text-purple-600">
                {referralCount > 0 ? (
                  <>🎉 {referralCount} ami{referralCount > 1 ? 's' : ''} parrainé{referralCount > 1 ? 's' : ''} • {referralCount * 100} points gagnés</>
                ) : (
                  'Partagez votre code pour gagner des points!'
                )}
              </p>
            </div>

            {/* Level Benefits */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">🏆 Niveaux de fidélité</h3>
              <div className="space-y-4">
                {LOYALTY_LEVELS.map((level, idx) => (
                  <div
                    key={level.name}
                    className={`p-3 rounded-lg border ${
                      level.name === currentLevel.name
                        ? 'border-orange-300 bg-orange-50'
                        : lifetimePoints >= level.minPoints
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">
                        {level.icon} {level.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {level.minPoints}+ pts
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      ×{level.pointsMultiplier} points {level.discount > 0 && `• ${level.discount}% réduction`}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* How to earn */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">💡 Comment gagner des points</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span><strong>Achats:</strong> 1 point par $ dépensé (×{currentLevel.pointsMultiplier})</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span><strong>Parrainage:</strong> 100 points par ami</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span><strong>Avis produit:</strong> 25 points</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span><strong>Anniversaire:</strong> 50 points bonus</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span><strong>Newsletter:</strong> Offres exclusives</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
