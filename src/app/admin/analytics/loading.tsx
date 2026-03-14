export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      {/* Page header */}
      <div className="flex justify-between items-center">
        <div className="h-8 w-40 bg-gray-200 rounded" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>

      {/* Revenue stat cards: 4 across */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="space-y-2 flex-1">
                <div className="h-6 w-20 bg-gray-200 rounded" />
                <div className="h-3 w-28 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-5 w-36 bg-gray-200 rounded mb-4" />
        <div className="h-64 bg-gray-100 rounded-lg" />
      </div>

      {/* RFM segments grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
