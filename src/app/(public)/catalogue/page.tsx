/**
 * PAGE CATALOGUE
 * Liste de tous les produits peptides avec filtres
 */

// P-02 FIX: Use ISR instead of force-dynamic for catalog (products don't change every second)
// searchParams already opts into dynamic rendering; revalidate provides ISR caching
export const revalidate = 300; // 5 minutes ISR, consistent with other catalog pages

import type { Metadata } from 'next';
import Link from 'next/link';
import { db as prisma } from '@/lib/db';
import { ProductCard } from '@/components/products/ProductCard';
import { Product } from '@/types';

export const metadata: Metadata = {
  title: 'Catalog',
  description: 'Browse our complete catalog of premium research peptides. Filter by category, type, and price. Lab-tested, 99%+ purity.',
};

interface CataloguePageProps {
  searchParams: Promise<{
    category?: string;
    type?: string;
    sort?: string;
    search?: string;
  }>;
}

async function getProducts(filters: { category?: string; type?: string; sort?: string; search?: string }) {
  const where: Record<string, unknown> = { isActive: true };

  if (filters.category) {
    where.category = { slug: filters.category };
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { shortDescription: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const orderBy: Record<string, string> = {};
  switch (filters.sort) {
    case 'price-asc':
      orderBy.price = 'asc';
      break;
    case 'price-desc':
      orderBy.price = 'desc';
      break;
    case 'name':
      orderBy.name = 'asc';
      break;
    default:
      orderBy.createdAt = 'desc';
  }

  return prisma.product.findMany({
    where,
    orderBy,
    include: { category: true },
  });
}

async function getCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { products: true } },
    },
  });
}

export default async function CataloguePage({ searchParams }: CataloguePageProps) {
  const params = await searchParams;
  const [products, categories] = await Promise.all([
    getProducts(params),
    getCategories(),
  ]);

  const productTypes = ['PEPTIDE', 'SUPPLEMENT', 'ACCESSORY'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Catalogue des Produits
          </h1>
          <p className="text-gray-600">
            {products.length} produit{products.length > 1 ? 's' : ''} disponible{products.length > 1 ? 's' : ''}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filtres Sidebar */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
              {/* Recherche */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rechercher
                </label>
                <form method="GET">
                  <input
                    type="text"
                    name="search"
                    defaultValue={params.search}
                    placeholder="Rechercher..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </form>
              </div>

              {/* Catégories */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Catégories</h3>
                <ul className="space-y-1">
                  <li>
                    <Link
                      href="/catalogue"
                      className={`block px-3 py-2 rounded-lg text-sm ${
                        !params.category
                          ? 'bg-orange-50 text-orange-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Toutes les catégories
                    </Link>
                  </li>
                  {categories.map((category) => (
                    <li key={category.id}>
                      <Link
                        href={`/catalogue?category=${category.slug}`}
                        className={`block px-3 py-2 rounded-lg text-sm ${
                          params.category === category.slug
                            ? 'bg-orange-50 text-orange-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {category.name}
                        <span className="text-gray-400 ms-1">
                          ({category._count.products})
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Type de produit */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Type</h3>
                <ul className="space-y-1">
                  <li>
                    <Link
                      href={`/catalogue${params.category ? `?category=${params.category}` : ''}`}
                      className={`block px-3 py-2 rounded-lg text-sm ${
                        !params.type
                          ? 'bg-orange-50 text-orange-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Tous les types
                    </Link>
                  </li>
                  {productTypes.map((type) => (
                    <li key={type}>
                      <Link
                        href={`/catalogue?type=${type}${params.category ? `&category=${params.category}` : ''}`}
                        className={`block px-3 py-2 rounded-lg text-sm ${
                          params.type === type
                            ? 'bg-orange-50 text-orange-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {type === 'PEPTIDE' ? 'Peptides' : type === 'SUPPLEMENT' ? 'Suppléments' : 'Accessoires'}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tri */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Trier par</h3>
                <select
                  defaultValue={params.sort || 'recent'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="recent">Plus récent</option>
                  <option value="name">Nom A-Z</option>
                  <option value="price-asc">Prix croissant</option>
                  <option value="price-desc">Prix décroissant</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Grille de produits */}
          <main className="flex-1">
            {products.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <svg
                  className="w-16 h-16 mx-auto text-gray-300 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucun produit trouvé
                </h3>
                <p className="text-gray-600 mb-4">
                  Essayez de modifier vos critères de recherche
                </p>
                <Link href="/catalogue" className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                  Voir tous les produits
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* Safe: Prisma result includes category via include, matching Product type */}
                {products.map((product) => (
                  <ProductCard key={product.id} product={product as unknown as Product} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
