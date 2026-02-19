'use client';

/**
 * TranslationNotice - Floating discreet notice for AI-translated pages
 *
 * Shows a small dismissible notice in the bottom-left corner when
 * the user is viewing the site in a non-reference language (not en/fr).
 * Dismissal is remembered in localStorage for 7 days.
 */

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/client';

const DISMISS_KEY = 'translation-notice-dismissed';
const DISMISS_DAYS = 7;

export function TranslationNotice() {
  const { locale, t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show for non-reference languages
    if (locale === 'en' || locale === 'fr') return;

    // Check if dismissed recently
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
    }

    // Show after a short delay to avoid flash
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [locale]);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        zIndex: 40,
        maxWidth: '320px',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        fontSize: '13px',
        lineHeight: 1.5,
        color: '#374151',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>
        &#x1F310;
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0 }}>
          {t('translation.aiNotice')}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>
          {t('translation.reportIssue')}
        </p>
      </div>
      <button
        onClick={handleDismiss}
        aria-label={t('common.aria.dismiss')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#9ca3af',
          fontSize: '18px',
          lineHeight: 1,
          padding: '0',
          flexShrink: 0,
        }}
      >
        &times;
      </button>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
