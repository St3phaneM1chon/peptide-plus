export default function LaunchWebexLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      <div className="h-8 w-48 bg-gray-200 rounded" />
      <div className="bg-white rounded-lg p-6 space-y-4">
        <div className="h-10 w-full bg-gray-100 rounded" />
        <div className="h-10 w-full bg-gray-100 rounded" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}
