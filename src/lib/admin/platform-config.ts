/**
 * Communication platform configuration registry.
 * Central source of truth for platform URLs, protocols, and metadata.
 */

export interface PlatformConfig {
  id: string;
  nameKey: string;        // i18n key for admin.media.platform{Name}
  descKey: string;        // i18n key for admin.media.platform{Name}Desc
  webUrl: string;
  desktopProtocol: string | null; // null = no desktop app
  color: string;          // Tailwind gradient (used for buttons)
  bgColor: string;        // Solid bg for fallback
  iconBg: string;         // Icon background color
  logoImage: string;      // Path to real platform logo in /public/images/platforms/
}

export const platforms: Record<string, PlatformConfig> = {
  teams: {
    id: 'teams',
    nameKey: 'admin.media.platformTeams',
    descKey: 'admin.media.platformTeamsDesc',
    webUrl: 'https://teams.microsoft.com',
    desktopProtocol: 'msteams://',
    color: 'from-indigo-600 to-violet-600',
    bgColor: 'bg-indigo-600',
    iconBg: 'bg-indigo-100',
    logoImage: '/images/platforms/teams.png',
  },
  zoom: {
    id: 'zoom',
    nameKey: 'admin.media.platformZoom',
    descKey: 'admin.media.platformZoomDesc',
    webUrl: 'https://zoom.us/signin',
    desktopProtocol: 'zoommtg://zoom.us/start',
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-500',
    iconBg: 'bg-blue-100',
    logoImage: '/images/platforms/zoom.png',
  },
  webex: {
    id: 'webex',
    nameKey: 'admin.media.platformWebex',
    descKey: 'admin.media.platformWebexDesc',
    webUrl: 'https://web.webex.com',
    desktopProtocol: 'webex://',
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-500',
    iconBg: 'bg-emerald-100',
    logoImage: '/images/platforms/webex.png',
  },
  'google-meet': {
    id: 'google-meet',
    nameKey: 'admin.media.platformGoogleMeet',
    descKey: 'admin.media.platformGoogleMeetDesc',
    webUrl: 'https://meet.google.com',
    desktopProtocol: null,
    color: 'from-teal-600 to-green-600',
    bgColor: 'bg-teal-600',
    iconBg: 'bg-teal-100',
    logoImage: '/images/platforms/google-meet.png',
  },
};

export function getPlatform(id: string): PlatformConfig | undefined {
  return platforms[id];
}
