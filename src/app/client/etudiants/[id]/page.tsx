/**
 * CLIENT - DÉTAIL D'UN ÉTUDIANT
 * Suivi des formations, notes, certifications
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

interface PageProps {
  params: { id: string };
}

async function getStudentDetails(ownerId: string, studentId: string) {
  // Vérifier que l'étudiant appartient à la compagnie du client
  const company = await prisma.company.findUnique({
    where: { ownerId },
    include: {
      customers: {
        where: { customerId: studentId },
        include: {
          customer: {
            include: {
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
              certificates: {
                include: {
                  product: { select: { name: true } },
                },
                orderBy: { issuedAt: 'desc' },
              },
            },
          },
        },
      },
    },
  });

  if (!company || company.customers.length === 0) return null;

  const studentRelation = company.customers[0];
  const student = studentRelation.customer;

  const completedCourses = student.courseAccess.filter((a) => a.completedAt).length;
  const totalCourses = student.courseAccess.length;

  return {
    company,
    student,
    addedAt: studentRelation.addedAt,
    stats: {
      totalCourses,
      completedCourses,
      completionRate: totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0,
      certificatesCount: student.certificates.length,
      averageGrade: student.grades.length > 0
        ? Math.round(student.grades.reduce((acc, g) => acc + Number(g.score), 0) / student.grades.length)
        : null,
    },
  };
}

export default async function StudentDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.CLIENT) {
    redirect('/dashboard');
  }

  const data = await getStudentDetails(session.user.id, params.id);

  if (!data) {
    notFound();
  }

  const { company, student, addedAt, stats } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/dashboard/client" className="hover:text-gray-700">Dashboard</Link>
            {' / '}
            <Link href="/client/etudiants" className="hover:text-gray-700">Mes étudiants</Link>
            {' / '}
            <span className="text-gray-900">{student.name || student.email}</span>
          </nav>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {student.image ? (
                <img src={student.image} alt="" className="w-16 h-16 rounded-full" />
              ) : (
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-600">
                    {student.name?.charAt(0) || student.email.charAt(0)}
                  </span>
                </div>
              )}
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">{student.name || 'Sans nom'}</h1>
                <p className="text-gray-600">{student.email}</p>
                <p className="text-sm text-gray-500">
                  Ajouté à {company.name} le {new Date(addedAt).toLocaleDateString('fr-CA')}
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link
                href={`/client/etudiants/${params.id}/attribuer`}
                className="btn-secondary"
              >
                + Attribuer une formation
              </Link>
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
          <StatCard
            label="Moyenne"
            value={stats.averageGrade !== null ? `${stats.averageGrade}%` : '—'}
            color="emerald"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formations */}
          <section className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Formations</h2>
              <Link
                href={`/client/etudiants/${params.id}/attribuer`}
                className="text-blue-600 hover:underline text-sm"
              >
                + Ajouter
              </Link>
            </div>
            <div className="divide-y divide-gray-200">
              {student.courseAccess.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p className="mb-4">Aucune formation attribuée</p>
                  <Link
                    href={`/client/etudiants/${params.id}/attribuer`}
                    className="btn-primary"
                  >
                    Attribuer une formation
                  </Link>
                </div>
              ) : (
                student.courseAccess.map((access) => (
                  <div key={access.id} className="p-4 flex items-center hover:bg-gray-50">
                    {access.product.imageUrl ? (
                      <img
                        src={access.product.imageUrl}
                        alt=""
                        className="w-20 h-14 object-cover rounded"
                      />
                    ) : (
                      <div className="w-20 h-14 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                        📚
                      </div>
                    )}
                    <div className="ml-4 flex-1">
                      <p className="font-medium text-gray-900">{access.product.name}</p>
                      <div className="flex items-center mt-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[200px] mr-3">
                          <div
                            className={`h-2 rounded-full ${
                              access.completedAt ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${access.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-500">{access.progress || 0}%</span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      {access.completedAt ? (
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                          ✓ Terminé
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                          En cours
                        </span>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
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
                <h3 className="font-semibold text-gray-900">🏆 Certificats obtenus</h3>
              </div>
              <div className="p-4">
                {student.certificates.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Aucun certificat obtenu
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {student.certificates.map((cert) => (
                      <li key={cert.id} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="text-yellow-500 mr-2">🏆</span>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{cert.product.name}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(cert.issuedAt).toLocaleDateString('fr-CA')}
                            </p>
                          </div>
                        </div>
                        <a
                          href={cert.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Télécharger
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Notes récentes */}
            <section className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">📊 Notes récentes</h3>
              </div>
              <div className="p-4">
                {student.grades.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Aucune note enregistrée
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {student.grades.slice(0, 5).map((grade) => (
                      <li key={grade.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {grade.module?.title || grade.product.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(grade.gradedAt).toLocaleDateString('fr-CA')}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-sm font-semibold ${
                          Number(grade.score) >= 80
                            ? 'bg-green-100 text-green-800'
                            : Number(grade.score) >= 60
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {grade.score}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
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
