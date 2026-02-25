'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { Monitor, Video, ExternalLink, ArrowLeft, ArrowRight, RotateCw, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { getPlatform } from '@/lib/admin/platform-config';
import { TeamsIcon, ZoomIcon, WebexIcon, GoogleMeetIcon } from '@/components/admin/icons/platform-icons';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const iconMap: Record<string, React.ComponentType<any>> = {
  teams: TeamsIcon,
  zoom: ZoomIcon,
  webex: WebexIcon,
  'google-meet': GoogleMeetIcon,
};

interface PlatformLauncherProps {
  platformId: string;
}

/**
 * PlatformLauncher — embeds communication platforms as a web browser
 * in the central content area, with a platform-branded header.
 *
 * Shows the site in an iframe (WebNavigator-style). If the site blocks
 * iframe embedding (X-Frame-Options), a helpful overlay appears with
 * "Open Desktop App" and "Open in Browser" buttons.
 */
export function PlatformLauncher({ platformId }: PlatformLauncherProps) {
  const { t } = useI18n();
  const platform = getPlatform(platformId);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Detect if iframe content was blocked (X-Frame-Options / CSP)
  // After onLoad, check if we can interact — if the iframe body is empty after
  // a short delay, the site likely blocked embedding.
  useEffect(() => {
    if (!loading && iframeRef.current) {
      const timer = setTimeout(() => {
        try {
          // Try accessing the contentDocument — will throw if cross-origin
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          iframeRef.current?.contentDocument?.title;
          // If we get here, same-origin — unlikely for external platforms
          // but let's check if body is empty (blocked scenario)
          const body = iframeRef.current?.contentDocument?.body;
          if (body && body.innerHTML.trim() === '') {
            setBlocked(true);
          }
        } catch {
          // Cross-origin: we can't tell if it loaded or was blocked
          // For known platforms that block iframes, mark as potentially blocked
          // after a reasonable timeout
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading]);

  const handleOpenDesktop = useCallback(() => {
    if (!platform?.desktopProtocol) return;
    // Use a hidden iframe to trigger the protocol handler
    // This prevents the main page from navigating away / freezing
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

  const handleRefresh = useCallback(() => {
    if (iframeRef.current && platform) {
      setLoading(true);
      setBlocked(false);
      iframeRef.current.src = platform.webUrl;
    }
  }, [platform]);

  if (!platform) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        {t('admin.platform.notFound') || 'Platform not found'}
      </div>
    );
  }

  const Icon = iconMap[platformId];
  const platformName = t(platform.nameKey);
  const platformDesc = t(platform.descKey);

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
      {/* Platform-branded header bar */}
      <div className={`flex items-center gap-3 px-4 py-2 text-white bg-gradient-to-r ${platform.color} flex-shrink-0`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {Icon && (
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Icon size={18} className="text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">{platformName}</h1>
            <p className="text-[11px] text-white/80 truncate">{platformDesc}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {platform.desktopProtocol && (
            <button
              type="button"
              onClick={handleOpenDesktop}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              aria-label={t('admin.media.openDesktopApp')}
            >
              <Monitor className="w-3.5 h-3.5" />
              {t('admin.media.openDesktopApp')}
            </button>
          )}
        </div>
      </div>

      {/* Browser toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { try { iframeRef.current?.contentWindow?.history.back(); } catch { /* cross-origin */ } }}
            className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            aria-label={t('admin.webNavigator.back')}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { try { iframeRef.current?.contentWindow?.history.forward(); } catch { /* cross-origin */ } }}
            className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            aria-label={t('admin.webNavigator.forward')}
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            aria-label={t('admin.webNavigator.refresh')}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* URL display */}
        <div className="flex-1 min-w-0 px-2">
          <div className="text-xs text-slate-500 truncate">{platform.webUrl}</div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsFullscreen(f => !f)}
            className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            aria-label={t('admin.webNavigator.fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleOpenWeb}
            className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            aria-label={t('admin.webNavigator.openNewTab')}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Iframe content area */}
      <div className="relative flex-1 bg-white">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
          </div>
        )}

        {/* Blocked overlay — shown if iframe embedding is detected as blocked */}
        {blocked && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-50/95">
            <div className="max-w-sm text-center space-y-6 p-8">
              <div className="flex justify-center">
                <div className={`w-16 h-16 rounded-2xl ${platform.iconBg} flex items-center justify-center`}>
                  {Icon ? <Icon size={32} className="text-slate-700" /> : <Video className="w-8 h-8 text-slate-500" />}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">{platformName}</h2>
                <p className="text-sm text-slate-500">
                  {t('admin.media.platformBlocked') || 'This site cannot be embedded. Use the buttons below to open it.'}
                </p>
              </div>
              <div className="space-y-2">
                {platform.desktopProtocol && (
                  <button
                    type="button"
                    onClick={handleOpenDesktop}
                    className={`w-full flex items-center justify-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium transition-all hover:shadow-lg bg-gradient-to-r ${platform.color}`}
                  >
                    <Monitor className="w-4 h-4" />
                    {t('admin.media.openDesktopApp')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenWeb}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-slate-700 bg-white border border-slate-200 rounded-xl font-medium transition-all hover:bg-slate-50 hover:shadow"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('admin.media.useWebVersion')}
                </button>
              </div>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={platform.webUrl}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setBlocked(true); }}
          title={platformName}
        />
      </div>
    </div>
  );
}
