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
import { getStaticLocale, createServerTranslator } from '@/i18n/server';
import type { Locale } from '@/i18n/config';

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
  const locale = getStaticLocale();
  const t = createServerTranslator(locale as Locale);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.employee.title')}</h1>
              <p className="text-gray-600">{t('dashboard.employee.subtitle')}</p>
            </div>
            <div className="flex space-x-3">
              <Link href="/dashboard/employee/clients/nouveau" className="btn-secondary">
                {t('dashboard.employee.newClient')}
              </Link>
              <Link href="/admin/produits" className="btn-primary">
                {t('dashboard.employee.manageProducts')}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard
            title={t('dashboard.employee.statsClients')}
            value={stats.totalClients}
            icon="🏢"
            color="blue"
          />
          <StatCard
            title={t('dashboard.employee.statsActiveClients')}
            value={stats.activeCompanies}
            icon="✅"
            color="green"
          />
          <StatCard
            title={t('dashboard.employee.statsStudents')}
            value={stats.totalCustomers}
            icon="👥"
            color="purple"
          />
          <StatCard
            title={t('dashboard.employee.statsSales')}
            value={stats.totalPurchases}
            icon="📦"
            color="orange"
          />
          <StatCard
            title={t('dashboard.employee.statsRevenue')}
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
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl me-4">
              🏢
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t('dashboard.employee.manageClients')}</h3>
              <p className="text-sm text-gray-500">{t('dashboard.employee.viewManageCompanies')}</p>
            </div>
          </Link>

          <Link
            href="/dashboard/employee/customers"
            className="bg-white p-6 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all flex items-center"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl me-4">
              👥
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t('dashboard.employee.allStudents')}</h3>
              <p className="text-sm text-gray-500">{t('dashboard.employee.customersList')}</p>
            </div>
          </Link>

          <Link
            href="/admin/chat"
            className="bg-white p-6 rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-md transition-all flex items-center"
          >
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl me-4">
              💬
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t('dashboard.employee.chatSupport')}</h3>
              <p className="text-sm text-gray-500">{t('dashboard.employee.answerMessages')}</p>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Liste des clients récents */}
          <section className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.employee.recentClients')}</h2>
              <Link href="/dashboard/employee/clients" className="text-blue-600 hover:underline text-sm">
                {t('dashboard.viewAll')}
              </Link>
            </div>
            <div className="divide-y divide-gray-200">
              {stats.recentCompanies.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  {t('dashboard.employee.noClientsRegistered')}
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
                      <div className="ms-3">
                        <p className="font-medium text-gray-900">{company.name}</p>
                        <p className="text-sm text-gray-500">
                          {company._count.customers} {t('dashboard.employee.studentsPurchases').replace('{purchases}', String(company._count.purchases))}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/employee/clients/${company.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {t('dashboard.employee.manage')}
                    </Link>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Achats récents */}
          <section className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.employee.latestSales')}</h2>
              <Link href="/dashboard/employee/ventes" className="text-blue-600 hover:underline text-sm">
                {t('dashboard.viewAll')}
              </Link>
            </div>
            <div className="divide-y divide-gray-200">
              {stats.recentPurchases.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  {t('dashboard.employee.noSales')}
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
                      <div className="text-end">
                        <p className="font-semibold text-gray-900">
                          {Number(purchase.amount).toFixed(2)} $
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(purchase.createdAt).toLocaleDateString(locale)}
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
    orange: 'bg-primary-100',
    emerald: 'bg-emerald-100',
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center">
        <div className={`w-12 h-12 ${bgColors[color]} rounded-lg flex items-center justify-center text-xl`}>
          {icon}
        </div>
        <div className="ms-4">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
