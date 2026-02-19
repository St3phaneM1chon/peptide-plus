'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const { t } = useI18n();

  // Generate JSON-LD structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href && { item: `https://biocyclepeptides.com${item.href}` }),
    })),
  };

  return (
    <>
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb navigation */}
      <nav aria-label={t('common.aria.breadcrumb')} className="bg-neutral-50 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <ol className="flex items-center gap-2 text-sm overflow-x-auto">
            {items.map((item, index) => {
              const isLast = index === items.length - 1;
              const isFirst = index === 0;

              // On mobile, truncate middle items if there are more than 3
              const shouldTruncate = items.length > 3 && index > 0 && index < items.length - 1;

              return (
                <li
                  key={index}
                  className={`flex items-center gap-2 ${shouldTruncate ? 'hidden sm:flex' : 'flex'}`}
                >
                  {/* Separator (except for first item) */}
                  {!isFirst && (
                    <svg
                      className="w-4 h-4 text-neutral-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}

                  {/* Breadcrumb item */}
                  {isLast ? (
                    // Current page (no link, bold)
                    <span className="text-neutral-900 font-medium" aria-current="page">
                      {item.label}
                    </span>
                  ) : item.href ? (
                    // Linked breadcrumb with home icon for first item
                    <Link
                      href={item.href}
                      className="text-neutral-600 hover:text-orange-600 transition-colors flex items-center gap-1.5"
                    >
                      {isFirst && (
                        <svg
                          className="w-4 h-4 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                        >
                          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                        </svg>
                      )}
                      <span className={isFirst ? 'sr-only sm:not-sr-only' : ''}>
                        {item.label}
                      </span>
                    </Link>
                  ) : (
                    // Non-linked breadcrumb
                    <span className="text-neutral-600">{item.label}</span>
                  )}
                </li>
              );
            })}

            {/* Show ellipsis on mobile when middle items are hidden */}
            {items.length > 3 && (
              <li className="flex sm:hidden items-center gap-2">
                <svg
                  className="w-4 h-4 text-neutral-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span className="text-neutral-400">...</span>
              </li>
            )}
          </ol>
        </div>
      </nav>
    </>
  );
}
