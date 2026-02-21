'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  User,
  CalendarDays,
  Clock,
  Users,
  Video,
  CheckCircle,
  BarChart3,
  ExternalLink,
} from 'lucide-react';

import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { FormField, Input, Textarea } from '@/components/admin/FormField';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────

interface Webinar {
  id: string;
  title: string;
  description: string;
  host: string;
  scheduledAt: string;
  duration: number;
  meetingUrl?: string;
  recordingUrl?: string;
  maxAttendees: number;
  registeredCount: number;
  attendedCount: number;
  status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

function statusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (status) {
    case 'DRAFT': return 'neutral';
    case 'SCHEDULED': return 'info';
    case 'LIVE': return 'error';
    case 'COMPLETED': return 'success';
    case 'CANCELLED': return 'neutral';
    default: return 'neutral';
  }
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

// ── Main Component ────────────────────────────────────────────

export default function WebinairesPage() {
  const { t, locale } = useI18n();
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWebinarId, setSelectedWebinarId] = useState<string | null>(null);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form modal state (Create/Edit)
  const [showForm, setShowForm] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_editingWebinar, _setEditingWebinar] = useState<Webinar | null>(null);

  // ─── Data fetching ──────────────────────────────────────────

  useEffect(() => {
    fetchWebinars();
  }, []);

  const fetchWebinars = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/webinars');
      if (res.ok) {
        const data = await res.json();
        const rawWebinars = data.webinars || [];
        setWebinars(
          rawWebinars.map((w: Record<string, unknown>) => ({
            id: w.id as string,
            title: (w.title as string) || '',
            description: (w.description as string) || '',
            host: (w.speaker as string) || '',
            scheduledAt: (w.scheduledAt as string) || '',
            duration: (w.duration as number) || 60,
            meetingUrl: (w.registrationUrl as string) || undefined,
            recordingUrl: (w.recordingUrl as string) || undefined,
            maxAttendees: (w.maxAttendees as number) || 100,
            registeredCount: (w.registeredCount as number) || 0,
            attendedCount: (w.attendedCount as number) || 0,
            status: (w.status as Webinar['status']) || 'DRAFT',
            createdAt: (w.createdAt as string) || '',
          }))
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWebinar = useCallback((id: string) => {
    setSelectedWebinarId(id);
  }, []);

  // ─── Filtering ──────────────────────────────────────────────

  const filteredWebinars = useMemo(() => {
    return webinars.filter((w) => {
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (
          !w.title.toLowerCase().includes(search) &&
          !w.host.toLowerCase().includes(search) &&
          !w.description.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [webinars, statusFilter, searchValue]);

  const stats = useMemo(() => ({
    upcoming: webinars.filter(w => w.status === 'SCHEDULED').length,
    completed: webinars.filter(w => w.status === 'COMPLETED').length,
    totalRegistered: webinars.filter(w => w.status === 'SCHEDULED').reduce((sum, w) => sum + w.registeredCount, 0),
    avgAttendance: webinars.filter(w => w.status === 'COMPLETED' && w.registeredCount > 0)
      .reduce((sum, w) => sum + (w.attendedCount / w.registeredCount * 100), 0) /
      webinars.filter(w => w.status === 'COMPLETED' && w.registeredCount > 0).length || 0,
  }), [webinars]);

  // ─── ContentList data ───────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.webinars.title'), count: webinars.length },
    { key: 'SCHEDULED', label: t('admin.webinars.upcoming'), count: stats.upcoming },
    { key: 'COMPLETED', label: t('admin.webinars.completed'), count: stats.completed },
    { key: 'DRAFT', label: 'Draft', count: webinars.filter(w => w.status === 'DRAFT').length },
  ], [t, webinars, stats]);

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredWebinars.map((w) => ({
      id: w.id,
      avatar: { text: w.title.charAt(0) },
      title: w.title,
      subtitle: w.scheduledAt
        ? `${new Date(w.scheduledAt).toLocaleDateString(locale)} - ${w.host}`
        : w.host,
      preview: `${w.registeredCount}/${w.maxAttendees} ${t('admin.webinars.registered')} - ${w.duration} min`,
      timestamp: w.scheduledAt || w.createdAt,
      badges: [
        { text: statusLabel(w.status), variant: statusBadgeVariant(w.status) },
        ...(w.recordingUrl
          ? [{ text: 'Replay', variant: 'info' as const }]
          : []),
      ],
    }));
  }, [filteredWebinars, locale, t]);

  const selectedWebinar = useMemo(() => {
    return webinars.find((w) => w.id === selectedWebinarId) || null;
  }, [webinars, selectedWebinarId]);

  // ─── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stat cards row */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.webinars.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.webinars.subtitle')}</p>
          </div>
          <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>
            {t('admin.webinars.newWebinar')}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label={t('admin.webinars.upcoming')} value={stats.upcoming} icon={CalendarDays} />
          <StatCard label={t('admin.webinars.completed')} value={stats.completed} icon={CheckCircle} />
          <StatCard label={t('admin.webinars.registeredUpcoming')} value={stats.totalRegistered} icon={Users} />
          <StatCard label={t('admin.webinars.avgAttendanceRate')} value={`${stats.avgAttendance.toFixed(0)}%`} icon={BarChart3} />
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={400}
          showDetail={!!selectedWebinarId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedWebinarId}
              onSelect={handleSelectWebinar}
              filterTabs={filterTabs}
              activeFilter={statusFilter}
              onFilterChange={setStatusFilter}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.webinars.searchPlaceholder') || 'Rechercher un webinaire...'}
              loading={loading}
              emptyIcon={Video}
              emptyTitle={t('admin.webinars.noWebinars')}
              emptyDescription={t('admin.webinars.startCreating')}
            />
          }
          detail={
            selectedWebinar ? (
              <DetailPane
                header={{
                  title: selectedWebinar.title,
                  subtitle: selectedWebinar.scheduledAt
                    ? `${new Date(selectedWebinar.scheduledAt).toLocaleDateString(locale)} ${t('admin.webinars.atTime')} ${new Date(selectedWebinar.scheduledAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
                    : '',
                  avatar: { text: selectedWebinar.title.charAt(0) },
                  onBack: () => setSelectedWebinarId(null),
                  backLabel: t('admin.webinars.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      {selectedWebinar.status === 'SCHEDULED' && (
                        <>
                          <Button variant="outline" size="sm">{t('admin.webinars.editWebinar')}</Button>
                          <Button variant="danger" size="sm">{t('admin.webinars.cancelWebinar')}</Button>
                        </>
                      )}
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Status badge */}
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      selectedWebinar.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      selectedWebinar.status === 'SCHEDULED' ? 'bg-sky-100 text-sky-800' :
                      selectedWebinar.status === 'LIVE' ? 'bg-red-100 text-red-800' :
                      selectedWebinar.status === 'CANCELLED' ? 'bg-slate-100 text-slate-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {selectedWebinar.status}
                    </span>
                  </div>

                  {/* Description */}
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">{t('admin.webinars.formDescription')}</h3>
                    <p className="text-slate-600">{selectedWebinar.description}</p>
                  </div>

                  {/* Details Grid */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.webinars.formTitle') || 'Details'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">{t('admin.webinars.formHost')}</p>
                          <p className="text-slate-900 font-medium">{selectedWebinar.host}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">{t('admin.webinars.formDateTime')}</p>
                          <p className="text-slate-900">
                            {selectedWebinar.scheduledAt
                              ? new Date(selectedWebinar.scheduledAt).toLocaleString(locale)
                              : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">{t('admin.webinars.formDuration')}</p>
                          <p className="text-slate-900">{selectedWebinar.duration} min</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">{t('admin.webinars.formMaxSeats')}</p>
                          <p className="text-slate-900">{selectedWebinar.maxAttendees}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Registration & Attendance */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.webinars.registeredUpcoming')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-2xl font-bold text-slate-900">{selectedWebinar.registeredCount}</p>
                        <p className="text-xs text-slate-500">{t('admin.webinars.registered')}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-2xl font-bold text-slate-900">{selectedWebinar.maxAttendees}</p>
                        <p className="text-xs text-slate-500">{t('admin.webinars.formMaxSeats')}</p>
                      </div>
                      {selectedWebinar.status === 'COMPLETED' && (
                        <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                          <p className="text-2xl font-bold text-slate-900">{selectedWebinar.attendedCount}</p>
                          <p className="text-xs text-slate-500">{t('admin.webinars.attended', { count: String(selectedWebinar.attendedCount) })}</p>
                        </div>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>{t('admin.webinars.registered')}</span>
                        <span>{Math.round((selectedWebinar.registeredCount / selectedWebinar.maxAttendees) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-sky-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min((selectedWebinar.registeredCount / selectedWebinar.maxAttendees) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="space-y-3">
                    {selectedWebinar.meetingUrl && (
                      <a
                        href={selectedWebinar.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-3 bg-sky-50 border border-sky-200 rounded-lg text-sky-700 hover:bg-sky-100 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="text-sm font-medium">{t('admin.webinars.formMeetingLink')}</span>
                      </a>
                    )}
                    {selectedWebinar.recordingUrl && (
                      <a
                        href={selectedWebinar.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors"
                      >
                        <Video className="w-4 h-4" />
                        <span className="text-sm font-medium">{t('admin.webinars.viewReplay')}</span>
                      </a>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button variant="ghost" size="sm" icon={Users}>
                      {t('admin.webinars.viewRegistered')}
                    </Button>
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Video}
                emptyTitle={t('admin.webinars.noWebinars')}
                emptyDescription={t('admin.webinars.startCreating')}
              />
            )
          }
        />
      </div>

      {/* ─── CREATE/EDIT FORM MODAL ─────────────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={t('admin.webinars.newWebinar')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              {t('admin.webinars.cancelButton')}
            </Button>
            <Button variant="primary">
              {t('admin.webinars.create')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.webinars.formTitle')} required>
            <Input type="text" />
          </FormField>
          <FormField label={t('admin.webinars.formDescription')} required>
            <Textarea rows={3} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.webinars.formDateTime')} required>
              <Input type="datetime-local" />
            </FormField>
            <FormField label={t('admin.webinars.formDuration')} required>
              <Input type="number" defaultValue={60} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.webinars.formHost')} required>
              <Input type="text" />
            </FormField>
            <FormField label={t('admin.webinars.formMaxSeats')}>
              <Input type="number" defaultValue={100} />
            </FormField>
          </div>
          <FormField label={t('admin.webinars.formMeetingLink')}>
            <Input type="url" placeholder={t('admin.webinars.formMeetingPlaceholder')} />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
