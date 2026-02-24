'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Monitor } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { getPlatform } from '@/lib/admin/platform-config';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { WebNavigator } from '@/components/admin/WebNavigator';
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

export function PlatformLauncher({ platformId }: PlatformLauncherProps) {
  const { t } = useI18n();
  const platform = getPlatform(platformId);
  const [showDialog, setShowDialog] = useState(false);
  const [showWeb, setShowWeb] = useState(false);

  // Show desktop app dialog on mount if platform has a desktop protocol
  useEffect(() => {
    if (platform?.desktopProtocol) {
      setShowDialog(true);
    } else {
      setShowWeb(true);
    }
  }, [platform?.desktopProtocol]);

  const handleOpenDesktop = useCallback(() => {
    if (!platform?.desktopProtocol) return;
    setShowDialog(false);
    // Try to open the desktop app via protocol handler
    window.location.href = platform.desktopProtocol;
    // Fallback to web version after 1.5s if the protocol didn't launch anything
    setTimeout(() => {
      setShowWeb(true);
    }, 1500);
  }, [platform]);

  const handleUseWeb = useCallback(() => {
    setShowDialog(false);
    setShowWeb(true);
  }, []);

  const handleOpenDesktopFromHeader = useCallback(() => {
    if (!platform?.desktopProtocol) return;
    window.location.href = platform.desktopProtocol;
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

  return (
    <div className="flex flex-col h-full">
      {/* Desktop App Dialog */}
      <ConfirmDialog
        isOpen={showDialog}
        title={t('admin.media.desktopAppDialogTitle')}
        message={t('admin.media.desktopAppDialogMessage')}
        confirmLabel={t('admin.media.openDesktopApp')}
        cancelLabel={t('admin.media.useWebVersion')}
        onConfirm={handleOpenDesktop}
        onCancel={handleUseWeb}
        variant="info"
      />

      {/* Header bar */}
      <div className={`flex items-center gap-3 px-4 py-3 text-white bg-gradient-to-r ${platform.color} flex-shrink-0`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Icon size={20} className="text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">{platformName}</h1>
            <p className="text-xs text-white/80 truncate">{t(platform.descKey)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {platform.desktopProtocol && (
            <button
              type="button"
              onClick={handleOpenDesktopFromHeader}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <Monitor className="w-3.5 h-3.5" />
              {t('admin.media.openDesktopApp')}
            </button>
          )}
          <a
            href={platform.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t('admin.media.useWebVersion')}
          </a>
        </div>
      </div>

      {/* Web content */}
      {showWeb && (
        <div className="flex-1 min-h-0">
          <WebNavigator
            url={platform.webUrl}
            title={platformName}
            subtitle={t(platform.descKey)}
          />
        </div>
      )}
    </div>
  );
}
