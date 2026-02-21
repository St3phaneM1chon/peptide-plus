'use client';

import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { useAdminLayout } from '@/lib/admin/admin-layout-context';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { railItems, folderSections } from '@/lib/admin/outlook-nav';
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

  const handleClick = (item: NavRailItem) => {
    setActiveRail(item.id);
    router.push(getFirstHref(item.id));
  };

  return (
    <nav
      className="w-12 h-full bg-sky-950 flex flex-col flex-shrink-0"
      aria-label="Main navigation rail"
    >
      {/* Rail items */}
      <div className="flex-1 flex flex-col items-center pt-1">
        {railItems.map((item) => {
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
                  ? 'bg-sky-700 border-s-[3px] border-s-white'
                  : 'border-s-[3px] border-s-transparent hover:bg-sky-800'
                }
              `}
            >
              <Icon className="w-5 h-5 text-white" />

              {/* Badge */}
              {badgeCount > 0 && (
                <span
                  className="absolute top-1.5 end-1.5 min-w-[16px] h-4 bg-red-500 text-white
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
      <div className="border-t border-sky-800 flex flex-col items-center py-1">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title={t('admin.outlook.viewSite')}
          aria-label={t('admin.outlook.viewSite')}
          className="w-12 h-12 flex items-center justify-center hover:bg-sky-800 transition-colors"
        >
          <ExternalLink className="w-5 h-5 text-white" />
        </a>
      </div>
    </nav>
  );
}
