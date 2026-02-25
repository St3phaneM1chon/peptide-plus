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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

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
  const [editingWebinar, setEditingWebinar] = useState<Webinar | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // UX FIX: ConfirmDialog for cancel action
  const [confirmCancel, setConfirmCancel] = useState<{
    isOpen: boolean;
    webinar: Webinar | null;
  }>({ isOpen: false, webinar: null });

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDateTime, setFormDateTime] = useState('');
  const [formDuration, setFormDuration] = useState(60);
  const [formHost, setFormHost] = useState('');
  const [formMaxSeats, setFormMaxSeats] = useState(100);
  const [formMeetingLink, setFormMeetingLink] = useState('');

  // ─── Data fetching ──────────────────────────────────────────

  // FIX: FLAW-055 - Wrap fetchWebinars in useCallback for stable reference
  const fetchWebinars = useCallback(async () => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    fetchWebinars();
  }, [fetchWebinars]);

  const handleSelectWebinar = useCallback((id: string) => {
    setSelectedWebinarId(id);
  }, []);

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormDateTime('');
    setFormDuration(60);
    setFormHost('');
    setFormMaxSeats(100);
    setFormMeetingLink('');
  };

  const openCreateForm = () => {
    setEditingWebinar(null);
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (webinar: Webinar) => {
    setEditingWebinar(webinar);
    setFormTitle(webinar.title);
    setFormDescription(webinar.description);
    setFormDateTime(webinar.scheduledAt ? webinar.scheduledAt.slice(0, 16) : '');
    setFormDuration(webinar.duration);
    setFormHost(webinar.host);
    setFormMaxSeats(webinar.maxAttendees);
    setFormMeetingLink(webinar.meetingUrl || '');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingWebinar(null);
    resetForm();
  };

  const handleSubmitWebinar = async () => {
    // UX FIX: Validate form fields with inline error messages
    const errors: Record<string, string> = {};
    if (!formTitle.trim()) {
      errors.title = t('admin.webinars.titleRequired') || 'Title is required';
    }
    if (!formDescription.trim()) {
      errors.description = t('admin.webinars.descriptionRequired') || 'Description is required';
    }
    if (!formHost.trim()) {
      errors.host = t('admin.webinars.hostRequired') || 'Host name is required';
    }
    if (!formDateTime) {
      errors.dateTime = t('admin.webinars.dateTimeRequired') || 'Date and time are required';
    }
    if (formDuration <= 0) {
      errors.duration = t('admin.webinars.durationRequired') || 'Duration must be greater than 0';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const isEdit = !!editingWebinar;
      const url = isEdit
        ? `/api/admin/webinars/${editingWebinar.id}`
        : '/api/admin/webinars';
      const method = isEdit ? 'PATCH' : 'POST';

      const body = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        scheduledAt: formDateTime || null,
        duration: formDuration,
        speaker: formHost.trim(),
        registrationUrl: formMeetingLink.trim() || null,
        maxAttendees: formMaxSeats,
        isPublished: !!formDateTime,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t(isEdit ? 'admin.webinars.updateError' : 'admin.webinars.createError'));
        return;
      }

      toast.success(t(isEdit ? 'admin.webinars.updateSuccess' : 'admin.webinars.createSuccess'));
      closeForm();
      fetchWebinars();
    } catch {
      toast.error(t('admin.webinars.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  // UX FIX: Actual cancel execution (called after confirmation)
  const executeCancelWebinar = async (webinar: Webinar) => {
    try {
      const res = await fetch(`/api/admin/webinars/${webinar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED', isPublished: false }),
      });
      if (!res.ok) {
        toast.error(t('admin.webinars.cancelError'));
        return;
      }
      toast.success(t('admin.webinars.cancelSuccess'));
      fetchWebinars();
    } catch {
      toast.error(t('admin.webinars.cancelError'));
    }
  };

  // UX FIX: Replaced native confirm() with ConfirmDialog
  const handleCancelWebinar = (webinar: Webinar) => {
    setConfirmCancel({
      isOpen: true,
      webinar,
    });
  };

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

  // ─── Ribbon action handlers ────────────────────────────────
  const handleRibbonNewWebinar = useCallback(() => {
    openCreateForm();
  }, []);

  const handleRibbonDelete = useCallback(() => {
    if (!selectedWebinar) { toast.info(t('admin.webinars.selectWebinarFirst') || 'Select a webinar first'); return; }
    handleCancelWebinar(selectedWebinar);
  }, [selectedWebinar, t]);

  const handleRibbonSchedule = useCallback(() => {
    if (!selectedWebinar) { toast.info(t('admin.webinars.selectWebinarFirst') || 'Select a webinar first'); return; }
    openEditForm(selectedWebinar);
  }, [selectedWebinar, t]);

  const handleRibbonLaunchNow = useCallback(async () => {
    if (!selectedWebinar) {
      toast.info(t('admin.webinars.selectWebinarFirst') || 'Select a webinar first');
      return;
    }
    if (selectedWebinar.meetingUrl) {
      window.open(selectedWebinar.meetingUrl, '_blank');
    } else {
      toast.info(t('admin.webinars.noMeetingLink') || 'No meeting link configured. Edit the webinar to add one.');
    }
  }, [selectedWebinar, t]);

  const handleRibbonRecording = useCallback(() => {
    if (selectedWebinar?.recordingUrl) {
      window.open(selectedWebinar.recordingUrl, '_blank');
    } else {
      toast.info(t('admin.webinars.noRecording') || 'No recording available for this webinar');
    }
  }, [selectedWebinar, t]);

  const handleRibbonParticipantStats = useCallback(() => {
    if (!selectedWebinar) {
      toast.info(t('admin.webinars.selectWebinarFirst') || 'Select a webinar first');
      return;
    }
    toast.info(
      `${selectedWebinar.title}: ${selectedWebinar.registeredCount} ${t('admin.webinars.registered') || 'registered'}, ${selectedWebinar.attendedCount} ${t('admin.webinars.attended') || 'attended'} (${selectedWebinar.registeredCount > 0 ? Math.round((selectedWebinar.attendedCount / selectedWebinar.registeredCount) * 100) : 0}%)`
    );
  }, [selectedWebinar, t]);

  const handleRibbonExport = useCallback(() => {
    if (webinars.length === 0) {
      toast.info(t('admin.webinars.noWebinars') || 'No webinars to export');
      return;
    }
    const BOM = '\uFEFF';
    const headers = ['Title', 'Host', 'Status', 'Scheduled At', 'Duration (min)', 'Registered', 'Attended', 'Max Attendees', 'Meeting URL'];
    const rows = webinars.map(w => [
      w.title,
      w.host,
      w.status,
      w.scheduledAt ? new Date(w.scheduledAt).toLocaleString(locale) : '',
      String(w.duration),
      String(w.registeredCount),
      String(w.attendedCount),
      String(w.maxAttendees),
      w.meetingUrl || '',
    ]);
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webinars-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported') || 'Exported successfully');
  }, [webinars, locale, t]);

  useRibbonAction('newWebinar', handleRibbonNewWebinar);
  useRibbonAction('delete', handleRibbonDelete);
  useRibbonAction('schedule', handleRibbonSchedule);
  useRibbonAction('launchNow', handleRibbonLaunchNow);
  useRibbonAction('recording', handleRibbonRecording);
  useRibbonAction('participantStats', handleRibbonParticipantStats);
  useRibbonAction('export', handleRibbonExport);

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
          <Button variant="primary" icon={Plus} onClick={openCreateForm}>
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
                          <Button variant="outline" size="sm" onClick={() => openEditForm(selectedWebinar)}>{t('admin.webinars.editWebinar')}</Button>
                          <Button variant="danger" size="sm" onClick={() => handleCancelWebinar(selectedWebinar)}>{t('admin.webinars.cancelWebinar')}</Button>
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
                  {/* FIX: FLAW-022 - Button was a non-functional stub with no onClick handler.
                      Disabled until WebinarRegistration model is created (FLAW-045/IMP-002).
                      TODO: Implement onClick to show modal with registered attendees once
                      WebinarRegistration model and API exist. */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Users}
                      disabled
                      title={t('admin.webinars.registrationTrackingComingSoon') || 'Registration tracking coming soon'}
                      onClick={() => {
                        // TODO: FLAW-045/IMP-002 - Show registered attendees modal
                        // Requires WebinarRegistration model (userId, webinarId, registeredAt, attended)
                        toast.info(t('admin.webinars.registrationTrackingComingSoon') || 'Registration tracking coming soon');
                      }}
                    >
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

      {/* UX FIX: ConfirmDialog for cancel webinar action */}
      <ConfirmDialog
        isOpen={confirmCancel.isOpen}
        title={t('admin.webinars.confirmCancelTitle') || 'Cancel webinar?'}
        message={t('admin.webinars.confirmCancelMessage') || `Are you sure you want to cancel "${confirmCancel.webinar?.title || ''}"? ${confirmCancel.webinar?.registeredCount ? `${confirmCancel.webinar.registeredCount} registered attendees will be affected.` : ''}`}
        variant="danger"
        confirmLabel={t('admin.webinars.cancelWebinar') || 'Cancel Webinar'}
        onConfirm={() => {
          if (confirmCancel.webinar) executeCancelWebinar(confirmCancel.webinar);
          setConfirmCancel({ isOpen: false, webinar: null });
        }}
        onCancel={() => setConfirmCancel({ isOpen: false, webinar: null })}
      />

      {/* ─── CREATE/EDIT FORM MODAL ─────────────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingWebinar ? t('admin.webinars.editTitle') : t('admin.webinars.newWebinar')}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              {t('admin.webinars.cancelButton')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitWebinar}
              disabled={submitting || !formTitle.trim()}
              loading={submitting}
            >
              {submitting
                ? t('admin.webinars.submitting')
                : editingWebinar
                  ? t('admin.webinars.update')
                  : t('admin.webinars.create')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.webinars.formTitle')} required>
            <Input
              type="text"
              value={formTitle}
              onChange={(e) => { setFormTitle(e.target.value); setFormErrors(prev => { const n = { ...prev }; delete n.title; return n; }); }}
            />
            {formErrors.title && (
              <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.title}</p>
            )}
          </FormField>
          <FormField label={t('admin.webinars.formDescription')} required>
            <Textarea
              rows={3}
              value={formDescription}
              onChange={(e) => { setFormDescription(e.target.value); setFormErrors(prev => { const n = { ...prev }; delete n.description; return n; }); }}
            />
            {formErrors.description && (
              <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.description}</p>
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.webinars.formDateTime')} required>
              <Input
                type="datetime-local"
                value={formDateTime}
                onChange={(e) => { setFormDateTime(e.target.value); setFormErrors(prev => { const n = { ...prev }; delete n.dateTime; return n; }); }}
              />
              {formErrors.dateTime && (
                <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.dateTime}</p>
              )}
            </FormField>
            <FormField label={t('admin.webinars.formDuration')} required>
              <Input
                type="number"
                value={formDuration}
                onChange={(e) => { setFormDuration(parseInt(e.target.value) || 0); setFormErrors(prev => { const n = { ...prev }; delete n.duration; return n; }); }}
              />
              {formErrors.duration && (
                <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.duration}</p>
              )}
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.webinars.formHost')} required>
              <Input
                type="text"
                value={formHost}
                onChange={(e) => { setFormHost(e.target.value); setFormErrors(prev => { const n = { ...prev }; delete n.host; return n; }); }}
              />
              {formErrors.host && (
                <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.host}</p>
              )}
            </FormField>
            <FormField label={t('admin.webinars.formMaxSeats')}>
              <Input
                type="number"
                value={formMaxSeats}
                onChange={(e) => setFormMaxSeats(parseInt(e.target.value) || 0)}
              />
            </FormField>
          </div>
          <FormField label={t('admin.webinars.formMeetingLink')}>
            <Input
              type="url"
              value={formMeetingLink}
              onChange={(e) => setFormMeetingLink(e.target.value)}
              placeholder={t('admin.webinars.formMeetingPlaceholder')}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
