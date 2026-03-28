export default function AbTestsLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      <div className="h-8 w-32 bg-white/10 rounded" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[var(--k-glass-thin)] rounded-lg p-4 h-20" />
        ))}
      </div>
      <div className="bg-[var(--k-glass-thin)] rounded-lg p-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-white/5 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
