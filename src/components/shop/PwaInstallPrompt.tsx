'use client';

/**
 * PWA Install Prompt — "Add to Home Screen" banner
 *
 * Appears after 3 visits, dismissible, remembers dismissal for 30 days.
 * Uses the beforeinstallprompt event for Chrome/Edge and provides
 * manual instructions for Safari/iOS.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { useI18n } from '@/i18n/client';

const STORAGE_KEY = 'pwa-install-dismissed';
const VISIT_COUNT_KEY = 'pwa-visit-count';
const VISITS_THRESHOLD = 3;
const DISMISS_DAYS = 30;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallPrompt() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  // Track visits and check if prompt should show
  useEffect(() => {
    // Skip if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Check if dismissed
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt) {
      const dismissDate = new Date(dismissedAt);
      const now = new Date();
      const daysSinceDismiss = (now.getTime() - dismissDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < DISMISS_DAYS) {
        return;
      }
      // Expired, clear it
      localStorage.removeItem(STORAGE_KEY);
    }

    // Increment visit count
    const count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(count));

    if (count < VISITS_THRESHOLD) {
      return;
    }

    // Detect iOS (Safari doesn't fire beforeinstallprompt)
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS);

    if (isiOS) {
      // On iOS, show banner with manual instructions
      // Only if not already in standalone
      const isStandalone = ('standalone' in window.navigator) && (window.navigator as unknown as { standalone: boolean }).standalone;
      if (!isStandalone) {
        setVisible(true);
      }
      return;
    }

    // Listen for beforeinstallprompt (Chrome, Edge, etc.)
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPromptRef.current) {
      await deferredPromptRef.current.prompt();
      const result = await deferredPromptRef.current.userChoice;
      if (result.outcome === 'accepted') {
        setVisible(false);
        localStorage.setItem(VISIT_COUNT_KEY, '0');
      }
      deferredPromptRef.current = null;
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  }, []);

  if (!visible) return null;

  return (
    <div
      role="banner"
      aria-label={t('pwa.installBanner')}
      className="fixed bottom-0 left-0 right-0 z-50 safe-bottom animate-in slide-in-from-bottom"
    >
      <div className="mx-auto max-w-lg p-4">
        <div className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-6">
            <div className="flex-shrink-0 rounded-xl bg-blue-50 p-2.5 dark:bg-blue-900/30">
              <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('pwa.installTitle')}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {isIOS ? t('pwa.installIosHint') : t('pwa.installDescription')}
              </p>

              {!isIOS && (
                <button
                  onClick={handleInstall}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('pwa.installButton')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
