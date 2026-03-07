'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  ArrowLeft,
  DollarSign,
  User,
  Phone,
  Mail,
  ClipboardList,
  ArrowRightLeft,
  Tag,
  ShoppingCart,
  ExternalLink,
  PhoneCall,
  Inbox,
  Star,
  Calculator,
  Video,
} from 'lucide-react';
import { ActivityTimeline } from '@/components/admin/crm/ActivityTimeline';

interface DealDetail {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: { id: string; name: string; color: string | null; probability: number; isWon: boolean; isLost: boolean };
  pipeline: { id: string; name: string; stages: Array<{ id: string; name: string; position: number; color: string | null; probability: number; isWon: boolean; isLost: boolean }> };
  assignedTo: { id: string; name: string | null; email: string };
  lead?: { id: string; contactName: string; email?: string; phone?: string } | null;
  contact?: { id: string; name: string | null; email: string; phone?: string | null } | null;
  expectedCloseDate?: string | null;
  actualCloseDate?: string | null;
  lostReason?: string | null;
  wonReason?: string | null;
  tags: string[];
  customFields?: Record<string, unknown> | null;
  activities: Array<{
    id: string;
    type: string;
    title: string;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
    performedBy: { name: string | null; email: string };
    createdAt: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    type: string;
    priority: string;
    status: string;
    dueAt?: string | null;
    assignedTo: { name: string | null; email: string };
  }>;
  stageHistory: Array<{
    id: string;
    fromStage?: { name: string; color: string | null } | null;
    toStage: { name: string; color: string | null };
    changedBy: { name: string | null; email: string };
    duration: number;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  purchaseHistory?: {
    recentOrders: Array<{ id: string; orderNumber: string; status: string; total: number; createdAt: string }>;
    totalOrders: number;
    totalSpent: number;
  } | null;
  // Bridge #7: CRM → Telephonie
  callHistory?: {
    recentCalls: Array<{ id: string; direction: string; status: string; duration: number; startedAt: string }>;
    totalCalls: number;
    totalDuration: number;
  } | null;
  // Bridge #11: CRM → Email
  emailHistory?: {
    recentEmails: Array<{ id: string; subject: string; status: string; sentAt: string | null }>;
    totalSent: number;
  } | null;
  // Bridge #15: CRM → Fidélité
  loyaltyInfo?: {
    currentTier: string;
    currentPoints: number;
  } | null;
  // Bridge #50: CRM → Accounting
  accountingInfo?: {
    totalInvoiced: number;
    totalPaid: number;
    outstandingBalance: number;
    recentEntries: Array<{ id: string; entryNumber: string; description: string | null; date: string; type: string }>;
  } | null;
}

// Activity icons handled by ActivityTimeline component

export default function DealDetailPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useParams();
  const dealId = params.id as string;
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'tasks' | 'notes'>('timeline');
  const [mediaBridge, setMediaBridge] = useState<{ enabled: boolean; videos?: Array<{ id: string; title: string; thumbnailUrl: string | null; duration: number | null; views: number; isPublished: boolean }> } | null>(null);

  const reloadDeal = useCallback(async () => {
    const res = await fetch(`/api/admin/crm/deals/${dealId}`);
    const json = await res.json();
    if (json.success) setDeal(json.data);
  }, [dealId]);

