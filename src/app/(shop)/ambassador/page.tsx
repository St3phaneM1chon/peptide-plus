'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from '@/hooks/useTranslations';

interface AmbassadorStats {
  referrals: number;
  earnings: number;
  clicks: number;
  conversionRate: number;
  tier: 'starter' | 'bronze' | 'silver' | 'gold' | 'platinum';
}

const ambassadorTiers = [
  {
    id: 'starter',
    name: 'Starter',
    icon: '🌱',
    commission: 10,
    minReferrals: 0,
    benefits: ['10% commission on all referrals', 'Unique referral link', 'Monthly payouts'],
  },
  {
    id: 'bronze',
    name: 'Bronze',
    icon: '🥉',
    commission: 12,
    minReferrals: 10,
    benefits: ['12% commission', 'Free product samples', 'Priority support', 'Marketing materials'],
  },
  {
    id: 'silver',
    name: 'Silver',
    icon: '🥈',
    commission: 15,
    minReferrals: 25,
    benefits: ['15% commission', 'Exclusive discount codes', 'Featured on our site', 'Early access to new products'],
  },
  {
    id: 'gold',
    name: 'Gold',
    icon: '🥇',
    commission: 18,
    minReferrals: 50,
    benefits: ['18% commission', 'Custom landing page', 'Co-branded materials', 'Quarterly bonus'],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    icon: '💎',
    commission: 20,
    minReferrals: 100,
    benefits: ['20% commission', 'VIP events access', 'Dedicated account manager', 'Revenue share opportunities'],
  },
];

// Testimonials will be loaded from API when available
const testimonials: { name: string; role: string; image: string; quote: string; earnings: string }[] = [];

