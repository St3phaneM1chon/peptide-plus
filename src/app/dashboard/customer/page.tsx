/**
 * DASHBOARD CUSTOMER (ÉTUDIANT)
 * Mes cours, progression, notes, certificats
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

async function getCustomerData(userId: string) {
  const [courses, stats] = await Promise.all([
    // Cours achetés avec progression
    prisma.courseAccess.findMany({
      where: { userId },
      include: {
        product: {
          include: { category: true },
        },
        purchase: true,
      },
      orderBy: { lastAccessedAt: 'desc' },
    }),
    // Statistiques
    prisma.$transaction([
      prisma.courseAccess.count({ where: { userId } }),
      prisma.courseAccess.count({ where: { userId, completedAt: { not: null } } }),
      prisma.courseAccess.count({ where: { userId, certificateUrl: { not: null } } }),
      prisma.purchase.aggregate({
        where: { userId, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.grade.aggregate({
        where: { userId },
        _avg: { score: true },
      }),
    ]),
  ]);

  return {
    courses,
    stats: {
      totalCourses: stats[0],
      completedCourses: stats[1],
      certificates: stats[2],
      totalSpent: stats[3]._sum.amount || 0,
      averageScore: stats[4]._avg.score || null,
    },
  };
}

export default async function CustomerDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Vérifier le rôle
  if (session.user.role !== UserRole.CUSTOMER && session.user.role !== UserRole.CLIENT) {
    redirect('/dashboard');
  }

  const { courses, stats } = await getCustomerData(session.user.id);
  const inProgressCourses = courses.filter((c) => !c.completedAt);
  const completedCourses = courses.filter((c) => c.completedAt);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Bonjour, {session.user.name || 'Étudiant'}
              </h1>
              <p className="text-gray-600">Bienvenue dans votre espace de formation</p>
            </div>
            <Link
              href="/catalogue"
              className="btn-primary"
            >
              Explorer les formations
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard
            title="Formations"
            value={stats.totalCourses}
            icon="book"
            color="blue"
          />
          <StatCard
            title="En cours"
            value={stats.totalCourses - stats.completedCourses}
            icon="play"
            color="yellow"
          />
          <StatCard
            title="Terminées"
            value={stats.completedCourses}
            icon="check"
            color="green"
          />
          <StatCard
            title="Certificats"
            value={stats.certificates}
            icon="certificate"
            color="purple"
          />
          <StatCard
            title="Note moyenne"
            value={stats.averageScore ? `${stats.averageScore.toFixed(0)}%` : '-'}
            icon="star"
            color="orange"
          />
        </div>

        {/* Navigation rapide */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <QuickLink href="/dashboard/customer/cours" icon="book" title="Mes formations" />
          <QuickLink href="/dashboard/customer/notes" icon="chart" title="Mes notes" />
          <QuickLink href="/dashboard/customer/certificats" icon="certificate" title="Certificats" />
          <QuickLink href="/dashboard/customer/achats" icon="receipt" title="Mes achats" />
        </div>

        {/* Cours en cours */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Formations en cours
            </h2>
            <Link href="/dashboard/customer/cours" className="text-blue-600 hover:underline text-sm">
              Voir tout
            </Link>
          </div>

          {inProgressCourses.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune formation en cours</h3>
              <p className="text-gray-600 mb-4">Commencez à apprendre dès maintenant</p>
              <Link href="/catalogue" className="btn-primary">
                Découvrir les formations
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inProgressCourses.slice(0, 3).map((access) => (
                <CourseProgressCard key={access.id} access={access} />
              ))}
            </div>
          )}
        </section>

        {/* Formations terminées */}
        {completedCourses.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Formations terminées
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedCourses.slice(0, 3).map((access) => (
                <CourseProgressCard key={access.id} access={access} completed />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// Composants auxiliaires

function StatCard({ title, value, icon, color }: {
  title: string;
  value: number | string;
  icon: string;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'orange';
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  const icons: Record<string, JSX.Element> = {
    book: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
    play: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />,
    check: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />,
    certificate: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />,
    star: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icons[icon]}
          </svg>
        </div>
        <div className="ml-4">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, title }: { href: string; icon: string; title: string }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all flex items-center"
    >
      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mr-3">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon === 'book' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />}
          {icon === 'chart' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />}
          {icon === 'certificate' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />}
          {icon === 'receipt' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />}
        </svg>
      </div>
      <span className="font-medium text-gray-900">{title}</span>
    </Link>
  );
}

function CourseProgressCard({ access, completed = false }: { access: any; completed?: boolean }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-md transition-shadow">
      <div className="aspect-video bg-gray-100 relative">
        {access.product.imageUrl ? (
          <img
            src={access.product.imageUrl}
            alt={access.product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
            <svg className="w-12 h-12 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        )}
        
        {completed && (
          <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-md text-xs font-semibold">
            Terminé
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-xs text-blue-600 font-medium mb-1">
          {access.product.category?.name || 'Formation'}
        </p>
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
          {access.product.name}
        </h3>

        {/* Barre de progression */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-500">Progression</span>
            <span className="font-medium text-gray-900">{access.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${completed ? 'bg-green-500' : 'bg-blue-600'}`}
              style={{ width: `${access.progress}%` }}
            />
          </div>
        </div>

        <Link
          href={`/cours/${access.product.slug}/learn`}
          className={`w-full py-2 rounded-lg text-sm font-medium text-center block ${
            completed
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {completed ? 'Revoir le cours' : 'Continuer'}
        </Link>
      </div>
    </div>
  );
}
