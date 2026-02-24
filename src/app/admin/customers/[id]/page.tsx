'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Gift,
  ShoppingCart,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  Shield,
  Ban,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Repeat,
  Pause,
  Play,
  StarIcon,
  FileText,
  CalendarDays,
  Hash,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { StatusBadge, type BadgeVariant } from '@/components/admin/StatusBadge';
import { StatCard } from '@/components/admin/StatCard';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface UserDetail {
  id: string;
  email: string;
  emailVerified: string | null;
  name: string | null;
  image: string | null;
  role: string;
  phone: string | null;
  locale: string;
  timezone: string;
  birthDate: string | null;
  mfaEnabled: boolean;
  loyaltyPoints: number;
  lifetimePoints: number;
  loyaltyTier: string;
  referralCode: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
  addresses: Address[];
  savedCards: SavedCard[];
  loyaltyTransactions: LoyaltyTransaction[];
  _count: { purchases: number };
}

interface Address {
  id: string;
  label: string | null;
  recipientName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface LoyaltyTransaction {
  id: string;
  type: string;
  points: number;
  description: string | null;
  balanceAfter: number;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  total: number;
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount: number;
  promoCode: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  items: OrderItem[];
  currency: { code: string; symbol: string };
}

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: { name: string; slug: string; imageUrl: string | null } | null;
  productName: string;
}

interface OrderStats {
  totalOrders: number;
  totalSpent: number;
  ytdSpent: number;
  totalItemsPurchased: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
}

interface Referral {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
}

interface ChatConversation {
  id: string;
  status: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  role: string; // 'user' | 'assistant' | 'agent'
  content: string;
  translatedContent: string | null;
  originalLanguage: string | null;
  createdAt: string;
}

interface SubscriptionItem {
  id: string;
  status: string; // ACTIVE, PAUSED, CANCELLED
  frequency: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  nextDelivery: string | null;
  lastDelivery: string | null;
  cancelledAt: string | null;
  createdAt: string;
  product: { name: string; slug: string; imageUrl: string | null } | null;
  format: { name: string; formatType: string; dosageMg: number | null } | null;
}

interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isApproved: boolean;
  isPublished: boolean;
  reply: string | null;
  createdAt: string;
  product: { name: string; slug: string } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


const statusConfig: Record<string, { variant: BadgeVariant; icon: typeof Clock }> = {
  PENDING: { variant: 'warning', icon: Clock },
  CONFIRMED: { variant: 'info', icon: CheckCircle },
  PROCESSING: { variant: 'primary', icon: Package },
  SHIPPED: { variant: 'info', icon: Truck },
  DELIVERED: { variant: 'success', icon: CheckCircle },
  CANCELLED: { variant: 'error', icon: XCircle },
};

const paymentStatusConfig: Record<string, BadgeVariant> = {
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'error',
  REFUNDED: 'neutral',
  PARTIAL_REFUND: 'warning',
};

const tierVariants: Record<string, BadgeVariant> = {
  BRONZE: 'warning',
  SILVER: 'neutral',
  GOLD: 'warning',
  PLATINUM: 'info',
  DIAMOND: 'primary',
};

const tierThresholds: Record<string, number> = {
  BRONZE: 0,
  SILVER: 500,
  GOLD: 2000,
  PLATINUM: 5000,
  DIAMOND: 15000,
};

const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];

const tierColors: Record<string, string> = {
  BRONZE: 'bg-amber-600',
  SILVER: 'bg-slate-400',
  GOLD: 'bg-yellow-500',
  PLATINUM: 'bg-sky-500',
  DIAMOND: 'bg-violet-600',
};

