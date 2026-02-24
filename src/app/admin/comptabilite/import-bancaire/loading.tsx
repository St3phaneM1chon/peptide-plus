export default function ImportBancaireLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      <div className="h-8 w-48 bg-gray-200 rounded" />
      <div className="bg-white rounded-lg p-6 space-y-4">
        <div className="h-32 w-full bg-gray-100 rounded-lg border-2 border-dashed border-gray-200" />
        <div className="h-4 w-48 bg-gray-200 rounded" />
      </div>
      <div className="bg-white rounded-lg p-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}
