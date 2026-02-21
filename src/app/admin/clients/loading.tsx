export default function ClientsLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      <div className="h-8 w-32 bg-gray-200 rounded" />
      <div className="flex gap-4">
        <div className="h-10 flex-1 bg-gray-100 rounded-lg" />
        <div className="h-10 w-28 bg-gray-200 rounded-lg" />
      </div>
      <div className="bg-white rounded-lg divide-y">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-3 w-56 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
