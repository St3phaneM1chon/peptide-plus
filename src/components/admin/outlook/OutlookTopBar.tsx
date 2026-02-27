'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Menu,
  Search,
  ShoppingCart,
  MessageCircle,
  Package,
  FileText,
  Users,
  FolderOpen,
  BookOpen,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { useAdminLayout } from '@/lib/admin/admin-layout-context';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';

// ── Avatar color palette ────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-sky-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-orange-600',
] as const;

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Component ───────────────────────────────────────────────────

const TYPE_ICONS: Record<string, typeof Package> = {
  product: Package,
  order: ShoppingCart,
  user: Users,
  journal_entry: BookOpen,
  category: FolderOpen,
};

const TYPE_LABEL_KEYS: Record<string, string> = {
  product: 'admin.search.typeProduct',
  order: 'admin.search.typeOrder',
  user: 'admin.search.typeUser',
  journal_entry: 'admin.search.typeEntry',
  category: 'admin.search.typeCategory',
};

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  url: string;
}

export default function OutlookTopBar({ onMobileMenuToggle, extraIcons }: { onMobileMenuToggle?: () => void; extraIcons?: React.ReactNode } = {}) {
  const { data: session } = useSession();
  const { t } = useI18n();
  const router = useRouter();
  const { toggleFolderPane, searchQuery, setSearchQuery } = useAdminLayout();
  const { pendingOrders, unreadChats } = useAdminNotifications();
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQuery)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowResults(true);
        }
      } catch { /* ignore */ }
      setSearchLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleResultClick = useCallback((result: SearchResult) => {
    setShowResults(false);
    setSearchQuery('');
    router.push(result.url);
  }, [router, setSearchQuery]);

  const userName = session?.user?.name || 'Admin';
  const userRole = (session?.user as { role?: string } | undefined)?.role ?? 'OWNER';
  const userInitial = userName.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(userName);

  return (
    <header
      className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-3 sticky top-0 z-30"
      role="banner"
    >
      {/* ── Left section ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Hamburger: desktop toggles folder pane, mobile toggles overlay */}
        <button
          type="button"
          onClick={() => {
            if (onMobileMenuToggle && window.innerWidth < 1024) {
              onMobileMenuToggle();
            } else {
              toggleFolderPane();
            }
          }}
          aria-label={t('admin.outlook.toggleNavigation') || 'Toggle navigation'}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>

        {/* Logo */}
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-sky-700 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-[11px] leading-none">BC</span>
          </div>
          <span className="font-semibold text-sm text-slate-800 hidden md:inline">
            {t('admin.brandName')}
          </span>
        </Link>
      </div>

      {/* ── Center section: Search ────────────────────────────── */}
      <div className="flex-1 flex justify-center px-4">
        <div className="relative max-w-md w-full" ref={searchRef}>
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
            placeholder={t('admin.outlook.searchPlaceholder')}
            aria-label={t('admin.outlook.searchPlaceholder')}
            className="w-full ps-9 pe-3 py-1.5 text-sm bg-slate-100 border border-transparent
                       rounded-lg placeholder:text-slate-400
                       focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white focus:border-sky-300
                       transition-colors"
          />
          {/* Search results dropdown */}
          {showResults && (
            <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-slate-200 max-h-80 overflow-y-auto z-50">
              {searchLoading ? (
                <div className="p-3 text-center text-sm text-slate-400">
                  <div className="animate-spin inline-block w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-3 text-center text-sm text-slate-400">
                  {t('common.noResults') || 'No results found'}
                </div>
              ) : (
                searchResults.map((result) => {
                  const Icon = TYPE_ICONS[result.type] || FileText;
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      onClick={() => handleResultClick(result)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors border-b border-slate-100 last:border-0"
                    >
                      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{result.title}</p>
                        {result.subtitle && (
                          <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                        )}
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded flex-shrink-0">
                        {TYPE_LABEL_KEYS[result.type] ? t(TYPE_LABEL_KEYS[result.type]) : result.type}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right section ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Extra icons injected by parent (ThemeToggle, NotificationCenter) */}
        {extraIcons}

        {/* Orders */}
        <Link
          href="/admin/commandes"
          title={t('admin.nav.orders')}
          aria-label={t('admin.nav.orders')}
          className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ShoppingCart className="w-[18px] h-[18px] text-slate-500" />
          {pendingOrders > 0 && (
            <span
              className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] bg-red-500 text-white
                         text-[10px] font-semibold rounded-full flex items-center justify-center
                         leading-none px-1"
            >
              {pendingOrders > 99 ? '99+' : pendingOrders}
            </span>
          )}
        </Link>

        {/* Chat */}
        <Link
          href="/admin/chat"
          title={t('admin.nav.chatSupport')}
          aria-label={t('admin.nav.chatSupport')}
          className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <MessageCircle className="w-[18px] h-[18px] text-slate-500" />
          {unreadChats > 0 && (
            <span
              className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] bg-sky-500 text-white
                         text-[10px] font-semibold rounded-full flex items-center justify-center
                         leading-none px-1"
            >
              {unreadChats > 99 ? '99+' : unreadChats}
            </span>
          )}
        </Link>

        {/* Separator */}
        <div className="w-px h-6 bg-slate-200 mx-1" />

        {/* User */}
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 ${avatarColor} rounded-full flex items-center justify-center flex-shrink-0`}
          >
            <span className="text-white font-medium text-sm leading-none">
              {userInitial}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-800 leading-tight truncate max-w-[120px]">
              {userName}
            </p>
            <p className="text-[11px] text-slate-400 leading-tight">
              {userRole}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
