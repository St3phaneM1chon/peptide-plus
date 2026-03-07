export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 bg-zinc-800 rounded w-1/3" />
      <div className="h-40 bg-zinc-800 rounded" />
      <div className="h-64 bg-zinc-800 rounded" />
    </div>
  );
}
