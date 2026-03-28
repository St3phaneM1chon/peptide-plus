/**
 * Skeleton loading page for /platform/features/[module]
 * Matches: breadcrumbs + hero + stats bar + bento grid + pricing CTA
 */
export default function Loading() {
  return (
    <div>
      {/* Breadcrumbs skeleton */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-3 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-3 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-300 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Hero skeleton */}
      <section className="pt-16 pb-12 text-center bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="h-14 w-14 bg-gray-200 rounded-2xl animate-pulse" />
          </div>
          {/* Module name */}
          <div className="flex justify-center mb-4">
            <div className="h-10 sm:h-12 w-2/3 max-w-sm bg-gray-200 rounded-lg animate-pulse" />
          </div>
          {/* Tagline */}
          <div className="flex justify-center mb-3">
            <div className="h-6 w-3/4 max-w-md bg-gray-100 rounded animate-pulse" />
          </div>
          {/* Description */}
          <div className="flex flex-col items-center gap-2 mb-8">
            <div className="h-4 w-full max-w-lg bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-2/3 max-w-sm bg-gray-100 rounded animate-pulse" />
          </div>
          {/* CTA buttons */}
          <div className="flex items-center justify-center gap-4">
            <div className="h-11 w-36 bg-gray-200 rounded-xl animate-pulse" />
            <div className="h-11 w-44 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </section>

      {/* Stats bar skeleton */}
      <section className="border-y border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="text-center space-y-2">
                <div className="h-8 w-16 mx-auto bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-24 mx-auto bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bento grid skeleton */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Section title */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-3">
            <div className="h-7 w-56 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="flex justify-center">
            <div className="h-5 w-80 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        {/* Bento cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-2xl border border-gray-100 bg-white p-6 space-y-3 ${
                i === 0 ? 'sm:col-span-2 sm:row-span-2' : ''
              }`}
            >
              <div className="h-8 w-8 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-5 w-2/3 bg-gray-200 rounded animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-gray-100 rounded animate-pulse" />
                {i === 0 && (
                  <>
                    <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                    <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing CTA skeleton */}
      <section className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="flex justify-center mb-8">
            <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="flex justify-center">
            <div className="h-12 w-40 bg-gray-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </section>
    </div>
  );
}
