/**
 * EMPLOYEE - DÉTAIL CUSTOMER (ÉTUDIANT)
 * Profil complet, formations, certifications, achats
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

interface PageProps {
  params: { id: string };
}

async function getCustomerDetails(customerId: string) {
  const customer = await prisma.user.findUnique({
    where: { id: customerId, role: 'CUSTOMER' },
    include: {
      companyCustomers: {
        include: {
          company: { select: { id: true, name: true } },
        },
      },
      courseAccess: {
        include: {
          product: {
            select: { id: true, name: true, slug: true, imageUrl: true, duration: true },
          },
        },
        orderBy: { enrolledAt: 'desc' },
      },
      grades: {
        include: {
          product: { select: { name: true } },
          module: { select: { title: true } },
        },
        orderBy: { gradedAt: 'desc' },
      },
      purchases: {
        include: {
          product: { select: { id: true, name: true, price: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      certificates: {
        include: {
          product: { select: { name: true } },
        },
        orderBy: { issuedAt: 'desc' },
      },
    },
  });

  if (!customer) return null;

  const totalSpent = customer.purchases
    .filter((p) => p.status === 'COMPLETED')
    .reduce((acc, p) => acc + Number(p.amount), 0);

  const completedCourses = customer.courseAccess.filter((a) => a.completedAt).length;
  const totalCourses = customer.courseAccess.length;

  return {
    customer,
    stats: {
      totalCourses,
      completedCourses,
      completionRate: totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0,
      totalSpent,
      certificatesCount: customer.certificates.length,
    },
  };
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  const data = await getCustomerDetails(params.id);

  if (!data) {
    notFound();
  }

  const { customer, stats } = data;
  const company = customer.companyCustomers[0]?.company;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/dashboard/employee" className="hover:text-gray-700">Dashboard</Link>
            {' / '}
            <Link href="/dashboard/employee/customers" className="hover:text-gray-700">Étudiants</Link>
            {' / '}
            <span className="text-gray-900">{customer.name || customer.email}</span>
          </nav>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {customer.image ? (
                <img src={customer.image} alt="" className="w-16 h-16 rounded-full" />
              ) : (
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-purple-600">
                    {customer.name?.charAt(0) || customer.email.charAt(0)}
                  </span>
                </div>
              )}
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">{customer.name || 'Sans nom'}</h1>
                <p className="text-gray-600">{customer.email}</p>
                {company && (
                  <Link href={`/dashboard/employee/clients/${company.id}`} className="text-sm text-blue-600 hover:underline">
                    🏢 {company.name}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex space-x-3">
              <button className="btn-secondary">Envoyer un message</button>
              <button className="btn-outline text-red-600 hover:bg-red-50">Désactiver</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Formations" value={stats.totalCourses} color="blue" />
          <StatCard label="Complétées" value={stats.completedCourses} color="green" />
          <StatCard label="Taux réussite" value={`${stats.completionRate}%`} color="purple" />
          <StatCard label="Certificats" value={stats.certificatesCount} color="yellow" />
          <StatCard label="Total payé" value={`${stats.totalSpent.toFixed(0)} $`} color="emerald" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formations */}
          <section className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Formations inscrites</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {customer.courseAccess.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Aucune formation
                </div>
              ) : (
                customer.courseAccess.map((access) => (
                  <div key={access.id} className="p-4 flex items-center hover:bg-gray-50">
                    {access.product.imageUrl ? (
                      <img
                        src={access.product.imageUrl}
                        alt=""
                        className="w-16 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                        📚
                      </div>
                    )}
                    <div className="ml-4 flex-1">
                      <p className="font-medium text-gray-900">{access.product.name}</p>
                      <div className="flex items-center mt-1">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${access.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-500">{access.progress || 0}%</span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      {access.completedAt ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          ✓ Terminé
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          En cours
                        </span>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Inscrit le {new Date(access.enrolledAt).toLocaleDateString('fr-CA')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Certificats */}
            <section className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">🎓 Certificats obtenus</h3>
              </div>
              <div className="p-4">
                {customer.certificates.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun certificat</p>
                ) : (
                  <ul className="space-y-3">
                    {customer.certificates.map((cert) => (
                      <li key={cert.id} className="flex items-center text-sm">
                        <span className="text-yellow-500 mr-2">🏆</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{cert.product.name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(cert.issuedAt).toLocaleDateString('fr-CA')}
                          </p>
                        </div>
                        <a href={cert.certificateUrl} target="_blank" className="text-blue-600 hover:underline text-xs">
                          PDF
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Achats récents */}
            <section className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">💳 Achats récents</h3>
              </div>
              <div className="p-4">
                {customer.purchases.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun achat</p>
                ) : (
                  <ul className="space-y-3">
                    {customer.purchases.slice(0, 5).map((purchase) => (
                      <li key={purchase.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{purchase.product.name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(purchase.createdAt).toLocaleDateString('fr-CA')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {Number(purchase.amount).toFixed(2)} $
                          </p>
                          <span className={`text-xs ${
                            purchase.status === 'COMPLETED' ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {purchase.status === 'COMPLETED' ? 'Payé' : 'En attente'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Informations */}
            <section className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">ℹ️ Informations</h3>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Inscrit depuis</span>
                  <span className="text-gray-900">
                    {new Date(customer.createdAt).toLocaleDateString('fr-CA')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Langue</span>
                  <span className="text-gray-900">{customer.locale || 'fr'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">MFA activé</span>
                  <span className={customer.mfaEnabled ? 'text-green-600' : 'text-gray-400'}>
                    {customer.mfaEnabled ? '✓ Oui' : 'Non'}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  const bgColors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    emerald: 'bg-emerald-50 border-emerald-200',
  };

  return (
    <div className={`rounded-lg p-4 border ${bgColors[color]}`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
