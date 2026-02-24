export default function TraductionsLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      <div className="flex justify-between">
        <div className="h-8 w-40 bg-gray-200 rounded" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>
      <div className="flex gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-8 w-12 bg-gray-200 rounded" />
        ))}
      </div>
      <div className="bg-white rounded-lg divide-y">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="flex-1 h-4 bg-gray-100 rounded" />
            <div className="h-6 w-16 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
