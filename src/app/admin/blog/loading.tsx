export default function BlogLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      {/* Page header with "New post" button */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-56 bg-gray-100 rounded" />
        </div>
        <div className="h-10 w-36 bg-gray-200 rounded-lg" />
      </div>

      {/* Search bar + filter tabs */}
      <div className="flex gap-4">
        <div className="h-10 flex-1 bg-gray-200 rounded-lg" />
        <div className="h-10 w-28 bg-gray-200 rounded-lg" />
      </div>

      {/* Blog post list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-5 flex items-start gap-4">
              <div className="h-16 w-16 bg-gray-200 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-64 bg-gray-200 rounded" />
                <div className="h-3 w-full max-w-md bg-gray-100 rounded" />
                <div className="flex gap-3">
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
