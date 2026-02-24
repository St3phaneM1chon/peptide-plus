'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  productName: string;
  formatName: string;
  quantity: number;
  reason: string;
  details?: string;
  status: string;
  resolution?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  deliveredAt?: string;
  status: string;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  productName: string;
  formatName?: string;
  quantity: number;
  unitPrice: number;
}

export default function ReturnsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [eligibleOrders, setEligibleOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/returns');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      // Fetch return requests
      const returnsRes = await fetch('/api/account/returns');
      if (returnsRes.ok) {
        const returnsData = await returnsRes.json();
        setReturnRequests(returnsData);
      }

      // Fetch orders to find eligible ones
      const ordersRes = await fetch('/api/account/orders');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        // Filter for delivered orders within 30 days
        const eligible = ordersData.filter((order: Order) => {
          if (order.status !== 'DELIVERED') return false;
          const deliveredDate = order.deliveredAt ? new Date(order.deliveredAt) : new Date(order.createdAt);
          const daysSince = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysSince <= 30;
        });
        setEligibleOrders(eligible);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(t('toast.returns.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOrder || !selectedItemId || !reason) {
      toast.error(t('toast.returns.fillRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/account/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          orderItemId: selectedItemId,
          reason,
          details,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t('toast.returns.submitFailed'));
        return;
      }

      toast.success(t('toast.returns.submitted'));
      setReturnRequests([data, ...returnRequests]);

      // Reset form
      setShowForm(false);
      setSelectedOrder(null);
      setSelectedItemId('');
      setReason('');
      setDetails('');
    } catch (error) {
      console.error('Failed to submit return:', error);
      toast.error(t('toast.returns.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    REJECTED: 'bg-red-100 text-red-800',
    RECEIVED: 'bg-purple-100 text-purple-800',
    REFUNDED: 'bg-green-100 text-green-800',
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'Pending Review',
    APPROVED: 'Approved - Ship Item',
    REJECTED: 'Rejected',
    RECEIVED: 'Item Received',
    REFUNDED: 'Refunded',
  };

  const returnReasons = [
    { value: 'DEFECTIVE', label: 'Product is defective or damaged' },
    { value: 'WRONG_ITEM', label: 'Wrong item received' },
    { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
    { value: 'QUALITY_ISSUE', label: 'Quality issue' },
    { value: 'NO_LONGER_NEEDED', label: 'No longer needed' },
    { value: 'OTHER', label: 'Other reason' },
  ];

  if (status === 'loading' || loading) {
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
      <Breadcrumbs
        items={[
          { label: t('nav.home') || 'Home', href: '/' },
          { label: t('account.myAccount') || 'My Account', href: '/account' },
          { label: 'Returns & Exchanges' },
        ]}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('account.returnsPage.title')}</h1>
            <p className="text-gray-600 mt-2">{t('account.returnsPage.subtitle')}</p>
          </div>
          {eligibleOrders.length > 0 && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span>📦</span>
              {t('account.returnsPage.requestReturn')}
            </button>
          )}
        </div>

        {/* Return Request Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">{t('account.returnsPage.newReturnRequest')}</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-6">
              {/* Select Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('account.returnsPage.selectOrder')} *
                </label>
                <select
                  value={selectedOrder?.id || ''}
                  onChange={(e) => {
                    const order = eligibleOrders.find((o) => o.id === e.target.value);
                    setSelectedOrder(order || null);
                    setSelectedItemId('');
                  }}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">{t('account.returnsPage.chooseOrder')}</option>
                  {eligibleOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} - {new Date(order.createdAt).toLocaleDateString(locale)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Item */}
              {selectedOrder && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('account.returnsPage.selectItemToReturn')} *
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">{t('account.returnsPage.chooseItem')}</option>
                    {selectedOrder.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.productName} {item.formatName ? `- ${item.formatName}` : ''} (Qty: {item.quantity})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('account.returnsPage.reasonForReturn')} *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">{t('account.returnsPage.selectReason')}</option>
                  {returnReasons.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Details */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('account.returnsPage.additionalDetails')}
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                  placeholder={t('account.returnsSettings.placeholderAdditionalInfo')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Return Policy Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">{t('account.returnsPage.returnPolicy')}</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• {t('account.returnsPage.policyWithin30Days')}</li>
                  <li>• {t('account.returnsPage.policyUnused')}</li>
                  <li>• {t('account.returnsPage.policyShippingLabel')}</li>
                  <li>• {t('account.returnsPage.policyRefundTime')}</li>
                </ul>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      {t('common.submitting')}
                    </>
                  ) : (
                    t('account.returnsPage.submitReturnRequest')
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Return Requests List */}
        {returnRequests.length === 0 && !showForm ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-4xl">🔄</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('account.returnsPage.noReturnRequests')}</h2>
            <p className="text-gray-600 mb-6">
              {t('account.returnsPage.noReturnRequestsDesc')}
            </p>
            {eligibleOrders.length > 0 ? (
              <button
                onClick={() => setShowForm(true)}
                className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                {t('account.returnsPage.requestAReturn')}
              </button>
            ) : (
              <p className="text-sm text-gray-500">
                {t('account.returnsPage.noEligibleOrders')}
                <br />
                {t('account.returnsPage.returnsAvailable')}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {returnRequests.map((request) => (
              <div key={request.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Request Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm text-gray-500">Return Request</p>
                        <p className="font-semibold text-gray-900">#{request.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Order</p>
                        <Link
                          href={`/account/orders`}
                          className="font-medium text-orange-600 hover:text-orange-700"
                        >
                          {request.orderNumber}
                        </Link>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Submitted</p>
                        <p className="text-gray-900">
                          {new Date(request.createdAt).toLocaleDateString(locale)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${statusColors[request.status] || 'bg-gray-100 text-gray-800'}`}>
                      {statusLabels[request.status] || request.status}
                    </span>
                  </div>
                </div>

                {/* Request Details */}
                <div className="px-6 py-4">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">🧪</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {request.productName}
                        {request.formatName && ` - ${request.formatName}`}
                      </h3>
                      <p className="text-sm text-gray-500">Quantity: {request.quantity}</p>
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700">Reason:</p>
                        <p className="text-sm text-gray-600">
                          {returnReasons.find(r => r.value === request.reason)?.label || request.reason}
                        </p>
                      </div>
                      {request.details && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-700">Details:</p>
                          <p className="text-sm text-gray-600">{request.details}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Return Status Timeline</h4>
                    <div className="relative ps-6">
                      <div className="absolute start-1.5 top-2 bottom-2 w-0.5 bg-gray-200"></div>

                      <TimelineStep
                        label="Submitted"
                        date={request.createdAt}
                        completed={true}
                        icon="📝"
                        locale={locale}
                      />

                      <TimelineStep
                        label="Under Review"
                        completed={['APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED'].includes(request.status)}
                        current={request.status === 'PENDING'}
                        icon="🔍"
                        locale={locale}
                      />

                      {request.status !== 'REJECTED' && (
                        <>
                          <TimelineStep
                            label="Approved - Ship Item"
                            completed={['RECEIVED', 'REFUNDED'].includes(request.status)}
                            current={request.status === 'APPROVED'}
                            icon="✅"
                            locale={locale}
                          />

                          <TimelineStep
                            label="Item Received"
                            completed={request.status === 'REFUNDED'}
                            current={request.status === 'RECEIVED'}
                            icon="📦"
                            locale={locale}
                          />

                          <TimelineStep
                            label={request.resolution === 'STORE_CREDIT' ? 'Store Credit Issued' : 'Refunded'}
                            completed={request.status === 'REFUNDED'}
                            icon="💰"
                            isLast={true}
                            locale={locale}
                          />
                        </>
                      )}

                      {request.status === 'REJECTED' && (
                        <TimelineStep
                          label="Rejected"
                          completed={true}
                          icon="❌"
                          isLast={true}
                          locale={locale}
                        />
                      )}
                    </div>
                  </div>

                  {/* Admin Notes */}
                  {request.adminNotes && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h4 className="text-sm font-medium text-yellow-900 mb-1">Note from Support</h4>
                      <p className="text-sm text-yellow-800">{request.adminNotes}</p>
                    </div>
                  )}

                  {/* Resolution */}
                  {request.resolution && request.status === 'REFUNDED' && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="text-sm font-medium text-green-900 mb-1">Resolution</h4>
                      <p className="text-sm text-green-800">
                        {request.resolution === 'REFUND' && '✅ Full refund has been processed'}
                        {request.resolution === 'EXCHANGE' && '✅ Replacement item has been shipped'}
                        {request.resolution === 'STORE_CREDIT' && '✅ Store credit has been added to your account'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Timeline Step Component
function TimelineStep({
  label,
  date,
  completed = false,
  current = false,
  icon,
  isLast = false,
  locale = 'en',
}: {
  label: string;
  date?: string;
  completed?: boolean;
  current?: boolean;
  icon: string;
  isLast?: boolean;
  locale?: string;
}) {
  return (
    <div className={`relative pb-6 ${isLast ? 'pb-0' : ''}`}>
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 ${
            completed
              ? 'bg-green-500 text-white'
              : current
              ? 'bg-orange-500 text-white animate-pulse'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          <span className="text-sm">{icon}</span>
        </div>
        <div>
          <p
            className={`text-sm font-medium ${
              completed || current ? 'text-gray-900' : 'text-gray-500'
            }`}
          >
            {label}
          </p>
          {date && (
            <p className="text-xs text-gray-500">
              {new Date(date).toLocaleDateString(locale)} {new Date(date).toLocaleTimeString(locale)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
