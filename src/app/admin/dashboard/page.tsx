export const dynamic = 'force-dynamic';
/**
 * DASHBOARD EMPLOYEE (ADMIN)
 * Gestion des comptes clients et association emails
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

async function getAdminData() {
  const [
    totalClients,
    totalCustomers,
    totalProducts,
    recentPurchases,
    recentUsers,
    pendingAssociations,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.purchase.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        product: true,
        company: true,
      },
    }),
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: { role: { in: ['CUSTOMER', 'CLIENT'] } },
    }),
    // Utilisateurs non associés à une compagnie
    prisma.user.count({
      where: {
        role: 'CUSTOMER',
        companies: { none: {} },
      },
    }),
  ]);

  return {
    stats: {
      totalClients,
      totalCustomers,
      totalProducts,
      pendingAssociations,
    },
    recentPurchases,
    recentUsers,
  };
}

export default async function AdminDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  const { stats, recentPurchases, recentUsers } = await getAdminData();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
              <p className="text-gray-600">Gestion des comptes et clients</p>
            </div>
            <div className="flex space-x-3">
              <Link href="/admin/association" className="btn-secondary">
                Association emails
              </Link>
              <Link href="/admin/clients/nouveau" className="btn-primary">
                Nouveau client
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Compagnies"
            value={stats.totalClients}
            icon="building"
            color="blue"
            href="/admin/clients"
          />
          <StatCard
            title="Étudiants"
            value={stats.totalCustomers}
            icon="users"
            color="green"
            href="/admin/customers"
          />
          <StatCard
            title="Formations"
            value={stats.totalProducts}
            icon="book"
            color="purple"
            href="/admin/produits"
          />
          <StatCard
            title="À associer"
            value={stats.pendingAssociations}
            icon="link"
            color="orange"
            href="/admin/association"
            alert={stats.pendingAssociations > 0}
          />
        </div>

        {/* Navigation rapide */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <QuickAction href="/admin/clients" icon="building" title="Gérer les clients" />
          <QuickAction href="/admin/customers" icon="users" title="Gérer les étudiants" />
          <QuickAction href="/admin/association" icon="link" title="Associer emails" />
          <QuickAction href="/admin/produits" icon="package" title="Gérer les formations" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Utilisateurs récents */}
          <section className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Inscriptions récentes</h2>
              <Link href="/admin/customers" className="text-blue-600 hover:underline text-sm">
                Voir tout
              </Link>
            </div>
            <div className="divide-y divide-gray-200">
              {recentUsers.map((user) => (
                <div key={user.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      {user.image ? (
                        <img src={user.image} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <span className="text-gray-600 font-semibold">
                          {user.name?.charAt(0) || user.email.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{user.name || user.email}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString('fr-CA')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.role === 'CLIENT'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role === 'CLIENT' ? 'Client' : 'Étudiant'}
                    </span>
                    <Link
                      href={`/admin/customers/${user.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Voir
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Achats récents */}
          <section className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Achats récents</h2>
              <Link href="/admin/achats" className="text-blue-600 hover:underline text-sm">
                Voir tout
              </Link>
            </div>
            <div className="divide-y divide-gray-200">
              {recentPurchases.map((purchase) => (
                <div key={purchase.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 truncate max-w-[200px]">
                      {purchase.product.name}
                    </p>
                    <span className="font-semibold text-gray-900">
                      {Number(purchase.amount).toFixed(2)} $
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {purchase.user.name || purchase.user.email}
                      {purchase.company && ` (${purchase.company.name})`}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      purchase.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : purchase.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {purchase.status === 'COMPLETED' ? 'Payé' : 
                       purchase.status === 'PENDING' ? 'En attente' : 'Échoué'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color, href, alert = false }: {
  title: string;
  value: number;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
  href: string;
  alert?: boolean;
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <Link href={href} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow relative">
      {alert && (
        <span className="absolute top-4 right-4 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
      )}
      <div className="flex items-center">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icon === 'building' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />}
            {icon === 'users' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />}
            {icon === 'book' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />}
            {icon === 'link' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />}
          </svg>
        </div>
        <div className="ml-4">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </Link>
  );
}

function QuickAction({ href, icon, title }: { href: string; icon: string; title: string }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all flex items-center"
    >
      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mr-3">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon === 'building' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />}
          {icon === 'users' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />}
          {icon === 'link' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />}
          {icon === 'package' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />}
        </svg>
      </div>
      <span className="font-medium text-gray-900">{title}</span>
    </Link>
  );
}
