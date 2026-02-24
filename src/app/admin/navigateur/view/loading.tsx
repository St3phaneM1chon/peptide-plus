export default function NavigateurViewLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      <div className="h-8 w-40 bg-gray-200 rounded" />
      <div className="h-10 w-full bg-gray-100 rounded-lg" />
      <div className="bg-white rounded-lg p-6">
        <div className="h-96 bg-gray-100 rounded" />
      </div>
    </div>
  );
}
