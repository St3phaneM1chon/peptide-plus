'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Menu,
  Search,
  Bell,
  ShoppingCart,
  MessageCircle,
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

export default function OutlookTopBar({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void } = {}) {
  const { data: session } = useSession();
  const { t } = useI18n();
  const { toggleFolderPane, searchQuery, setSearchQuery } = useAdminLayout();
  const { pendingOrders, unreadChats } = useAdminNotifications();

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
          aria-label="Toggle navigation"
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
        <div className="relative max-w-md w-full">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admin.outlook.searchPlaceholder')}
            aria-label={t('admin.outlook.searchPlaceholder')}
            className="w-full ps-9 pe-3 py-1.5 text-sm bg-slate-100 border border-transparent
                       rounded-lg placeholder:text-slate-400
                       focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white focus:border-sky-300
                       transition-colors"
          />
        </div>
      </div>

      {/* ── Right section ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Bell / Notifications */}
        <button
          type="button"
          title={t('admin.notifications')}
          aria-label={t('admin.notifications')}
          className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Bell className="w-[18px] h-[18px] text-slate-500" />
          <span className="absolute top-1.5 end-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

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
