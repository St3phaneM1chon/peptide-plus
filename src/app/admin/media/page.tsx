'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Video, MessageCircle, Users, Search, Activity, Globe, Briefcase,
  Image as ImageIcon, FolderOpen, CheckCircle2, XCircle, Loader2, Monitor, Upload,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { TeamsIcon, ZoomIcon, WebexIcon, GoogleMeetIcon } from '@/components/admin/icons/platform-icons';
import { platforms } from '@/lib/admin/platform-config';

interface PlatformStatus {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  enabled: boolean | null; // null = loading
}

interface MediaStats {
  totalMedia: number;
  totalVideos: number;
  imageCount: number;
  videoFileCount: number;
  pdfCount: number;
}

const PLATFORM_LAUNCHERS = [
  { id: 'teams', href: '/admin/media/launch-teams', icon: TeamsIcon, gradient: platforms.teams.color, nameKey: platforms.teams.nameKey, descKey: platforms.teams.descKey, hasDesktop: true },
  { id: 'zoom', href: '/admin/media/launch-zoom', icon: ZoomIcon, gradient: platforms.zoom.color, nameKey: platforms.zoom.nameKey, descKey: platforms.zoom.descKey, hasDesktop: true },
  { id: 'webex', href: '/admin/media/launch-webex', icon: WebexIcon, gradient: platforms.webex.color, nameKey: platforms.webex.nameKey, descKey: platforms.webex.descKey, hasDesktop: true },
  { id: 'google-meet', href: '/admin/media/launch-google-meet', icon: GoogleMeetIcon, gradient: platforms['google-meet'].color, nameKey: platforms['google-meet'].nameKey, descKey: platforms['google-meet'].descKey, hasDesktop: false },
];

// F60 FIX: Move platformDefs outside component to avoid recreating on every render
const PLATFORM_DEFS = [
  { key: 'zoom', label: 'Zoom', href: '/admin/media/api-zoom', color: 'bg-blue-500', IconComp: Video },
  { key: 'whatsapp', label: 'WhatsApp', href: '/admin/media/api-whatsapp', color: 'bg-green-500', IconComp: MessageCircle },
  { key: 'teams', label: 'Teams', href: '/admin/media/api-teams', color: 'bg-purple-500', IconComp: Users },
  { key: 'youtube', label: 'YouTube', href: '/admin/media/pub-youtube', color: 'bg-red-500', IconComp: Video },
  { key: 'meta', label: 'Meta (FB/IG)', href: '/admin/media/pub-meta', color: 'bg-blue-600', IconComp: Globe },
  { key: 'x', label: 'X (Twitter)', href: '/admin/media/pub-x', color: 'bg-slate-800', IconComp: MessageCircle },
  { key: 'tiktok', label: 'TikTok', href: '/admin/media/pub-tiktok', color: 'bg-pink-500', IconComp: Activity },
  { key: 'google', label: 'Google Ads', href: '/admin/media/pub-google', color: 'bg-yellow-500', IconComp: Search },
  { key: 'linkedin', label: 'LinkedIn', href: '/admin/media/pub-linkedin', color: 'bg-blue-700', IconComp: Briefcase },
];

