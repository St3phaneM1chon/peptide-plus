'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { useLoyalty, LOYALTY_TIERS, LOYALTY_REWARDS, LOYALTY_CONFIG } from '@/contexts/LoyaltyContext';
import { useTranslations } from '@/hooks/useTranslations';

export default function RewardsPage() {
  const { data: session } = useSession();
  const { t } = useTranslations();
  const {
    points,
    lifetimePoints,
    tier,
    transactions,
    referralCode,
    referralCount,
    getTierProgress,
    canRedeemReward,
    redeemReward,
    isLoading,
  } = useLoyalty();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'rewards' | 'history' | 'referral'>('overview');
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const tierProgress = getTierProgress();
  const nextTier = LOYALTY_TIERS.find(t => t.minPoints > lifetimePoints);

  const handleRedeem = async (rewardId: string) => {
    setRedeemingId(rewardId);
    const success = redeemReward(rewardId);
    await new Promise(resolve => setTimeout(resolve, 800));
    setRedeemingId(null);
    if (success) {
      alert('Reward redeemed successfully! It will be applied to your next order.');
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(`https://peptideplus.ca/ref/${referralCode}`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: t('nav.home') || 'Home', href: '/' },
          { label: t('rewards.rewards') || 'Rewards' },
        ]}
      />

      {/* Hero Section */}
      <section className={`bg-gradient-to-br ${tier.color} text-white py-12`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{tier.icon}</span>
                <div>
                  <p className="text-white/80 text-sm">{t('rewards.yourStatus') || 'Your Status'}</p>
                  <h1 className="text-3xl font-bold">{tier.name} {t('rewards.member') || 'Member'}</h1>
                </div>
              </div>
              {!session && (
                <p className="text-white/80 mt-2">
                  <Link href="/auth/signin" className="underline hover:text-white">
                    {t('rewards.signInToSave') || 'Sign in to save your points'}
                  </Link>
                </p>
              )}
            </div>
            
            <div className="text-center md:text-right">
              <p className="text-white/80 text-sm">{t('rewards.availablePoints') || 'Available Points'}</p>
              <p className="text-5xl font-bold">{points.toLocaleString()}</p>
              <p className="text-white/80 text-sm mt-1">
                ≈ ${(points * LOYALTY_CONFIG.pointsValue).toFixed(2)} {t('rewards.inRewards') || 'in rewards'}
              </p>
            </div>
          </div>

          {/* Progress to next tier */}
          {nextTier && (
            <div className="mt-8 bg-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">{tier.name}</span>
                <span className="text-sm">{nextTier.name}</span>
              </div>
              <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${tierProgress.percentage}%` }}
                />
              </div>
              <p className="text-sm text-white/80 mt-2 text-center">
                {(nextTier.minPoints - lifetimePoints).toLocaleString()} {t('rewards.pointsToNext') || 'points to'} {nextTier.name}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          {[
            { id: 'overview', label: t('rewards.overview') || 'Overview', icon: '📊' },
            { id: 'rewards', label: t('rewards.redeem') || 'Redeem Rewards', icon: '🎁' },
            { id: 'history', label: t('rewards.history') || 'History', icon: '📋' },
            { id: 'referral', label: t('rewards.referral') || 'Refer Friends', icon: '👥' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* How to Earn */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <h2 className="text-xl font-bold mb-4">{t('rewards.howToEarn') || 'How to Earn Points'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: '🛒', title: t('rewards.earnShopping') || 'Shopping', desc: `${LOYALTY_CONFIG.pointsPerDollar} points per $1`, highlight: true },
                  { icon: '⭐', title: t('rewards.earnReview') || 'Write a Review', desc: `+${LOYALTY_CONFIG.reviewBonus} points` },
                  { icon: '👥', title: t('rewards.earnReferral') || 'Refer a Friend', desc: `+${LOYALTY_CONFIG.referralBonus} points` },
                  { icon: '🎂', title: t('rewards.earnBirthday') || 'Birthday Bonus', desc: `+${LOYALTY_CONFIG.birthdayBonus} points` },
                ].map((item, i) => (
                  <div 
                    key={i} 
                    className={`p-4 rounded-lg ${item.highlight ? 'bg-orange-50 border-2 border-orange-200' : 'bg-neutral-50'}`}
                  >
                    <span className="text-3xl">{item.icon}</span>
                    <h3 className="font-semibold mt-2">{item.title}</h3>
                    <p className="text-sm text-neutral-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier Benefits */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <h2 className="text-xl font-bold mb-4">{t('rewards.tierBenefits') || 'Membership Tiers'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {LOYALTY_TIERS.map((tierItem) => (
                  <div 
                    key={tierItem.id}
                    className={`p-4 rounded-lg border-2 ${tier.id === tierItem.id ? 'border-orange-500 bg-orange-50' : 'border-neutral-200'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{tierItem.icon}</span>
                      <span className="font-bold">{tierItem.name}</span>
                    </div>
                    <p className="text-sm text-neutral-500 mb-3">
                      {tierItem.minPoints.toLocaleString()}+ points
                    </p>
                    <ul className="space-y-1">
                      {tierItem.benefits.map((benefit, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {benefit}
                        </li>
                      ))}
                    </ul>
                    {tier.id === tierItem.id && (
                      <div className="mt-3 px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded-full text-center">
                        {t('rewards.currentTier') || 'Current Tier'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 text-center">
                <p className="text-3xl font-bold text-orange-500">{lifetimePoints.toLocaleString()}</p>
                <p className="text-neutral-500">{t('rewards.lifetimePoints') || 'Lifetime Points'}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 text-center">
                <p className="text-3xl font-bold text-orange-500">{tier.multiplier}x</p>
                <p className="text-neutral-500">{t('rewards.pointsMultiplier') || 'Points Multiplier'}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 text-center">
                <p className="text-3xl font-bold text-orange-500">{referralCount}</p>
                <p className="text-neutral-500">{t('rewards.friendsReferred') || 'Friends Referred'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Rewards Tab */}
        {activeTab === 'rewards' && (
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
            <h2 className="text-xl font-bold mb-4">{t('rewards.redeemRewards') || 'Redeem Your Points'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {LOYALTY_REWARDS.map((reward) => {
                const canRedeem = canRedeemReward(reward.id);
                return (
                  <div 
                    key={reward.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      canRedeem ? 'border-orange-200 hover:border-orange-400' : 'border-neutral-200 opacity-60'
                    }`}
                  >
                    <div className="text-center mb-3">
                      <span className="text-4xl">
                        {reward.type === 'discount' && '💵'}
                        {reward.type === 'shipping' && '📦'}
                        {reward.type === 'product' && '🎁'}
                        {reward.type === 'multiplier' && '✨'}
                      </span>
                    </div>
                    <h3 className="font-bold text-center">{reward.name}</h3>
                    <p className="text-orange-500 font-bold text-center text-lg mt-1">
                      {reward.points.toLocaleString()} pts
                    </p>
                    <button
                      onClick={() => handleRedeem(reward.id)}
                      disabled={!canRedeem || redeemingId === reward.id}
                      className={`w-full mt-3 py-2 rounded-lg font-medium transition-colors ${
                        canRedeem
                          ? 'bg-orange-500 text-white hover:bg-orange-600'
                          : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                      }`}
                    >
                      {redeemingId === reward.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          {t('rewards.redeeming') || 'Redeeming...'}
                        </span>
                      ) : canRedeem ? (
                        t('rewards.redeem') || 'Redeem'
                      ) : (
                        `${(reward.points - points).toLocaleString()} ${t('rewards.morePointsNeeded') || 'more pts needed'}`
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-xl font-bold">{t('rewards.pointsHistory') || 'Points History'}</h2>
            </div>
            {transactions.length === 0 ? (
              <div className="p-12 text-center">
                <span className="text-6xl mb-4 block">📊</span>
                <h3 className="text-lg font-bold mb-2">{t('rewards.noHistory') || 'No transactions yet'}</h3>
                <p className="text-neutral-500 mb-4">
                  {t('rewards.noHistoryDesc') || 'Start shopping to earn your first points!'}
                </p>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
                >
                  {t('rewards.startShopping') || 'Start Shopping'}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-neutral-200">
                {transactions.map((tx) => (
                  <div key={tx.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === 'earn' ? 'bg-green-100' :
                        tx.type === 'redeem' ? 'bg-orange-100' :
                        tx.type === 'bonus' ? 'bg-blue-100' : 'bg-red-100'
                      }`}>
                        {tx.type === 'earn' && '➕'}
                        {tx.type === 'redeem' && '🎁'}
                        {tx.type === 'bonus' && '🎉'}
                        {tx.type === 'expire' && '⏰'}
                      </div>
                      <div>
                        <p className="font-medium">{tx.description}</p>
                        <p className="text-sm text-neutral-500">
                          {new Date(tx.date).toLocaleDateString('en-CA', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <span className={`font-bold ${tx.points > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Referral Tab */}
        {activeTab === 'referral' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-8 text-white text-center">
              <span className="text-6xl mb-4 block">👥</span>
              <h2 className="text-2xl font-bold mb-2">{t('rewards.referTitle') || 'Give $10, Get $10'}</h2>
              <p className="text-white/80 mb-6 max-w-md mx-auto">
                {t('rewards.referDesc') || 'Share your referral link with friends. They get $10 off their first order, and you earn 1,000 bonus points!'}
              </p>
              
              {session ? (
                <div className="bg-white/10 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-white/80 mb-2">{t('rewards.yourReferralLink') || 'Your Referral Link'}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`https://peptideplus.ca/ref/${referralCode}`}
                      className="flex-1 px-3 py-2 bg-white/20 rounded-lg text-white text-sm"
                    />
                    <button
                      onClick={copyReferralCode}
                      className="px-4 py-2 bg-white text-orange-600 rounded-lg font-medium hover:bg-white/90"
                    >
                      {copiedCode ? `✓ ${t('common.copied') || 'Copied!'}` : t('common.copy') || 'Copy'}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <button className="p-2 bg-white/20 rounded-full hover:bg-white/30">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                      </svg>
                    </button>
                    <button className="p-2 bg-white/20 rounded-full hover:bg-white/30">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/>
                      </svg>
                    </button>
                    <button className="p-2 bg-white/20 rounded-full hover:bg-white/30">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                    </button>
                    <button className="p-2 bg-white/20 rounded-full hover:bg-white/30">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M0 3v18h24v-18h-24zm6.623 7.929l-4.623 5.712v-9.458l4.623 3.746zm-4.141-5.929h19.035l-9.517 7.713-9.518-7.713zm5.694 7.188l3.824 3.099 3.83-3.104 5.612 6.817h-18.779l5.513-6.812zm9.208-1.264l4.616-3.741v9.348l-4.616-5.607z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-orange-600 rounded-lg font-medium hover:bg-white/90"
                >
                  {t('rewards.signInToRefer') || 'Sign In to Get Your Link'}
                </Link>
              )}
            </div>

            {/* Referral Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 text-center">
                <p className="text-3xl font-bold text-orange-500">{referralCount}</p>
                <p className="text-neutral-500">{t('rewards.friendsReferred') || 'Friends Referred'}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 text-center">
                <p className="text-3xl font-bold text-orange-500">{(referralCount * LOYALTY_CONFIG.referralBonus).toLocaleString()}</p>
                <p className="text-neutral-500">{t('rewards.pointsEarned') || 'Points Earned'}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 text-center">
                <p className="text-3xl font-bold text-orange-500">${referralCount * 10}</p>
                <p className="text-neutral-500">{t('rewards.givenToFriends') || 'Given to Friends'}</p>
              </div>
            </div>

            {/* How it Works */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <h3 className="text-lg font-bold mb-4">{t('rewards.howItWorks') || 'How It Works'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { step: 1, icon: '📤', title: t('rewards.step1Title') || 'Share Your Link', desc: t('rewards.step1Desc') || 'Send your unique referral link to friends via email, text, or social media' },
                  { step: 2, icon: '🛒', title: t('rewards.step2Title') || 'Friend Makes Purchase', desc: t('rewards.step2Desc') || 'Your friend gets $10 off their first order when they use your link' },
                  { step: 3, icon: '🎉', title: t('rewards.step3Title') || 'You Earn Points', desc: t('rewards.step3Desc') || 'You receive 1,000 bonus points once their order is delivered' },
                ].map((item) => (
                  <div key={item.step} className="text-center">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">{item.icon}</span>
                    </div>
                    <div className="text-xs text-orange-500 font-medium mb-1">{t('common.step') || 'Step'} {item.step}</div>
                    <h4 className="font-bold mb-1">{item.title}</h4>
                    <p className="text-sm text-neutral-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
