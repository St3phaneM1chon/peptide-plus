export default function Loading() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 bg-slate-200 rounded w-64" />
        <div className="h-4 bg-slate-100 rounded w-96" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 rounded w-24" />
                <div className="h-7 bg-slate-200 rounded w-16" />
              </div>
              <div className="h-9 w-9 bg-slate-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="h-5 bg-slate-200 rounded w-40 mb-4" />
          <div className="h-48 bg-slate-100 rounded" />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="h-5 bg-slate-200 rounded w-48 mb-4" />
          <div className="h-48 bg-slate-100 rounded" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="h-5 bg-slate-200 rounded w-36 mb-4" />
        <div className="space-y-3">
          <div className="h-8 bg-slate-100 rounded" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-50 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
