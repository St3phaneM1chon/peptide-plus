export default function RechercheComptaLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      <div className="h-8 w-36 bg-gray-200 rounded" />
      <div className="h-10 w-full bg-gray-100 rounded-lg" />
      <div className="bg-white rounded-lg p-6 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}
