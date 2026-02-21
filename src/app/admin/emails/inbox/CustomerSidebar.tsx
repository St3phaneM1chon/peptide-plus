'use client';

import {
  User, Mail, Phone, Globe, Calendar, ShoppingBag,
  DollarSign, Star, MessageSquare, Crown,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';

interface CustomerSidebarProps {
  customer: Record<string, unknown>;
  stats: Record<string, unknown> | null;
}

const tierColors: Record<string, string> = {
  BRONZE: 'text-orange-600 bg-orange-50',
  SILVER: 'text-slate-600 bg-slate-100',
  GOLD: 'text-yellow-600 bg-yellow-50',
  PLATINUM: 'text-purple-600 bg-purple-50',
  DIAMOND: 'text-blue-600 bg-blue-50',
};

export default function CustomerSidebar({ customer, stats }: CustomerSidebarProps) {
  const { t, locale } = useI18n();
  const orders = (customer.orders as Array<Record<string, unknown>>) || [];
  const tier = (customer.loyaltyTier as string) || 'BRONZE';

  return (
    <div className="w-72 border-l border-slate-200 bg-white overflow-y-auto">
      {/* Customer header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
            {customer.image ? (
              <img src={customer.image as string} alt="" className="w-12 h-12 rounded-full" />
            ) : (
              <User className="h-6 w-6 text-slate-400" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{(customer.name as string) || t('admin.emails.inbox.customer')}</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tierColors[tier] || tierColors.BRONZE}`}>
              <Crown className="h-2.5 w-2.5 inline mr-0.5" />
              {tier}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Mail className="h-3.5 w-3.5 text-slate-400" />
            <span className="truncate">{customer.email as string}</span>
          </div>
          {customer.phone && (
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              <span>{customer.phone as string}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-slate-600">
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <span>{(customer.locale as string) === 'fr' ? t('admin.emails.inbox.languageFr') : t('admin.emails.inbox.languageEn')}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>{t('admin.emails.inbox.customerSince')} {new Date(customer.createdAt as string).toLocaleDateString(locale)}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100 border-b border-slate-100">
          <div className="bg-white p-3 text-center">
            <ShoppingBag className="h-4 w-4 mx-auto text-slate-400 mb-1" />
            <div className="text-lg font-semibold text-slate-900">{stats.orderCount as number}</div>
            <div className="text-[10px] text-slate-400">{t('admin.emails.inbox.statsOrders')}</div>
          </div>
          <div className="bg-white p-3 text-center">
            <DollarSign className="h-4 w-4 mx-auto text-slate-400 mb-1" />
            <div className="text-lg font-semibold text-slate-900">
              {Number(stats.totalSpent || 0).toFixed(0)}$
            </div>
            <div className="text-[10px] text-slate-400">{t('admin.emails.inbox.statsTotal')}</div>
          </div>
          <div className="bg-white p-3 text-center">
            <MessageSquare className="h-4 w-4 mx-auto text-slate-400 mb-1" />
            <div className="text-lg font-semibold text-slate-900">{stats.conversationCount as number}</div>
            <div className="text-[10px] text-slate-400">{t('admin.emails.inbox.statsConversations')}</div>
          </div>
        </div>
      )}

      {/* Loyalty */}
      <div className="p-4 border-b border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('admin.emails.inbox.loyalty')}</h4>
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-slate-900">
            {(customer.loyaltyPoints as number) || 0} {t('admin.emails.inbox.points')}
          </span>
        </div>
      </div>

      {/* Recent orders */}
      {orders.length > 0 && (
        <div className="p-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('admin.emails.inbox.recentOrders')}</h4>
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.id as string} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-slate-900">#{order.orderNumber as string}</span>
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                    order.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                    order.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {order.status as string}
                  </span>
                </div>
                <span className="text-slate-600">{Number(order.total || 0).toFixed(2)}$</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
