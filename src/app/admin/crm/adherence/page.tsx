'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  ShieldCheck, Clock, Users, RefreshCw, Calendar, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RealtimeAgent {
  agentId: string;
  agentName: string;
  agentEmail: string | null;
  agentImage: string | null;
  scheduledActivity: string | null;
  actualStatus: string;
  state: 'IN_ADHERENCE' | 'OUT_OF_ADHERENCE';
  reason: string | null;
  adherenceRate: number;
}

interface HistoricalAgent {
  agentId: string;
  agentName: string;
  agentImage: string | null;
  scheduledShift: string;
  adherenceRate: number;
  isOff: boolean;
}

interface HistoricalData {
  date: string;
  agents: HistoricalAgent[];
  teamAverage: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Status Badge Component
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ONLINE: 'bg-green-100 text-green-700',
    BUSY: 'bg-yellow-100 text-yellow-700',
    DND: 'bg-red-100 text-red-700',
    AWAY: 'bg-orange-100 text-orange-700',
    OFFLINE: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Adherence Indicator
// ---------------------------------------------------------------------------

function AdherenceIndicator({ state }: { state: 'IN_ADHERENCE' | 'OUT_OF_ADHERENCE' }) {
  return state === 'IN_ADHERENCE' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      In Adherence
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
      Out of Adherence
    </span>
  );
}

// ---------------------------------------------------------------------------
// Percentage Bar
// ---------------------------------------------------------------------------

function PercentageBar({ value }: { value: number }) {
  const color = value >= 90 ? 'bg-green-500' : value >= 70 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{value}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdherencePage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'realtime' | 'historical'>('realtime');
  const [realtimeData, setRealtimeData] = useState<RealtimeAgent[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch realtime adherence
  const fetchRealtime = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/adherence?mode=realtime');
      const json = await res.json();
      if (json.success) {
        setRealtimeData(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      toast.error('Failed to load realtime adherence');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch historical adherence
  const fetchHistorical = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/crm/adherence?mode=historical&date=${formatDate(selectedDate)}`);
      const json = await res.json();
      if (json.success) {
        setHistoricalData(json.data);
      }
    } catch {
      toast.error('Failed to load historical adherence');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Initial load + auto-refresh for realtime
  useEffect(() => {
    if (tab === 'realtime') {
      fetchRealtime();
      if (autoRefresh) {
        intervalRef.current = setInterval(fetchRealtime, 30000);
      }
    } else {
      fetchHistorical();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tab, fetchRealtime, fetchHistorical, autoRefresh]);

  // Summary stats
  const inAdherenceCount = realtimeData.filter(a => a.state === 'IN_ADHERENCE').length;
  const outCount = realtimeData.filter(a => a.state === 'OUT_OF_ADHERENCE').length;
  const _avgRate = realtimeData.length > 0
    ? Math.round(realtimeData.reduce((s, a) => s + a.adherenceRate, 0) / realtimeData.length)
    : 0;
  void _avgRate; // Used for future summary display

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            {t('admin.crm.adherence.title') || 'Adherence Monitoring'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.adherence.subtitle') || 'Track agent adherence to scheduled shifts in real-time'}
          </p>
        </div>
        {tab === 'realtime' && (
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
              autoRefresh
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('realtime')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'realtime' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {t('admin.crm.adherence.realtime') || 'Real-time'}
          </span>
        </button>
        <button
          onClick={() => setTab('historical')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'historical' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {t('admin.crm.adherence.historical') || 'Historical'}
          </span>
        </button>
      </div>

      {/* Realtime Tab */}
      {tab === 'realtime' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Users className="h-4 w-4" />
                {t('admin.crm.adherence.totalAgents') || 'Total Agents'}
              </div>
              <div className="text-2xl font-bold text-gray-900">{realtimeData.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4">
              <div className="text-sm text-green-600 mb-1">
                {t('admin.crm.adherence.inAdherence') || 'In Adherence'}
              </div>
              <div className="text-2xl font-bold text-green-700">{inAdherenceCount}</div>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <div className="text-sm text-red-600 mb-1">
                {t('admin.crm.adherence.outOfAdherence') || 'Out of Adherence'}
              </div>
              <div className="text-2xl font-bold text-red-700">{outCount}</div>
            </div>
          </div>

          {/* Agent Table */}
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : realtimeData.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <ShieldCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">
                {t('admin.crm.adherence.noAgents') || 'No agents scheduled today'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {t('admin.crm.adherence.noAgentsDesc') || 'Add schedules in the Scheduling page to see adherence data.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      {t('admin.crm.adherence.agent') || 'Agent'}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      {t('admin.crm.adherence.scheduled') || 'Scheduled'}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      {t('admin.crm.adherence.status') || 'Status'}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      {t('admin.crm.adherence.adherence') || 'Adherence'}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      {t('admin.crm.adherence.reason') || 'Reason'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {realtimeData.map((agent) => (
                    <tr key={agent.agentId} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {agent.agentImage ? (
                            <Image src={agent.agentImage} alt="" width={40} height={40} className="h-7 w-7 rounded-full" unoptimized />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                              {agent.agentName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900">{agent.agentName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {agent.scheduledActivity ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={agent.actualStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <AdherenceIndicator state={agent.state} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {agent.reason ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Historical Tab */}
      {tab === 'historical' && (
        <>
          {/* Date picker */}
          <div className="flex items-center gap-3 mb-6 bg-white rounded-xl border border-gray-200 p-3 w-fit">
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={formatDate(selectedDate)}
              onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(d);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-500">{formatDateDisplay(selectedDate)}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : historicalData ? (
            <>
              {/* Team average card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                <div className="text-sm text-gray-500 mb-2">
                  {t('admin.crm.adherence.teamAverage') || 'Team Average Adherence'}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-bold text-gray-900">{historicalData.teamAverage}%</span>
                  <div className="flex-1 max-w-md">
                    <PercentageBar value={historicalData.teamAverage} />
                  </div>
                </div>
              </div>

              {/* Bar chart */}
              {historicalData.agents.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">
                    {t('admin.crm.adherence.adherenceByAgent') || 'Adherence by Agent'}
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={historicalData.agents.filter(a => !a.isOff)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="agentName" width={120} tick={{ fontSize: 12 }} />
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <Tooltip formatter={(value: any) => [`${value}%`, 'Adherence']} />
                      <Bar dataKey="adherenceRate" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {historicalData.agents.filter(a => !a.isOff).map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.adherenceRate >= 90 ? '#22c55e' : entry.adherenceRate >= 70 ? '#eab308' : '#ef4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Agent detail table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                        {t('admin.crm.adherence.agent') || 'Agent'}
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                        {t('admin.crm.adherence.shift') || 'Shift'}
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-48">
                        {t('admin.crm.adherence.adherenceRate') || 'Adherence Rate'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicalData.agents.map((agent) => (
                      <tr key={agent.agentId} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {agent.agentImage ? (
                              <Image src={agent.agentImage} alt="" width={40} height={40} className="h-7 w-7 rounded-full" unoptimized />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                {agent.agentName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-900">{agent.agentName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{agent.scheduledShift}</td>
                        <td className="px-4 py-3">
                          {agent.isOff ? (
                            <span className="text-xs text-gray-400">Day Off</span>
                          ) : (
                            <PercentageBar value={agent.adherenceRate} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">
                {t('admin.crm.adherence.noData') || 'No data for this date'}
              </h3>
            </div>
          )}
        </>
      )}
    </div>
  );
}
