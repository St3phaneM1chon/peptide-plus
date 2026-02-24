export const dynamic = 'force-dynamic';
/**
 * EMPLOYEE - DÉTAIL CLIENT
 * Profil complet + Liste des customers (étudiants)
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { getApiTranslator } from '@/i18n/server';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

async function getClientDetails(clientId: string) {
  const company = await prisma.company.findUnique({
    where: { id: clientId },
    include: {
      owner: {
        select: { id: true, name: true, email: true, image: true, createdAt: true },
      },
      customers: {
        include: {
          user: {
            include: {
              courseAccesses: {
                include: { product: { select: { id: true, name: true } } },
              },
              purchases: {
                where: { status: 'COMPLETED' },
                select: { id: true, amount: true, createdAt: true },
                take: 5,
              },
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      },
      purchases: {
        include: {
          product: { select: { id: true, name: true, price: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!company) return null;

  // Statistiques
  const totalSpent = await prisma.purchase.aggregate({
    where: { companyId: clientId, status: 'COMPLETED' },
    _sum: { amount: true },
  });

  type CompanyCustomer = (typeof company.customers)[number];

  const completedCourses = company.customers.reduce((acc: number, cc: CompanyCustomer) => {
    return acc + cc.user.courseAccesses.filter((a: { completedAt: Date | null }) => a.completedAt).length;
  }, 0);

  const totalCourses = company.customers.reduce((acc: number, cc: CompanyCustomer) => {
    return acc + cc.user.courseAccesses.length;
  }, 0);

  return {
    company,
    stats: {
      totalStudents: company.customers.length,
      completedCourses,
      totalCourses,
      completionRate: totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0,
      totalSpent: totalSpent._sum.amount || 0,
      totalPurchases: company.purchases.length,
    },
  };
}

export default async function ClientDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const session = await auth();
  const { t } = await getApiTranslator();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  const data = await getClientDetails(id);

  if (!data) {
    notFound();
  }

  const { company, stats } = data;
  const activeTab = resolvedSearchParams.tab || 'etudiants';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/dashboard/employee" className="hover:text-gray-700">Dashboard</Link>
            {' / '}
            <Link href="/dashboard/employee/clients" className="hover:text-gray-700">Clients</Link>
            {' / '}
            <span className="text-gray-900">{company.name}</span>
          </nav>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center text-2xl font-bold text-blue-600">
                {company.name.charAt(0)}
              </div>
              <div className="ms-4">
                <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
                <p className="text-gray-600">{company.contactEmail}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link 
                href={`/dashboard/employee/clients/${company.id}/ajouter-etudiant`}
                className="btn-secondary"
              >
                + {t('dashboard.addStudent')}
              </Link>
              <Link 
                href={`/dashboard/employee/clients/${company.id}/edit`}
                className="btn-primary"
              >
                {t('common.edit')}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <StatCard label="Étudiants" value={stats.totalStudents} />
          <StatCard label="Formations actives" value={stats.totalCourses} />
          <StatCard label="Terminées" value={stats.completedCourses} />
          <StatCard label="Taux réussite" value={`${stats.completionRate}%`} />
          <StatCard label="Achats" value={stats.totalPurchases} />
          <StatCard label="Total investi" value={`${Number(stats.totalSpent).toFixed(0)} $`} />
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            <TabLink
              href={`/dashboard/employee/clients/${company.id}?tab=etudiants`}
              active={activeTab === 'etudiants'}
            >
              👥 Étudiants ({company.customers.length})
            </TabLink>
            <TabLink
              href={`/dashboard/employee/clients/${company.id}?tab=achats`}
              active={activeTab === 'achats'}
            >
              📦 Achats ({company.purchases.length})
            </TabLink>
            <TabLink
              href={`/dashboard/employee/clients/${company.id}?tab=infos`}
              active={activeTab === 'infos'}
            >
              ℹ️ Informations
            </TabLink>
          </nav>
        </div>

        {/* Tab: Étudiants */}
        {activeTab === 'etudiants' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-gray-900">Étudiant</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Formations</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Complétées</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Statut</th>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-gray-900">Ajouté le</th>
                  <th className="px-6 py-4 text-end text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {company.customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Aucun étudiant associé à cette entreprise.
                      <br />
                      <Link href={`/dashboard/employee/clients/${company.id}/ajouter-etudiant`} className="text-blue-600 hover:underline">
                        Ajouter un étudiant
                      </Link>
                    </td>
                  </tr>
                ) : (
                  company.customers.map((cc: { id: string; customerId: string; addedAt: Date; user: { name: string | null; email: string; courseAccesses: Array<{ completedAt: Date | null }> } }) => {
                    const completed = cc.user.courseAccesses.filter((a: { completedAt: Date | null }) => a.completedAt).length;
                    const total = cc.user.courseAccesses.length;
                    const hasActive = cc.user.courseAccesses.some((a: { completedAt: Date | null }) => !a.completedAt);

                    return (
                      <tr key={cc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                              <span className="text-purple-600 font-semibold">
                                {cc.user.name?.charAt(0) || cc.user.email.charAt(0)}
                              </span>
                            </div>
                            <div className="ms-3">
                              <p className="font-medium text-gray-900">
                                {cc.user.name || 'Sans nom'}
                              </p>
                              <p className="text-sm text-gray-500">{cc.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-900">
                          {total}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`font-medium ${completed > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {completed}/{total}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {completed === total && total > 0 ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              Certifié
                            </span>
                          ) : hasActive ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              En cours
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                              Inactif
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(cc.addedAt).toLocaleDateString('fr-CA')}
                        </td>
                        <td className="px-6 py-4 text-end">
                          <Link
                            href={`/dashboard/employee/customers/${cc.customerId}`}
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
          </div>
        )}

        {/* Tab: Achats */}
        {activeTab === 'achats' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-gray-900">Produit</th>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-gray-900">Acheteur</th>
                  <th className="px-6 py-4 text-end text-sm font-semibold text-gray-900">Montant</th>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-gray-900">Date</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {company.purchases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Aucun achat enregistré
                    </td>
                  </tr>
                ) : (
                  company.purchases.map((purchase: { id: string; amount: unknown; createdAt: Date; status: string; product: { name: string }; user: { name: string | null; email: string } }) => (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{purchase.product.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900">{purchase.user.name || purchase.user.email}</p>
                      </td>
                      <td className="px-6 py-4 text-end font-semibold text-gray-900">
                        {Number(purchase.amount).toFixed(2)} $
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(purchase.createdAt).toLocaleDateString('fr-CA')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          purchase.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : purchase.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {purchase.status === 'COMPLETED' ? 'Payé' : purchase.status === 'PENDING' ? 'En attente' : 'Annulé'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Informations */}
        {activeTab === 'infos' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Coordonnées</h3>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm text-gray-500">Nom de l'entreprise</dt>
                    <dd className="text-gray-900 font-medium">{company.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Email de contact</dt>
                    <dd className="text-gray-900">{company.contactEmail}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Téléphone</dt>
                    <dd className="text-gray-900">{company.phone || '—'}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Facturation</h3>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm text-gray-500">Adresse</dt>
                    <dd className="text-gray-900">{company.billingAddress || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Ville</dt>
                    <dd className="text-gray-900">
                      {company.billingCity ? `${company.billingCity}, ${company.billingState} ${company.billingPostal}` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Pays</dt>
                    <dd className="text-gray-900">{company.billingCountry || '—'}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Propriétaire du compte</h3>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 font-semibold">
                      {company.owner.name?.charAt(0) || company.owner.email.charAt(0)}
                    </span>
                  </div>
                  <div className="ms-3">
                    <p className="font-medium text-gray-900">{company.owner.name || 'Sans nom'}</p>
                    <p className="text-sm text-gray-500">{company.owner.email}</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Statut</h3>
                <div className="flex items-center space-x-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    company.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {company.isActive ? '✓ Actif' : '✕ Inactif'}
                  </span>
                  <span className="text-sm text-gray-500">
                    Client depuis le {new Date(company.createdAt).toLocaleDateString('fr-CA')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`pb-4 px-1 border-b-2 text-sm font-medium ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {children}
    </Link>
  );
}
