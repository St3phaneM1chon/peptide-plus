'use client';

import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user already dismissed the prompt
    const dismissedUntil = localStorage.getItem('pwa-install-dismissed-until');
    if (dismissedUntil && new Date().getTime() < parseInt(dismissedUntil)) {
      return;
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();

      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Show the banner after a short delay (better UX)
      setTimeout(() => {
        setShowBanner(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app was successfully installed
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed successfully');
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User response to install prompt: ${outcome}`);

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowBanner(false);

    if (outcome === 'dismissed') {
      // User dismissed - don't show again for 30 days
      const thirtyDaysFromNow = new Date().getTime() + (30 * 24 * 60 * 60 * 1000);
      localStorage.setItem('pwa-install-dismissed-until', thirtyDaysFromNow.toString());
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);

    // Don't show again for 7 days
    const sevenDaysFromNow = new Date().getTime() + (7 * 24 * 60 * 60 * 1000);
    localStorage.setItem('pwa-install-dismissed-until', sevenDaysFromNow.toString());
  };

  if (!showBanner || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-slide-up">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 p-4">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-white/80 hover:text-white transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 bg-white/20 rounded-full p-2">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-white">
              <h3 className="font-bold text-lg mb-1">Install BioCycle App</h3>
              <p className="text-sm text-white/90">
                Get faster access and a better shopping experience
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50">
          <ul className="space-y-2 mb-4 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <span className="text-orange-500">✓</span>
              <span>Quick access from your home screen</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-orange-500">✓</span>
              <span>Faster performance</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-orange-500">✓</span>
              <span>Works offline</span>
            </li>
          </ul>

          <div className="flex gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Install Now
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
