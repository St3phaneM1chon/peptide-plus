export const dynamic = 'force-dynamic';
/**
 * EMPLOYEE - LISTE COMPLÈTE DES CLIENTS (COMPAGNIES)
 * Avec filtres, recherche et pagination
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

interface PageProps {
  searchParams: { search?: string; page?: string; status?: string };
}

async function getClients(search?: string, page = 1, status?: string) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: any = {};
  
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { contactEmail: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status === 'active') {
    where.isActive = true;
  } else if (status === 'inactive') {
    where.isActive = false;
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { customers: true, purchases: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.company.count({ where }),
  ]);

  return {
    companies,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
}

export default async function ClientsListPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  const page = parseInt(searchParams.page || '1');
  const { companies, total, totalPages, currentPage } = await getClients(
    searchParams.search,
    page,
    searchParams.status
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
                <span className="text-gray-900">Clients</span>
              </nav>
              <h1 className="text-2xl font-bold text-gray-900">Gestion des clients</h1>
              <p className="text-gray-600">{total} entreprise(s) enregistrée(s)</p>
            </div>
            <Link href="/dashboard/employee/clients/nouveau" className="btn-primary">
              + Nouveau client
            </Link>
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
            <div>
              <select name="status" defaultValue={searchParams.status || ''} className="form-input form-select">
                <option value="">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
              </select>
            </div>
            <button type="submit" className="btn-secondary">
              Filtrer
            </button>
            {(searchParams.search || searchParams.status) && (
              <Link href="/dashboard/employee/clients" className="btn-outline text-gray-600">
                Réinitialiser
              </Link>
            )}
          </form>
        </div>

        {/* Liste des clients */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Entreprise</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Contact</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Étudiants</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Achats</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Statut</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Aucun client trouvé
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">{company.name.charAt(0)}</span>
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">{company.name}</p>
                          <p className="text-sm text-gray-500">{company.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900">{company.contactEmail}</p>
                      <p className="text-sm text-gray-500">{company.owner.name || company.owner.email}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-sm font-medium">
                        {company._count.customers}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                        {company._count.purchases}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        company.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {company.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <Link
                          href={`/dashboard/employee/clients/${company.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Voir
                        </Link>
                        <Link
                          href={`/dashboard/employee/clients/${company.id}/edit`}
                          className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                        >
                          Modifier
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {currentPage} sur {totalPages} • {total} résultat(s)
              </p>
              <div className="flex space-x-2">
                {currentPage > 1 && (
                  <Link
                    href={`/dashboard/employee/clients?page=${currentPage - 1}${searchParams.search ? `&search=${searchParams.search}` : ''}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
                    className="btn-outline px-4 py-2 text-sm"
                  >
                    ← Précédent
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/dashboard/employee/clients?page=${currentPage + 1}${searchParams.search ? `&search=${searchParams.search}` : ''}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
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
