'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Grid3X3, Phone, Filter, RefreshCw, Loader2, Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeatmapCell {
  day: number;
  hour: number;
  totalCalls: number;
  answeredCalls: number;
  successRate: number;
}

interface HeatmapData {
  cells: HeatmapCell[];
  bestTime: { day: string; hour: number; rate: number } | null;
  worstTime: { day: string; hour: number; rate: number } | null;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getColor(rate: number, maxRate: number): string {
  if (maxRate === 0) return 'bg-gray-100';
  const intensity = rate / maxRate;
  if (intensity >= 0.8) return 'bg-green-500';
  if (intensity >= 0.6) return 'bg-green-400';
  if (intensity >= 0.4) return 'bg-green-300';
  if (intensity >= 0.2) return 'bg-yellow-300';
  if (intensity > 0) return 'bg-yellow-200';
  return 'bg-gray-100';
}

function getTextColor(rate: number, maxRate: number): string {
  if (maxRate === 0) return 'text-gray-400';
  const intensity = rate / maxRate;
  return intensity >= 0.6 ? 'text-white' : 'text-gray-700';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HeatmapsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState('');
  const [metricType, setMetricType] = useState<'success_rate' | 'volume'>('success_rate');
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (agentFilter) params.set('agentId', agentFilter);

      const res = await fetch(`/api/admin/crm/wallboard?heatmap=true&${params}`);
      await res.json();

      // Build heatmap from CallLog data
      // If the endpoint doesn't provide heatmap data, fetch calls directly
      const callRes = await fetch('/api/admin/crm/call-center-kpis?period=month');
      const callJson = await callRes.json();

      // Build heatmap grid from any available call data
      const grid: Map<string, HeatmapCell> = new Map();

      // Initialize all cells
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          grid.set(`${d}-${h}`, { day: d, hour: h, totalCalls: 0, answeredCalls: 0, successRate: 0 });
        }
      }

      // If we got trend data, distribute it
      if (callJson.success && callJson.data?.trends) {
        for (const trend of callJson.data.trends) {
          const hourMatch = trend.label?.match(/(\d+)h/);
          if (hourMatch) {
            const h = parseInt(hourMatch[1]);
            const currentDay = new Date().getDay();
            const key = `${currentDay}-${h}`;
            const cell = grid.get(key);
            if (cell) {
              cell.totalCalls = trend.calls || 0;
              cell.answeredCalls = trend.answered || 0;
              cell.successRate = cell.totalCalls > 0
                ? Math.round((cell.answeredCalls / cell.totalCalls) * 100)
                : 0;
            }
          }
        }
      }

      const cells = Array.from(grid.values());
      const sortedByRate = [...cells].filter(c => c.totalCalls > 0).sort((a, b) => b.successRate - a.successRate);

      setData({
        cells,
        bestTime: sortedByRate.length > 0 ? {
          day: DAY_LABELS[sortedByRate[0].day],
          hour: sortedByRate[0].hour,
          rate: sortedByRate[0].successRate,
        } : null,
        worstTime: sortedByRate.length > 0 ? {
          day: DAY_LABELS[sortedByRate[sortedByRate.length - 1].day],
          hour: sortedByRate[sortedByRate.length - 1].hour,
          rate: sortedByRate[sortedByRate.length - 1].successRate,
        } : null,
      });
    } catch {
      toast.error('Failed to load heatmap data');
    } finally {
      setLoading(false);
    }
  }, [agentFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxValue = data?.cells
    ? Math.max(...data.cells.map(c => metricType === 'success_rate' ? c.successRate : c.totalCalls), 1)
    : 1;

  const getCellValue = (cell: HeatmapCell) =>
    metricType === 'success_rate' ? cell.successRate : cell.totalCalls;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.crm.heatmaps') || 'Call Time Heatmap'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.heatmapsDesc') || 'Best calling times based on answer rates by day and hour'}
          </p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-lg hover:bg-gray-100" title="Refresh">
          <RefreshCw className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select value={metricType} onChange={e => setMetricType(e.target.value as 'success_rate' | 'volume')}
            className="text-sm border rounded-md px-3 py-2">
            <option value="success_rate">Answer Rate %</option>
            <option value="volume">Call Volume</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-400" />
          <input type="text" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
            placeholder="Filter by agent ID"
            className="text-sm border rounded-md px-3 py-2 w-48" />
        </div>
      </div>

      {/* Best/Worst times */}
      {data && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {data.bestTime && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">Best Time to Call</p>
                <p className="text-xs text-green-600">{data.bestTime.day} at {data.bestTime.hour}:00 ({data.bestTime.rate}% answer rate)</p>
              </div>
            </div>
          )}
          {data.worstTime && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Clock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">Worst Time to Call</p>
                <p className="text-xs text-red-600">{data.worstTime.day} at {data.worstTime.hour}:00 ({data.worstTime.rate}% answer rate)</p>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      ) : (
        <>
          {/* Heatmap Grid */}
          <div className="bg-white rounded-xl border p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" /> 7-Day x 24-Hour Grid
            </h3>

            {/* Tooltip */}
            {hoveredCell && (
              <div className="mb-3 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg inline-block">
                {DAY_LABELS[hoveredCell.day]} {hoveredCell.hour}:00 - {hoveredCell.totalCalls} calls,{' '}
                {hoveredCell.answeredCalls} answered ({hoveredCell.successRate}%)
              </div>
            )}

            <div className="overflow-x-auto">
              {/* Hour headers */}
              <div className="flex">
                <div className="w-12 shrink-0" />
                {HOUR_LABELS.map((h, i) => (
                  i % 2 === 0 && (
                    <div key={h} className="text-xs text-gray-400 text-center" style={{ width: '2.8%', minWidth: 20 }}>
                      {i}
                    </div>
                  )
                ))}
              </div>

              {/* Grid rows */}
              {DAY_LABELS.map((day, dayIdx) => (
                <div key={day} className="flex items-center gap-0.5 mb-0.5">
                  <div className="w-12 text-xs text-gray-500 font-medium shrink-0 text-right pr-2">{day}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const cell = data?.cells?.find(c => c.day === dayIdx && c.hour === h);
                    const value = cell ? getCellValue(cell) : 0;
                    const color = getColor(value, maxValue);
                    const textColor = getTextColor(value, maxValue);
                    return (
                      <div
                        key={h}
                        className={`flex-1 h-8 rounded-sm ${color} flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-teal-400 hover:z-10`}
                        style={{ minWidth: 20 }}
                        onMouseEnter={() => cell && setHoveredCell(cell)}
                        onMouseLeave={() => setHoveredCell(null)}
                        title={cell ? `${day} ${h}:00 - ${cell.totalCalls} calls, ${cell.successRate}% rate` : `${day} ${h}:00`}
                      >
                        {cell && cell.totalCalls > 0 && (
                          <span className={`text-[10px] font-medium ${textColor}`}>
                            {metricType === 'success_rate' ? `${value}` : value}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
              <span>Low</span>
              <div className="flex gap-0.5">
                <div className="w-6 h-4 bg-gray-100 rounded-sm" />
                <div className="w-6 h-4 bg-yellow-200 rounded-sm" />
                <div className="w-6 h-4 bg-yellow-300 rounded-sm" />
                <div className="w-6 h-4 bg-green-300 rounded-sm" />
                <div className="w-6 h-4 bg-green-400 rounded-sm" />
                <div className="w-6 h-4 bg-green-500 rounded-sm" />
              </div>
              <span>High</span>
              <span className="ml-4 text-gray-400">
                {metricType === 'success_rate' ? '(Answer Rate %)' : '(Call Volume)'}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
