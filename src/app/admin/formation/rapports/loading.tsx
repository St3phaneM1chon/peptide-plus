export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 bg-muted rounded w-1/3" />
      <div className="h-4 bg-muted rounded w-2/3" />
      <div className="grid grid-cols-4 gap-4">
        <div className="h-28 bg-muted rounded" />
        <div className="h-28 bg-muted rounded" />
        <div className="h-28 bg-muted rounded" />
        <div className="h-28 bg-muted rounded" />
      </div>
      <div className="h-64 bg-muted rounded" />
    </div>
  );
}
