/**
 * CLIENT - LISTE DE MES ÉTUDIANTS
 * Pour les compagnies: voir et gérer leurs customers
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

interface PageProps {
  searchParams: { search?: string; status?: string };
}

async function getMyStudents(ownerId: string, search?: string, status?: string) {
  const company = await prisma.company.findUnique({
    where: { ownerId },
    include: {
      customers: {
        include: {
          customer: {
            include: {
              courseAccess: {
                include: { product: { select: { id: true, name: true } } },
              },
              purchases: {
                where: { status: 'COMPLETED' },
                select: { amount: true },
              },
              certificates: {
                select: { id: true },
              },
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      },
    },
  });

  if (!company) return { students: [], company: null };

  let students = company.customers.map((cc) => ({
    ...cc,
    completed: cc.customer.courseAccess.filter((a) => a.completedAt).length,
    total: cc.customer.courseAccess.length,
    totalSpent: cc.customer.purchases.reduce((acc, p) => acc + Number(p.amount), 0),
    certificatesCount: cc.customer.certificates.length,
  }));

  // Filtrer par recherche
  if (search) {
    const searchLower = search.toLowerCase();
    students = students.filter(
      (s) =>
        s.customer.name?.toLowerCase().includes(searchLower) ||
        s.customer.email.toLowerCase().includes(searchLower)
    );
  }

  // Filtrer par statut
  if (status === 'active') {
    students = students.filter((s) => s.total > s.completed);
  } else if (status === 'completed') {
    students = students.filter((s) => s.total > 0 && s.completed === s.total);
  } else if (status === 'inactive') {
    students = students.filter((s) => s.total === 0);
  }

  return { students, company };
}

export default async function MyStudentsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.CLIENT) {
    redirect('/dashboard');
  }

  const { students, company } = await getMyStudents(
    session.user.id,
    searchParams.search,
    searchParams.status
  );

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Profil entreprise non configuré</h1>
          <Link href="/client/setup" className="btn-primary">
            Configurer mon entreprise
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <nav className="text-sm text-gray-500 mb-2">
                <Link href="/dashboard/client" className="hover:text-gray-700">Dashboard</Link>
                {' / '}
                <span className="text-gray-900">Mes étudiants</span>
              </nav>
              <h1 className="text-2xl font-bold text-gray-900">Mes étudiants</h1>
              <p className="text-gray-600">{students.length} étudiant(s) dans {company.name}</p>
            </div>
            <Link href="/client/etudiants/ajouter" className="btn-primary">
              + Ajouter un étudiant
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
                <option value="active">En formation</option>
                <option value="completed">Formations terminées</option>
                <option value="inactive">Aucune formation</option>
              </select>
            </div>
            <button type="submit" className="btn-secondary">
              Filtrer
            </button>
            {(searchParams.search || searchParams.status) && (
              <Link href="/client/etudiants" className="btn-outline text-gray-600">
                Réinitialiser
              </Link>
            )}
          </form>
        </div>

        {/* Liste */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {students.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 mb-4">Aucun étudiant trouvé</p>
              <Link href="/client/etudiants/ajouter" className="btn-primary">
                Ajouter votre premier étudiant
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Étudiant</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Formations</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Progression</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Certificats</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Ajouté le</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {s.customer.name?.charAt(0) || s.customer.email.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">{s.customer.name || 'Sans nom'}</p>
                          <p className="text-sm text-gray-500">{s.customer.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                        {s.total}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: s.total > 0 ? `${(s.completed / s.total) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{s.completed}/{s.total}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {s.certificatesCount > 0 ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-sm font-medium">
                          🏆 {s.certificatesCount}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(s.addedAt).toLocaleDateString('fr-CA')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <Link
                          href={`/client/etudiants/${s.customerId}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Voir
                        </Link>
                        <Link
                          href={`/client/etudiants/${s.customerId}/attribuer`}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          + Formation
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
