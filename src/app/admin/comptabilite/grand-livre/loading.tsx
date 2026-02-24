export default function GrandLivreLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      <div className="h-8 w-40 bg-gray-200 rounded" />
      <div className="flex gap-3">
        <div className="h-10 w-40 bg-gray-100 rounded-lg" />
        <div className="h-10 w-32 bg-gray-100 rounded-lg" />
        <div className="h-10 w-32 bg-gray-100 rounded-lg" />
      </div>
      <div className="bg-white rounded-lg p-6 space-y-3">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}
