'use client';

/**
 * PAGE RÉCOMPENSES & FIDÉLITÉ - BioCycle Peptides
 * Programme de fidélité avec points et niveaux
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';

// Types
interface LoyaltyLevel {
  name: string;
  minPoints: number;
  color: string;
  icon: string;
  benefitKeys: string[];
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
  nameKey: string;
  descKey: string;
  pointsCost: number;
  type: 'discount' | 'product' | 'shipping' | 'exclusive';
  value?: number;
  available: boolean;
}

import { LOYALTY_TIER_THRESHOLDS } from '@/lib/constants';

// Configuration des niveaux - derived from CANONICAL thresholds in constants.ts
// benefits keys resolved at render time via t()
const tierExtras: Record<string, { color: string; icon: string; benefitKeys: string[]; discount: number }> = {
  BRONZE:   { color: 'from-amber-600 to-amber-700', icon: '🥉', benefitKeys: ['customerRewards.benefit1PointPerDollar', 'customerRewards.benefitMemberOffers'], discount: 0 },
  SILVER:   { color: 'from-gray-400 to-gray-500', icon: '🥈', benefitKeys: ['customerRewards.benefit1_25PointsPerDollar', 'customerRewards.benefit5PercentDiscount', 'customerRewards.benefitPriorityAccess'], discount: 5 },
  GOLD:     { color: 'from-yellow-500 to-amber-500', icon: '🥇', benefitKeys: ['customerRewards.benefit1_5PointsPerDollar', 'customerRewards.benefit10PercentDiscount', 'customerRewards.benefitFreeShipping', 'customerRewards.benefitPrioritySupport'], discount: 10 },
  PLATINUM: { color: 'from-slate-600 to-slate-800', icon: '💎', benefitKeys: ['customerRewards.benefit2PointsPerDollar', 'customerRewards.benefit15PercentDiscount', 'customerRewards.benefitFreeExpressShipping', 'customerRewards.benefitVipAccess', 'customerRewards.benefitDedicatedAdvisor'], discount: 15 },
  DIAMOND:  { color: 'from-indigo-600 to-indigo-800', icon: '💠', benefitKeys: ['customerRewards.benefit3PointsPerDollar', 'customerRewards.benefit20PercentDiscount', 'customerRewards.benefitFreeExpressShipping', 'customerRewards.benefitVipAccess', 'customerRewards.benefitDedicatedAdvisor'], discount: 20 },
};

const LOYALTY_LEVELS_CONFIG: LoyaltyLevel[] = LOYALTY_TIER_THRESHOLDS.map(tier => {
  const extra = tierExtras[tier.id] || tierExtras.BRONZE;
  return {
    name: tier.name,
    minPoints: tier.minPoints,
    color: extra.color,
    icon: extra.icon,
    benefitKeys: extra.benefitKeys,
    discount: extra.discount,
    pointsMultiplier: tier.multiplier,
  };
});

// Récompenses disponibles - names/descriptions resolved via t() at render time
const AVAILABLE_REWARDS_CONFIG = [
  { id: 'discount-5', nameKey: 'customerRewards.reward5Discount', descKey: 'customerRewards.rewardNextOrderDesc', pointsCost: 100, type: 'discount' as const, value: 5, available: true },
  { id: 'discount-15', nameKey: 'customerRewards.reward15Discount', descKey: 'customerRewards.rewardNextOrderDesc', pointsCost: 250, type: 'discount' as const, value: 15, available: true },
  { id: 'discount-50', nameKey: 'customerRewards.reward50Discount', descKey: 'customerRewards.rewardNextOrderDesc', pointsCost: 750, type: 'discount' as const, value: 50, available: true },
  { id: 'free-shipping', nameKey: 'customerRewards.rewardFreeShipping', descKey: 'customerRewards.rewardNextOrderShortDesc', pointsCost: 150, type: 'shipping' as const, available: true },
  { id: 'bac-water-free', nameKey: 'customerRewards.rewardFreeBacWater', descKey: 'customerRewards.rewardBacWaterDesc', pointsCost: 200, type: 'product' as const, available: true },
  { id: 'vip-consultation', nameKey: 'customerRewards.rewardVipConsultation', descKey: 'customerRewards.rewardVipConsultationDesc', pointsCost: 1000, type: 'exclusive' as const, available: true },
];

export default function RewardsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useI18n();

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
    for (let i = LOYALTY_LEVELS_CONFIG.length - 1; i >= 0; i--) {
      if (lifetimePoints >= LOYALTY_LEVELS_CONFIG[i].minPoints) {
        return LOYALTY_LEVELS_CONFIG[i];
      }
    }
    return LOYALTY_LEVELS_CONFIG[0];
  }, [lifetimePoints]);

  // Calculate next level
  const nextLevel = useMemo(() => {
    const currentIndex = LOYALTY_LEVELS_CONFIG.findIndex(l => l.name === currentLevel.name);
    return currentIndex < LOYALTY_LEVELS_CONFIG.length - 1 ? LOYALTY_LEVELS_CONFIG[currentIndex + 1] : null;
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
      setTransactions(prev => [{
        id: `txn_${Date.now()}`,
        type: 'redeemed',
        points: -reward.pointsCost,
        description: `${t('customerRewards.exchangeLabel')}: ${t(reward.nameKey)}`,
        date: new Date().toISOString(),
      }, ...prev]);
      alert(t('customerRewards.rewardRedeemedSuccess'));
    }
  };

  // Copy referral code
  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    alert(t('customerRewards.codeCopied'));
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
            <Link href="/" className="hover:text-orange-600">{t('nav.home')}</Link>
            <span className="mx-2">/</span>
            <Link href="/account" className="hover:text-orange-600">{t('account.dashboard')}</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{t('customerRewards.title')}</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">{t('customerRewards.title')}</h1>
          <p className="text-gray-600 mt-1">{t('customerRewards.subtitle')}</p>
        </div>

        {/* Level Card */}
        <div className={`bg-gradient-to-r ${currentLevel.color} rounded-2xl p-6 md:p-8 text-white mb-8`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{currentLevel.icon}</span>
                <div>
                  <p className="text-white/80 text-sm">{t('customerRewards.yourLevel')}</p>
                  <h2 className="text-2xl font-bold">{currentLevel.name}</h2>
                </div>
              </div>
              <p className="text-white/90">
                {t('customerRewards.pointsMultiplier')}: <strong>×{currentLevel.pointsMultiplier}</strong> points
                {currentLevel.discount > 0 && (
                  <> • {t('customerRewards.permanentDiscount')}: <strong>{currentLevel.discount}%</strong></>
                )}
              </p>
            </div>
            <div className="text-center md:text-end">
              <p className="text-5xl font-bold">{points.toLocaleString()}</p>
              <p className="text-white/80">{t('customerRewards.availablePoints')}</p>
            </div>
          </div>

          {/* Progress to next level */}
          {nextLevel && (
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span>{currentLevel.name}</span>
                <span>{nextLevel.name} ({nextLevel.minPoints - lifetimePoints} {t('customerRewards.pointsRemaining')})</span>
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
                <h3 className="text-lg font-bold text-gray-900">{t('customerRewards.availableRewards')}</h3>
                <p className="text-sm text-gray-500">{t('customerRewards.exchangePoints')}</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {AVAILABLE_REWARDS_CONFIG.map(reward => (
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
                          <h4 className="font-semibold text-gray-900">{t(reward.nameKey)}</h4>
                          <p className="text-sm text-gray-500">{t(reward.descKey)}</p>
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
                          {t('customerRewards.exchange')}
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
                <h3 className="text-lg font-bold text-gray-900">{t('customerRewards.pointsHistory')}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    {t('customerRewards.noTransactions')}
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
                            {new Date(txn.date).toLocaleDateString(undefined, {
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
              <h3 className="font-bold text-gray-900 mb-4">{t('customerRewards.statistics')}</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('customerRewards.availablePoints')}</span>
                  <span className="font-bold text-gray-900">{points.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('customerRewards.totalPointsEarned')}</span>
                  <span className="font-bold text-gray-900">{lifetimePoints.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('customerRewards.currentLevel')}</span>
                  <span className="font-bold text-gray-900">{currentLevel.icon} {currentLevel.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('customerRewards.permanentDiscount')}</span>
                  <span className="font-bold text-green-600">{currentLevel.discount}%</span>
                </div>
              </div>
            </div>

            {/* Referral Program */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-6">
              <h3 className="font-bold text-purple-900 mb-2">{t('customerRewards.referralProgram')}</h3>
              <p className="text-sm text-purple-700 mb-4">
                {t('customerRewards.earnPerFriend')}
              </p>
              <div className="bg-white rounded-lg p-3 flex items-center justify-between mb-4">
                <code className="font-mono text-purple-700">{referralCode}</code>
                <button
                  onClick={copyReferralCode}
                  className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-sm transition-colors"
                >
                  {t('customerRewards.copyCode')}
                </button>
              </div>
              <p className="text-sm text-purple-600 mb-4">
                {referralCount > 0 ? (
                  <>{referralCount} {t('customerRewards.friendsReferred')} • {referralCount * 100} {t('customerRewards.pointsEarned')}</>
                ) : (
                  t('customerRewards.shareCode')
                )}
              </p>
              <Link
                href="/account/referrals"
                className="block w-full text-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {t('customerRewards.referral') || 'Referral Program'} →
              </Link>
            </div>

            {/* Level Benefits */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">{t('customerRewards.loyaltyLevels')}</h3>
              <div className="space-y-4">
                {LOYALTY_LEVELS_CONFIG.map((level, _idx) => (
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
                      ×{level.pointsMultiplier} points {level.discount > 0 && `• ${level.discount}% ${t('customerRewards.discountLabel')}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* How to earn */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">{t('customerRewards.howToEarnPoints')}</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span><strong>{t('customerRewards.purchases')}:</strong> 1 {t('customerRewards.pointsPerDollar')} (×{currentLevel.pointsMultiplier})</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span><strong>{t('customerRewards.referral')}:</strong> 100 {t('customerRewards.pointsPerFriend')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span><strong>{t('customerRewards.productReview')}:</strong> 25 points</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span><strong>{t('customerRewards.birthday')}:</strong> 50 {t('customerRewards.bonusPoints')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span><strong>{t('customerRewards.newsletter')}:</strong> {t('customerRewards.exclusiveOffers')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
