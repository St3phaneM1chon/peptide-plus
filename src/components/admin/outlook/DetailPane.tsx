'use client';

import React from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import { AvatarCircle } from './AvatarCircle';

interface DetailPaneProps {
  children?: React.ReactNode;
  header?: {
    title: string;
    subtitle?: string;
    avatar?: { text: string; color?: string; imageUrl?: string };
    actions?: React.ReactNode;
    backLabel?: string;
    onBack?: () => void;
  };
  isEmpty?: boolean;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DetailPane({
  children,
  header,
  isEmpty = false,
  emptyIcon: EmptyIcon = Mail,
  emptyTitle = 'Selectionnez un element',
  emptyDescription = 'Aucun element selectionne',
  className = '',
}: DetailPaneProps) {
  // Empty state
  if (isEmpty || (!children && !header)) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center bg-white ${className}`}>
        <div className="flex flex-col items-center text-center px-6 animate-fade-in">
          <EmptyIcon className="w-16 h-16 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-600">{emptyTitle}</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">{emptyDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col bg-white min-w-0 animate-fade-in ${className}`}>
      {/* Header */}
      {header && (
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-4">
            {/* Back button (mobile) */}
            {header.onBack && (
              <button
                type="button"
                onClick={header.onBack}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700
                           transition-colors -ms-1 me-1 flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                {header.backLabel && <span>{header.backLabel}</span>}
              </button>
            )}

            {/* Avatar */}
            {header.avatar && (
              <AvatarCircle
                name={header.avatar.text}
                imageUrl={header.avatar.imageUrl}
                size="lg"
                className="flex-shrink-0"
              />
            )}

            {/* Title / Subtitle */}
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-slate-900 truncate">
                {header.title}
              </h2>
              {header.subtitle && (
                <p className="text-sm text-slate-500 truncate mt-0.5">
                  {header.subtitle}
                </p>
              )}
            </div>

            {/* Actions */}
            {header.actions && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {header.actions}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto outlook-scroll p-6" aria-live="polite">
        {children}
      </div>
    </div>
  );
}

export type { DetailPaneProps };
