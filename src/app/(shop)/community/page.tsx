// TODO: F-052 - Add explicit ReviewStatus enum to Prisma schema instead of deriving from booleans
// TODO: F-055 - Calculate popular tags dynamically from posts instead of hardcoded fallback
// F086 FIX: Dynamic SEO meta (Open Graph, Twitter Card) added to community/layout.tsx
// IMP-045: Character counters added to post title and content fields
// A-041: URL-based pagination params for bookmarkable/shareable community URLs
// A-062: Auto-save draft post to localStorage for persistence across page navigations
// Community backend wired: fetches from /api/community/posts and /api/community/categories
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useI18n } from '@/i18n/client';
import { useSearchParams } from 'next/navigation';

// --- Types matching API responses ---

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  postCount?: number;
}

interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userBadge?: string;
  title: string;
  content: string;
  category: string;
  categorySlug?: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  replyCount: number;
  views: number;
  isPinned: boolean;
  createdAt: string;
  lastReply?: string;
}

// Fallback categories used when the API is not yet available
const getFallbackCategories = (t: (key: string) => string): Category[] => [
  { id: 'all', name: t('community.allDiscussions') || 'All Discussions', slug: 'all', icon: '\u{1F4AC}', color: 'bg-neutral-100 text-neutral-700' },
  { id: 'general', name: t('community.general') || 'General', slug: 'general', icon: '\u{1F5E3}\u{FE0F}', color: 'bg-blue-100 text-blue-700' },
  { id: 'research', name: t('community.research') || 'Research', slug: 'research', icon: '\u{1F52C}', color: 'bg-purple-100 text-purple-700' },
  { id: 'howto', name: t('community.howto') || 'How-To', slug: 'howto', icon: '\u{1F4D6}', color: 'bg-green-100 text-green-700' },
  { id: 'results', name: t('community.results') || 'Results & Experiences', slug: 'results', icon: '\u{1F4CA}', color: 'bg-orange-100 text-orange-700' },
  { id: 'support', name: t('community.support') || 'Support', slug: 'support', icon: '\u{1F198}', color: 'bg-red-100 text-red-700' },
];

// --- Skeleton loaders ---

function PostSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden animate-pulse">
      <div className="p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="hidden sm:block">
            <div className="w-12 h-12 bg-neutral-200 rounded-full" />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 bg-neutral-200 rounded-full" />
            </div>
            <div className="h-6 w-3/4 bg-neutral-200 rounded" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-neutral-100 rounded" />
              <div className="h-4 w-2/3 bg-neutral-100 rounded" />
            </div>
            <div className="flex gap-2 mt-3">
              <div className="h-6 w-16 bg-neutral-100 rounded" />
              <div className="h-6 w-16 bg-neutral-100 rounded" />
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
              <div className="h-4 w-32 bg-neutral-100 rounded" />
              <div className="flex gap-4">
                <div className="h-4 w-10 bg-neutral-100 rounded" />
                <div className="h-4 w-10 bg-neutral-100 rounded" />
                <div className="h-4 w-10 bg-neutral-100 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoriesSkeleton() {
  return (
    <div className="space-y-1 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-neutral-200 rounded" />
            <div className="h-4 w-24 bg-neutral-200 rounded" />
          </div>
          <div className="h-4 w-6 bg-neutral-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// --- Main component ---

export default function CommunityPage() {
  const { data: session } = useSession();
  const { t, locale } = useI18n();

  // A-041: Read initial state from URL search params for bookmarkable/shareable URLs
  const searchParams = useSearchParams();

  // --- Categories state (fetched from API) ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // --- Posts state ---
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [totalPosts, setTotalPosts] = useState(0);
  const [currentPage, setCurrentPage] = useState(() => {
    const p = searchParams.get('page');
    return p ? Math.max(1, parseInt(p, 10) || 1) : 1;
  });
  const [totalPages, setTotalPages] = useState(1);

  const [activeCategory, setActiveCategory] = useState(() => {
    const cat = searchParams.get('category');
    return cat || 'all';
  });

  // F-064 FIX: Persist sort preference in localStorage
  // A-041: Also read from URL params (URL takes priority over localStorage)
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'replies'>(() => {
    const urlSort = searchParams.get('sort');
    if (urlSort === 'newest' || urlSort === 'popular' || urlSort === 'replies') return urlSort;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('community-sort');
      if (saved === 'newest' || saved === 'popular' || saved === 'replies') return saved;
    }
    return 'newest';
  });

  const [showNewPost, setShowNewPost] = useState(false);

  // A-041: Read initial search from URL params
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  // FIX F-032: Debounce search query to avoid excessive re-renders with API calls
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchQuery]);

  // --- Vote tracking: which posts user has voted on in this session ---
  const [votedPosts, setVotedPosts] = useState<Record<string, 1 | -1>>({});

  // --- Submitting state for create post ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // F-064 FIX: Save sort preference to localStorage
  useEffect(() => {
    localStorage.setItem('community-sort', sortBy);
  }, [sortBy]);

  // A-041: Sync URL search params when filters change (bookmarkable/shareable)
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory !== 'all') params.set('category', activeCategory);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (currentPage > 1) params.set('page', String(currentPage));
    const paramStr = params.toString();
    const newUrl = paramStr ? `?${paramStr}` : window.location.pathname;
    // Use replaceState to avoid polluting browser history on every keystroke
    window.history.replaceState({}, '', newUrl);
  }, [activeCategory, sortBy, debouncedSearch, currentPage]);

  // --- Fetch categories from API ---
  useEffect(() => {
    let cancelled = false;
    async function fetchCategories() {
      setCategoriesLoading(true);
      try {
        const res = await fetch('/api/community/categories');
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        if (!cancelled && data.categories) {
          // Prepend the "all" category
          const allCat: Category = {
            id: 'all',
            name: t('community.allDiscussions') || 'All Discussions',
            slug: 'all',
            icon: '\u{1F4AC}',
            color: 'bg-neutral-100 text-neutral-700',
          };
          setCategories([allCat, ...data.categories]);
        }
      } catch {
        // Fallback to hardcoded categories if API not available
        if (!cancelled) {
          setCategories(getFallbackCategories(t));
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    }
    fetchCategories();
    return () => { cancelled = true; };
  }, [t]);

  // --- Fetch posts from API ---
  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', '20');
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('sort', sortBy);

      const res = await fetch(`/api/community/posts?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPosts(data.posts || []);
      setTotalPosts(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setFetchError(message);
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, activeCategory, debouncedSearch, sortBy]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, debouncedSearch, sortBy]);

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

  // A-062: Auto-save draft to localStorage whenever form fields change
  useEffect(() => {
    if (newPost.title || newPost.content || newPost.tags) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(newPost));
    }
  }, [newPost]);

  // --- Create post via API ---
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPost.title,
          content: newPost.content,
          categoryId: newPost.category,
          tags: newPost.tags.split(',').map((tag: string) => tag.trim().toLowerCase()).filter(Boolean),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      // A-062: Clear draft on successful submission
      localStorage.removeItem(DRAFT_KEY);
      setShowNewPost(false);
      setNewPost(defaultDraft);

      // Refresh posts to show the newly created one
      setCurrentPage(1);
      // If we're already on page 1, fetchPosts won't re-trigger from the page change,
      // so call it explicitly
      await fetchPosts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create post';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Vote on a post via API ---
  const handleVote = async (postId: string, value: 1 | -1) => {
    if (!session) return;
    // Prevent double-voting in the same direction
    if (votedPosts[postId] === value) return;

    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const undoPrev = votedPosts[postId];
      let newUpvotes = p.upvotes;
      let newDownvotes = p.downvotes;
      // Undo previous vote if switching
      if (undoPrev === 1) newUpvotes--;
      if (undoPrev === -1) newDownvotes--;
      // Apply new vote
      if (value === 1) newUpvotes++;
      if (value === -1) newDownvotes++;
      return { ...p, upvotes: newUpvotes, downvotes: newDownvotes };
    }));
    setVotedPosts(prev => ({ ...prev, [postId]: value }));

    try {
      const res = await fetch(`/api/community/posts/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });

      if (!res.ok) {
        // Revert optimistic update on error
        await fetchPosts();
        return;
      }

      const data = await res.json();
      // Update with server-confirmed values
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, upvotes: data.upvotes, downvotes: data.downvotes }
          : p
      ));
    } catch {
      // Revert on network error
      await fetchPosts();
    }
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
    return categories.find(c => c.id === categoryId || c.slug === categoryId) || categories[0];
  };

  // Compute display-friendly likes count (upvotes - downvotes, minimum 0)
  const getLikeCount = (post: Post) => Math.max(0, post.upvotes - post.downvotes);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-600 to-purple-700 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">{'\u{1F465}'}</span>
            <h1 className="text-3xl md:text-4xl font-bold">
              {t('community.title') || 'Community Forum'}
            </h1>
          </div>
          <p className="text-xl text-purple-100 max-w-2xl">
            {t('community.subtitle') || 'Connect with fellow researchers, share experiences, ask questions, and learn from the community.'}
          </p>

          {/* Stats */}
          {/* F081 FIX: Show computed values from API or '--' placeholder */}
          {/* F091 FIX: Add research-only disclaimer for peptide-related discussions */}
          <div className="flex flex-wrap gap-6 mt-8">
            <div className="bg-white/10 px-6 py-3 rounded-lg">
              <p className="text-2xl font-bold">{totalPosts > 0 ? totalPosts : '--'}</p>
              <p className="text-sm text-purple-200">{t('community.statsDiscussions') || 'Discussions'}</p>
            </div>
            <div className="bg-white/10 px-6 py-3 rounded-lg">
              <p className="text-2xl font-bold">{posts.length > 0 ? posts.reduce((sum, p) => sum + p.replyCount, 0) : '--'}</p>
              <p className="text-sm text-purple-200">{t('community.statsReplies') || 'Replies'}</p>
            </div>
            <div className="bg-white/10 px-6 py-3 rounded-lg">
              {/* F-058 FIX: Show unique author count instead of placeholder */}
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
              {categoriesLoading ? (
                <CategoriesSkeleton />
              ) : (
                <div className="space-y-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.slug || cat.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                        (activeCategory === cat.slug || activeCategory === cat.id)
                          ? 'bg-purple-100 text-purple-700'
                          : 'hover:bg-neutral-100'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span className="text-sm">{cat.name}</span>
                      </span>
                      {cat.postCount !== undefined && (
                        <span className="text-xs text-neutral-500">
                          {cat.postCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
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
                <option value="newest">{t('community.sortRecent') || 'Most Recent'}</option>
                <option value="popular">{t('community.sortPopular') || 'Most Popular'}</option>
                <option value="replies">{t('community.sortReplies') || 'Most Replies'}</option>
              </select>
            </div>

            {/* Posts List */}
            <div className="space-y-4">
              {/* Error state */}
              {fetchError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                  <p className="text-red-700 font-medium">{t('community.fetchError') || 'Failed to load discussions'}</p>
                  <p className="text-red-500 text-sm mt-1">{fetchError}</p>
                  <button
                    onClick={() => { setFetchError(null); fetchPosts(); }}
                    className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                  >
                    {t('common.retry') || 'Retry'}
                  </button>
                </div>
              )}

              {/* Loading skeleton state */}
              {isLoading && !fetchError && (
                <div className="space-y-4">
                  <PostSkeleton />
                  <PostSkeleton />
                  <PostSkeleton />
                </div>
              )}

              {!isLoading && !fetchError && posts.length === 0 && !debouncedSearch && activeCategory === 'all' ? (
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
              ) : !isLoading && !fetchError && posts.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center">
                  <span className="text-6xl mb-4 block">{'\u{1F50D}'}</span>
                  <h3 className="text-lg font-bold mb-2">{t('community.noResults') || 'No discussions found'}</h3>
                  <p className="text-neutral-500">{t('community.tryDifferent') || 'Try a different search or start a new discussion!'}</p>
                </div>
              ) : !isLoading && !fetchError && (
                <>
                  {posts.map((post) => {
                    const catInfo = getCategoryInfo(post.categorySlug || post.category);
                    return (
                      <div
                        key={post.id}
                        className={`bg-white rounded-xl shadow-sm border ${post.isPinned ? 'border-purple-300' : 'border-neutral-200'} overflow-hidden hover:shadow-md transition-shadow`}
                      >
                        <div className="p-4 sm:p-6">
                          <div className="flex items-start gap-4">
                            {/* Vote buttons */}
                            {session && (
                              <div className="hidden sm:flex flex-col items-center gap-1">
                                <button
                                  onClick={() => handleVote(post.id, 1)}
                                  className={`p-1 rounded transition-colors ${
                                    votedPosts[post.id] === 1
                                      ? 'text-purple-600 bg-purple-50'
                                      : 'text-neutral-400 hover:text-purple-600 hover:bg-purple-50'
                                  }`}
                                  aria-label={t('community.upvote') || 'Upvote'}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <span className={`text-sm font-bold ${getLikeCount(post) > 0 ? 'text-purple-600' : 'text-neutral-400'}`}>
                                  {getLikeCount(post)}
                                </span>
                                <button
                                  onClick={() => handleVote(post.id, -1)}
                                  className={`p-1 rounded transition-colors ${
                                    votedPosts[post.id] === -1
                                      ? 'text-red-500 bg-red-50'
                                      : 'text-neutral-400 hover:text-red-500 hover:bg-red-50'
                                  }`}
                                  aria-label={t('community.downvote') || 'Downvote'}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            )}

                            {/* Avatar (shown when not logged in, or on mobile) */}
                            {!session && (
                              <div className="hidden sm:block">
                                {post.userAvatar ? (
                                  <Image src={post.userAvatar} alt={post.userName} width={48} height={48} className="w-12 h-12 rounded-full" />
                                ) : (
                                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <span className="text-purple-600 font-bold text-lg">{post.userName.charAt(0)}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {post.isPinned && (
                                  <span className="text-purple-600">{'\u{1F4CC}'}</span>
                                )}
                                {catInfo && (
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${catInfo.color}`}>
                                    {catInfo.icon} {catInfo.name}
                                  </span>
                                )}
                              </div>

                              <h3 className="font-bold text-lg hover:text-purple-600 cursor-pointer">
                                {post.title}
                              </h3>

                              <p className="text-neutral-600 mt-1 line-clamp-2">{post.content}</p>

                              {/* Tags */}
                              {post.tags && post.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {post.tags.map((tag) => (
                                    <span key={tag} className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Meta */}
                              <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
                                <div className="flex items-center gap-2">
                                  {/* Small inline avatar */}
                                  {post.userAvatar ? (
                                    <Image src={post.userAvatar} alt="" width={20} height={20} className="w-5 h-5 rounded-full" />
                                  ) : (
                                    <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center">
                                      <span className="text-purple-600 font-bold text-[10px]">{post.userName.charAt(0)}</span>
                                    </div>
                                  )}
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
                                  <span className="text-xs text-neutral-500">{'\u2022'} {formatDate(post.createdAt)}</span>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-neutral-500">
                                  <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    {post.views}
                                  </span>
                                  {/* Mobile vote display (when no vote buttons in sidebar) */}
                                  <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                    {getLikeCount(post)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    {post.replyCount}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('common.previous') || 'Previous'}
                      </button>
                      <span className="text-sm text-neutral-600">
                        {(t('community.pageOf') || 'Page {current} of {total}')
                          .replace('{current}', String(currentPage))
                          .replace('{total}', String(totalPages))}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('common.next') || 'Next'}
                      </button>
                    </div>
                  )}
                </>
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
              {/* Submit error */}
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}

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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                >
                  {categories.filter(c => c.id !== 'all' && c.slug !== 'all').map((cat) => (
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
              {(newPost.title || newPost.content || newPost.tags) && !isSubmitting && (
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
                disabled={isSubmitting}
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting && (
                  <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                )}
                {isSubmitting
                  ? (t('community.submitting') || 'Posting...')
                  : (t('community.submitPost') || 'Post Discussion')
                }
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
