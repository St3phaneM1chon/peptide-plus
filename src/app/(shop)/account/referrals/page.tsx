'use client';

/**
 * REFERRAL PROGRAM PAGE - BioCycle Peptides
 * Customer-facing page for managing referral codes and tracking referral stats
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Copy,
  Check,
  Mail,
  Share2,
  Users,
  Trophy,
  Star,
  Gift,
  ArrowRight,
  Loader2,
  Sparkles,
  Clock,
  CheckCircle2,
  Award,
} from 'lucide-react';

// -- Types --

interface ReferralEntry {
  id: string;
  referredName: string;
  status: string;
  orderAmount: number | null;
  pointsAwarded: number;
  createdAt: string;
  qualifiedAt: string | null;
}

interface ReferralStats {
  referralCode: string | null;
  totalReferrals: number;
  qualifiedReferrals: number;
  pendingReferrals: number;
  totalPointsEarned: number;
  recentReferrals: ReferralEntry[];
}

// -- Social share SVG icons (not available in lucide-react) --

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// -- Status badge component --

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    PENDING: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      icon: <Clock className="w-3 h-3" />,
      label: 'Pending',
    },
    QUALIFIED: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: 'Qualified',
    },
    REWARDED: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: <Award className="w-3 h-3" />,
      label: 'Rewarded',
    },
    CANCELLED: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      icon: <Clock className="w-3 h-3" />,
      label: 'Cancelled',
    },
  };

  const cfg = config[status] || config.PENDING;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// -- Main Page Component --

export default function ReferralsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);

  const siteUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com';

  const referralLink = stats?.referralCode
    ? `${siteUrl}/shop?ref=${stats.referralCode}`
    : '';

  // Auth check
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/referrals');
    }
  }, [authStatus, router]);

  // Fetch referral stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/referrals');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching referral stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchStats();
    }
  }, [session, fetchStats]);

  // Generate referral code
  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/referrals/generate', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.referralCode) {
        toast.success('Referral code generated!', {
          description: `Your code is: ${data.referralCode}`,
        });
        // Refresh stats
        await fetchStats();
      } else {
        toast.error(data.error || 'Failed to generate code');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Copy referral code
  const handleCopyCode = async () => {
    if (!stats?.referralCode) return;
    try {
      await navigator.clipboard.writeText(stats.referralCode);
      setCopied(true);
      toast.success(t('customerRewards.codeCopied') !== 'customerRewards.codeCopied'
        ? t('customerRewards.codeCopied')
        : 'Code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  // Copy referral link
  const handleCopyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  // Share via email
  const handleShareEmail = () => {
    const subject = encodeURIComponent('Join BioCycle Peptides and save!');
    const body = encodeURIComponent(
      `Hey! I've been using BioCycle Peptides and thought you'd like it too.\n\nSign up with my referral link and get a discount on your first order ($25+ minimum):\n${referralLink}\n\nOr use my code at checkout: ${stats?.referralCode}\n\nWe both earn 1,000 loyalty points!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Check out BioCycle Peptides! Use my referral link to sign up and we both earn 1,000 loyalty points: ${referralLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Share via Twitter/X
  const handleShareTwitter = () => {
    const text = encodeURIComponent(
      `I'm loving @BioCyclePeptides! Sign up with my link and we both earn rewards:`
    );
    const url = encodeURIComponent(referralLink);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  // Loading state
  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#CC5500]" />
      </div>
    );
  }

  if (!session) return null;

  const hasCode = !!stats?.referralCode;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-2">
          <Link href="/" className="hover:text-[#CC5500]">
            {t('nav.home') !== 'nav.home' ? t('nav.home') : 'Home'}
          </Link>
          <span className="mx-2">/</span>
          <Link href="/account" className="hover:text-[#CC5500]">
            {t('account.dashboard') !== 'account.dashboard' ? t('account.dashboard') : 'My Account'}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">
            {t('customerRewards.referralProgram') !== 'customerRewards.referralProgram'
              ? t('customerRewards.referralProgram')
              : 'Referral Program'}
          </span>
        </nav>

        {/* Page Title */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[#CC5500]/10 rounded-xl flex items-center justify-center">
            <Gift className="w-5 h-5 text-[#CC5500]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('customerRewards.referralProgram') !== 'customerRewards.referralProgram'
                ? t('customerRewards.referralProgram')
                : 'Referral Program'}
            </h1>
            <p className="text-gray-600">
              Give $10, Get $10 &mdash; Share the love and earn rewards together!
            </p>
          </div>
        </div>

        {/* No referral code yet - Generate CTA */}
        {!hasCode && (
          <div className="bg-gradient-to-br from-[#CC5500] to-[#a34400] rounded-2xl p-8 md:p-12 text-white text-center mb-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full" />
              <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-white rounded-full" />
            </div>
            <div className="relative">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-white/90" />
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Start Earning With Referrals
              </h2>
              <p className="text-white/90 max-w-lg mx-auto mb-8 text-lg">
                Generate your unique referral code to start sharing with friends. When they sign up and make a purchase of $25 or more, you both earn 1,000 loyalty points!
              </p>
              <button
                onClick={handleGenerateCode}
                disabled={generating}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#CC5500] rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors disabled:opacity-50 shadow-lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate My Code
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Referral Code + Share Section */}
        {hasCode && stats && (
          <>
            {/* Big referral code display */}
            <div className="bg-gradient-to-br from-[#CC5500] to-[#a34400] rounded-2xl p-8 text-white mb-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full" />
                <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-white rounded-full" />
              </div>
              <div className="relative">
                <p className="text-white/80 text-sm font-medium uppercase tracking-wider mb-2">
                  Your Referral Code
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                  <div className="bg-white/15 backdrop-blur-sm border-2 border-white/30 rounded-xl px-8 py-4 flex items-center gap-4">
                    <span className="text-3xl md:text-4xl font-mono font-bold tracking-[0.15em] select-all">
                      {stats.referralCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      aria-label="Copy referral code"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-300" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Referral Link */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6">
                  <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-2">
                    Your Referral Link
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm break-all text-white/90 bg-white/10 rounded-lg px-3 py-2">
                      {referralLink}
                    </code>
                    <button
                      onClick={handleCopyLink}
                      className="shrink-0 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-4 h-4 text-green-300" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Share Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-white/70 text-sm font-medium flex items-center gap-1.5">
                    <Share2 className="w-4 h-4" />
                    Share via:
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </button>
                  <button
                    onClick={handleShareEmail}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                  <button
                    onClick={handleShareWhatsApp}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#25D366]/80 hover:bg-[#25D366] rounded-lg text-sm font-medium transition-colors"
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                    WhatsApp
                  </button>
                  <button
                    onClick={handleShareTwitter}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-black/30 hover:bg-black/50 rounded-lg text-sm font-medium transition-colors"
                  >
                    <TwitterIcon className="w-4 h-4" />
                    X / Twitter
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.totalReferrals}
                    </p>
                    <p className="text-sm text-gray-500">Total Referrals</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.qualifiedReferrals}
                    </p>
                    <p className="text-sm text-gray-500">Successful Referrals</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-[#CC5500]/10 rounded-lg flex items-center justify-center">
                    <Star className="w-5 h-5 text-[#CC5500]" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.totalPointsEarned.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">Points Earned</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Referrals List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8 shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">Your Referrals</h3>
                <p className="text-sm text-gray-500">
                  Track the status of your referred friends
                </p>
              </div>

              {stats.recentReferrals.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">
                    No referrals yet
                  </h4>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Share your referral code with friends to start earning loyalty points. They sign up, make a purchase, and you both win!
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Friend
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Order Amount
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Points Earned
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stats.recentReferrals.map((referral) => (
                        <tr key={referral.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#CC5500]/10 rounded-full flex items-center justify-center">
                                <span className="text-[#CC5500] font-semibold text-sm">
                                  {referral.referredName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-medium text-gray-900">
                                {referral.referredName}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={referral.status} />
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {referral.orderAmount
                              ? `$${referral.orderAmount.toFixed(2)}`
                              : '--'}
                          </td>
                          <td className="px-6 py-4">
                            {referral.pointsAwarded > 0 ? (
                              <span className="text-green-600 font-semibold">
                                +{referral.pointsAwarded.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-400">--</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-sm">
                            {new Date(referral.createdAt).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* How It Works */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              How It Works
            </h2>
            <p className="text-gray-500">
              Earn rewards in 3 simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center relative">
              <div className="w-16 h-16 bg-[#CC5500]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-8 h-8 text-[#CC5500]" />
              </div>
              <div className="absolute top-8 -right-4 hidden md:block text-gray-300">
                <ArrowRight className="w-8 h-8" />
              </div>
              <div className="bg-[#CC5500] text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-3">
                1
              </div>
              <h3 className="font-bold text-gray-900 mb-2">
                Share Your Code
              </h3>
              <p className="text-sm text-gray-500">
                Send your unique referral code or link to friends via email, text, WhatsApp, or social media
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center relative">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <div className="absolute top-8 -right-4 hidden md:block text-gray-300">
                <ArrowRight className="w-8 h-8" />
              </div>
              <div className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-3">
                2
              </div>
              <h3 className="font-bold text-gray-900 mb-2">
                They Sign Up &amp; Purchase
              </h3>
              <p className="text-sm text-gray-500">
                Your friend creates an account and makes their first purchase of $25 or more
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-green-600" />
              </div>
              <div className="bg-green-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-3">
                3
              </div>
              <h3 className="font-bold text-gray-900 mb-2">
                You Both Earn 1,000 Points!
              </h3>
              <p className="text-sm text-gray-500">
                Once their order qualifies, you each receive 1,000 loyalty points to use on future purchases
              </p>
            </div>
          </div>

          {/* Fine print */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Referral rewards are applied after the referred friend&apos;s first qualifying order ($25 minimum). Maximum 50 referrals per account. Points cannot be exchanged for cash.
            </p>
          </div>
        </div>

        {/* Back to Account */}
        <div className="mt-8 text-center">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-[#CC5500] hover:text-[#a34400] font-medium transition-colors"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to My Account
          </Link>
        </div>
      </div>
    </div>
  );
}