  const fmt = useCallback(
    (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(amount),
    [locale]
  );

  useEffect(() => {
    if (!dealId) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/crm/deals/${dealId}`);
        const json = await res.json();
        if (json.success) setDeal(json.data);
        else toast.error(json.error?.message || 'Failed to load deal');
      } catch {
        toast.error('Network error');
      } finally {
        setLoading(false);
      }
    })();
  }, [dealId]);

  // Bridge #49: CRM → Media (lazy)
  useEffect(() => {
    if (!dealId) return;
    fetch(`/api/admin/crm/deals/${dealId}/media`).then(r => r.ok ? r.json() : null).then(json => {
      if (json?.data?.enabled) setMediaBridge(json.data);
    }).catch(() => {});
  }, [dealId]);

  const moveDeal = async (stageId: string) => {
    try {
      const res = await fetch(`/api/admin/crm/deals/${dealId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Stage updated');
        // Reload deal
        const reload = await fetch(`/api/admin/crm/deals/${dealId}`);
        const reloadJson = await reload.json();
        if (reloadJson.success) setDeal(reloadJson.data);
      } else {
        toast.error(json.error?.message || 'Failed to move deal');
      }
    } catch {
      toast.error('Network error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Deal not found</p>
        <button onClick={() => router.push('/admin/crm/pipeline')} className="mt-4 text-teal-600 hover:underline">
          Back to Pipeline
        </button>
      </div>
    );
  }

  const stages = deal.pipeline.stages.sort((a, b) => a.position - b.position);

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/admin/crm/pipeline')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{deal.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              <strong className="text-green-700">{fmt(deal.value)}</strong>
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: deal.stage.color || '#6B7280' }} />
              {deal.stage.name}
            </span>
            {deal.assignedTo && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {deal.assignedTo.name || deal.assignedTo.email}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {deal.contact?.phone && (
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-50 text-green-700 rounded-md hover:bg-green-100">
              <Phone className="h-4 w-4" /> {t('admin.crm.call') || 'Call'}
            </button>
          )}
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-teal-50 text-teal-700 rounded-md hover:bg-teal-100">
            <Mail className="h-4 w-4" /> {t('admin.crm.sendEmail') || 'Email'}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100">
            <ClipboardList className="h-4 w-4" /> {t('admin.crm.addTask') || 'Task'}
          </button>
        </div>
      </div>

      {/* Stage Progress Bar */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="flex items-center gap-1">
          {stages.filter(s => !s.isLost).map((stage, i) => {
            const currentPos = stages.find(s => s.id === deal.stage.id)?.position || 0;
            const isPast = stage.position < currentPos;
            const isCurrent = stage.id === deal.stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => moveDeal(stage.id)}
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all ${
                  isCurrent
                    ? 'text-white shadow-sm'
                    : isPast
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={isCurrent ? { backgroundColor: stage.color || '#3B82F6' } : undefined}
              >
                {stage.name}
                {i < stages.filter(s => !s.isLost).length - 1 && !isCurrent && !isPast && (
                  <span className="ml-1 text-gray-400">{Math.round(stage.probability * 100)}%</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="bg-white rounded-lg border">
            <div className="flex border-b">
              {(['timeline', 'tasks', 'notes'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-teal-500 text-teal-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'timeline' ? t('admin.crm.timeline') || 'Timeline' : tab === 'tasks' ? t('admin.crm.tasks') || 'Tasks' : t('admin.crm.notes') || 'Notes'}
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === 'timeline' && (
                <ActivityTimeline
                  activities={deal.activities}
                  dealId={dealId}
                  onActivityAdded={reloadDeal}
                  bare
                />
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  {deal.tasks.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No tasks yet</p>
                  )}
                  {deal.tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                      <div className={`w-2 h-2 rounded-full ${
                        task.status === 'COMPLETED' ? 'bg-green-500' : task.priority === 'URGENT' ? 'bg-red-500' : task.priority === 'HIGH' ? 'bg-orange-500' : 'bg-teal-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${task.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                          <span>{task.type}</span>
                          {task.dueAt && <span>Due: {new Date(task.dueAt).toLocaleDateString(locale)}</span>}
                          <span>{task.assignedTo.name || task.assignedTo.email}</span>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        task.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : task.status === 'IN_PROGRESS' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-3">
                  {deal.activities.filter(a => a.type === 'NOTE').length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No notes yet</p>
                  )}
                  {deal.activities.filter(a => a.type === 'NOTE').map((note) => (
                    <div key={note.id} className="p-3 rounded-lg bg-yellow-50 border border-yellow-100">
                      <p className="text-sm text-gray-800">{note.description || note.title}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <span>{note.performedBy.name || note.performedBy.email}</span>
                        <span>{new Date(note.createdAt).toLocaleString(locale)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stage History */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('admin.crm.stageHistory') || 'Stage History'}</h3>
            <div className="space-y-3">
              {deal.stageHistory.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 text-sm">
                  <ArrowRightLeft className="h-4 w-4 text-gray-400" />
                  <div>
                    {entry.fromStage ? (
                      <span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fromStage.color || '#6B7280' }} />
                          {entry.fromStage.name}
                        </span>
                        {' → '}
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.toStage.color || '#6B7280' }} />
                          {entry.toStage.name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-green-600">Created in {entry.toStage.name}</span>
                    )}
                    {entry.duration > 0 && (
                      <span className="text-gray-400 ml-2">({Math.round(entry.duration / 86400)}d in previous stage)</span>
                    )}
                  </div>
                  <div className="ml-auto text-xs text-gray-400">
                    {entry.changedBy.name || entry.changedBy.email} - {new Date(entry.createdAt).toLocaleString(locale)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Deal Details Card */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">{t('admin.crm.dealDetails') || 'Details'}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('admin.crm.pipeline') || 'Pipeline'}</span>
                <span className="text-gray-900">{deal.pipeline.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('admin.crm.probability') || 'Probability'}</span>
                <span className="text-gray-900">{Math.round(deal.stage.probability * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('admin.crm.weightedValue') || 'Weighted'}</span>
                <span className="text-green-700 font-medium">{fmt(deal.value * deal.stage.probability)}</span>
              </div>
              {deal.expectedCloseDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('admin.crm.expectedClose') || 'Expected Close'}</span>
                  <span className="text-gray-900">{new Date(deal.expectedCloseDate).toLocaleDateString(locale)}</span>
                </div>
              )}
              {deal.actualCloseDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('admin.crm.closedDate') || 'Closed'}</span>
                  <span className="text-gray-900">{new Date(deal.actualCloseDate).toLocaleDateString(locale)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">{t('common.createdAt') || 'Created'}</span>
                <span className="text-gray-900">{new Date(deal.createdAt).toLocaleDateString(locale)}</span>
              </div>
            </div>
          </div>

          {/* Contact Card */}
          {(deal.contact || deal.lead) && (
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">{t('admin.crm.contact') || 'Contact'}</h3>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-gray-900">{deal.contact?.name || deal.lead?.contactName}</p>
                {(deal.contact?.email || deal.lead?.email) && (
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Mail className="h-3.5 w-3.5" />
                    {deal.contact?.email || deal.lead?.email}
                  </div>
                )}
                {(deal.contact?.phone || deal.lead?.phone) && (
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Phone className="h-3.5 w-3.5" />
                    {deal.contact?.phone || deal.lead?.phone}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Purchase History Card (e-commerce bridge) */}
          {deal.purchaseHistory && (
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4" />
                {t('admin.crm.purchaseHistory') || 'Purchase History'}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('admin.crm.totalOrders') || 'Total Orders'}</span>
                  <span className="font-medium text-gray-900">{deal.purchaseHistory.totalOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('admin.crm.totalSpent') || 'Total Spent'}</span>
                  <span className="font-medium text-green-700">{fmt(deal.purchaseHistory.totalSpent)}</span>
                </div>
              </div>
              {deal.purchaseHistory.recentOrders.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-500 pt-1">{t('admin.crm.recentOrders') || 'Recent Orders'}</p>
                  <div className="space-y-1.5">
                    {deal.purchaseHistory.recentOrders.map((order) => (
                      <Link
                        key={order.id}
                        href={`/admin/commandes?order=${order.id}`}
                        className="flex items-center justify-between text-xs p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <span className="font-mono text-gray-700">{order.orderNumber}</span>
                        <span className="text-green-700 font-medium">{fmt(order.total)}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
              {deal.contact && (
                <Link
                  href={`/admin/customers/${deal.contact.id}`}
                  className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 pt-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('admin.crm.viewFullProfile') || 'View full customer profile'}
                </Link>
              )}
            </div>
          )}

          {/* Bridge #7: CRM → Telephonie (Call History) */}
          {deal.callHistory && deal.callHistory.totalCalls > 0 && (
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <PhoneCall className="h-4 w-4" />
                {t('admin.crm.callHistory') || 'Call History'}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('admin.crm.totalCalls') || 'Total Calls'}</span>
                  <span className="font-medium text-gray-900">{deal.callHistory.totalCalls}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('admin.crm.totalDuration') || 'Total Duration'}</span>
                  <span className="font-medium text-gray-900">
                    {Math.floor(deal.callHistory.totalDuration / 60)}m {deal.callHistory.totalDuration % 60}s
                  </span>
                </div>
              </div>
              {deal.callHistory.recentCalls.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-500 pt-1">{t('admin.crm.recentCalls') || 'Recent Calls'}</p>
                  <div className="space-y-1.5">
                    {deal.callHistory.recentCalls.map((call) => (
                      <div
                        key={call.id}
                        className="flex items-center justify-between text-xs p-2 rounded-md bg-gray-50"
                      >
                        <span className={`px-1.5 py-0.5 rounded ${
                          call.direction === 'INBOUND' ? 'bg-teal-100 text-teal-700' : 'bg-green-100 text-green-700'
                        }`}>{call.direction}</span>
                        <span className="text-gray-500">{Math.floor(call.duration / 60)}m {call.duration % 60}s</span>
                        <span className="text-gray-400">{new Date(call.startedAt).toLocaleDateString(locale)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Bridge #11: CRM → Email (Email History) */}
          {deal.emailHistory && deal.emailHistory.totalSent > 0 && (
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Inbox className="h-4 w-4" />
                {t('admin.crm.emailHistory') || 'Email History'}
              </h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('admin.crm.totalEmails') || 'Total Emails'}</span>
                <span className="font-medium text-gray-900">{deal.emailHistory.totalSent}</span>
              </div>
              {deal.emailHistory.recentEmails.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-500 pt-1">{t('admin.crm.recentEmails') || 'Recent Emails'}</p>
                  <div className="space-y-1.5">
                    {deal.emailHistory.recentEmails.map((email) => (
                      <div
                        key={email.id}
                        className="text-xs p-2 rounded-md bg-gray-50"
                      >
                        <p className="text-gray-700 truncate">{email.subject}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-gray-400">
                          <span className={`px-1 py-0.5 rounded ${
                            email.status === 'delivered' ? 'bg-green-100 text-green-700' :
                            email.status === 'opened' ? 'bg-teal-100 text-teal-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{email.status}</span>
                          {email.sentAt && <span>{new Date(email.sentAt).toLocaleDateString(locale)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Bridge #15: CRM → Fidélité */}
          {deal.loyaltyInfo && (
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Star className="h-4 w-4" />
                {t('admin.crm.loyaltyInfo') || 'Loyalty'}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('admin.orders.loyalty.currentTier') || 'Tier'}</span>
                  <span className="font-medium text-purple-700">{deal.loyaltyInfo.currentTier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('admin.orders.loyalty.pointsEarned') || 'Points'}</span>
                  <span className="font-medium text-gray-900">{deal.loyaltyInfo.currentPoints.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Bridge #50: CRM → Accounting */}
          {deal.accountingInfo && (
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Calculator className="h-4 w-4" />
                {t('admin.bridges.accountingInfo') || 'Accounting'}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('admin.bridges.totalInvoiced') || 'Total Invoiced'}</span>
                  <span className="font-medium text-gray-900">{fmt(deal.accountingInfo.totalInvoiced)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('admin.bridges.totalPaid') || 'Total Paid'}</span>
                  <span className="font-medium text-green-700">{fmt(deal.accountingInfo.totalPaid)}</span>
                </div>
                {deal.accountingInfo.outstandingBalance > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('admin.bridges.outstandingBalance') || 'Outstanding'}</span>
                    <span className="font-medium text-red-600">{fmt(deal.accountingInfo.outstandingBalance)}</span>
                  </div>
                )}
              </div>
              {deal.accountingInfo.recentEntries.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-500 pt-1">{t('admin.bridges.recentEntries') || 'Recent Entries'}</p>
                  <div className="space-y-1.5">
                    {deal.accountingInfo.recentEntries.slice(0, 3).map((entry) => (
                      <Link
                        key={entry.id}
                        href="/admin/comptabilite/ecritures"
                        className="flex items-center justify-between text-xs p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <span className="font-mono text-gray-700">{entry.entryNumber}</span>
                        <span className="text-gray-400">{new Date(entry.date).toLocaleDateString(locale)}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Bridge #49: CRM → Media */}
          {mediaBridge?.enabled && (mediaBridge.videos ?? []).length > 0 && (
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Video className="h-4 w-4" />
                {t('admin.bridges.dealMedia') || 'Deal Videos'}
                <span className="text-xs font-normal text-gray-400">({mediaBridge.videos?.length})</span>
              </h3>
              <div className="space-y-1.5">
                {mediaBridge.videos?.slice(0, 5).map((vid) => (
                  <Link
                    key={vid.id}
                    href={`/admin/media/videos/${vid.id}`}
                    className="flex items-center justify-between text-xs p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Video className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="font-medium text-gray-700 truncate">{vid.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-gray-400">{vid.views} {t('admin.bridges.views')}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${vid.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {vid.isPublished ? '●' : '○'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {deal.tags.length > 0 && (
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('admin.crm.tags') || 'Tags'}</h3>
              <div className="flex flex-wrap gap-1.5">
                {deal.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-700">
                    <Tag className="h-3 w-3" />{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {deal.wonReason && (
            <div className="bg-green-50 rounded-lg border border-green-200 p-4">
              <h3 className="text-sm font-semibold text-green-700 mb-1">Won Reason</h3>
              <p className="text-sm text-green-600">{deal.wonReason}</p>
            </div>
          )}
          {deal.lostReason && (
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <h3 className="text-sm font-semibold text-red-700 mb-1">Lost Reason</h3>
              <p className="text-sm text-red-600">{deal.lostReason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
