export default function NewProductLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      <div className="h-8 w-48 bg-gray-200 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg p-6 space-y-4">
            <div className="h-6 w-32 bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-100 rounded" />
            <div className="h-32 w-full bg-gray-100 rounded" />
          </div>
          <div className="bg-white rounded-lg p-6 space-y-3">
            <div className="h-6 w-24 bg-gray-200 rounded" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-6 space-y-3">
            <div className="h-40 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
          </div>
          <div className="bg-white rounded-lg p-6 space-y-3">
            <div className="h-6 w-24 bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
