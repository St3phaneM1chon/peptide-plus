/**
 * Skeleton loading page for /platform (landing page)
 * Matches: hero section + 3 feature cards + integration preview
 */
export default function Loading() {
  return (
    <div className="bg-white">
      {/* Hero skeleton */}
      <section className="pt-20 pb-24 text-center">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="h-7 w-48 bg-gray-200 rounded-full animate-pulse" />
          </div>
          {/* Title */}
          <div className="flex justify-center mb-6">
            <div className="h-12 sm:h-14 w-3/4 max-w-xl bg-gray-200 rounded-lg animate-pulse" />
          </div>
          {/* Subtitle */}
          <div className="flex flex-col items-center gap-2 mb-10">
            <div className="h-5 w-2/3 max-w-lg bg-gray-100 rounded animate-pulse" />
            <div className="h-5 w-1/2 max-w-md bg-gray-100 rounded animate-pulse" />
          </div>
          {/* CTA buttons */}
          <div className="flex items-center justify-center gap-4">
            <div className="h-12 w-44 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-12 w-36 bg-gray-100 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Feature cards skeleton — 3 cards in a row */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-100 p-6 space-y-4"
            >
              {/* Icon */}
              <div className="h-10 w-10 bg-gray-200 rounded-xl animate-pulse" />
              {/* Title */}
              <div className="h-5 w-1/2 bg-gray-200 rounded animate-pulse" />
              {/* Description lines */}
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-4/5 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integration preview skeleton */}
      <section className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <div className="flex justify-center mb-8">
            <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 space-y-3">
                <div className="h-8 w-8 bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
