'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { useAdminLayout } from '@/lib/admin/admin-layout-context';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { railItems, folderSections, getVisibleRailItems } from '@/lib/admin/outlook-nav';
import type { NavRailItem } from '@/lib/admin/outlook-nav';

// ── Badge value resolver ────────────────────────────────────────

type BadgeKey = NonNullable<NavRailItem['badge']>;

function useBadgeCounts(): Record<BadgeKey, number> {
  const { pendingOrders, unreadChats } = useAdminNotifications();
  return {
    pendingOrders,
    unreadChats,
    inboxCount: 0,
  };
}

// ── First href helper ───────────────────────────────────────────

function getFirstHref(railId: string): string {
  const section = folderSections[railId];
  if (!section) return '/admin/dashboard';
  for (const group of section.groups) {
    if (group.items.length > 0) {
      return group.items[0].href;
    }
  }
  return '/admin/dashboard';
}

// ── Component ───────────────────────────────────────────────────

export default function IconRail() {
  const router = useRouter();
  const { t } = useI18n();
  const { activeRailId, setActiveRail } = useAdminLayout();
  const badgeCounts = useBadgeCounts();
  const { data: session } = useSession();

  // Determine visible rail items based on tenant modules and super-admin status
  const visibleItems = useMemo(() => {
    if (!session?.user) return railItems; // Fallback: show all while loading

    const tenantModules = session.user.tenantModules ?? [];
    const isSuperAdmin = session.user.isSuperAdmin ?? false;

    return getVisibleRailItems(tenantModules, isSuperAdmin);
  }, [session?.user]);

  const handleClick = (item: NavRailItem) => {
    setActiveRail(item.id);
    router.push(getFirstHref(item.id));
  };

  return (
    <nav
      className="w-12 h-full bg-[var(--k-bg-surface)]/80 backdrop-blur-xl border-e border-[var(--k-border-subtle)] flex flex-col flex-shrink-0"
      aria-label={t('admin.outlook.mainNavigationRail') || 'Main navigation rail'}
    >
      {/* Rail items */}
      <div className="flex-1 flex flex-col items-center pt-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRailId === item.id;
          const badgeCount = item.badge ? badgeCounts[item.badge] : 0;
          const label = t(item.labelKey);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleClick(item)}
              title={label}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`
                relative w-12 h-12 flex items-center justify-center transition-colors
                ${isActive
                  ? 'bg-[var(--k-glass-regular)] border-s-[3px] border-s-[#6366f1]'
                  : 'border-s-[3px] border-s-transparent hover:bg-[var(--k-glass-thin)]'
                }
              `}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[var(--k-text-secondary)]'}`} />

              {/* Badge */}
              {badgeCount > 0 && (
                <span
                  className="absolute top-1.5 end-1.5 min-w-[16px] h-4 bg-gradient-to-r from-rose-500 to-red-500 text-white
                             text-[10px] font-bold rounded-full flex items-center justify-center
                             leading-none px-1"
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom section */}
      <div className="border-t border-[var(--k-border-subtle)] flex flex-col items-center py-1">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title={t('admin.outlook.viewSite')}
          aria-label={t('admin.outlook.viewSite')}
          className="w-12 h-12 flex items-center justify-center hover:bg-[var(--k-glass-thin)] transition-colors"
        >
          <ExternalLink className="w-5 h-5 text-[var(--k-text-secondary)]" />
        </a>
      </div>
    </nav>
  );
}