type TabKey = 'orders' | 'invoices' | 'communications' | 'loyalty' | 'subscriptions' | 'reviews' | 'addresses' | 'cards';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referredBy, setReferredBy] = useState<{ id: string; name: string | null; email: string } | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('orders');

  // Point adjustment state
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointsAmount, setPointsAmount] = useState('');
  const [pointsReason, setPointsReason] = useState('');
  const [pointsLoading, setPointsLoading] = useState(false);

  // Expanded conversations
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set());

  const fetchUserDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (!res.ok) {
        router.push('/admin/customers');
        return;
      }
      const data = await res.json();
      setUser(data.user);
      setOrders(data.orders || []);
      setOrderStats(data.orderStats);
      setReferredBy(data.referredBy);
      setReferrals(data.referrals || []);
      setConversations(data.conversations || []);
      setSubscriptions(data.subscriptions || []);
      setReviews(data.reviews || []);
    } catch (err) {
      console.error(err);
      toast.error(t('common.errorOccurred'));
    }
    setLoading(false);
  }, [id, router, t]);

  useEffect(() => {
    if (id) fetchUserDetail();
  }, [id, fetchUserDetail]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });

  const formatDateTime = (date: string) =>
    new Date(date).toLocaleDateString(locale, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(amount);
  }

  // Toggle expanded conversation
  const toggleConversation = (convId: string) => {
    setExpandedConversations((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) {
        next.delete(convId);
      } else {
        next.add(convId);
      }
      return next;
    });
  };

  // Adjust loyalty points
  const handleAdjustPoints = async () => {
    const amount = parseInt(pointsAmount, 10);
    if (!amount || !pointsReason.trim()) return;

    setPointsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason: pointsReason.trim() }),
      });
      if (res.ok) {
        setPointsAmount('');
        setPointsReason('');
        setShowPointsModal(false);
        await fetchUserDetail();
      }
    } catch (err) {
      console.error(err);
      toast.error(t('common.errorOccurred'));
    }
    setPointsLoading(false);
  };

  // Tier progress helpers
  const getNextTier = (currentTier: string): string | null => {
    const idx = tierOrder.indexOf(currentTier);
    if (idx < 0 || idx >= tierOrder.length - 1) return null;
    return tierOrder[idx + 1];
  };

  const getTierProgress = (lifetimePoints: number, currentTier: string) => {
    const nextTier = getNextTier(currentTier);
    if (!nextTier) return { percent: 100, remaining: 0, nextTier: null };
    const currentThreshold = tierThresholds[currentTier] || 0;
    const nextThreshold = tierThresholds[nextTier];
    const rangeTotal = nextThreshold - currentThreshold;
    const progress = lifetimePoints - currentThreshold;
    const percent = Math.min(100, Math.max(0, (progress / rangeTotal) * 100));
    const remaining = Math.max(0, nextThreshold - lifetimePoints);
    return { percent, remaining, nextTier };
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-500 border-t-transparent" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">{t('admin.customerDetail.notFound')}</p>
        <Link href="/admin/customers" className="text-sky-600 hover:underline mt-2 inline-block">
          {t('admin.customerDetail.backToList')}
        </Link>
      </div>
    );
  }

  // Group orders by status
  const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');
  const processingOrders = orders.filter(o => o.status === 'PROCESSING');
  const shippedOrders = orders.filter(o => o.status === 'SHIPPED');
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED');
  const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');

  const paidOrders = orders.filter(o => o.paymentStatus === 'PAID');

  const tabs: { key: TabKey; label: string; icon: typeof ShoppingCart }[] = [
    { key: 'orders', label: `${t('admin.customerDetail.tabs.orders')} (${orders.length})`, icon: ShoppingCart },
    { key: 'invoices', label: `${t('admin.customerDetail.tabs.invoices')} (${paidOrders.length})`, icon: FileText },
    { key: 'communications', label: `${t('admin.customerDetail.tabs.communications')} (${conversations.length})`, icon: MessageSquare },
    { key: 'loyalty', label: `${t('admin.customerDetail.tabs.loyalty')} (${user.loyaltyPoints} pts)`, icon: Gift },
    { key: 'subscriptions', label: `${t('admin.customerDetail.tabs.subscriptions')} (${subscriptions.length})`, icon: Repeat },
    { key: 'reviews', label: `${t('admin.customerDetail.tabs.reviews')} (${reviews.length})`, icon: Star },
    { key: 'addresses', label: `${t('admin.customerDetail.tabs.addresses')} (${user.addresses.length})`, icon: MapPin },
    { key: 'cards', label: `${t('admin.customerDetail.tabs.cards')} (${user.savedCards.length})`, icon: CreditCard },
  ];

  const tierProgress = getTierProgress(user.lifetimePoints, user.loyaltyTier);

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/customers')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <PageHeader
          title={user.name || user.email}
          subtitle={`${t('admin.customerDetail.customerSince')} ${formatDate(user.createdAt)}`}
          actions={
            <div className="flex items-center gap-2">
              <a href={`mailto:${user.email}`}>
                <Button variant="secondary" icon={Mail} size="sm">
                  {t('admin.customerDetail.actions.contact')}
                </Button>
              </a>
              <Button
                variant="secondary"
                icon={Gift}
                size="sm"
                onClick={() => setShowPointsModal(true)}
              >
                {t('admin.customerDetail.actions.adjustPoints')}
              </Button>
              <Button variant="danger" icon={Ban} size="sm">
                {t('admin.customerDetail.actions.block')}
              </Button>
            </div>
          }
        />
      </div>

      {/* Points Adjustment Modal */}
      {showPointsModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="points-modal-title">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 id="points-modal-title" className="text-lg font-semibold text-slate-900 mb-4">
              {t('admin.customerDetail.pointsModal.title')}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {t('admin.customerDetail.pointsModal.currentBalance')}: {user.loyaltyPoints.toLocaleString(locale)} pts
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.customerDetail.pointsModal.amount')}
                </label>
                <input
                  type="number"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(e.target.value)}
                  placeholder={t('admin.customerDetail.pointsModal.amountPlaceholder')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {t('admin.customerDetail.pointsModal.amountHint')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.customerDetail.pointsModal.reason')}
                </label>
                <input
                  type="text"
                  value={pointsReason}
                  onChange={(e) => setPointsReason(e.target.value)}
                  placeholder={t('admin.customerDetail.pointsModal.reasonPlaceholder')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" size="sm" onClick={() => setShowPointsModal(false)}>
                {t('admin.customerDetail.pointsModal.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={pointsLoading}
                disabled={!pointsAmount || !pointsReason.trim()}
                onClick={handleAdjustPoints}
              >
                {t('admin.customerDetail.pointsModal.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
            {user.image ? (
              <Image src={user.image} alt="" width={80} height={80} className="w-20 h-20 rounded-full" unoptimized />
            ) : (
              <User className="w-10 h-10 text-slate-400" />
            )}
          </div>

          {/* Info Grid */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('admin.customerDetail.profile.name')}</p>
              <p className="font-semibold text-slate-900">{user.name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('admin.customerDetail.profile.email')}</p>
              <p className="text-sm text-slate-900">{user.email}</p>
              {user.emailVerified && (
                <span className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                  <CheckCircle className="w-3 h-3" /> {t('admin.customerDetail.profile.verified')}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('admin.customerDetail.profile.phone')}</p>
              <p className="text-sm text-slate-900">{user.phone || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('admin.customerDetail.profile.birthDate')}</p>
              <p className="text-sm text-slate-900">
                {user.birthDate ? formatDate(user.birthDate) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('admin.customerDetail.profile.role')}</p>
              <StatusBadge variant={user.role === 'OWNER' ? 'success' : user.role === 'EMPLOYEE' ? 'warning' : 'info'}>
                {user.role}
              </StatusBadge>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('admin.customerDetail.profile.loyalty')}</p>
              <StatusBadge variant={tierVariants[user.loyaltyTier] || 'neutral'}>
                {user.loyaltyTier} - {user.loyaltyPoints.toLocaleString(locale)} pts
              </StatusBadge>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('admin.customerDetail.profile.localeTimezone')}</p>
              <p className="text-sm text-slate-900">{user.locale.toUpperCase()} / {user.timezone}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('admin.customerDetail.profile.security')}</p>
              <div className="flex items-center gap-2">
                {user.mfaEnabled ? (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> {t('admin.customerDetail.profile.mfaEnabled')}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">{t('admin.customerDetail.profile.mfaDisabled')}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Referral info */}
        {(user.referralCode || referredBy) && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex gap-6 text-sm">
            {user.referralCode && (
              <span className="text-slate-600">
                {t('admin.customerDetail.profile.referralCode')}: <code className="font-mono font-bold text-sky-600">{user.referralCode}</code>
                {referrals.length > 0 && ` (${referrals.length} ${t('admin.customerDetail.profile.referrals')})`}
              </span>
            )}
            {referredBy && (
              <span className="text-slate-600">
                {t('admin.customerDetail.profile.referredBy')}:{' '}
                <Link href={`/admin/customers/${referredBy.id}`} className="text-sky-600 hover:underline">
                  {referredBy.name || referredBy.email}
                </Link>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Order Stats */}
      {orderStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            label={t('admin.customerDetail.stats.totalSpent')}
            value={formatCurrency(orderStats.totalSpent)}
            icon={ShoppingCart}
            className="bg-emerald-50 border-emerald-200"
          />
          <StatCard
            label={t('admin.customerDetail.stats.ytdSpent')}
            value={formatCurrency(orderStats.ytdSpent)}
            icon={CalendarDays}
            className="bg-teal-50 border-teal-200"
          />
          <StatCard
            label={t('admin.customerDetail.stats.orders')}
            value={orderStats.totalOrders}
            icon={Package}
          />
          <StatCard
            label={t('admin.customerDetail.stats.totalProducts')}
            value={orderStats.totalItemsPurchased}
            icon={Hash}
            className="bg-violet-50 border-violet-200"
          />
          <StatCard
            label={t('admin.customerDetail.stats.avgOrder')}
            value={formatCurrency(orderStats.averageOrderValue)}
            icon={Star}
            className="bg-sky-50 border-sky-200"
          />
          <StatCard
            label={t('admin.customerDetail.stats.inProgress')}
            value={orderStats.pendingOrders + orderStats.processingOrders + orderStats.shippedOrders}
            icon={Truck}
            className="bg-amber-50 border-amber-200"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================================================================= */}
      {/* TAB: Orders                                                       */}
      {/* ================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {pendingOrders.length > 0 && (
            <OrderSection
              title={t('admin.customerDetail.orders.pending')}
              orders={pendingOrders}
              formatCurrency={formatCurrency}
              formatDateTime={formatDateTime}
              variant="warning"
              t={t}
            />
          )}
          {processingOrders.length > 0 && (
            <OrderSection
              title={t('admin.customerDetail.orders.processing')}
              orders={processingOrders}
              formatCurrency={formatCurrency}
              formatDateTime={formatDateTime}
              variant="primary"
              t={t}
            />
          )}
          {shippedOrders.length > 0 && (
            <OrderSection
              title={t('admin.customerDetail.orders.shipped')}
              orders={shippedOrders}
              formatCurrency={formatCurrency}
              formatDateTime={formatDateTime}
              variant="info"
              t={t}
            />
          )}
          {deliveredOrders.length > 0 && (
            <OrderSection
              title={t('admin.customerDetail.orders.delivered')}
              orders={deliveredOrders}
              formatCurrency={formatCurrency}
              formatDateTime={formatDateTime}
              variant="success"
              t={t}
            />
          )}
          {cancelledOrders.length > 0 && (
            <OrderSection
              title={t('admin.customerDetail.orders.cancelled')}
              orders={cancelledOrders}
              formatCurrency={formatCurrency}
              formatDateTime={formatDateTime}
              variant="error"
              t={t}
            />
          )}
          {orders.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('admin.customerDetail.orders.empty')}</p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Invoices                                                     */}
      {/* ================================================================= */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">{t('admin.customerDetail.invoices.title')}</h3>
            <p className="text-sm text-slate-500">
              {paidOrders.length} {t('admin.customerDetail.invoices.count')}
            </p>
          </div>
          {paidOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.customerDetail.invoices.number')}</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.customerDetail.invoices.date')}</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.customerDetail.invoices.items')}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.customerDetail.invoices.subtotal')}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.customerDetail.invoices.tax')}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.customerDetail.invoices.shipping')}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.customerDetail.invoices.total')}</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.customerDetail.invoices.status')}</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.customerDetail.invoices.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paidOrders.map((order) => {
                    const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-slate-900">{order.orderNumber}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className="text-slate-600">{itemCount} {t('admin.customerDetail.invoices.products')}</span>
                          <p className="text-xs text-slate-400 truncate max-w-[200px]">
                            {order.items.map(i => i.product?.name || i.productName).join(', ')}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(order.subtotal)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(order.tax)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(order.shippingCost)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(order.total)}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge variant={statusConfig[order.status]?.variant || 'neutral'}>
                            {order.status}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href={`/admin/commandes?order=${order.id}`}
                            className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 text-sm"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {t('admin.customerDetail.invoices.view')}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('admin.customerDetail.invoices.empty')}</p>
            </div>
          )}

          {/* Invoice Totals Summary */}
          {paidOrders.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
              <div className="flex justify-end gap-8 text-sm">
                <span className="text-slate-500">
                  {t('admin.customerDetail.invoices.totalAllTime')}: <strong className="text-slate-900">{formatCurrency(orderStats?.totalSpent || 0)}</strong>
                </span>
                <span className="text-slate-500">
                  {t('admin.customerDetail.invoices.totalYTD')}: <strong className="text-teal-700">{formatCurrency(orderStats?.ytdSpent || 0)}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Communications                                               */}
      {/* ================================================================= */}
      {activeTab === 'communications' && (
        <div className="space-y-4">
          {conversations.length > 0 ? (
            conversations.map((conv) => {
              const isExpanded = expandedConversations.has(conv.id);
              const lastMsg = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
              const isOpen = conv.status === 'open' || conv.status === 'OPEN';

              return (
                <div key={conv.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Conversation header */}
                  <button
                    onClick={() => toggleConversation(conv.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge variant={isOpen ? 'success' : 'neutral'} dot>
                        {isOpen
                          ? t('admin.customerDetail.communications.statusOpen')
                          : t('admin.customerDetail.communications.statusClosed')}
                      </StatusBadge>
                      <span className="text-xs text-slate-400 uppercase font-medium">
                        {conv.language}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDateTime(conv.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {lastMsg && (
                        <span className="text-sm text-slate-500 max-w-[300px] truncate hidden md:inline">
                          {lastMsg.content.substring(0, 80)}
                          {lastMsg.content.length > 80 ? '...' : ''}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {conv.messages.length} {t('admin.customerDetail.communications.messagesCount')}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded messages */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {conv.messages.map((msg) => {
                        const roleLabel =
                          msg.role === 'user'
                            ? t('admin.customerDetail.communications.roleUser')
                            : msg.role === 'assistant'
                              ? t('admin.customerDetail.communications.roleAssistant')
                              : t('admin.customerDetail.communications.roleAgent');
                        const roleBg =
                          msg.role === 'user'
                            ? 'bg-sky-50'
                            : msg.role === 'assistant'
                              ? 'bg-slate-50'
                              : 'bg-emerald-50';
                        const roleColor =
                          msg.role === 'user'
                            ? 'text-sky-700'
                            : msg.role === 'assistant'
                              ? 'text-slate-600'
                              : 'text-emerald-700';

                        return (
                          <div key={msg.id} className={`px-4 py-3 ${roleBg}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold ${roleColor}`}>
                                {roleLabel}
                              </span>
                              <span className="text-xs text-slate-400">
                                {formatDateTime(msg.createdAt)}
                              </span>
                              {msg.originalLanguage && msg.originalLanguage !== conv.language && (
                                <span className="text-xs text-slate-400">
                                  ({t('admin.customerDetail.communications.translated')} {msg.originalLanguage})
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-800 whitespace-pre-wrap">{msg.content}</p>
                            {msg.translatedContent && (
                              <p className="text-xs text-slate-400 mt-1 italic">
                                {t('admin.customerDetail.communications.original')}: {msg.translatedContent}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('admin.customerDetail.communications.empty')}</p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Loyalty                                                      */}
      {/* ================================================================= */}
      {activeTab === 'loyalty' && (
        <div className="space-y-4">
          {/* Tier Progress Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 mb-3">
              {t('admin.customerDetail.loyalty.tierProgress')}
            </h3>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge variant={tierVariants[user.loyaltyTier] || 'neutral'}>
                {user.loyaltyTier}
              </StatusBadge>
              {tierProgress.nextTier && (
                <>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${tierColors[user.loyaltyTier] || 'bg-slate-400'}`}
                      style={{ width: `${tierProgress.percent}%` }}
                    />
                  </div>
                  <StatusBadge variant={tierVariants[tierProgress.nextTier] || 'neutral'}>
                    {tierProgress.nextTier}
                  </StatusBadge>
                </>
              )}
              {!tierProgress.nextTier && (
                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${tierColors[user.loyaltyTier] || 'bg-slate-400'}`}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
            {tierProgress.nextTier ? (
              <p className="text-sm text-slate-500">
                {t('admin.customerDetail.loyalty.pointsRemaining', {
                  points: tierProgress.remaining.toLocaleString(locale),
                  tier: tierProgress.nextTier,
                })}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                {t('admin.customerDetail.loyalty.maxTier')}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              {t('admin.customerDetail.loyalty.lifetimePoints')}: {user.lifetimePoints.toLocaleString(locale)} pts
            </p>
          </div>

          {/* Quick Adjust Points inline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 mb-3">
              {t('admin.customerDetail.loyalty.quickAdjust')}
            </h3>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t('admin.customerDetail.pointsModal.amount')}
                </label>
                <input
                  type="number"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(e.target.value)}
                  placeholder={t('admin.customerDetail.pointsModal.amountPlaceholder')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t('admin.customerDetail.pointsModal.reason')}
                </label>
                <input
                  type="text"
                  value={pointsReason}
                  onChange={(e) => setPointsReason(e.target.value)}
                  placeholder={t('admin.customerDetail.pointsModal.reasonPlaceholder')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                loading={pointsLoading}
                disabled={!pointsAmount || !pointsReason.trim()}
                onClick={handleAdjustPoints}
              >
                {t('admin.customerDetail.loyalty.apply')}
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {t('admin.customerDetail.pointsModal.amountHint')}
            </p>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-900">{t('admin.customerDetail.loyalty.history')}</h3>
              <p className="text-sm text-slate-500">
                {user.loyaltyPoints.toLocaleString(locale)} {t('admin.customerDetail.loyalty.currentPoints')} / {user.lifetimePoints.toLocaleString(locale)} {t('admin.customerDetail.loyalty.cumulativePoints')}
              </p>
            </div>
            {user.loyaltyTransactions.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {user.loyaltyTransactions.map((tx) => (
                  <div key={tx.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-900">{tx.description || tx.type}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(tx.createdAt)}</p>
                    </div>
                    <div className="text-end">
                      <p className={`font-semibold ${tx.points > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.points > 0 ? '+' : ''}{tx.points} pts
                      </p>
                      <p className="text-xs text-slate-400">{t('admin.customerDetail.loyalty.balance')}: {tx.balanceAfter}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                {t('admin.customerDetail.loyalty.emptyTransactions')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Subscriptions                                                */}
      {/* ================================================================= */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          {subscriptions.length > 0 ? (
            subscriptions.map((sub) => {
              const statusVariant: BadgeVariant =
                sub.status === 'ACTIVE' ? 'success' :
                sub.status === 'PAUSED' ? 'warning' :
                'error';
              const StatusIcon =
                sub.status === 'ACTIVE' ? Play :
                sub.status === 'PAUSED' ? Pause :
                XCircle;

              return (
                <div key={sub.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-4">
                    {/* Product image */}
                    <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {sub.product?.imageUrl ? (
                        <Image
                          src={sub.product.imageUrl}
                          alt=""
                          width={64}
                          height={64}
                          className="w-16 h-16 object-cover rounded-lg"
                          unoptimized
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-300" />
                      )}
                    </div>

                    {/* Subscription details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-900 truncate">
                          {sub.product?.name || t('admin.customerDetail.subscriptions.unknownProduct')}
                        </p>
                        <StatusBadge variant={statusVariant}>
                          <StatusIcon className="w-3 h-3 me-1" />
                          {sub.status}
                        </StatusBadge>
                      </div>
                      {sub.format && (
                        <p className="text-sm text-slate-500">
                          {sub.format.name}
                          {sub.format.dosageMg ? ` - ${sub.format.dosageMg}mg` : ''}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
                        <span>
                          {t('admin.customerDetail.subscriptions.frequency')}: <strong>{sub.frequency}</strong>
                        </span>
                        <span>
                          {t('admin.customerDetail.subscriptions.quantity')}: <strong>x{sub.quantity}</strong>
                        </span>
                        <span>
                          {t('admin.customerDetail.subscriptions.price')}: <strong>{formatCurrency(sub.unitPrice)}</strong>
                          {sub.discountPercent > 0 && (
                            <span className="text-emerald-600 ms-1">(-{sub.discountPercent}%)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-1 text-xs text-slate-400">
                        {sub.nextDelivery && (
                          <span>
                            {t('admin.customerDetail.subscriptions.nextDelivery')}: {formatDate(sub.nextDelivery)}
                          </span>
                        )}
                        {sub.lastDelivery && (
                          <span>
                            {t('admin.customerDetail.subscriptions.lastDelivery')}: {formatDate(sub.lastDelivery)}
                          </span>
                        )}
                        {sub.cancelledAt && (
                          <span className="text-red-500">
                            {t('admin.customerDetail.subscriptions.cancelledAt')}: {formatDate(sub.cancelledAt)}
                          </span>
                        )}
                        <span>
                          {t('admin.customerDetail.subscriptions.since')}: {formatDate(sub.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <Repeat className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('admin.customerDetail.subscriptions.empty')}</p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Reviews                                                      */}
      {/* ================================================================= */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {/* Stars */}
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <StarIcon
                            key={s}
                            className={`w-4 h-4 ${
                              s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{review.rating}/5</span>
                    </div>
                    {review.product && (
                      <p className="text-sm text-slate-600">
                        {t('admin.customerDetail.reviews.product')}: {review.product.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge variant={review.isApproved ? 'success' : 'warning'}>
                      {review.isApproved
                        ? t('admin.customerDetail.reviews.approved')
                        : t('admin.customerDetail.reviews.pending')}
                    </StatusBadge>
                    <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                  </div>
                </div>
                {review.title && (
                  <p className="font-medium text-slate-900 mb-1">{review.title}</p>
                )}
                {review.comment && (
                  <p className="text-sm text-slate-600">{review.comment}</p>
                )}
                {review.reply && (
                  <div className="mt-3 ps-4 border-s-2 border-sky-200">
                    <p className="text-xs font-semibold text-sky-600 mb-1">
                      {t('admin.customerDetail.reviews.adminReply')}
                    </p>
                    <p className="text-sm text-slate-600">{review.reply}</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('admin.customerDetail.reviews.empty')}</p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Addresses                                                    */}
      {/* ================================================================= */}
      {activeTab === 'addresses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {user.addresses.length > 0 ? (
            user.addresses.map((addr) => (
              <div key={addr.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-900">{addr.label || addr.recipientName}</span>
                  {addr.isDefault && (
                    <StatusBadge variant="success">{t('admin.customerDetail.addresses.default')}</StatusBadge>
                  )}
                </div>
                <p className="text-sm text-slate-600">{addr.recipientName}</p>
                <p className="text-sm text-slate-600">{addr.addressLine1}</p>
                {addr.addressLine2 && <p className="text-sm text-slate-600">{addr.addressLine2}</p>}
                <p className="text-sm text-slate-600">{addr.city}, {addr.state} {addr.postalCode}</p>
                <p className="text-sm text-slate-600">{addr.country}</p>
                {addr.phone && (
                  <p className="text-sm text-slate-500 mt-1">
                    <Phone className="w-3 h-3 inline me-1" />{addr.phone}
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-12 bg-white rounded-xl border border-slate-200">
              <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('admin.customerDetail.addresses.empty')}</p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Cards                                                        */}
      {/* ================================================================= */}
      {activeTab === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {user.savedCards.length > 0 ? (
            user.savedCards.map((card) => (
              <div key={card.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 uppercase">{card.brand}</span>
                  {card.isDefault && <StatusBadge variant="success">{t('admin.customerDetail.cards.default')}</StatusBadge>}
                </div>
                <p className="font-mono text-lg text-slate-700">{'\u2022\u2022\u2022\u2022'} {'\u2022\u2022\u2022\u2022'} {'\u2022\u2022\u2022\u2022'} {card.last4}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {t('admin.customerDetail.cards.expires')} {card.expMonth.toString().padStart(2, '0')}/{card.expYear}
                </p>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-12 bg-white rounded-xl border border-slate-200">
              <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('admin.customerDetail.cards.empty')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrderSection sub-component
// ---------------------------------------------------------------------------

function OrderSection({
  title,
  orders,
  formatCurrency,
  formatDateTime,
  variant,
  t,
}: {
  title: string;
  orders: Order[];
  formatCurrency: (n: number) => string;
  formatDateTime: (d: string) => string;
  variant: BadgeVariant;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div>
      <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <StatusBadge variant={variant}>{title}</StatusBadge>
        <span className="text-slate-400 text-sm font-normal">({orders.length})</span>
      </h3>
      <div className="space-y-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/admin/commandes?order=${order.id}`}
            className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-sky-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-slate-900">{order.orderNumber}</span>
                <StatusBadge variant={statusConfig[order.status]?.variant || 'neutral'}>
                  {order.status}
                </StatusBadge>
                <StatusBadge variant={paymentStatusConfig[order.paymentStatus] || 'neutral'}>
                  {order.paymentStatus}
                </StatusBadge>
              </div>
              <div className="text-end">
                <p className="font-bold text-slate-900">{formatCurrency(order.total)}</p>
                <p className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
              </div>
            </div>

            {/* Order Items */}
            <div className="flex flex-wrap gap-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  {item.product?.imageUrl && (
                    <Image
                      src={item.product.imageUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded object-cover"
                      unoptimized
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {item.product?.name || item.productName}
                    </p>
                    <p className="text-xs text-slate-500">
                      x{item.quantity} - {formatCurrency(item.totalPrice)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tracking info */}
            {order.trackingNumber && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-600">
                <Truck className="w-4 h-4" />
                <span>{order.carrier}: {order.trackingNumber}</span>
                {order.shippedAt && (
                  <span>- {t('admin.customerDetail.orders.shippedOn')} {formatDateTime(order.shippedAt)}</span>
                )}
                {order.deliveredAt && (
                  <span className="text-green-600">
                    - {t('admin.customerDetail.orders.deliveredOn')} {formatDateTime(order.deliveredAt)}
                  </span>
                )}
              </div>
            )}

            {/* Promo code */}
            {order.promoCode && (
              <div className="mt-2 text-xs text-purple-600">
                {t('admin.customerDetail.orders.promoCode')}: <code className="font-mono font-bold">{order.promoCode}</code>
                {order.discount > 0 && ` (-${formatCurrency(order.discount)})`}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
