'use client';

/**
 * AnalyticsClient - VoIP analytics with charts.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { useI18n } from '@/i18n/client';
import CallStats from '@/components/voip/CallStats';
import { formatDuration } from '@/hooks/useCallState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function AnalyticsClient() {
  const { t } = useI18n();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const { data } = useSWR(
    `/api/admin/voip/dashboard?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  if (!data) {
    return <div className="p-8 text-center text-gray-400">{t('common.loading')}...</div>;
  }

  // Prepare chart data
  const directionData = [
    { name: t('voip.callLog.inbound'), value: data.period?.inbound || 0 },
    { name: t('voip.callLog.outbound'), value: data.period?.outbound || 0 },
  ];

  const statusData = [
    { name: t('voip.status.call.completed'), value: data.period?.completed || 0 },
    { name: t('voip.status.call.missed'), value: data.period?.missed || 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('voip.analytics.title')}</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
          <span className="text-gray-400">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <CallStats
        today={data.today}
        satisfaction={data.satisfaction}
        activeAgents={data.activeAgents}
        unreadVoicemails={data.unreadVoicemails}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Direction Pie */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('voip.analytics.byDirection')}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={directionData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {directionData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status Bar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('voip.analytics.byStatus')}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Period summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('voip.analytics.periodSummary')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">{t('voip.analytics.totalCalls')}</span>
            <div className="text-xl font-bold">{data.period?.calls || 0}</div>
          </div>
          <div>
            <span className="text-gray-500">{t('voip.analytics.answerRate')}</span>
            <div className="text-xl font-bold">{data.period?.answerRate || 0}%</div>
          </div>
          <div>
            <span className="text-gray-500">{t('voip.analytics.avgDuration')}</span>
            <div className="text-xl font-bold">{formatDuration(data.period?.avgDuration || 0)}</div>
          </div>
          <div>
            <span className="text-gray-500">{t('voip.analytics.satisfaction')}</span>
            <div className="text-xl font-bold">
              {data.satisfaction?.avgScore ? `${data.satisfaction.avgScore}/5` : '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
