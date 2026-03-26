'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, DataTable, EmptyState, type Column } from '@/components/admin';
import { FilterBar, SelectFilter } from '@/components/admin';
import { Trophy, Users, Medal } from 'lucide-react';

type ViewMode = 'individual' | 'team';
type TimeFilter = 'week' | 'month' | 'all';

interface LeaderboardRow {
  rank: number;
  id: string;
  name: string;
  points: number;
  coursesCompleted: number;
  badgesEarned: number;
  streakDays: number;
}

export default function LeaderboardPage() {
  const { t } = useTranslations();

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('individual');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: viewMode, period: timeFilter });
      const res = await fetch(`/api/admin/lms/leaderboard?${params}`);
      const data = await res.json();
      const list = data.data ?? data.leaderboard ?? data;
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [viewMode, timeFilter]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-lg" role="img" aria-label={t('admin.lms.leaderboard.first')}>{'\u{1F947}'}</span>;
    if (rank === 2) return <span className="text-lg" role="img" aria-label={t('admin.lms.leaderboard.second')}>{'\u{1F948}'}</span>;
    if (rank === 3) return <span className="text-lg" role="img" aria-label={t('admin.lms.leaderboard.third')}>{'\u{1F949}'}</span>;
    return <span className="text-sm font-semibold text-slate-500 tabular-nums">{rank}</span>;
  };

  const columns: Column<LeaderboardRow>[] = [
    {
      key: 'rank',
      header: t('admin.lms.leaderboard.rank'),
      render: (row) => (
        <div className="flex items-center justify-center w-8">{getRankBadge(row.rank)}</div>
      ),
    },
    {
      key: 'name',
      header: viewMode === 'individual'
        ? t('admin.lms.leaderboard.studentName')
        : t('admin.lms.leaderboard.teamName'),
      render: (row) => (
        <span className="font-medium text-[var(--k-text-primary)]">{row.name}</span>
      ),
    },
    {
      key: 'points',
      header: t('admin.lms.leaderboard.points'),
      render: (row) => (
        <span className="font-semibold text-indigo-600 tabular-nums">{row.points.toLocaleString()}</span>
      ),
    },
    {
      key: 'coursesCompleted',
      header: t('admin.lms.leaderboard.coursesCompleted'),
      render: (row) => (
        <span className="tabular-nums">{row.coursesCompleted}</span>
      ),
    },
    {
      key: 'badgesEarned',
      header: t('admin.lms.leaderboard.badgesEarned'),
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Medal className="w-4 h-4 text-amber-500" />
          <span className="tabular-nums">{row.badgesEarned}</span>
        </div>
      ),
    },
    {
      key: 'streakDays',
      header: t('admin.lms.leaderboard.streakDays'),
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {row.streakDays > 0 && <span className="text-sm">{'\u{1F525}'}</span>}
          <span className="tabular-nums">{row.streakDays} {t('admin.lms.leaderboard.days')}</span>
        </div>
      ),
    },
  ];

  const timeOptions = [
    { value: 'week', label: t('admin.lms.leaderboard.thisWeek') },
    { value: 'month', label: t('admin.lms.leaderboard.thisMonth') },
    { value: 'all', label: t('admin.lms.leaderboard.allTime') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.leaderboard.title')}
        subtitle={`${rows.length} ${viewMode === 'individual'
          ? t('admin.lms.leaderboard.participants')
          : t('admin.lms.leaderboard.teams')}`}
        backHref="/admin/formation"
      />

      {/* View mode toggle */}
      <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setViewMode('individual')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
            ${viewMode === 'individual'
              ? 'bg-white/20 text-[var(--k-text-primary)] shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
            }
          `}
          aria-label={t('admin.lms.leaderboard.individual')}
        >
          <Users className="w-4 h-4" />
          {t('admin.lms.leaderboard.individual')}
        </button>
        <button
          onClick={() => setViewMode('team')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
            ${viewMode === 'team'
              ? 'bg-white/20 text-[var(--k-text-primary)] shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
            }
          `}
          aria-label={t('admin.lms.leaderboard.team')}
        >
          <Trophy className="w-4 h-4" />
          {t('admin.lms.leaderboard.team')}
        </button>
      </div>

      <FilterBar>
        <SelectFilter
          label={t('admin.lms.leaderboard.timePeriod')}
          value={timeFilter}
          onChange={(v) => setTimeFilter(v as TimeFilter)}
          options={timeOptions}
        />
      </FilterBar>

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={t('admin.lms.leaderboard.noData')}
          description={t('admin.lms.leaderboard.noDataDesc')}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyTitle={t('admin.lms.leaderboard.noData')}
        />
      )}
    </div>
  );
}
