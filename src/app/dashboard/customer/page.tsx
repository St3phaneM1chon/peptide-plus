export const dynamic = 'force-dynamic';
/**
 * DASHBOARD CLIENT - BioCycle Peptides
 * Commandes, points de fidélité, réapprovisionnement rapide
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { getStaticLocale, createServerTranslator } from '@/i18n/server';
import type { Locale } from '@/i18n/config';

async function getCustomerData(userId: string) {
  const [orders, user, recentlyViewed] = await Promise.all([
    // Commandes récentes
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        items: true,
        currency: true,
      },
    }),
    // Données utilisateur (points, etc.)
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        loyaltyPoints: true,
        lifetimePoints: true,
        loyaltyTier: true,
        referralCode: true,
      },
    }),
    // Dernières transactions fidélité
    prisma.loyaltyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  // Stats
  const stats = await prisma.$transaction([
    prisma.order.count({ where: { userId } }),
    prisma.order.count({ where: { userId, status: 'DELIVERED' } }),
    prisma.order.aggregate({
      where: { userId, paymentStatus: 'PAID' },
      _sum: { total: true },
    }),
  ]);

  return {
    orders,
    user,
    recentTransactions: recentlyViewed,
    stats: {
      totalOrders: stats[0],
      deliveredOrders: stats[1],
      totalSpent: Number(stats[2]._sum.total || 0),
    },
  };
}

export default async function CustomerDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const locale = getStaticLocale();
  const t = createServerTranslator(locale as Locale);
  const { orders, user, recentTransactions, stats } = await getCustomerData(session.user.id);

  const tierColors: Record<string, string> = {
    BRONZE: 'bg-amber-600',
    SILVER: 'bg-gray-400',
    GOLD: 'bg-yellow-500',
    PLATINUM: 'bg-cyan-400',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('dashboard.hello')}, {session.user.name || t('dashboard.customer')}
              </h1>
              <p className="text-gray-600">{t('dashboard.welcomeMessage')}</p>
            </div>
            <Link
              href="/shop"
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {t('dashboard.viewProducts')}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title={t('dashboard.orders')}
            value={stats.totalOrders}
            icon="📦"
            color="blue"
          />
          <StatCard
            title={t('dashboard.delivered')}
            value={stats.deliveredOrders}
            icon="✅"
            color="green"
          />
          <StatCard
            title={t('dashboard.loyaltyPoints')}
            value={user?.loyaltyPoints || 0}
            icon="🎁"
            color="orange"
          />
          <StatCard
            title={t('dashboard.totalSpent')}
            value={`$${stats.totalSpent.toFixed(2)}`}
            icon="💰"
            color="purple"
          />
        </div>

        {/* Navigation rapide */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <QuickLink href="/account/orders" icon="📦" title={t('dashboard.myOrders')} />
          <QuickLink href="/account/inventory" icon="🔬" title={t('dashboard.myInventory')} />
          <QuickLink href="/rewards" icon="🎁" title={t('dashboard.myRewards')} />
          <QuickLink href="/account/profile" icon="👤" title={t('dashboard.myProfile')} />
          <QuickLink href="/shop" icon="🛒" title={t('dashboard.shop')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Commandes récentes */}
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {t('dashboard.recentOrders')}
              </h2>
              <Link href="/account/orders" className="text-primary-600 hover:underline text-sm">
                {t('dashboard.viewAll')}
              </Link>
            </div>

            {orders.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">📦</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.noOrders')}</h3>
                <p className="text-gray-600 mb-4">{t('dashboard.noOrdersHint')}</p>
                <Link href="/shop" className="inline-block bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                  {t('dashboard.discoverProducts')}
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <OrderCard key={order.id} order={order} t={t} locale={locale} />
                ))}
              </div>
            )}
          </section>

          {/* Sidebar - Points de fidélité */}
          <aside className="space-y-6">
            {/* Carte de fidélité */}
            <div className={`${tierColors[user?.loyaltyTier || 'BRONZE']} rounded-xl p-6 text-white`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm opacity-80">{t('dashboard.tier')}</span>
                <span className="font-bold">{user?.loyaltyTier || 'BRONZE'}</span>
              </div>
              <div className="text-center mb-4">
                <p className="text-4xl font-bold">{user?.loyaltyPoints || 0}</p>
                <p className="text-sm opacity-80">{t('dashboard.pointsAvailable')}</p>
              </div>
              <Link
                href="/rewards"
                className="block w-full bg-white/20 hover:bg-white/30 text-center py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {t('dashboard.redeemPoints')}
              </Link>
            </div>

            {/* Code de parrainage */}
            {user?.referralCode && (
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">{t('dashboard.referFriends')}</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {t('dashboard.referFriendsDesc')}
                </p>
                <div className="bg-gray-100 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">{t('dashboard.yourCode')}</p>
                  <p className="font-mono font-bold text-primary-600 text-lg">{user.referralCode}</p>
                </div>
              </div>
            )}

            {/* Dernières activités fidélité */}
            {recentTransactions.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">{t('dashboard.recentActivity')}</h3>
                <div className="space-y-3">
                  {recentTransactions.slice(0, 3).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 truncate">{tx.description || tx.type}</span>
                      <span className={tx.points > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {tx.points > 0 ? '+' : ''}{tx.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

// Composants auxiliaires

function StatCard({ title, value, icon, color }: {
  title: string;
  value: number | string;
  icon: string;
  color: 'blue' | 'green' | 'orange' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-primary-100 text-primary-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="ms-4">
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
      className="bg-white rounded-xl p-4 border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all flex items-center"
    >
      <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 me-3">
        <span className="text-xl">{icon}</span>
      </div>
      <span className="font-medium text-gray-900">{title}</span>
    </Link>
  );
}

interface OrderWithRelations {
  id: string;
  orderNumber: string;
  createdAt: Date | string;
  status: string;
  total: number | { toNumber?: () => number } | string;
  items: Array<Record<string, unknown>>;
  currency?: { code: string; [key: string]: unknown } | null;
}

function OrderCard({ order, t, locale }: { order: OrderWithRelations; t: (key: string) => string; locale: string }) {
  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-indigo-100 text-indigo-800',
    SHIPPED: 'bg-purple-100 text-purple-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900">{order.orderNumber}</p>
          <p className="text-sm text-gray-500">
            {new Date(order.createdAt).toLocaleDateString(locale, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
          {t(`dashboard.status.${order.status.toLowerCase()}`) || order.status}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {order.items.length} {order.items.length > 1 ? t('dashboard.items') : t('dashboard.item')}
        </p>
        <div className="flex items-center gap-4">
          <p className="font-semibold text-primary-600">
            ${Number(order.total).toFixed(2)} {order.currency?.code || 'CAD'}
          </p>
          <Link
            href={`/account/orders/${order.id}`}
            className="text-sm text-primary-600 hover:underline"
          >
            {t('dashboard.details')}
          </Link>
        </div>
      </div>
    </div>
  );
}
