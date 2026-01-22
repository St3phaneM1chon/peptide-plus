/**
 * DASHBOARD CLIENT (COMPAGNIE D'ASSURANCE)
 * Gestion profil, étudiants, achats entreprise
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

async function getClientData(userId: string) {
  // Récupérer la compagnie
  const company = await prisma.company.findUnique({
    where: { ownerId: userId },
    include: {
      customers: {
        include: {
          customer: {
            include: {
              courseAccess: {
                include: { product: true },
              },
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      },
      purchases: {
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!company) return null;

  // Calculer les stats
  const totalStudents = company.customers.length;
  const activeStudents = company.customers.filter(
    (c) => c.customer.courseAccess.some((a) => !a.completedAt)
  ).length;

  const completedCourses = company.customers.reduce(
    (acc, c) => acc + c.customer.courseAccess.filter((a) => a.completedAt).length,
    0
  );
  const totalCourses = company.customers.reduce(
    (acc, c) => acc + c.customer.courseAccess.length,
    0
  );

  const totalSpent = await prisma.purchase.aggregate({
    where: { companyId: company.id, status: 'COMPLETED' },
    _sum: { amount: true },
  });

  return {
    company,
    stats: {
      totalStudents,
      activeStudents,
      completedCourses,
      totalCourses,
      completionRate: totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0,
      totalSpent: totalSpent._sum.amount || 0,
    },
  };
}

export default async function ClientDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.CLIENT) {
    redirect('/dashboard');
  }

  const data = await getClientData(session.user.id);

  if (!data) {
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

  const { company, stats } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
              <p className="text-gray-600">Tableau de bord entreprise</p>
            </div>
            <div className="flex space-x-3">
              <Link href="/client/etudiants/ajouter" className="btn-secondary">
                Ajouter un étudiant
              </Link>
              <Link href="/catalogue" className="btn-primary">
                Acheter des formations
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Étudiants</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Taux complétion</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completionRate}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Formations actives</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCourses}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Total investi</p>
                <p className="text-2xl font-bold text-gray-900">{Number(stats.totalSpent).toFixed(2)} $</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Liste des étudiants */}
          <section className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Mes étudiants</h2>
              <Link href="/client/etudiants" className="text-blue-600 hover:underline text-sm">
                Voir tout
              </Link>
            </div>
            <div className="divide-y divide-gray-200">
              {company.customers.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Aucun étudiant associé
                </div>
              ) : (
                company.customers.slice(0, 5).map((cc) => (
                  <div key={cc.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {cc.customer.name?.charAt(0) || cc.customer.email.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">
                          {cc.customer.name || cc.customer.email}
                        </p>
                        <p className="text-sm text-gray-500">
                          {cc.customer.courseAccess.length} formation(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {cc.customer.courseAccess.some((a) => a.completedAt) && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          Certifié
                        </span>
                      )}
                      <Link
                        href={`/client/etudiants/${cc.customerId}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Détails
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Achats récents */}
          <section className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Achats récents</h2>
              <Link href="/client/achats" className="text-blue-600 hover:underline text-sm">
                Voir tout
              </Link>
            </div>
            <div className="divide-y divide-gray-200">
              {company.purchases.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Aucun achat
                </div>
              ) : (
                company.purchases.map((purchase) => (
                  <div key={purchase.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{purchase.product.name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(purchase.createdAt).toLocaleDateString('fr-CA')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {Number(purchase.amount).toFixed(2)} $
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        purchase.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {purchase.status === 'COMPLETED' ? 'Payé' : 'En attente'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
