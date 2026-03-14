export default function SecuriteLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      {/* Page header with action button */}
      <div className="flex justify-between items-center">
        <div className="h-8 w-44 bg-gray-200 rounded" />
        <div className="h-10 w-36 bg-gray-200 rounded-lg" />
      </div>

      {/* Grade + stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200 flex items-center justify-center">
          <div className="h-16 w-16 bg-gray-200 rounded-full" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="space-y-2">
              <div className="h-6 w-12 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Security checks list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="h-5 w-40 bg-gray-200 rounded" />
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4 px-6">
              <div className="h-5 w-5 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-48 bg-gray-200 rounded" />
                <div className="h-3 w-64 bg-gray-100 rounded" />
              </div>
              <div className="h-6 w-16 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
