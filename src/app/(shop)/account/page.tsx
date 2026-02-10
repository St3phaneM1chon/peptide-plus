'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

interface OrderSummary {
  totalOrders: number;
  totalSpent: number;
  pendingOrders: number;
  lastOrder?: {
    id: string;
    date: string;
    total: number;
    status: string;
  };
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslations();
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchOrderSummary();
    }
  }, [session]);

  const fetchOrderSummary = async () => {
    try {
      const res = await fetch('/api/account/summary');
      if (res.ok) {
        const data = await res.json();
        setOrderSummary(data);
      }
    } catch (error) {
      console.error('Error fetching order summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt="Profile"
                className="w-16 h-16 rounded-full border-4 border-orange-500"
              />
            ) : (
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {t('account.welcome') || 'Welcome back'}, {session.user?.name?.split(' ')[0] || 'User'}!
              </h1>
              <p className="text-neutral-400">{session.user?.email}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{orderSummary?.totalOrders || 0}</p>
                <p className="text-sm text-neutral-500">{t('account.totalOrders') || 'Total Orders'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">${(orderSummary?.totalSpent || 0).toFixed(2)}</p>
                <p className="text-sm text-neutral-500">{t('account.totalSpent') || 'Total Spent'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{orderSummary?.pendingOrders || 0}</p>
                <p className="text-sm text-neutral-500">{t('account.pendingOrders') || 'Pending'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">VIP</p>
                <p className="text-sm text-neutral-500">{t('account.memberStatus') || 'Member Status'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions - Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <QuickActionCard
            href="/account/orders"
            icon="📦"
            title={t('account.viewOrders') || 'Mes commandes'}
            description="Suivre mes commandes"
          />
          <QuickActionCard
            href="/account/inventory"
            icon="🧪"
            title="Mon inventaire"
            description="Gérer mes peptides"
          />
          <QuickActionCard
            href="/account/protocols"
            icon="📋"
            title="Mes protocoles"
            description="Suivre mes recherches"
            highlight
          />
          <QuickActionCard
            href="/account/rewards"
            icon="⭐"
            title="Récompenses"
            description="Mes points fidélité"
          />
        </div>

        {/* Quick Actions - Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <QuickActionCard
            href="/account/settings"
            icon="⚙️"
            title={t('account.accountSettings') || 'Paramètres'}
            description="Profil et préférences"
          />
          <QuickActionCard
            href="/subscriptions"
            icon="🔄"
            title="Abonnements"
            description="Auto-reorder"
          />
          <Link
            href="/shop"
            className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 shadow-sm hover:shadow-md transition-all group text-white"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🛒</span>
                <div>
                  <h3 className="font-semibold">{t('account.continueShopping') || 'Continuer mes achats'}</h3>
                  <p className="text-sm text-white/80">{t('account.browseProducts') || 'Voir les produits'}</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Recent Order */}
        {orderSummary?.lastOrder && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{t('account.recentOrder') || 'Most Recent Order'}</h2>
              <Link href="/account/orders" className="text-orange-600 hover:text-orange-700 text-sm font-medium">
                {t('account.viewAll') || 'View All'} →
              </Link>
            </div>

            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Order #{orderSummary.lastOrder.id}</p>
                  <p className="text-sm text-neutral-500">{orderSummary.lastOrder.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold">${orderSummary.lastOrder.total.toFixed(2)}</p>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                  orderSummary.lastOrder.status === 'delivered' ? 'bg-green-100 text-green-700' :
                  orderSummary.lastOrder.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                  orderSummary.lastOrder.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-neutral-100 text-neutral-700'
                }`}>
                  {orderSummary.lastOrder.status.charAt(0).toUpperCase() + orderSummary.lastOrder.status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* No Orders */}
        {orderSummary && orderSummary.totalOrders === 0 && (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-neutral-200 text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">{t('account.noOrders') || 'No orders yet'}</h3>
            <p className="text-neutral-500 mb-6">{t('account.noOrdersDesc') || 'Start shopping to see your orders here'}</p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {t('account.startShopping') || 'Start Shopping'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// Quick Action Card Component
function QuickActionCard({
  href,
  icon,
  title,
  description,
  highlight = false,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl p-5 shadow-sm border transition-all group ${
        highlight
          ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400 hover:shadow-md'
          : 'bg-white border-neutral-200 hover:border-orange-500 hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className={`font-semibold ${highlight ? 'text-blue-900' : 'text-neutral-900'}`}>{title}</h3>
            <p className={`text-sm ${highlight ? 'text-blue-600' : 'text-neutral-500'}`}>{description}</p>
          </div>
        </div>
        <svg className={`w-5 h-5 transition-colors ${highlight ? 'text-blue-400 group-hover:text-blue-600' : 'text-neutral-400 group-hover:text-orange-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
