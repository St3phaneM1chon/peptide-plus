export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-live="polite" aria-busy="true">
      <div className="h-8 w-48 bg-[var(--k-glass-thin)] rounded animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: '400% 100%', backgroundImage: 'linear-gradient(90deg, var(--k-bg-surface) 0%, var(--k-bg-surface-raised) 50%, var(--k-bg-surface) 100%)' }} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl p-6 border border-[var(--k-border-subtle)]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--k-glass-regular)] rounded-lg animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-6 w-16 bg-[var(--k-glass-regular)] rounded animate-pulse" />
                <div className="h-3 w-24 bg-[var(--k-glass-thin)] rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl p-6 border border-[var(--k-border-subtle)] h-64 animate-pulse" />
        <div className="bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl p-6 border border-[var(--k-border-subtle)] h-64 animate-pulse" />
      </div>
      <div className="bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl border border-[var(--k-border-subtle)] divide-y divide-[var(--k-border-subtle)]">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <div className="h-4 w-32 bg-[var(--k-glass-regular)] rounded animate-pulse" />
            <div className="flex-1" />
            <div className="h-4 w-20 bg-[var(--k-glass-thin)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
