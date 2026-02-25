// TODO: F-052 - Add explicit ReviewStatus enum to Prisma schema instead of deriving from booleans
// TODO: F-055 - Calculate popular tags dynamically from posts instead of hardcoded fallback
// TODO: F-072 - Add skeleton loading state for when backend data loading is implemented
// F086 FIX: Dynamic SEO meta (Open Graph, Twitter Card) added to community/layout.tsx
// IMP-001: Forum backend NOT YET IMPLEMENTED - requires new Prisma models (ForumPost, ForumReply, ForumTag)
// IMP-045: Character counters added to post title and content fields
// A-041: URL-based pagination params for bookmarkable/shareable community URLs
// A-062: Auto-save draft post to localStorage for persistence across page navigations
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useI18n } from '@/i18n/client';
import { useSearchParams } from 'next/navigation';
import { sanitizeText } from '@/lib/sanitize';

interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userBadge?: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  likes: number;
  replies: number;
  views: number;
  isPinned: boolean;
  createdAt: string;
  lastReply?: string;
}

/* Reply interface for future use when implementing reply functionality
interface Reply {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userBadge?: string;
  content: string;
  likes: number;
  isOfficial: boolean;
  createdAt: string;
}
*/

const getCategories = (t: (key: string) => string) => [
  { id: 'all', name: t('community.allDiscussions') || 'All Discussions', icon: '💬', color: 'bg-neutral-100 text-neutral-700' },
  { id: 'general', name: t('community.general') || 'General', icon: '🗣️', color: 'bg-blue-100 text-blue-700' },
  { id: 'research', name: t('community.research') || 'Research', icon: '🔬', color: 'bg-purple-100 text-purple-700' },
  { id: 'howto', name: t('community.howto') || 'How-To', icon: '📖', color: 'bg-green-100 text-green-700' },
  { id: 'results', name: t('community.results') || 'Results & Experiences', icon: '📊', color: 'bg-orange-100 text-orange-700' },
  { id: 'support', name: t('community.support') || 'Support', icon: '🆘', color: 'bg-red-100 text-red-700' },
];

// Community posts loaded from API (empty by default until community system is implemented)

