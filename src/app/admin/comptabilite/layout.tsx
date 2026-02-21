'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n/client';

/**
 * Comptabilite Layout - Simplified for Outlook shell.
 * Navigation is now handled by the FolderPane (Icon Rail "Comptabilite" section).
 * This layout only adds a breadcrumb for context.
 */
export default function ComptabiliteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();

  // Build breadcrumb segments from pathname
  const segments = pathname.replace('/admin/comptabilite', '').split('/').filter(Boolean);

  return (
    <div>
      {/* Breadcrumb */}
      {segments.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 text-xs text-slate-400">
          <Link href="/admin/comptabilite" className="hover:text-slate-600 transition-colors">
            {t('admin.nav.accounting')}
          </Link>
          {segments.map((seg, i) => {
            const href = '/admin/comptabilite/' + segments.slice(0, i + 1).join('/');
            const isLast = i === segments.length - 1;
            const label = seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return (
              <span key={href} className="flex items-center gap-1.5">
                <ChevronRight className="w-3 h-3" />
                {isLast ? (
                  <span className="text-slate-600 font-medium">{label}</span>
                ) : (
                  <Link href={href} className="hover:text-slate-600 transition-colors">{label}</Link>
                )}
              </span>
            );
          })}
        </div>
      )}

      {children}
    </div>
  );
}
