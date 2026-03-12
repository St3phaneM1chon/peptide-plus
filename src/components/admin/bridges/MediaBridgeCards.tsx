'use client';

/**
 * Bridge cards for the Media admin module.
 *
 * - Bridge #41: Media -> Marketing (social posts + campaigns correlation)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Megaphone, Globe, Loader2 } from 'lucide-react';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  sentAt: string;
}

interface MediaMarketingBridge {
  enabled: boolean;
  posts?: SocialPost[];
  campaigns?: {
    email: Campaign[];
    sms: Campaign[];
  };
}

const platformColors: Record<string, string> = {
  twitter: 'bg-sky-100 text-sky-700',
  x: 'bg-slate-100 text-slate-700',
  facebook: 'bg-blue-100 text-blue-700',
  instagram: 'bg-pink-100 text-pink-700',
  linkedin: 'bg-indigo-100 text-indigo-700',
  tiktok: 'bg-fuchsia-100 text-fuchsia-700',
  youtube: 'bg-red-100 text-red-700',
};

// --------------------------------------------------------------------------
// Bridge #41: Media -> Marketing (Social Posts & Campaigns)
// --------------------------------------------------------------------------

export function MediaMarketingBridgeCard({
  t,
  locale,
}: {
  t: (key: string) => string;
  locale: string;
}) {
  const [data, setData] = useState<MediaMarketingBridge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/media/social-posts/marketing?limit=10')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data?.enabled ? json.data : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Megaphone className="w-4 h-4 text-pink-500" />
          {t('admin.bridges.mediaMarketing') || 'Social & Marketing'}
        </h3>
        <div className="flex items-center gap-2 animate-pulse py-2">
          <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
          <div className="h-3 bg-slate-200 rounded w-32" />
        </div>
      </div>
    );
  }

  if (!data?.enabled) return null;

  const hasPosts = data.posts && data.posts.length > 0;
  const hasCampaigns =
    (data.campaigns?.email && data.campaigns.email.length > 0) ||
    (data.campaigns?.sms && data.campaigns.sms.length > 0);

  if (!hasPosts && !hasCampaigns) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Megaphone className="w-4 h-4 text-pink-500" />
          {t('admin.bridges.mediaMarketing') || 'Social & Marketing'}
        </h3>
        <p className="text-sm text-slate-400 italic">
          {t('admin.bridges.noSocialPosts') || 'No recent social posts'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
        <Megaphone className="w-4 h-4 text-pink-500" />
        {t('admin.bridges.mediaMarketing') || 'Social & Marketing'}
      </h3>

      {/* Social posts */}
      {hasPosts && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
            Recent Social Posts
          </p>
          <div className="space-y-1.5">
            {data.posts!.slice(0, 5).map((post) => (
              <div
                key={post.id}
                className="flex items-center gap-2 text-xs p-2 rounded-md bg-pink-50/60"
              >
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    platformColors[post.platform.toLowerCase()] || 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {post.platform}
                </span>
                <span className="text-slate-700 truncate flex-1">{post.content}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    post.status === 'PUBLISHED'
                      ? 'bg-green-100 text-green-700'
                      : post.status === 'SCHEDULED'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {post.status}
                </span>
                {post.externalUrl && (
                  <a
                    href={post.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-indigo-600"
                  >
                    <Globe className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Marketing campaigns */}
      {hasCampaigns && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
            Recent Campaigns
          </p>
          <div className="space-y-1.5">
            {data.campaigns?.email.slice(0, 3).map((c) => (
              <Link
                key={c.id}
                href="/admin/newsletter"
                className="flex items-center justify-between text-xs p-2 rounded-md bg-indigo-50/60 hover:bg-indigo-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">
                    Email
                  </span>
                  <span className="text-slate-700 truncate">{c.name}</span>
                </div>
                <span className="text-slate-400">
                  {new Date(c.sentAt).toLocaleDateString(locale)}
                </span>
              </Link>
            ))}
            {data.campaigns?.sms.slice(0, 3).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between text-xs p-2 rounded-md bg-indigo-50/60"
              >
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">
                    SMS
                  </span>
                  <span className="text-slate-700 truncate">{c.name}</span>
                </div>
                <span className="text-slate-400">
                  {new Date(c.sentAt).toLocaleDateString(locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
