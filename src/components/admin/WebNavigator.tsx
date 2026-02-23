'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Maximize2, ExternalLink, Loader2, ShieldAlert } from 'lucide-react';
import { useI18n } from '@/i18n/client';

// Security: Only allow HTTPS URLs from trusted protocols
function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow https (block http, file, data, javascript, blob, etc.)
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface WebNavigatorProps {
  url: string;
  title?: string;
  subtitle?: string;
}

export function WebNavigator({ url, title, subtitle }: WebNavigatorProps) {
  const { t } = useI18n();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const urlSafe = useMemo(() => isUrlSafe(url), [url]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      setLoading(true);
      setError(false);
      iframeRef.current.src = url;
    }
  }, [url]);

  const handleOpenExternal = useCallback(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  return (
    <div className={`flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden ${
      isFullscreen ? 'fixed inset-0 z-50' : 'h-full'
    }`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 flex-shrink-0">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { try { iframeRef.current?.contentWindow?.history.back(); } catch { /* cross-origin */ } }}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            title={t('admin.webNavigator.back')}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { try { iframeRef.current?.contentWindow?.history.forward(); } catch { /* cross-origin */ } }}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            title={t('admin.webNavigator.forward')}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            title={t('admin.webNavigator.refresh')}
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0 px-2">
          <div className="text-sm font-medium text-slate-900 truncate">{title || url}</div>
          {subtitle && <div className="text-xs text-slate-500 truncate">{subtitle}</div>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            title={t('admin.webNavigator.fullscreen')}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleOpenExternal}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            title={t('admin.webNavigator.openNewTab')}
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
          </div>
        )}

        {!urlSafe ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <ShieldAlert className="w-12 h-12 text-red-400" />
            <p className="text-slate-600 text-sm font-medium">
              {t('admin.webNavigator.unsafeUrl')}
            </p>
            <p className="text-xs text-slate-400 max-w-md break-all">{url}</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <div className="text-slate-400 text-4xl">&#x1F6AB;</div>
            <p className="text-slate-600 text-sm">{t('admin.webNavigator.blockedMessage')}</p>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {t('admin.webNavigator.openNewTab')}
            </button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={url}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            title={title || 'Web Navigator'}
          />
        )}
      </div>
    </div>
  );
}
