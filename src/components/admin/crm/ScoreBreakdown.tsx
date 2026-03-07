'use client';

import { Flame, Thermometer, Snowflake, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n/client';

interface ScoreFactor {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  met: boolean;
}

interface ScoreBreakdownProps {
  score: number;
  temperature: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  lastContactedAt?: string | null;
  lastActivityAt?: string | null;
  source: string;
  onRecalculate?: () => void;
  recalculating?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#10B981'; // green
  if (score >= 40) return '#F59E0B'; // amber
  return '#6B7280'; // gray
}

export function ScoreBreakdown({
  score,
  temperature,
  email,
  phone,
  companyName,
  lastContactedAt,
  lastActivityAt,
  source,
  onRecalculate,
  recalculating,
}: ScoreBreakdownProps) {
  const { t } = useI18n();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const hasRecentActivity = lastActivityAt ? new Date(lastActivityAt) >= thirtyDaysAgo : false;
  const sourceBonus = source === 'REFERRAL' ? 20 : ['WEB', 'CAMPAIGN'].includes(source) ? 10 : 0;

  const factors: ScoreFactor[] = [
    { key: 'email',      label: t('admin.crm.scoreFactors.email') || 'Email provided',        points: email ? 15 : 0,               maxPoints: 15, met: !!email },
    { key: 'phone',      label: t('admin.crm.scoreFactors.phone') || 'Phone provided',        points: phone ? 15 : 0,               maxPoints: 15, met: !!phone },
    { key: 'company',    label: t('admin.crm.scoreFactors.company') || 'Company name',        points: companyName ? 10 : 0,          maxPoints: 10, met: !!companyName },
    { key: 'contacted',  label: t('admin.crm.scoreFactors.contacted') || 'Has been contacted', points: lastContactedAt ? 20 : 0,     maxPoints: 20, met: !!lastContactedAt },
    { key: 'activity',   label: t('admin.crm.scoreFactors.recentActivity') || 'Recent activity (30d)', points: hasRecentActivity ? 20 : 0, maxPoints: 20, met: hasRecentActivity },
    { key: 'source',     label: t('admin.crm.scoreFactors.source') || `Source: ${source}`,    points: sourceBonus,                   maxPoints: 20, met: sourceBonus > 0 },
  ];

  const TempIcon = temperature === 'HOT' ? Flame : temperature === 'WARM' ? Thermometer : Snowflake;
  const tempColor = temperature === 'HOT' ? 'text-red-500' : temperature === 'WARM' ? 'text-orange-500' : 'text-blue-400';
  const tempBg = temperature === 'HOT' ? 'bg-red-50' : temperature === 'WARM' ? 'bg-orange-50' : 'bg-blue-50';
  const scoreColor = getScoreColor(score);

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{t('admin.crm.leadScore') || 'Lead Score'}</h3>
        {onRecalculate && (
          <button
            onClick={onRecalculate}
            disabled={recalculating}
            className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${recalculating ? 'animate-spin' : ''}`} />
            {t('admin.crm.recalculate') || 'Recalculate'}
          </button>
        )}
      </div>

      {/* Score + Temperature header */}
      <div className="flex items-center gap-4 mb-4">
        {/* Donut chart */}
        <div className="relative w-16 h-16 shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none" stroke="#E5E7EB" strokeWidth="3.5"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none" stroke={scoreColor} strokeWidth="3.5"
              strokeDasharray={`${score}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold" style={{ color: scoreColor }}>{score}</span>
          </div>
        </div>

        {/* Temperature badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${tempBg}`}>
          <TempIcon className={`h-4 w-4 ${tempColor}`} />
          <span className={`text-sm font-semibold ${tempColor}`}>{temperature}</span>
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="space-y-2">
        {factors.map(factor => (
          <div key={factor.key} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-xs ${factor.met ? 'text-gray-700' : 'text-gray-400'}`}>
                  {factor.label}
                </span>
                <span className={`text-xs font-medium ${factor.met ? 'text-gray-900' : 'text-gray-400'}`}>
                  {factor.points}/{factor.maxPoints}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(factor.points / factor.maxPoints) * 100}%`,
                    backgroundColor: factor.met ? scoreColor : 'transparent',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs">
        <span className="font-medium text-gray-500">{t('common.total') || 'Total'}</span>
        <span className="font-bold text-gray-900">{score}/100</span>
      </div>
    </div>
  );
}
