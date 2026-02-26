'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { Monitor, Video, ExternalLink } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { getPlatform } from '@/lib/admin/platform-config';

interface PlatformLauncherProps {
  platformId: string;
}

/**
 * PlatformLauncher — shows a clean platform landing page with real logo,
 * title, description, and action buttons to open in desktop app or browser.
 *
 * External platforms (Teams, Zoom, Webex, Google Meet) all block iframe
 * embedding via X-Frame-Options/CSP. Instead of showing a broken iframe,
 * we present a polished landing page with direct launch buttons.
 */
export function PlatformLauncher({ platformId }: PlatformLauncherProps) {
  const { t } = useI18n();
  const platform = getPlatform(platformId);
  const [hovered, setHovered] = useState(false);

  const handleOpenDesktop = useCallback(() => {
    if (!platform?.desktopProtocol) return;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = platform.desktopProtocol;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch { /* already removed */ }
    }, 3000);
  }, [platform]);

  const handleOpenWeb = useCallback(() => {
    if (!platform?.webUrl) return;
    window.open(platform.webUrl, '_blank', 'noopener,noreferrer');
  }, [platform]);

  if (!platform) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        {t('admin.platform.notFound') || 'Platform not found'}
      </div>
    );
  }

  const platformName = t(platform.nameKey);
  const platformDesc = t(platform.descKey);

  return (
    <div className="flex flex-col h-full">
      {/* Header — white background, real logo, black text */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div
            className="w-10 h-10 flex-shrink-0 transition-transform duration-300 ease-out"
            style={{ transform: hovered ? 'scale(1.1)' : 'scale(1)' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <Image
              src={platform.logoImage}
              alt={platformName}
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900 truncate">{platformName}</h1>
            <p className="text-sm text-slate-500 truncate">{platformDesc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {platform.desktopProtocol && (
            <button
              type="button"
              onClick={handleOpenDesktop}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-all hover:shadow-lg ${platform.color}`}
              aria-label={t('admin.media.openDesktopApp')}
            >
              <Monitor className="w-4 h-4" />
              {t('admin.media.openDesktopApp')}
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenWeb}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg transition-all hover:bg-slate-50 hover:shadow"
            aria-label={t('admin.media.useWebVersion')}
          >
            <ExternalLink className="w-4 h-4" />
            {t('admin.media.useWebVersion')}
          </button>
        </div>
      </div>

      {/* Main content — centered logo and launch area */}
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="max-w-md text-center space-y-8 p-8">
          <div className="flex justify-center">
            <Image
              src={platform.logoImage}
              alt={platformName}
              width={96}
              height={96}
              className="w-24 h-24 object-contain drop-shadow-sm"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{platformName}</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              {platformDesc}
            </p>
          </div>
          <div className="space-y-3">
            {platform.desktopProtocol && (
              <button
                type="button"
                onClick={handleOpenDesktop}
                className={`w-full flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl font-medium transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] ${platform.color}`}
              >
                <Monitor className="w-5 h-5" />
                {t('admin.media.openDesktopApp')}
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenWeb}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 text-slate-700 bg-white border border-slate-200 rounded-xl font-medium transition-all hover:bg-slate-50 hover:shadow hover:scale-[1.02] active:scale-[0.98]"
            >
              <ExternalLink className="w-5 h-5" />
              {t('admin.media.useWebVersion')}
            </button>
          </div>
          <p className="text-xs text-slate-400">
            {t('admin.media.platformExternalNote') || 'This platform opens in a separate window for security.'}
          </p>
        </div>
      </div>
    </div>
  );
}
