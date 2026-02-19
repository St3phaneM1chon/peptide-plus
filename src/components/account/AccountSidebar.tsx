'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/i18n/client';

const accountLinks = [
  { href: '/account', labelKey: 'account.dashboard', icon: '🏠' },
  { href: '/account/orders', labelKey: 'account.orders', icon: '📦' },
  { href: '/account/inventory', labelKey: 'account.inventory', icon: '🔬' },
  { href: '/account/addresses', labelKey: 'account.addresses', icon: '📍' },
  { href: '/account/profile', labelKey: 'account.profile', icon: '👤' },
  { href: '/account/referrals', labelKey: 'customerRewards.referral', icon: '🎁' },
  { href: '/account/subscriptions', labelKey: 'nav.subscriptions', icon: '🔄' },
];

export default function AccountSidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav aria-label={t('account.navigation') || 'Account navigation'} className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-20 bg-white rounded-xl border border-neutral-200 p-4">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">{t('account.myAccount') || 'My Account'}</h2>
        <ul className="space-y-1">
          {accountLinks.map((link) => {
            const isActive = link.href === '/account'
              ? pathname === '/account'
              : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-orange-50 text-orange-600 font-medium'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <span>{link.icon}</span>
                  <span>{t(link.labelKey) || link.labelKey}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
