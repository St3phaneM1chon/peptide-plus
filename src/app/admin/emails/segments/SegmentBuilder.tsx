'use client';

import { useState, useEffect } from 'react';
import { Users, Crown, Mail, Globe, TrendingUp, TrendingDown, UserPlus, Zap } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface Segment {
  id: string;
  name: string;
  description: string;
  color: string;
  count: number;
  type: 'rfm' | 'builtin' | 'custom';
}

export default function SegmentBuilder() {
  const { t } = useI18n();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      const res = await fetch('/api/admin/emails/segments');
      if (res.ok) {
        const data = await res.json();
        setSegments(data.segments || []);
        setTotalUsers(data.totalUsers || 0);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32" role="status" aria-label="Loading"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500" /><span className="sr-only">Loading...</span></div>;
  }

  const rfmSegments = segments.filter(s => s.type === 'rfm');
  const builtinSegments = segments.filter(s => s.type === 'builtin');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t('admin.emails.segments.title')}</h3>
          <p className="text-sm text-slate-500">{totalUsers} {t('admin.emails.segments.totalUsers')}</p>
        </div>
      </div>

      {/* RFM Segmentation */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-sky-500" />
          {t('admin.emails.segments.rfmTitle')}
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {rfmSegments.map((segment) => (
            <div
              key={segment.id}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-sky-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <h5 className="font-semibold text-slate-900 text-sm">{segment.name}</h5>
                </div>
                <span className="text-lg font-bold text-slate-900">{segment.count}</span>
              </div>
              <p className="text-xs text-slate-500">{segment.description}</p>
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${totalUsers > 0 ? (segment.count / totalUsers * 100) : 0}%`,
                    backgroundColor: segment.color,
                  }}
                />
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {totalUsers > 0 ? (segment.count / totalUsers * 100).toFixed(1) : 0}% {t('admin.emails.segments.ofTotal')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Built-in segments */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-sky-500" />
          {t('admin.emails.segments.builtinTitle')}
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {builtinSegments.map((segment) => {
            const Icon = segment.id === 'vip-tier' ? Crown :
                         segment.id === 'newsletter' ? Mail :
                         segment.id.startsWith('locale') ? Globe : Users;

            return (
              <div
                key={segment.id}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:border-sky-300 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: segment.color }} />
                    <h5 className="font-semibold text-slate-900 text-sm">{segment.name}</h5>
                  </div>
                  <span className="text-lg font-bold text-slate-900">{segment.count}</span>
                </div>
                <p className="text-xs text-slate-500">{segment.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-sky-50 rounded-xl border border-sky-200 p-4">
        <h4 className="text-sm font-semibold text-sky-900 mb-1 flex items-center gap-2">
          <Zap className="h-4 w-4 text-sky-500" />
          {t('admin.emails.segments.rfmInfoTitle')}
        </h4>
        <p className="text-xs text-sky-700">
          {t('admin.emails.segments.rfmInfoDesc')}
        </p>
      </div>
    </div>
  );
}
