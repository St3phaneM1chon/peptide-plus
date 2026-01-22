/**
 * EMPLOYEE - TOUS LES CUSTOMERS (ÉTUDIANTS)
 * Liste globale avec recherche et filtres
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

interface PageProps {
  searchParams: { search?: string; page?: string; company?: string };
}

async function getCustomers(search?: string, page = 1, companyId?: string) {
  const limit = 25;
  const skip = (page - 1) * limit;

  const where: any = {
    role: 'CUSTOMER',
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Filtrer par compagnie si spécifié
  let companyFilter = companyId ? { some: { companyId } } : undefined;

  const [customers, total, companies] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...where,
        ...(companyFilter ? { companyCustomers: companyFilter } : {}),
      },
      include: {
        companyCustomers: {
          include: {
            company: { select: { id: true, name: true } },
          },
        },
        courseAccess: {
          include: { product: { select: { id: true, name: true } } },
        },
        purchases: {
          where: { status: 'COMPLETED' },
          select: { amount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({
      where: {
        ...where,
        ...(companyFilter ? { companyCustomers: companyFilter } : {}),
      },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    customers,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    companies,
  };
}

export default async function CustomersListPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  const page = parseInt(searchParams.page || '1');
  const { customers, total, totalPages, currentPage, companies } = await getCustomers(
    searchParams.search,
    page,
    searchParams.company
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <nav className="text-sm text-gray-500 mb-2">
                <Link href="/dashboard/employee" className="hover:text-gray-700">Dashboard</Link>
                {' / '}
                <span className="text-gray-900">Tous les étudiants</span>
              </nav>
              <h1 className="text-2xl font-bold text-gray-900">Tous les étudiants</h1>
              <p className="text-gray-600">{total} étudiant(s) enregistré(s)</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtres */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <form className="flex flex-wrap gap-4" method="GET">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                name="search"
                defaultValue={searchParams.search}
                placeholder="Rechercher par nom ou email..."
                className="form-input w-full"
              />
            </div>
            <div className="min-w-[200px]">
              <select name="company" defaultValue={searchParams.company || ''} className="form-input form-select w-full">
                <option value="">Toutes les entreprises</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary">
              Filtrer
            </button>
            {(searchParams.search || searchParams.company) && (
              <Link href="/dashboard/employee/customers" className="btn-outline text-gray-600">
                Réinitialiser
              </Link>
            )}
          </form>
        </div>

        {/* Liste */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Étudiant</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Entreprise</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Formations</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Complétées</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Total achats</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Aucun étudiant trouvé
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const completed = customer.courseAccess.filter((a) => a.completedAt).length;
                  const total = customer.courseAccess.length;
                  const totalSpent = customer.purchases.reduce((acc, p) => acc + Number(p.amount), 0);
                  const company = customer.companyCustomers[0]?.company;

                  return (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <span className="text-purple-600 font-semibold">
                              {customer.name?.charAt(0) || customer.email.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-3">
                            <p className="font-medium text-gray-900">{customer.name || 'Sans nom'}</p>
                            <p className="text-sm text-gray-500">{customer.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {company ? (
                          <Link
                            href={`/dashboard/employee/clients/${company.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {company.name}
                          </Link>
                        ) : (
                          <span className="text-gray-400 italic">Indépendant</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                          {total}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          completed === total && total > 0
                            ? 'bg-green-100 text-green-800'
                            : completed > 0
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {completed}/{total}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {totalSpent.toFixed(2)} $
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/employee/customers/${customer.id}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Détails →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {currentPage} sur {totalPages}
              </p>
              <div className="flex space-x-2">
                {currentPage > 1 && (
                  <Link
                    href={`/dashboard/employee/customers?page=${currentPage - 1}${searchParams.search ? `&search=${searchParams.search}` : ''}${searchParams.company ? `&company=${searchParams.company}` : ''}`}
                    className="btn-outline px-4 py-2 text-sm"
                  >
                    ← Précédent
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/dashboard/employee/customers?page=${currentPage + 1}${searchParams.search ? `&search=${searchParams.search}` : ''}${searchParams.company ? `&company=${searchParams.company}` : ''}`}
                    className="btn-outline px-4 py-2 text-sm"
                  >
                    Suivant →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
