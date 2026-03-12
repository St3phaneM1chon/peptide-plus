'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  ArrowLeft, Phone, Mail, Building2, Tag,
  Flame, Thermometer, Snowflake, ShieldAlert,
  DollarSign,
} from 'lucide-react';
import { ActivityTimeline } from '@/components/admin/crm/ActivityTimeline';
import { ScoreBreakdown } from '@/components/admin/crm/ScoreBreakdown';
import { InlineEdit } from '@/components/admin/crm/InlineEdit';

interface ContactDetail {
  id: string;
  contactName: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  source: string;
  status: string;
  score: number;
  temperature: string;
  dncStatus: string;
  assignedTo?: { id: string; name: string | null; email: string } | null;
  tags: string[];
  customFields?: Record<string, unknown> | null;
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
  timezone?: string | null;
  preferredLang?: string | null;
  createdAt: string;
  updatedAt: string;
  deals: Array<{
    id: string;
    title: string;
    value: number;
    stage: { name: string; color?: string | null };
  }>;
  tasks: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    dueAt?: string | null;
    priority: string;
  }>;
  activities: Array<{
    id: string;
    type: string;
    title: string;
    description?: string | null;
    performedBy: { name: string | null; email: string };
    createdAt: string;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-indigo-100 text-indigo-700',
  CONTACTED: 'bg-yellow-100 text-yellow-700',
  QUALIFIED: 'bg-green-100 text-green-700',
  UNQUALIFIED: 'bg-gray-100 text-gray-600',
  CONVERTED: 'bg-purple-100 text-purple-700',
  LOST: 'bg-red-100 text-red-700',
};

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'UNQUALIFIED', label: 'Unqualified' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'LOST', label: 'Lost' },
];

