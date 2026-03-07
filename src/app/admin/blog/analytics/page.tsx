'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  FileText,
  Eye,
  Star,
  PenLine,
  Calendar,
  Tag,
  Users,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────

interface BlogOverview {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  featuredPosts: number;
  publishRate: number;
}

interface BlogActivity {
  postsThisWeek: number;
  postsThisMonth: number;
}

interface CategoryStat {
  category: string;
  count: number;
}

interface AuthorStat {
  author: string;
  postCount: number;
}

interface RecentPost {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  publishedAt: string | null;
  readTime: number | null;
  author: string | null;
}

interface BlogAnalytics {
  overview: BlogOverview;
  activity: BlogActivity;
  categories: CategoryStat[];
  authors: AuthorStat[];
  recentPosts: RecentPost[];
}

// ── Main Component ────────────────────────────────────────────

export default function BlogAnalyticsPage() {
  const { locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BlogAnalytics | null>(null);

  const formatDate = (date: string | null) => {
    if (!date) return '---';
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/blog/analytics');
      if (!res.ok) {
        toast.error('Failed to fetch blog analytics');
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Blog Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Overview of blog posts, categories, and publishing activity
          </p>
        </div>
        <Button
          variant="secondary"
          icon={RefreshCw}
          size="sm"
          onClick={fetchAnalytics}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48" role="status">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        </div>
      )}

      {/* Analytics */}
      {!loading && data && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Total Posts" value={data.overview.totalPosts} icon={FileText} />
            <StatCard label="Published" value={data.overview.publishedPosts} icon={Eye} />
            <StatCard label="Drafts" value={data.overview.draftPosts} icon={PenLine} />
            <StatCard label="Featured" value={data.overview.featuredPosts} icon={Star} />
            <StatCard label="Publish Rate" value={`${data.overview.publishRate}%`} icon={TrendingUp} />
          </div>

          {/* Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-semibold text-slate-900">Publishing Activity</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-teal-50 rounded-lg">
                  <p className="text-2xl font-bold text-teal-700">{data.activity.postsThisWeek}</p>
                  <p className="text-sm text-teal-600 mt-1">This Week</p>
                </div>
                <div className="text-center p-4 bg-indigo-50 rounded-lg">
                  <p className="text-2xl font-bold text-indigo-700">{data.activity.postsThisMonth}</p>
                  <p className="text-sm text-indigo-600 mt-1">This Month</p>
                </div>
              </div>
            </div>

            {/* Categories breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-semibold text-slate-900">Categories</h3>
              </div>
              {data.categories.length > 0 ? (
                <div className="space-y-2">
                  {data.categories.map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">{cat.category}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{
                              width: `${Math.round((cat.count / (data.overview.totalPosts || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-500 w-6 text-right">
                          {cat.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No categories found</p>
              )}
            </div>
          </div>

          {/* Authors */}
          {data.authors.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-semibold text-slate-900">Authors</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.authors.map((author) => (
                  <div key={author.author} className="text-center p-3 bg-emerald-50 rounded-lg">
                    <p className="text-lg font-bold text-emerald-700">{author.postCount}</p>
                    <p className="text-xs font-medium text-emerald-600 mt-0.5 truncate">{author.author}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Posts Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Recent Posts</h3>
              <p className="text-sm text-slate-500">Latest 10 posts by publish date</p>
            </div>
            {data.recentPosts.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Title</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Category</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Author</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Published</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Read Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 truncate max-w-[300px]">
                            {post.title}
                          </span>
                          {post.isFeatured && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {post.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600">{post.author || '---'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          post.isPublished
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {post.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600">{formatDate(post.publishedAt)}</td>
                      <td className="px-6 py-3 text-slate-600">
                        {post.readTime ? `${post.readTime} min` : '---'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 mb-1">No posts yet</h3>
                <p className="text-sm text-slate-500">Blog posts will appear here once created.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty state if fetch failed */}
      {!loading && !data && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Could not load analytics</h3>
          <p className="text-sm text-slate-500 mb-4">
            Click Refresh to try again.
          </p>
        </div>
      )}
    </div>
  );
}
