import Link from 'next/link';

export default function ProductNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <h2 className="text-2xl font-bold mb-4">Product Not Found</h2>
      <p className="text-gray-600 mb-6">
        The product you&apos;re looking for doesn&apos;t exist or has been removed.
      </p>
      <Link
        href="/catalogue"
        className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
      >
        Browse Catalog
      </Link>
    </div>
  );
}
