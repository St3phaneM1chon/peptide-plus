'use client';

import React from 'react';

interface SplitLayoutProps {
  list: React.ReactNode;
  detail: React.ReactNode;
  listWidth?: number;
  className?: string;
}

export function SplitLayout({
  list,
  detail,
  listWidth = 380,
  className = '',
}: SplitLayoutProps) {
  return (
    <div className={`flex h-full ${className}`}>
      {/* List panel - fixed width on desktop, full width on mobile */}
      <div
        className="hidden lg:flex flex-shrink-0 h-full"
        style={{ width: `${listWidth}px` }}
      >
        {list}
      </div>

      {/* Mobile: list visible by default (detail handles its own back button) */}
      <div className="flex lg:hidden flex-1 h-full">
        {list}
      </div>

      {/* Detail panel - flex-1 on desktop, hidden on mobile (shown via MobileSplitLayout) */}
      <div className="hidden lg:flex flex-1 h-full min-w-0">
        {detail}
      </div>
    </div>
  );
}

/**
 * Mobile-aware split layout: shows either the list or the detail
 * depending on whether an item is selected.
 *
 * Use this when you need automatic list/detail toggling on mobile.
 */
interface MobileSplitLayoutProps {
  list: React.ReactNode;
  detail: React.ReactNode;
  showDetail: boolean;
  listWidth?: number;
  className?: string;
}

export function MobileSplitLayout({
  list,
  detail,
  showDetail,
  listWidth = 380,
  className = '',
}: MobileSplitLayoutProps) {
  return (
    <div className={`flex h-full ${className}`}>
      {/* Desktop: always show both side by side */}
      <div
        className="hidden lg:flex flex-shrink-0 h-full"
        style={{ width: `${listWidth}px` }}
      >
        {list}
      </div>
      <div className="hidden lg:flex flex-1 h-full min-w-0">
        {detail}
      </div>

      {/* Mobile: show one or the other */}
      <div className="flex lg:hidden flex-1 h-full min-w-0">
        {showDetail ? detail : list}
      </div>
    </div>
  );
}

export type { SplitLayoutProps, MobileSplitLayoutProps };