export default function AmbassadorPage() {
  const { data: session } = useSession();
  const { t } = useTranslations();
  const [activeTab, setActiveTab] = useState<'overview' | 'dashboard' | 'apply'>('overview');
  const [isApplying, setIsApplying] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  
  // Ambassador data loaded from API when available
  const [isAmbassador] = useState(false);
  const [ambassadorStats] = useState<AmbassadorStats>({
    referrals: 0,
    earnings: 0,
    clicks: 0,
    conversionRate: 0,
    tier: 'starter',
  });

  const [applicationData, setApplicationData] = useState({
    website: '',
    socialMedia: '',
    followers: '',
    whyJoin: '',
    promotionPlan: '',
  });

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;
    setIsApplying(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: session.user.name || 'Ambassador Applicant',
          email: session.user.email,
          subject: 'Ambassador Program Application',
          message: [
            `Website: ${applicationData.website || 'N/A'}`,
            `Social Media: ${applicationData.socialMedia || 'N/A'}`,
            `Followers: ${applicationData.followers || 'N/A'}`,
            `Why Join: ${applicationData.whyJoin}`,
            `Promotion Plan: ${applicationData.promotionPlan}`,
          ].join('\n\n'),
        }),
      });
      if (res.ok) {
        setApplicationSubmitted(true);
      }
    } catch {
      // Silently handle error - form stays open for retry
    } finally {
      setIsApplying(false);
    }
  };

  const getCurrentTier = () => ambassadorTiers.find(t => t.id === ambassadorStats.tier) || ambassadorTiers[0];
  const getNextTier = () => {
    const currentIndex = ambassadorTiers.findIndex(t => t.id === ambassadorStats.tier);
    return ambassadorTiers[currentIndex + 1];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-500 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-6xl mb-4 block">🤝</span>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            {t('ambassador.title') || 'Become an Ambassador'}
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto mb-8">
            {t('ambassador.subtitle') || 'Join our ambassador program and earn up to 20% commission by sharing products you love with your audience.'}
          </p>

          {/* Key Benefits */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {[
              { icon: '💰', text: 'Up to 20% Commission' },
              { icon: '🎁', text: 'Free Products' },
              { icon: '📈', text: 'Passive Income' },
              { icon: '🌟', text: 'Exclusive Perks' },
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
                <span>{benefit.icon}</span>
                <span className="font-medium">{benefit.text}</span>
              </div>
            ))}
          </div>

          {!session ? (
            <Link
              href="/auth/signin?callbackUrl=/ambassador"
              className="inline-block px-8 py-4 bg-white text-orange-600 rounded-xl font-bold text-lg hover:bg-orange-50 transition-colors"
            >
              Sign In to Apply
            </Link>
          ) : isAmbassador ? (
            <button
              onClick={() => setActiveTab('dashboard')}
              className="inline-block px-8 py-4 bg-white text-orange-600 rounded-xl font-bold text-lg hover:bg-orange-50 transition-colors"
            >
              View Dashboard
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('apply')}
              className="inline-block px-8 py-4 bg-white text-orange-600 rounded-xl font-bold text-lg hover:bg-orange-50 transition-colors"
            >
              Apply Now
            </button>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs (for ambassadors) */}
        {isAmbassador && (
          <div className="flex gap-4 mb-8">
            {['overview', 'dashboard'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* How It Works */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-center mb-8">{t('ambassador.howItWorks') || 'How It Works'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { step: 1, icon: '📝', title: 'Apply', desc: 'Fill out our simple application form' },
                  { step: 2, icon: '✅', title: 'Get Approved', desc: 'We review applications within 48 hours' },
                  { step: 3, icon: '📤', title: 'Share', desc: 'Use your unique link to promote products' },
                  { step: 4, icon: '💵', title: 'Earn', desc: 'Get paid monthly for every sale' },
                ].map((item) => (
                  <div key={item.step} className="bg-white rounded-xl p-6 text-center shadow-sm border border-neutral-200">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">{item.icon}</span>
                    </div>
                    <div className="text-xs text-orange-500 font-bold mb-1">STEP {item.step}</div>
                    <h3 className="font-bold mb-1">{item.title}</h3>
                    <p className="text-sm text-neutral-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Commission Tiers */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-center mb-8">{t('ambassador.commissionTiers') || 'Commission Tiers'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {ambassadorTiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={`bg-white rounded-xl p-5 shadow-sm border-2 ${
                      tier.id === 'gold' ? 'border-yellow-400 shadow-yellow-100' : 'border-neutral-200'
                    }`}
                  >
                    <div className="text-center mb-4">
                      <span className="text-4xl">{tier.icon}</span>
                      <h3 className="font-bold mt-2">{tier.name}</h3>
                      <p className="text-3xl font-bold text-orange-500 mt-1">{tier.commission}%</p>
                      <p className="text-xs text-neutral-500">commission</p>
                    </div>
                    <p className="text-sm text-neutral-500 text-center mb-3">
                      {tier.minReferrals}+ referrals
                    </p>
                    <ul className="space-y-2">
                      {tier.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-neutral-600">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                    {tier.id === 'gold' && (
                      <div className="mt-3 text-center">
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                          Most Popular
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Testimonials - shown when available */}
            {testimonials.length > 0 && (
              <section className="mb-12">
                <h2 className="text-2xl font-bold text-center mb-8">{t('ambassador.successStories') || 'Success Stories'}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {testimonials.map((testimonial, i) => (
                    <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                          <span className="text-orange-600 font-bold text-lg">{testimonial.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-bold">{testimonial.name}</p>
                          <p className="text-sm text-neutral-500">{testimonial.role}</p>
                        </div>
                      </div>
                      <p className="text-neutral-600 italic mb-4">&quot;{testimonial.quote}&quot;</p>
                      <div className="flex items-center gap-2 text-green-600 font-bold">
                        <span>💰</span>
                        {testimonial.earnings}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* FAQ */}
            <section className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <h2 className="text-xl font-bold mb-6">{t('ambassador.faq') || 'Frequently Asked Questions'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { q: 'How do I get paid?', a: 'Payments are made monthly via PayPal or bank transfer for earnings over $50.' },
                  { q: 'Is there a minimum audience size?', a: 'No minimum required! We welcome ambassadors of all sizes who are passionate about peptide research.' },
                  { q: 'Can I promote on any platform?', a: 'Yes! Blog, YouTube, Instagram, TikTok, email lists - wherever your audience is.' },
                  { q: 'How long does the cookie last?', a: 'Our tracking cookie lasts 30 days, so you get credit for sales within that window.' },
                  { q: 'Do I need to be a customer first?', a: 'While not required, it helps! Authentic recommendations from users perform best.' },
                  { q: 'What marketing materials do you provide?', a: 'We provide banners, product images, email templates, and social media content.' },
                ].map((faq, i) => (
                  <div key={i}>
                    <h4 className="font-medium mb-1">{faq.q}</h4>
                    <p className="text-sm text-neutral-500">{faq.a}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && isAmbassador && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <p className="text-sm text-neutral-500 mb-1">Total Earnings</p>
                <p className="text-3xl font-bold text-green-600">${ambassadorStats.earnings.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <p className="text-sm text-neutral-500 mb-1">Total Referrals</p>
                <p className="text-3xl font-bold">{ambassadorStats.referrals}</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <p className="text-sm text-neutral-500 mb-1">Link Clicks</p>
                <p className="text-3xl font-bold">{ambassadorStats.clicks}</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <p className="text-sm text-neutral-500 mb-1">Conversion Rate</p>
                <p className="text-3xl font-bold">{ambassadorStats.conversionRate}%</p>
              </div>
            </div>

            {/* Current Tier */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{getCurrentTier().icon}</span>
                  <div>
                    <h3 className="font-bold text-lg">{getCurrentTier().name} Ambassador</h3>
                    <p className="text-orange-500 font-bold">{getCurrentTier().commission}% Commission</p>
                  </div>
                </div>
                {getNextTier() && (
                  <div className="text-right">
                    <p className="text-sm text-neutral-500">Next tier: {getNextTier().name}</p>
                    <p className="text-sm">{getNextTier().minReferrals - ambassadorStats.referrals} more referrals needed</p>
                  </div>
                )}
              </div>
              {getNextTier() && (
                <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full"
                    style={{ width: `${(ambassadorStats.referrals / getNextTier().minReferrals) * 100}%` }}
                  />
                </div>
              )}
            </div>

            {/* Referral Link */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
              <h3 className="font-bold mb-4">Your Referral Link</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${process.env.NEXT_PUBLIC_APP_URL || ''}/ref/${session?.user?.name?.replace(/\s+/g, '') || 'unknown'}`}
                  className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-300 rounded-lg"
                />
                <button className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600">
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Apply Tab */}
        {activeTab === 'apply' && !isAmbassador && (
          <div className="max-w-2xl mx-auto">
            {applicationSubmitted ? (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-neutral-200">
                <span className="text-6xl mb-4 block">🎉</span>
                <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
                <p className="text-neutral-600 mb-6">
                  Thank you for applying to our ambassador program! We will review your application and get back to you within 48 hours.
                </p>
                <button
                  onClick={() => setActiveTab('overview')}
                  className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
                >
                  Back to Overview
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-8 shadow-sm border border-neutral-200">
                <h2 className="text-2xl font-bold mb-6">Apply to Become an Ambassador</h2>
                
                <form onSubmit={handleApply} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Website or Blog URL</label>
                    <input
                      type="url"
                      value={applicationData.website}
                      onChange={(e) => setApplicationData(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="https://yourwebsite.com"
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Social Media Profiles</label>
                    <input
                      type="text"
                      value={applicationData.socialMedia}
                      onChange={(e) => setApplicationData(prev => ({ ...prev, socialMedia: e.target.value }))}
                      placeholder="@yourusername on Instagram, Twitter, etc."
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Estimated Total Followers/Audience</label>
                    <select
                      value={applicationData.followers}
                      onChange={(e) => setApplicationData(prev => ({ ...prev, followers: e.target.value }))}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    >
                      <option value="">Select...</option>
                      <option value="0-1000">0 - 1,000</option>
                      <option value="1000-5000">1,000 - 5,000</option>
                      <option value="5000-10000">5,000 - 10,000</option>
                      <option value="10000-50000">10,000 - 50,000</option>
                      <option value="50000+">50,000+</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Why do you want to join our program?</label>
                    <textarea
                      value={applicationData.whyJoin}
                      onChange={(e) => setApplicationData(prev => ({ ...prev, whyJoin: e.target.value }))}
                      placeholder="Tell us about yourself and why you'd be a great ambassador..."
                      rows={4}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">How do you plan to promote our products?</label>
                    <textarea
                      value={applicationData.promotionPlan}
                      onChange={(e) => setApplicationData(prev => ({ ...prev, promotionPlan: e.target.value }))}
                      placeholder="Blog posts, videos, social media, email newsletter, etc."
                      rows={3}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                      required
                    />
                  </div>

                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-sm text-orange-800">
                      <strong>Note:</strong> By applying, you agree to our Ambassador Terms and Conditions. We review all applications manually and will respond within 48 hours.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isApplying}
                    className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isApplying ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Submitting...
                      </>
                    ) : (
                      'Submit Application'
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
