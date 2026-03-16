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
import { getStaticLocale, createServerTranslator } from '@/i18n/server';
import type { Locale } from '@/i18n/config';

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; status?: string }>;
}

async function getClients(search?: string, page = 1, status?: string) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  
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
  const resolvedSearchParams = await searchParams;
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  const page = parseInt(resolvedSearchParams.page || '1');
  const { companies, total, totalPages, currentPage } = await getClients(
    resolvedSearchParams.search,
    page,
    resolvedSearchParams.status
  );
  const locale = getStaticLocale();
  const t = createServerTranslator(locale as Locale);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <nav className="text-sm text-gray-500 mb-2">
                <Link href="/dashboard/employee" className="hover:text-gray-700">{t('dashboard.employee.breadcrumbDashboard')}</Link>
                {' / '}
                <span className="text-gray-900">{t('dashboard.employee.breadcrumbClients')}</span>
              </nav>
              <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.employee.clientsTitle')}</h1>
              <p className="text-gray-600">{t('dashboard.employee.companiesRegistered').replace('{count}', String(total))}</p>
            </div>
            <Link href="/dashboard/employee/clients/nouveau" className="btn-primary">
              {t('dashboard.employee.newClient')}
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
                defaultValue={resolvedSearchParams.search}
                placeholder={t('dashboard.employee.searchByNameEmail')}
                className="form-input w-full"
              />
            </div>
            <div>
              <select name="status" aria-label={t('dashboard.employee.filter')} defaultValue={resolvedSearchParams.status || ''} className="form-input form-select">
                <option value="">{t('dashboard.employee.allStatuses')}</option>
                <option value="active">{t('dashboard.employee.active')}</option>
                <option value="inactive">{t('dashboard.employee.inactive')}</option>
              </select>
            </div>
            <button type="submit" className="btn-secondary">
              {t('dashboard.employee.filter')}
            </button>
            {(resolvedSearchParams.search || resolvedSearchParams.status) && (
              <Link href="/dashboard/employee/clients" className="btn-outline text-gray-600">
                {t('dashboard.employee.reset')}
              </Link>
            )}
          </form>
        </div>

        {/* Liste des clients */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-start text-sm font-semibold text-gray-900">{t('dashboard.employee.thCompany')}</th>
                <th className="px-6 py-4 text-start text-sm font-semibold text-gray-900">{t('dashboard.employee.thContact')}</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">{t('dashboard.employee.thStudents')}</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">{t('dashboard.employee.thPurchases')}</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">{t('dashboard.employee.thStatus')}</th>
                <th className="px-6 py-4 text-end text-sm font-semibold text-gray-900">{t('dashboard.employee.thActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {t('dashboard.employee.noClientsFound')}
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
                        <div className="ms-3">
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
                        {company.isActive ? t('dashboard.employee.statusActive') : t('dashboard.employee.statusInactive')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-end">
                      <div className="flex justify-end space-x-2">
                        <Link
                          href={`/dashboard/employee/clients/${company.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          {t('dashboard.employee.view')}
                        </Link>
                        <Link
                          href={`/dashboard/employee/clients/${company.id}/edit`}
                          className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                        >
                          {t('dashboard.employee.edit')}
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
                {t('dashboard.employee.pagination').replace('{page}', String(currentPage)).replace('{total}', String(totalPages)).replace('{count}', String(total))}
              </p>
              <div className="flex space-x-2">
                {currentPage > 1 && (
                  <Link
                    href={`/dashboard/employee/clients?page=${currentPage - 1}${resolvedSearchParams.search ? `&search=${resolvedSearchParams.search}` : ''}${resolvedSearchParams.status ? `&status=${resolvedSearchParams.status}` : ''}`}
                    className="btn-outline px-4 py-2 text-sm"
                  >
                    {t('dashboard.employee.previous')}
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/dashboard/employee/clients?page=${currentPage + 1}${resolvedSearchParams.search ? `&search=${resolvedSearchParams.search}` : ''}${resolvedSearchParams.status ? `&status=${resolvedSearchParams.status}` : ''}`}
                    className="btn-outline px-4 py-2 text-sm"
                  >
                    {t('dashboard.employee.next')}
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
