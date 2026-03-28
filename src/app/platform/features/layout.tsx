import Link from 'next/link';

/**
 * Features layout — wraps all /platform/features/* pages
 * Adds a lightweight back-navigation bar. The platform layout
 * already provides header + footer, so this stays minimal.
 */
export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* Back nav */}
      <div className="bg-gray-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-2">
          <Link
            href="/platform"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
            Retour a la plateforme
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-700">
            Fonctionnalites
          </span>
        </div>
      </div>

      {children}
    </div>
  );
}