export default function MediaDashboardPage() {
  const { t } = useI18n();
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadAll = async () => {
      // Load platform statuses in parallel
      const statusPromises = PLATFORM_DEFS.map(async (p) => {
        try {
          const res = await fetch(`/api/admin/integrations/${p.key}`);
          const icon = <p.IconComp className="w-5 h-5" />;
          if (!res.ok) return { ...p, icon, enabled: null };
          const data = await res.json();
          return { ...p, icon, enabled: data.enabled || false };
        } catch {
          return { ...p, icon: <p.IconComp className="w-5 h-5" />, enabled: null };
        }
      });

      // FIX: F52 - TODO: Create a single /api/admin/medias/stats endpoint that aggregates all counts in one DB query
      // Load media stats (currently 5 separate requests)
      const statsPromise = Promise.all([
        fetch('/api/admin/medias?limit=1').then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
        fetch('/api/admin/videos?limit=1').then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
        fetch('/api/admin/medias?mimeType=image&limit=1').then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
        fetch('/api/admin/medias?mimeType=video&limit=1').then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
        fetch('/api/admin/medias?mimeType=application/pdf&limit=1').then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
      ]);

      const [statuses, [mediaRes, videoRes, imgRes, vidFileRes, pdfRes]] = await Promise.all([
        Promise.all(statusPromises),
        statsPromise,
      ]);

      setPlatforms(statuses);
      setStats({
        totalMedia: mediaRes.pagination?.total || 0,
        totalVideos: videoRes.pagination?.total || 0,
        imageCount: imgRes.pagination?.total || 0,
        videoFileCount: vidFileRes.pagination?.total || 0,
        pdfCount: pdfRes.pagination?.total || 0,
      });
      setLoading(false);
    };

    loadAll();
  }, []);

  // ---- Upload handler for dashboard-level upload ----
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      formData.append('folder', 'general');
      const res = await fetch('/api/admin/medias', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.count || 1} ${t('admin.media.uploadSuccess') || 'file(s) uploaded'}`);
        // Refresh stats
        const mediaRes = await fetch('/api/admin/medias?limit=1').then(r => r.json()).catch(() => ({ pagination: { total: 0 } }));
        setStats(prev => prev ? { ...prev, totalMedia: mediaRes.pagination?.total || prev.totalMedia } : prev);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.media.uploadFailed') || 'Upload failed');
      }
    } catch {
      toast.error(t('admin.media.uploadFailed') || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---- Ribbon action handlers (media section-level: upload, delete, play, export) ----
  const handleUploadRibbon = useCallback(() => { fileInputRef.current?.click(); }, []);
  const handleDeleteRibbon = useCallback(() => toast.info(t('admin.media.deleteHint') || 'Navigate to Images, Videos, or Library to select and delete files.'), [t]);
  const handlePlayRibbon = useCallback(() => toast.info(t('admin.media.playHint') || 'Navigate to Videos to play a video.'), [t]);
  const handleExportRibbon = useCallback(() => toast.info(t('admin.media.exportHint') || 'Navigate to Images, Videos, or Library to export data as CSV.'), [t]);

  useRibbonAction('upload', handleUploadRibbon);
  useRibbonAction('delete', handleDeleteRibbon);
  useRibbonAction('play', handlePlayRibbon);
  useRibbonAction('export', handleExportRibbon);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  const enabledCount = platforms.filter(p => p.enabled === true).length;
  const configuredCount = platforms.filter(p => p.enabled !== null).length;

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.media.dashboardTitle')}</h1>
        <div>
          <input ref={fileInputRef} type="file" multiple onChange={handleUpload} aria-label={t('admin.media.upload') || 'Upload files'} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {t('admin.media.upload') || 'Upload'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<FolderOpen className="w-5 h-5" />} label={t('admin.media.libraryTitle')} value={stats?.totalMedia || 0} color="text-sky-600" />
        <StatCard icon={<Video className="w-5 h-5" />} label={t('admin.media.videosTitle')} value={stats?.totalVideos || 0} color="text-red-600" />
        <StatCard icon={<ImageIcon className="w-5 h-5" />} label={t('admin.media.imagesTitle')} value={stats?.imageCount || 0} color="text-emerald-600" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label={t('admin.integrations.connected')} value={`${enabledCount}/${configuredCount}`} color="text-green-600" />
      </div>

      {/* Communication Platforms - Launch directly */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">{t('admin.nav.mediaPlatforms')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLATFORM_LAUNCHERS.map((p) => (
            <Link key={p.id} href={p.href} className="group">
              <div className={`flex items-center gap-3 p-4 bg-gradient-to-r ${p.gradient} rounded-lg text-white hover:opacity-90 transition-opacity`}>
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <p.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t(p.nameKey)}</p>
                  <p className="text-xs text-white/70 truncate">{t(p.descKey)}</p>
                </div>
                {p.hasDesktop && <Monitor className="w-4 h-4 text-white/50 flex-shrink-0" />}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Platform integrations grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">{t('admin.nav.mediaAPIs')} & {t('admin.nav.mediaAds')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {platforms.map((p) => (
            <Link key={p.key} href={p.href} className="group">
              <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-sky-300 hover:shadow-sm transition-all">
                <div className={`w-10 h-10 rounded-lg ${p.color} flex items-center justify-center text-white`}>
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{p.label}</p>
                  <div className="flex items-center gap-1 text-xs">
                    {p.enabled === null ? (
                      <span className="text-slate-400">{t('admin.media.comingSoon')}</span>
                    ) : p.enabled ? (
                      <><CheckCircle2 className="w-3 h-3 text-green-500" /><span className="text-green-600">{t('admin.integrations.connected')}</span></>
                    ) : (
                      <><XCircle className="w-3 h-3 text-slate-300" /><span className="text-slate-400">{t('admin.integrations.connectionFailed')}</span></>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick links to media management */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">{t('admin.nav.mediaManagement')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickLink href="/admin/media/videos" icon={<Video className="w-6 h-6" />} label={t('admin.media.videosTitle')} desc={t('admin.media.videosDesc')} />
          <QuickLink href="/admin/media/images" icon={<ImageIcon className="w-6 h-6" />} label={t('admin.media.imagesTitle')} desc={t('admin.media.imagesDesc')} />
          <QuickLink href="/admin/media/library" icon={<FolderOpen className="w-6 h-6" />} label={t('admin.media.libraryTitle')} desc={t('admin.media.libraryDesc')} />
        </div>
      </div>
    </div>
  );
}

// FIX: F85 - Local StatCard shadows admin StatCard; different props so intentional.
// FIX: F84 - TODO: Extract QuickLink to src/components/admin/QuickLink.tsx for reuse
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className={`flex items-center gap-2 ${color} mb-1`}>{icon}<span className="text-sm font-medium">{label}</span></div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function QuickLink({ href, icon, label, desc }: { href: string; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <Link href={href}>
      <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-sky-300 hover:shadow-sm transition-all">
        <div className="text-sky-600 mt-0.5">{icon}</div>
        <div>
          <p className="font-medium text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