export default function CommunityPage() {
  const { data: session } = useSession();
  const { t, locale } = useI18n();
  const categories = getCategories(t);
  // A-041: Read initial state from URL search params for bookmarkable/shareable URLs
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState(() => {
    const cat = searchParams.get('category');
    return cat && ['all', 'general', 'research', 'howto', 'results', 'support'].includes(cat) ? cat : 'all';
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // F-064 FIX: Persist sort preference in localStorage
  // A-041: Also read from URL params (URL takes priority over localStorage)
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'replies'>(() => {
    const urlSort = searchParams.get('sort');
    if (urlSort === 'recent' || urlSort === 'popular' || urlSort === 'replies') return urlSort;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('community-sort');
      if (saved === 'recent' || saved === 'popular' || saved === 'replies') return saved;
    }
    return 'recent';
  });
  const [showNewPost, setShowNewPost] = useState(false);
  // A-041: Read initial search from URL params
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  // FIX F-032: Debounce search query to avoid excessive re-renders with future API calls
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchQuery]);

  // F-064 FIX: Save sort preference to localStorage
  useEffect(() => {
    localStorage.setItem('community-sort', sortBy);
  }, [sortBy]);

  // A-041: Sync URL search params when filters change (bookmarkable/shareable)
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory !== 'all') params.set('category', activeCategory);
    if (sortBy !== 'recent') params.set('sort', sortBy);
    if (debouncedSearch) params.set('q', debouncedSearch);
    const paramStr = params.toString();
    const newUrl = paramStr ? `?${paramStr}` : window.location.pathname;
    // Use replaceState to avoid polluting browser history on every keystroke
    window.history.replaceState({}, '', newUrl);
  }, [activeCategory, sortBy, debouncedSearch]);

  // A-062: Auto-save draft post to localStorage for persistence across page navigations
  const DRAFT_KEY = 'community-draft-post';
  type PostDraft = { title: string; content: string; category: string; tags: string };
  const defaultDraft: PostDraft = { title: '', content: '', category: 'general', tags: '' };
  // New post form -- A-062: Restore draft from localStorage on mount
  const [newPost, setNewPost] = useState<PostDraft>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.title === 'string') return parsed as PostDraft;
        }
      } catch { /* ignore parse errors */ }
    }
    return defaultDraft;
  });

  const filteredPosts = posts
    .filter(p => activeCategory === 'all' || p.category === activeCategory)
    .filter(p => {
      if (!debouncedSearch) return true;
      const search = debouncedSearch.toLowerCase();
      return p.title.toLowerCase().includes(search) ||
        p.content.toLowerCase().includes(search) ||
        p.tags.some(tag => tag.toLowerCase().includes(search));
    })
    .sort((a, b) => {
      // Pinned posts first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      switch (sortBy) {
        case 'popular': return b.likes - a.likes;
        case 'replies': return b.replies - a.replies;
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  // A-062: Auto-save draft to localStorage whenever form fields change
  useEffect(() => {
    if (newPost.title || newPost.content || newPost.tags) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(newPost));
    }
  }, [newPost]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    // A-062: Clear draft on successful submission
    localStorage.removeItem(DRAFT_KEY);

    // F-024 FIX: Sanitize HTML in user-generated content using centralized sanitizeText
    const post: Post = {
      id: crypto.randomUUID(),
      userId: session.user?.id || 'anonymous',  // FIX F-023: Never expose email as public identifier
      userName: session.user?.name || 'Anonymous',
      title: sanitizeText(newPost.title),
      content: sanitizeText(newPost.content),
      category: newPost.category,
      tags: newPost.tags.split(',').map((tag: string) => sanitizeText(tag.trim().toLowerCase())).filter(Boolean),
      likes: 0,
      replies: 0,
      views: 0,
      isPinned: false,
      createdAt: new Date().toISOString(),
    };

    setPosts(prev => [post, ...prev]);
    setShowNewPost(false);
    setNewPost({ title: '', content: '', category: 'general', tags: '' });
  };

  // F-080 FIX: Close new post modal on Escape key
  useEffect(() => {
    if (!showNewPost) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowNewPost(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showNewPost]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return t('community.timeJustNow') || 'Just now';
    if (diffHours < 24) return (t('community.timeHoursAgo') || '{count}h ago').replace('{count}', String(diffHours));
    if (diffHours < 48) return t('community.timeYesterday') || 'Yesterday';
    if (diffDays < 30) return (t('community.timeDaysAgo') || '{count}d ago').replace('{count}', String(diffDays));
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  };

  const getCategoryInfo = (categoryId: string) => {
    return categories.find(c => c.id === categoryId) || categories[0];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo Notice Banner - F-001 fix: No backend persistence yet */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p>
              <strong>{t('community.demoBannerTitle') || 'Demo Mode'}:</strong>{' '}
              {t('community.demoBannerDesc') || 'This community forum is currently in preview mode. Posts are not saved and will be lost when you leave the page. Full persistence is coming soon!'}
            </p>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-600 to-purple-700 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">👥</span>
            <h1 className="text-3xl md:text-4xl font-bold">
              {t('community.title') || 'Community Forum'}
            </h1>
          </div>
          <p className="text-xl text-purple-100 max-w-2xl">
            {t('community.subtitle') || 'Connect with fellow researchers, share experiences, ask questions, and learn from the community.'}
          </p>

          {/* Stats */}
          {/* F081 FIX: Show "Coming soon" placeholder when no backend data, or computed local values otherwise */}
          {/* F091 FIX: Add research-only disclaimer for peptide-related discussions */}
          <div className="flex flex-wrap gap-6 mt-8">
            <div className="bg-white/10 px-6 py-3 rounded-lg">
              <p className="text-2xl font-bold">{posts.length > 0 ? posts.length : '--'}</p>
              <p className="text-sm text-purple-200">{t('community.statsDiscussions') || 'Discussions'}</p>
            </div>
            <div className="bg-white/10 px-6 py-3 rounded-lg">
              <p className="text-2xl font-bold">{posts.length > 0 ? posts.reduce((sum, p) => sum + p.replies, 0) : '--'}</p>
              <p className="text-sm text-purple-200">{t('community.statsReplies') || 'Replies'}</p>
            </div>
            <div className="bg-white/10 px-6 py-3 rounded-lg">
              {/* F-058 FIX: Show unique author count instead of placeholder "-" */}
              <p className="text-2xl font-bold">{posts.length > 0 ? new Set(posts.map(p => p.userName)).size : '--'}</p>
              <p className="text-sm text-purple-200">{t('community.statsMembers') || 'Members'}</p>
            </div>
          </div>
          {/* F091 FIX: Research disclaimer for peptide content */}
          <p className="text-xs text-purple-300 mt-4">
            {t('community.researchDisclaimer') || 'This community is for research discussion purposes only. Content shared here does not constitute medical advice. All peptides discussed are for research use only.'}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* New Post Button */}
            {session ? (
              <button
                onClick={() => setShowNewPost(true)}
                className="w-full mb-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('community.newPost') || 'New Discussion'}
              </button>
            ) : (
              <Link
                href="/auth/signin"
                className="block w-full mb-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors text-center"
              >
                {t('community.signInToPost') || 'Sign In to Post'}
              </Link>
            )}

            {/* Categories */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4 mb-6">
              <h3 className="font-bold mb-3">{t('community.categories') || 'Categories'}</h3>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                      activeCategory === cat.id
                        ? 'bg-purple-100 text-purple-700'
                        : 'hover:bg-neutral-100'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span className="text-sm">{cat.name}</span>
                    </span>
                    <span className="text-xs text-neutral-500">
                      {posts.filter(p => cat.id === 'all' || p.category === cat.id).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Popular Tags */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4">
              <h3 className="font-bold mb-3">{t('community.popularTags') || 'Popular Tags'}</h3>
              <div className="flex flex-wrap gap-2">
                {/* F-039 FIX: Dynamic tags from posts, fallback to defaults */}
                {(posts.length > 0
                  ? [...posts.flatMap(p => p.tags).reduce((acc, tag) => acc.set(tag, (acc.get(tag) || 0) + 1), new Map<string, number>()).entries()]
                      .sort((a, b) => b[1] - a[1]).slice(0, 7).map(([tag]) => tag)
                  : ['bpc-157', 'semaglutide', 'reconstitution', 'storage', 'beginner', 'tb-500', 'research']
                ).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSearchQuery(tag)}
                    className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-full text-sm transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Search & Sort */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <svg className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('community.searchPlaceholder') || 'Search discussions...'}
                  className="w-full ps-12 pe-10 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {/* FIX: F-095 - Add clear button when search has text */}
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label={t('common.clear') || 'Clear search'}
                    className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="recent">{t('community.sortRecent') || 'Most Recent'}</option>
                <option value="popular">{t('community.sortPopular') || 'Most Popular'}</option>
                <option value="replies">{t('community.sortReplies') || 'Most Replies'}</option>
              </select>
            </div>

            {/* Posts List */}
            <div className="space-y-4">
              {/* Error state for future API integration */}
              {fetchError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                  <p className="text-red-700 font-medium">{t('community.fetchError') || 'Failed to load discussions'}</p>
                  <p className="text-red-500 text-sm mt-1">{fetchError}</p>
                  <button
                    onClick={() => { setFetchError(null); setIsLoading(false); }}
                    className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                  >
                    {t('common.retry') || 'Retry'}
                  </button>
                </div>
              )}

              {/* Loading state for future API integration */}
              {isLoading && !fetchError && (
                <div className="bg-white rounded-xl p-12 text-center border border-neutral-200">
                  <div className="animate-spin w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full mx-auto mb-4" />
                  <p className="text-neutral-500">{t('community.loading') || 'Loading discussions...'}</p>
                </div>
              )}

              {!isLoading && !fetchError && filteredPosts.length === 0 && posts.length === 0 && !searchQuery ? (
                /* Empty state: no posts at all */
                <div className="bg-white rounded-xl p-12 text-center border border-neutral-200">
                  <div className="w-20 h-20 mx-auto mb-6 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-neutral-900">
                    {t('community.emptyTitle') || 'No discussions yet'}
                  </h3>
                  <p className="text-neutral-500 mb-6 max-w-md mx-auto">
                    {t('community.emptyDescription') || 'Be the first to start a conversation! Share your research experiences, ask questions, or help fellow community members.'}
                  </p>
                  {session ? (
                    <button
                      onClick={() => setShowNewPost(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t('community.startFirstDiscussion') || 'Start the First Discussion'}
                    </button>
                  ) : (
                    <Link
                      href="/auth/signin"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                    >
                      {t('community.signInToStart') || 'Sign In to Start a Discussion'}
                    </Link>
                  )}
                </div>
              ) : !isLoading && !fetchError && filteredPosts.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center">
                  <span className="text-6xl mb-4 block">🔍</span>
                  <h3 className="text-lg font-bold mb-2">{t('community.noResults') || 'No discussions found'}</h3>
                  <p className="text-neutral-500">{t('community.tryDifferent') || 'Try a different search or start a new discussion!'}</p>
                </div>
              ) : (
                filteredPosts.map((post) => {
                  const catInfo = getCategoryInfo(post.category);
                  return (
                    <div
                      key={post.id}
                      className={`bg-white rounded-xl shadow-sm border ${post.isPinned ? 'border-purple-300' : 'border-neutral-200'} overflow-hidden hover:shadow-md transition-shadow`}
                    >
                      <div className="p-4 sm:p-6">
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <div className="hidden sm:block">
                            {/* FIX: F-067 - Removed unoptimized to use Next.js image optimization */}
                            {post.userAvatar ? (
                              <Image src={post.userAvatar} alt={post.userName} width={48} height={48} className="w-12 h-12 rounded-full" />
                            ) : (
                              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                <span className="text-purple-600 font-bold text-lg">{post.userName.charAt(0)}</span>
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {post.isPinned && (
                                <span className="text-purple-600">📌</span>
                              )}
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${catInfo.color}`}>
                                {catInfo.icon} {catInfo.name}
                              </span>
                            </div>

                            <h3 className="font-bold text-lg hover:text-purple-600 cursor-pointer">
                              {post.title}
                            </h3>

                            <p className="text-neutral-600 mt-1 line-clamp-2">{post.content}</p>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2 mt-3">
                              {post.tags.map((tag) => (
                                <span key={tag} className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                  #{tag}
                                </span>
                              ))}
                            </div>

                            {/* Meta */}
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{post.userName}</span>
                                {post.userBadge && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    post.userBadge === 'Official' ? 'bg-orange-100 text-orange-700' :
                                    post.userBadge === 'Platinum Member' ? 'bg-purple-100 text-purple-700' :
                                    post.userBadge === 'Gold Member' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-neutral-100 text-neutral-700'
                                  }`}>
                                    {post.userBadge}
                                  </span>
                                )}
                                <span className="text-xs text-neutral-500">• {formatDate(post.createdAt)}</span>
                              </div>

                              <div className="flex items-center gap-4 text-sm text-neutral-500">
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  {post.views}
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                  {post.likes}
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                  {post.replies}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Post Modal */}
      {showNewPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="new-post-modal-title">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 id="new-post-modal-title" className="text-xl font-bold">{t('community.createPost') || 'Start a Discussion'}</h3>
                <button onClick={() => setShowNewPost(false)} aria-label="Close" className="p-2 hover:bg-neutral-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <form onSubmit={handleCreatePost} className="p-6 space-y-6">
              {/* IMP-045: Character counter on form fields */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('community.postTitle') || 'Title'}</label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={t('community.placeholderPostTitle')}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                  maxLength={200}
                />
                <p className={`text-xs mt-1 text-end ${newPost.title.length > 180 ? 'text-red-500' : newPost.title.length > 150 ? 'text-amber-500' : 'text-neutral-400'}`}>
                  {newPost.title.length}/200
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('community.postCategory') || 'Category'}</label>
                <select
                  value={newPost.category}
                  onChange={(e) => setNewPost(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {categories.filter(c => c.id !== 'all').map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>

              {/* IMP-045: Character counter on form fields */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('community.postContent') || 'Content'}</label>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                  placeholder={t('community.placeholderPostBody')}
                  rows={6}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  required
                  maxLength={10000}
                />
                <p className={`text-xs mt-1 text-end ${newPost.content.length > 9500 ? 'text-red-500' : newPost.content.length > 8000 ? 'text-amber-500' : 'text-neutral-400'}`}>
                  {newPost.content.length}/10000
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('community.postTags') || 'Tags (comma separated)'}</label>
                <input
                  type="text"
                  value={newPost.tags}
                  onChange={(e) => setNewPost(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder={t('community.placeholderTags')}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="bg-purple-50 rounded-lg p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-purple-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-purple-800">{t('community.guidelines') || 'Community Guidelines'}</p>
                  <p className="text-sm text-purple-600">{t('community.guidelinesDesc') || 'Be respectful, stay on topic, and remember this is for research discussion only.'}</p>
                </div>
              </div>

              {/* A-062: Discard draft button when draft data exists */}
              {(newPost.title || newPost.content || newPost.tags) && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(DRAFT_KEY);
                    setNewPost({ title: '', content: '', category: 'general', tags: '' });
                  }}
                  className="w-full py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  {t('community.discardDraft') || 'Discard Draft'}
                </button>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                {t('community.submitPost') || 'Post Discussion'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