export default function ContactDetailPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'tasks'>('timeline');

  const fmt = useCallback(
    (n: number) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(n),
    [locale]
  );

  const fetchContact = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/crm/contacts/${contactId}`);
      const json = await res.json();
      if (json.success) setContact(json.data);
      else toast.error(json.error?.message || 'Failed to load contact');
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    if (contactId) fetchContact();
  }, [contactId, fetchContact]);

  const updateField = useCallback(
    async (field: string, value: string) => {
      try {
        const res = await fetch(`/api/admin/crm/contacts/${contactId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value || null }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(t('common.saved'));
          fetchContact();
        } else {
          toast.error(json.error?.message || 'Update failed');
          throw new Error('Update failed');
        }
      } catch (e) {
        if (!(e instanceof Error && e.message === 'Update failed'))
          toast.error('Network error');
        throw e;
      }
    },
    [contactId, fetchContact, t]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>{t('admin.crm.contactNotFound')}</p>
        <button
          onClick={() => router.push('/admin/crm')}
          className="mt-4 text-indigo-600 hover:underline"
        >
          {t('admin.crm.backToCrm')}
        </button>
      </div>
    );
  }

  const TempIcon =
    contact.temperature === 'HOT'
      ? Flame
      : contact.temperature === 'WARM'
        ? Thermometer
        : Snowflake;
  const tempColor =
    contact.temperature === 'HOT'
      ? 'text-red-500'
      : contact.temperature === 'WARM'
        ? 'text-orange-500'
        : 'text-blue-400';

  const lastActivityAt =
    contact.activities.length > 0 ? contact.activities[0].createdAt : null;

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/admin/crm')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {contact.contactName}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[contact.status] || ''}`}
            >
              {contact.status}
            </span>
            <TempIcon className={`h-5 w-5 ${tempColor}`} />
            {contact.dncStatus !== 'CALLABLE' && (
              <ShieldAlert className="h-5 w-5 text-red-500" />
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {contact.companyName && (
              <span className="me-3">
                <Building2 className="h-3.5 w-3.5 inline me-1" />
                {contact.companyName}
              </span>
            )}
            {contact.email && (
              <span className="me-3">
                <Mail className="h-3.5 w-3.5 inline me-1" />
                {contact.email}
              </span>
            )}
            {contact.phone && (
              <span>
                <Phone className="h-3.5 w-3.5 inline me-1" />
                {contact.phone}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {contact.phone && (
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-50 text-green-700 rounded-md hover:bg-green-100">
              <Phone className="h-4 w-4" /> {t('admin.crm.call')}
            </button>
          )}
          {contact.email && (
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100">
              <Mail className="h-4 w-4" /> {t('admin.crm.sendEmail')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="bg-white rounded-lg border">
            <div className="flex border-b">
              {(['timeline', 'tasks'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'timeline'
                    ? t('admin.crm.timeline')
                    : t('admin.crm.tasks')}
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === 'timeline' && (
                <ActivityTimeline
                  activities={contact.activities}
                  leadId={contactId}
                  onActivityAdded={fetchContact}
                  bare
                />
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  {contact.tasks.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      {t('admin.crm.noTasks')}
                    </p>
                  )}
                  {contact.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          task.status === 'COMPLETED'
                            ? 'bg-green-500'
                            : task.priority === 'URGENT'
                              ? 'bg-red-500'
                              : task.priority === 'HIGH'
                                ? 'bg-orange-500'
                                : 'bg-indigo-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${task.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-900'}`}
                        >
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                          <span>{task.type}</span>
                          {task.dueAt && (
                            <span>
                              Due:{' '}
                              {new Date(task.dueAt).toLocaleDateString(locale)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          task.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700'
                            : task.status === 'IN_PROGRESS'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Score Breakdown */}
          <ScoreBreakdown
            score={contact.score}
            temperature={contact.temperature}
            email={contact.email}
            phone={contact.phone}
            companyName={contact.companyName}
            lastContactedAt={contact.lastContactedAt}
            lastActivityAt={lastActivityAt}
            source={contact.source}
          />

          {/* Details with inline edit */}
          <div className="bg-white rounded-lg border p-4 space-y-2.5">
            <h3 className="font-semibold text-gray-700 text-sm mb-2">
              {t('admin.crm.details')}
            </h3>
            <InlineEdit
              label="Email"
              value={contact.email || ''}
              type="email"
              onSave={(v) => updateField('email', v)}
            />
            <InlineEdit
              label={t('admin.crm.phone')}
              value={contact.phone || ''}
              type="tel"
              onSave={(v) => updateField('phone', v)}
            />
            <InlineEdit
              label={t('admin.crm.company')}
              value={contact.companyName || ''}
              onSave={(v) => updateField('companyName', v)}
            />
            <InlineEdit
              label="Source"
              value={contact.source}
              type="select"
              options={[
                { value: 'WEB', label: 'Web' },
                { value: 'REFERRAL', label: 'Referral' },
                { value: 'IMPORT', label: 'Import' },
                { value: 'CAMPAIGN', label: 'Campaign' },
                { value: 'MANUAL', label: 'Manual' },
                { value: 'PARTNER', label: 'Partner' },
                { value: 'EMAIL', label: 'Email' },
                { value: 'SOCIAL', label: 'Social' },
                { value: 'CHATBOT', label: 'Chatbot' },
              ]}
              onSave={(v) => updateField('source', v)}
            />
            <InlineEdit
              label="Status"
              value={contact.status}
              type="select"
              options={STATUS_OPTIONS}
              onSave={(v) => updateField('status', v)}
            />
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                {t('admin.crm.assignedTo')}
              </span>
              <span>
                {contact.assignedTo?.name || contact.assignedTo?.email || '-'}
              </span>
            </div>
            <InlineEdit
              label="Timezone"
              value={contact.timezone || ''}
              onSave={(v) => updateField('timezone', v)}
            />
            <InlineEdit
              label={t('admin.crm.language')}
              value={contact.preferredLang || ''}
              onSave={(v) => updateField('preferredLang', v)}
            />
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                {t('common.createdAt')}
              </span>
              <span className="text-gray-900">
                {new Date(contact.createdAt).toLocaleDateString(locale)}
              </span>
            </div>
            {contact.lastContactedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  {t('admin.crm.lastContact')}
                </span>
                <span>
                  {new Date(contact.lastContactedAt).toLocaleDateString(locale)}
                </span>
              </div>
            )}
            {contact.nextFollowUpAt && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  {t('admin.crm.nextFollowUp')}
                </span>
                <span>
                  {new Date(contact.nextFollowUpAt).toLocaleDateString(locale)}
                </span>
              </div>
            )}
          </div>

          {/* Deals */}
          {contact.deals.length > 0 && (
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                {t('admin.crm.deals')}
              </h3>
              <div className="space-y-2">
                {contact.deals.map((deal) => (
                  <button
                    key={deal.id}
                    onClick={() => router.push(`/admin/crm/deals/${deal.id}`)}
                    className="w-full flex items-center justify-between p-2 rounded bg-gray-50 hover:bg-gray-100 text-sm transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {deal.stage?.color && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: deal.stage.color }}
                        />
                      )}
                      <span>{deal.title}</span>
                    </div>
                    <span className="text-green-700 font-medium">
                      {fmt(deal.value)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {contact.tags.length > 0 && (
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                {t('admin.crm.tags')}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-700"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
