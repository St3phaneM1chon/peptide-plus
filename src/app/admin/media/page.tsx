'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Video, MessageCircle, Users, Search, Activity, Globe, Briefcase,
  Image as ImageIcon, FolderOpen, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import Link from 'next/link';

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

export default function MediaDashboardPage() {
  const { t } = useI18n();
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [loading, setLoading] = useState(true);

  const platformDefs = [
    { key: 'zoom', label: 'Zoom', icon: <Video className="w-5 h-5" />, href: '/admin/media/api-zoom', color: 'bg-blue-500' },
    { key: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="w-5 h-5" />, href: '/admin/media/api-whatsapp', color: 'bg-green-500' },
    { key: 'teams', label: 'Teams', icon: <Users className="w-5 h-5" />, href: '/admin/media/api-teams', color: 'bg-purple-500' },
    { key: 'youtube', label: 'YouTube', icon: <Video className="w-5 h-5" />, href: '/admin/media/pub-youtube', color: 'bg-red-500' },
    { key: 'meta', label: 'Meta (FB/IG)', icon: <Globe className="w-5 h-5" />, href: '/admin/media/pub-meta', color: 'bg-blue-600' },
    { key: 'x', label: 'X (Twitter)', icon: <MessageCircle className="w-5 h-5" />, href: '/admin/media/pub-x', color: 'bg-slate-800' },
    { key: 'tiktok', label: 'TikTok', icon: <Activity className="w-5 h-5" />, href: '/admin/media/pub-tiktok', color: 'bg-pink-500' },
    { key: 'google', label: 'Google Ads', icon: <Search className="w-5 h-5" />, href: '/admin/media/pub-google', color: 'bg-yellow-500' },
    { key: 'linkedin', label: 'LinkedIn', icon: <Briefcase className="w-5 h-5" />, href: '/admin/media/pub-linkedin', color: 'bg-blue-700' },
  ];

  useEffect(() => {
    const loadAll = async () => {
      // Load platform statuses in parallel
      const statusPromises = platformDefs.map(async (p) => {
        try {
          const res = await fetch(`/api/admin/integrations/${p.key}`);
          if (!res.ok) return { ...p, enabled: null };
          const data = await res.json();
          return { ...p, enabled: data.enabled || false };
        } catch {
          return { ...p, enabled: null };
        }
      });

      // Load media stats
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <h1 className="text-2xl font-bold text-slate-900">{t('admin.media.dashboardTitle')}</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<FolderOpen className="w-5 h-5" />} label={t('admin.media.libraryTitle')} value={stats?.totalMedia || 0} color="text-sky-600" />
        <StatCard icon={<Video className="w-5 h-5" />} label={t('admin.media.videosTitle')} value={stats?.totalVideos || 0} color="text-red-600" />
        <StatCard icon={<ImageIcon className="w-5 h-5" />} label={t('admin.media.imagesTitle')} value={stats?.imageCount || 0} color="text-emerald-600" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label={t('admin.integrations.connected')} value={`${enabledCount}/${configuredCount}`} color="text-green-600" />
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
