/**
 * PAGE CATALOGUE
 * Liste de toutes les formations avec filtres
 */

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ProductCard } from '@/components/products/ProductCard';

interface CataloguePageProps {
  searchParams: {
    category?: string;
    level?: string;
    sort?: string;
    search?: string;
  };
}

async function getProducts(filters: CataloguePageProps['searchParams']) {
  const where: any = { isActive: true };

  if (filters.category) {
    where.category = { slug: filters.category };
  }

  if (filters.level) {
    where.level = filters.level;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { shortDescription: { contains: filters.search } },
    ];
  }

  const orderBy: any = {};
  switch (filters.sort) {
    case 'price-asc':
      orderBy.price = 'asc';
      break;
    case 'price-desc':
      orderBy.price = 'desc';
      break;
    case 'popular':
      orderBy.purchaseCount = 'desc';
      break;
    case 'rating':
      orderBy.averageRating = 'desc';
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
  const [products, categories] = await Promise.all([
    getProducts(searchParams),
    getCategories(),
  ]);

  const levels = ['Débutant', 'Intermédiaire', 'Avancé'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Catalogue des formations
          </h1>
          <p className="text-gray-600">
            {products.length} formation{products.length > 1 ? 's' : ''} disponible{products.length > 1 ? 's' : ''}
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
                    defaultValue={searchParams.search}
                    placeholder="Rechercher..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        !searchParams.category
                          ? 'bg-blue-50 text-blue-700 font-medium'
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
                          searchParams.category === category.slug
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {category.name}
                        <span className="text-gray-400 ml-1">
                          ({category._count.products})
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Niveau */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Niveau</h3>
                <ul className="space-y-1">
                  <li>
                    <Link
                      href={`/catalogue${searchParams.category ? `?category=${searchParams.category}` : ''}`}
                      className={`block px-3 py-2 rounded-lg text-sm ${
                        !searchParams.level
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Tous les niveaux
                    </Link>
                  </li>
                  {levels.map((level) => (
                    <li key={level}>
                      <Link
                        href={`/catalogue?level=${level}${searchParams.category ? `&category=${searchParams.category}` : ''}`}
                        className={`block px-3 py-2 rounded-lg text-sm ${
                          searchParams.level === level
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {level}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tri */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Trier par</h3>
                <select
                  defaultValue={searchParams.sort || 'recent'}
                  onChange={(e) => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('sort', e.target.value);
                    window.location.href = url.toString();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="recent">Plus récent</option>
                  <option value="popular">Plus populaire</option>
                  <option value="rating">Mieux noté</option>
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
                  Aucune formation trouvée
                </h3>
                <p className="text-gray-600 mb-4">
                  Essayez de modifier vos critères de recherche
                </p>
                <Link href="/catalogue" className="btn-primary">
                  Voir toutes les formations
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product as any} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
