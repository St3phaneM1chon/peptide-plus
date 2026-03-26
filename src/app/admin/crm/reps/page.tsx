'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { Users, Search, Phone, Target, DollarSign, TrendingUp } from 'lucide-react';

interface Rep {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  createdAt: string;
  _count: {
    assignedLeads: number;
    assignedDeals: number;
    crmActivities: number;
    agentDailyStats: number;
  };
}

function RepAvatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name || 'Rep'}
        className="h-14 w-14 rounded-full object-cover border-2 border-indigo-100 dark:border-indigo-900"
      />
    );
  }
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <div className="h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center border-2 border-indigo-200 dark:border-indigo-800">
      <span className="text-xl font-bold text-indigo-600 dark:text-indigo-300">{initial}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--k-glass-thin)] dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
      <div className="flex items-center gap-4 mb-4">
        <div className="h-14 w-14 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function RepsListPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  const fetchReps = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/crm/reps?${params}`);
      const json = await res.json();
      if (json.success) {
        setReps(json.data || []);
        setTotal(json.pagination?.total || 0);
      } else {
        toast.error(json.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, search, t]);

  useEffect(() => {
    fetchReps();
  }, [fetchReps]);

  const totalPages = Math.ceil(total / limit);

  const filteredReps = reps;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Users className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            {t('admin.crm.salesReps')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total} {t('admin.crm.representatives')}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('admin.crm.searchReps')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full ps-9 pe-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-[var(--k-glass-thin)] dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredReps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Users className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
            {t('admin.crm.noRepsFound')}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {search
              ? t('admin.crm.noRepsMatchSearch')
              : t('admin.crm.noRepsDescription')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReps.map((rep) => (
            <div
              key={rep.id}
              onClick={() => router.push(`/admin/crm/reps/${rep.id}`)}
              className="bg-[var(--k-glass-thin)] dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-pointer group"
            >
              {/* Rep Info */}
              <div className="flex items-center gap-4 mb-4">
                <RepAvatar name={rep.name} image={rep.image} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {rep.name || rep.email}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{rep.email}</p>
                  <span className="inline-flex items-center px-2 py-0.5 mt-1 text-[10px] font-medium rounded-full bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                    {rep.role}
                  </span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                  <Target className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      {t('admin.crm.leads')}
                    </p>
                    <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                      {rep._count.assignedLeads}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                  <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                      {t('admin.crm.deals')}
                    </p>
                    <p className="text-sm font-bold text-green-800 dark:text-green-200">
                      {rep._count.assignedDeals}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
                  <Phone className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                      {t('admin.crm.activities')}
                    </p>
                    <p className="text-sm font-bold text-purple-800 dark:text-purple-200">
                      {rep._count.crmActivities}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      {t('admin.crm.daysTracked')}
                    </p>
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                      {rep._count.agentDailyStats}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 px-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {(page - 1) * limit + 1}-{Math.min(page * limit, total)} / {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              {t('common.previous')}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
