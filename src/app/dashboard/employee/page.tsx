export const dynamic = 'force-dynamic';
/**
 * DASHBOARD EMPLOYEE
 * Vue d'ensemble: statistiques, liste clients, actions rapides
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

async function getEmployeeStats() {
  const [
    totalClients,
    totalCustomers,
    totalPurchases,
    recentPurchases,
    activeCompanies,
    recentCompanies,
  ] = await Promise.all([
    prisma.company.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.purchase.count({ where: { status: 'COMPLETED' } }),
    prisma.purchase.findMany({
      where: { status: 'COMPLETED' },
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true } },
        company: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.company.count({
      where: {
        isActive: true,
        customers: { some: {} },
      },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { customers: true, purchases: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const revenue = await prisma.purchase.aggregate({
    where: { status: 'COMPLETED' },
    _sum: { amount: true },
  });

  return {
    totalClients,
    totalCustomers,
    totalPurchases,
    activeCompanies,
    revenue: revenue._sum.amount || 0,
    recentPurchases,
    recentCompanies,
  };
}

export default async function EmployeeDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  const stats = await getEmployeeStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tableau de bord employé</h1>
              <p className="text-gray-600">Gestion des clients et des étudiants</p>
            </div>
            <div className="flex space-x-3">
              <Link href="/dashboard/employee/clients/nouveau" className="btn-secondary">
                + Nouveau client
              </Link>
              <Link href="/admin/produits" className="btn-primary">
                Gérer les produits
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard
            title="Clients (entreprises)"
            value={stats.totalClients}
            icon="🏢"
            color="blue"
          />
          <StatCard
            title="Clients actifs"
            value={stats.activeCompanies}
            icon="✅"
            color="green"
          />
          <StatCard
            title="Étudiants"
            value={stats.totalCustomers}
            icon="👥"
            color="purple"
          />
          <StatCard
            title="Ventes"
            value={stats.totalPurchases}
            icon="📦"
            color="orange"
          />
          <StatCard
            title="Revenus"
            value={`${Number(stats.revenue).toFixed(0)} $`}
            icon="💰"
            color="emerald"
          />
        </div>

        {/* Navigation rapide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            href="/dashboard/employee/clients"
            className="bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl mr-4">
              🏢
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Gestion des clients</h3>
              <p className="text-sm text-gray-500">Voir et gérer les entreprises clientes</p>
            </div>
          </Link>
          
          <Link
            href="/dashboard/employee/customers"
            className="bg-white p-6 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all flex items-center"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl mr-4">
              👥
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Tous les étudiants</h3>
              <p className="text-sm text-gray-500">Liste complète des customers</p>
            </div>
          </Link>
          
          <Link
            href="/admin/chat"
            className="bg-white p-6 rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-md transition-all flex items-center"
          >
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl mr-4">
              💬
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Support chat</h3>
              <p className="text-sm text-gray-500">Répondre aux messages</p>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Liste des clients récents */}
          <section className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Clients récents</h2>
              <Link href="/dashboard/employee/clients" className="text-blue-600 hover:underline text-sm">
                Voir tout
              </Link>
            </div>
            <div className="divide-y divide-gray-200">
              {stats.recentCompanies.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Aucun client enregistré
                </div>
              ) : (
                stats.recentCompanies.map((company) => (
                  <div key={company.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {company.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">{company.name}</p>
                        <p className="text-sm text-gray-500">
                          {company._count.customers} étudiant(s) • {company._count.purchases} achat(s)
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/employee/clients/${company.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Gérer →
                    </Link>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Achats récents */}
          <section className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Dernières ventes</h2>
              <Link href="/dashboard/employee/ventes" className="text-blue-600 hover:underline text-sm">
                Voir tout
              </Link>
            </div>
            <div className="divide-y divide-gray-200">
              {stats.recentPurchases.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Aucune vente
                </div>
              ) : (
                stats.recentPurchases.map((purchase) => (
                  <div key={purchase.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{purchase.product.name}</p>
                        <p className="text-sm text-gray-500">
                          {purchase.user.name || purchase.user.email}
                          {purchase.company && ` • ${purchase.company.name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {Number(purchase.amount).toFixed(2)} $
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(purchase.createdAt).toLocaleDateString('fr-CA')}
                        </p>
                      </div>
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

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: string;
  color: string;
}) {
  const bgColors: Record<string, string> = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    purple: 'bg-purple-100',
    orange: 'bg-orange-100',
    emerald: 'bg-emerald-100',
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center">
        <div className={`w-12 h-12 ${bgColors[color]} rounded-lg flex items-center justify-center text-xl`}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
