'use client';

/**
 * Admin Reservations/Booking Page
 * - Tab 1: Calendar view (week/month) showing all bookings
 * - Tab 2: Services management (create/edit booking services + availability slots)
 * - Tab 3: Booking list with filters (date, status, service)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar, Clock, Plus, Search, ChevronLeft, ChevronRight,
  Edit, Trash2, CheckCircle, XCircle, Users, DollarSign,
  CalendarDays, List, Settings, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { FormField, Input } from '@/components/admin/FormField';
import { EmptyState } from '@/components/admin/EmptyState';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// ── Types ─────────────────────────────────────────────────────

interface BookingService {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration: number;
  price: number;
  currency: string;
  color: string | null;
  isActive: boolean;
  maxAdvanceDays: number;
  bufferBefore: number;
  bufferAfter: number;
  sortOrder: number;
  slots: BookingSlot[];
  _count: { bookings: number };
}

interface BookingSlot {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface Booking {
  id: string;
  serviceId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes: string | null;
  paymentStatus: string | null;
  paymentAmount: number | null;
  reminderSent: boolean;
  createdAt: string;
  service: {
    id: string;
    name: string;
    color: string | null;
    duration: number;
  };
}

// ── Constants ─────────────────────────────────────────────────

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_NAMES_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  no_show: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16',
];

// ── Helpers ───────────────────────────────────────────────────

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const start = new Date(baseDate);
  start.setDate(start.getDate() - start.getDay());
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(start));
    start.setDate(start.getDate() + 1);
  }
  return dates;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

// ── Main Component ────────────────────────────────────────────

export default function ReservationsPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'calendar' | 'services' | 'list'>('calendar');
  const [services, setServices] = useState<BookingService[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const upcoming = bookings.filter(b => b.status === 'confirmed' && new Date(b.startTime) >= today);
    const todayBookings = bookings.filter(b => {
      const d = new Date(b.startTime);
      return d >= today && d < tomorrow && b.status !== 'cancelled';
    });
    const totalRevenue = bookings
      .filter(b => b.paymentStatus === 'paid')
      .reduce((sum, b) => sum + (Number(b.paymentAmount) || 0), 0);

    return {
      todayCount: todayBookings.length,
      upcomingCount: upcoming.length,
      activeServices: services.filter(s => s.isActive).length,
      totalRevenue,
    };
  }, [bookings, services]);

  // ── Fetch Data ──────────────────────────────────────────────

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/booking/services');
      if (!res.ok) throw new Error('Failed to fetch services');
      const data = await res.json();
      setServices(data.services || []);
    } catch {
      toast.error('Erreur lors du chargement des services');
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      // Fetch a broad date range for calendar
      const from = new Date(calendarDate);
      from.setDate(from.getDate() - 35);
      const to = new Date(calendarDate);
      to.setDate(to.getDate() + 35);

      const params = new URLSearchParams({
        view: 'calendar',
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const res = await fetch(`/api/admin/booking/bookings?${params}`);
      if (!res.ok) throw new Error('Failed to fetch bookings');
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch {
      toast.error('Erreur lors du chargement des réservations');
    }
  }, [calendarDate]);

  useEffect(() => {
    Promise.all([fetchServices(), fetchBookings()]).finally(() => setLoading(false));
  }, [fetchServices, fetchBookings]);

  // ── Service Modal ──────────────────────────────────────────

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<BookingService | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '', description: '', duration: 60, price: 0, currency: 'CAD',
    color: '#3b82f6', isActive: true, maxAdvanceDays: 30,
    bufferBefore: 0, bufferAfter: 0, sortOrder: 0,
    slots: [] as BookingSlot[],
  });
  const [savingService, setSavingService] = useState(false);

  const openCreateService = () => {
    setEditingService(null);
    setServiceForm({
      name: '', description: '', duration: 60, price: 0, currency: 'CAD',
      color: DEFAULT_COLORS[services.length % DEFAULT_COLORS.length],
      isActive: true, maxAdvanceDays: 30, bufferBefore: 0, bufferAfter: 0, sortOrder: 0,
      slots: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true },
        { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isActive: true },
        { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isActive: true },
      ],
    });
    setShowServiceModal(true);
  };

  const openEditService = (svc: BookingService) => {
    setEditingService(svc);
    setServiceForm({
      name: svc.name,
      description: svc.description || '',
      duration: svc.duration,
      price: Number(svc.price),
      currency: svc.currency,
      color: svc.color || '#3b82f6',
      isActive: svc.isActive,
      maxAdvanceDays: svc.maxAdvanceDays,
      bufferBefore: svc.bufferBefore,
      bufferAfter: svc.bufferAfter,
      sortOrder: svc.sortOrder,
      slots: svc.slots.map(s => ({
        dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, isActive: s.isActive,
      })),
    });
    setShowServiceModal(true);
  };

  const saveService = async () => {
    if (!serviceForm.name.trim()) { toast.error('Le nom est requis'); return; }
    setSavingService(true);
    try {
      const url = editingService
        ? `/api/admin/booking/services/${editingService.id}`
        : '/api/admin/booking/services';
      const method = editingService ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify(serviceForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save service');
      }

      toast.success(editingService ? 'Service mis à jour' : 'Service créé');
      setShowServiceModal(false);
      fetchServices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingService(false);
    }
  };

  const deleteService = async (id: string) => {
    if (!confirm('Supprimer ce service ?')) return;
    try {
      const res = await fetch(`/api/admin/booking/services/${id}`, {
        method: 'DELETE',
        headers: addCSRFHeader(),
      });
      if (!res.ok) throw new Error('Failed to delete service');
      const data = await res.json();
      toast.success(data.deactivated ? 'Service désactivé' : 'Service supprimé');
      fetchServices();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  // ── Booking Modal ──────────────────────────────────────────

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    serviceId: '', customerName: '', customerEmail: '', customerPhone: '',
    startTime: '', notes: '', status: 'confirmed' as const,
  });
  const [savingBooking, setSavingBooking] = useState(false);

  const openCreateBooking = (date?: Date, serviceId?: string) => {
    const defaultDate = date || new Date();
    defaultDate.setHours(9, 0, 0, 0);
    setBookingForm({
      serviceId: serviceId || (services[0]?.id || ''),
      customerName: '', customerEmail: '', customerPhone: '',
      startTime: defaultDate.toISOString().slice(0, 16),
      notes: '', status: 'confirmed',
    });
    setShowBookingModal(true);
  };

  const saveBooking = async () => {
    if (!bookingForm.serviceId || !bookingForm.customerName || !bookingForm.customerEmail || !bookingForm.startTime) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setSavingBooking(true);
    try {
      const res = await fetch('/api/admin/booking/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({
          ...bookingForm,
          startTime: new Date(bookingForm.startTime).toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create booking');
      }

      toast.success('Réservation créée');
      setShowBookingModal(false);
      fetchBookings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingBooking(false);
    }
  };

  const updateBookingStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/booking/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update booking');
      toast.success('Statut mis à jour');
      fetchBookings();
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // ── Booking Detail ─────────────────────────────────────────

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // ── Calendar Rendering ─────────────────────────────────────

  const weekDates = useMemo(() => getWeekDates(calendarDate), [calendarDate]);
  const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 - 18:00

  const navigateCalendar = (direction: number) => {
    const next = new Date(calendarDate);
    if (calendarView === 'week') next.setDate(next.getDate() + direction * 7);
    else next.setMonth(next.getMonth() + direction);
    setCalendarDate(next);
  };

  // ── Filters for List Tab ───────────────────────────────────

  const [listSearch, setListSearch] = useState('');
  const [listStatus, setListStatus] = useState('all');
  const [listServiceId, setListServiceId] = useState('all');

  const filteredBookings = useMemo(() => {
    return bookings
      .filter(b => {
        if (listStatus !== 'all' && b.status !== listStatus) return false;
        if (listServiceId !== 'all' && b.serviceId !== listServiceId) return false;
        if (listSearch) {
          const q = listSearch.toLowerCase();
          return b.customerName.toLowerCase().includes(q)
            || b.customerEmail.toLowerCase().includes(q)
            || (b.customerPhone || '').toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [bookings, listSearch, listStatus, listServiceId]);

  // ── Slot Editor Sub-Component ──────────────────────────────

  const toggleSlotDay = (dayOfWeek: number) => {
    const existing = serviceForm.slots.find(s => s.dayOfWeek === dayOfWeek);
    if (existing) {
      setServiceForm(prev => ({
        ...prev,
        slots: prev.slots.filter(s => s.dayOfWeek !== dayOfWeek),
      }));
    } else {
      setServiceForm(prev => ({
        ...prev,
        slots: [...prev.slots, { dayOfWeek, startTime: '09:00', endTime: '17:00', isActive: true }],
      }));
    }
  };

  const updateSlotTime = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setServiceForm(prev => ({
      ...prev,
      slots: prev.slots.map(s =>
        s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s
      ),
    }));
  };

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--k-text-primary)]">
            {t('admin.booking.title')}
          </h1>
          <p className="text-sm text-[var(--k-text-secondary)]">
            {t('admin.booking.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openCreateService}>
            <Settings className="w-4 h-4 mr-1" />
            {t('admin.booking.newService')}
          </Button>
          <Button variant="primary" onClick={() => openCreateBooking()}>
            <Plus className="w-4 h-4 mr-1" />
            {t('admin.booking.newBooking')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('admin.booking.todayBookings')} value={stats.todayCount} icon={CalendarDays} />
        <StatCard label={t('admin.booking.upcoming')} value={stats.upcomingCount} icon={Clock} />
        <StatCard label={t('admin.booking.activeServices')} value={stats.activeServices} icon={Settings} />
        <StatCard label={t('admin.booking.revenue')} value={`$${stats.totalRevenue.toFixed(2)}`} icon={DollarSign} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--k-bg-secondary)] rounded-lg w-fit">
        {[
          { id: 'calendar' as const, label: t('admin.booking.tabCalendar'), icon: Calendar },
          { id: 'services' as const, label: t('admin.booking.tabServices'), icon: Settings },
          { id: 'list' as const, label: t('admin.booking.tabList'), icon: List },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--k-bg-primary)] text-[var(--k-text-primary)] shadow-sm'
                : 'text-[var(--k-text-secondary)] hover:text-[var(--k-text-primary)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'calendar' && (
        <div className="bg-[var(--k-bg-primary)] rounded-xl border border-[var(--k-border)] overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--k-border)]">
            <div className="flex items-center gap-2">
              <button onClick={() => navigateCalendar(-1)} className="p-1.5 rounded-lg hover:bg-[var(--k-bg-secondary)] transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-[var(--k-text-primary)] min-w-[200px] text-center">
                {calendarView === 'week'
                  ? `${weekDates[0].toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })} — ${weekDates[6].toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : calendarDate.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })
                }
              </h2>
              <button onClick={() => navigateCalendar(1)} className="p-1.5 rounded-lg hover:bg-[var(--k-bg-secondary)] transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCalendarDate(new Date())}
                className="ml-2 px-3 py-1 text-xs font-medium rounded-md bg-[var(--k-bg-secondary)] hover:bg-[var(--k-bg-tertiary)] transition-colors"
              >
                {t('admin.booking.today')}
              </button>
            </div>
            <div className="flex gap-1 p-0.5 bg-[var(--k-bg-secondary)] rounded-md">
              {['week', 'month'].map(v => (
                <button
                  key={v}
                  onClick={() => setCalendarView(v as 'week' | 'month')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    calendarView === v ? 'bg-[var(--k-bg-primary)] shadow-sm' : 'hover:bg-[var(--k-bg-tertiary)]'
                  }`}
                >
                  {v === 'week' ? t('admin.booking.week') : t('admin.booking.month')}
                </button>
              ))}
            </div>
          </div>

          {/* Week View */}
          {calendarView === 'week' && (
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Day headers */}
                <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--k-border)]">
                  <div className="p-2" />
                  {weekDates.map((d, i) => {
                    const isToday = isSameDay(d, new Date());
                    return (
                      <div
                        key={i}
                        className={`p-2 text-center border-l border-[var(--k-border)] ${isToday ? 'bg-blue-500/10' : ''}`}
                      >
                        <div className="text-xs text-[var(--k-text-secondary)]">{DAY_NAMES[i]}</div>
                        <div className={`text-sm font-semibold ${isToday ? 'text-blue-500' : 'text-[var(--k-text-primary)]'}`}>
                          {d.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Time grid */}
                {hours.map(hour => (
                  <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--k-border)] min-h-[60px]">
                    <div className="p-1 text-xs text-[var(--k-text-muted)] text-right pr-2 pt-1">
                      {`${hour.toString().padStart(2, '0')}:00`}
                    </div>
                    {weekDates.map((d, di) => {
                      const dayBookings = bookings.filter(b => {
                        const bDate = new Date(b.startTime);
                        return isSameDay(bDate, d)
                          && bDate.getHours() === hour
                          && b.status !== 'cancelled';
                      });
                      return (
                        <div
                          key={di}
                          className="border-l border-[var(--k-border)] relative cursor-pointer hover:bg-[var(--k-bg-secondary)]/50 transition-colors"
                          onClick={() => {
                            const date = new Date(d);
                            date.setHours(hour, 0, 0, 0);
                            openCreateBooking(date);
                          }}
                        >
                          {dayBookings.map(b => (
                            <div
                              key={b.id}
                              className="absolute inset-x-1 top-0.5 rounded px-1.5 py-0.5 text-xs font-medium truncate cursor-pointer hover:opacity-80 transition-opacity"
                              style={{
                                backgroundColor: (b.service.color || '#3b82f6') + '30',
                                color: b.service.color || '#3b82f6',
                                borderLeft: `3px solid ${b.service.color || '#3b82f6'}`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBooking(b);
                              }}
                              title={`${b.customerName} - ${b.service.name}`}
                            >
                              {formatTime(b.startTime)} {b.customerName}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Month View */}
          {calendarView === 'month' && (
            <div className="p-4">
              <MonthCalendar
                date={calendarDate}
                bookings={bookings}
                onBookingClick={(b) => setSelectedBooking(b)}
                onDateClick={(d) => openCreateBooking(d)}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'services' && (
        <div className="space-y-4">
          {services.length === 0 ? (
            <EmptyState
              icon={Settings}
              title={t('admin.booking.noServices')}
              description={t('admin.booking.noServicesDesc')}
              action={
                <Button variant="primary" onClick={openCreateService}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t('admin.booking.createFirstService')}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4">
              {services.map(svc => (
                <div
                  key={svc.id}
                  className="bg-[var(--k-bg-primary)] rounded-xl border border-[var(--k-border)] p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-12 rounded-full"
                        style={{ backgroundColor: svc.color || '#3b82f6' }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[var(--k-text-primary)]">{svc.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            svc.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {svc.isActive ? t('common.active') : t('common.inactive')}
                          </span>
                        </div>
                        {svc.description && (
                          <p className="text-sm text-[var(--k-text-secondary)] mt-0.5">{svc.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--k-text-muted)]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {svc.duration} min
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5" />
                            {Number(svc.price) > 0 ? `${Number(svc.price).toFixed(2)} ${svc.currency}` : t('admin.booking.free')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> {svc._count.bookings} {t('admin.booking.bookingsCount')}
                          </span>
                          <span>
                            {svc.slots.filter(s => s.isActive).map(s => DAY_NAMES[s.dayOfWeek]).join(', ')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditService(svc)}
                        className="p-2 rounded-lg hover:bg-[var(--k-bg-secondary)] transition-colors"
                        title={t('common.edit')}
                      >
                        <Edit className="w-4 h-4 text-[var(--k-text-secondary)]" />
                      </button>
                      <button
                        onClick={() => deleteService(svc.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)]" />
              <input
                type="text"
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder={t('admin.booking.searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--k-bg-secondary)] border border-[var(--k-border)] text-sm text-[var(--k-text-primary)] placeholder-[var(--k-text-muted)]"
              />
            </div>
            <select
              value={listStatus}
              onChange={e => setListStatus(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[var(--k-bg-secondary)] border border-[var(--k-border)] text-sm"
            >
              <option value="all">{t('admin.booking.allStatuses')}</option>
              <option value="confirmed">{t('admin.booking.statusConfirmed')}</option>
              <option value="completed">{t('admin.booking.statusCompleted')}</option>
              <option value="cancelled">{t('admin.booking.statusCancelled')}</option>
              <option value="no_show">{t('admin.booking.statusNoShow')}</option>
            </select>
            <select
              value={listServiceId}
              onChange={e => setListServiceId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[var(--k-bg-secondary)] border border-[var(--k-border)] text-sm"
            >
              <option value="all">{t('admin.booking.allServices')}</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* List */}
          {filteredBookings.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={t('admin.booking.noBookings')}
              description={t('admin.booking.noBookingsDesc')}
            />
          ) : (
            <div className="bg-[var(--k-bg-primary)] rounded-xl border border-[var(--k-border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--k-border)] text-left text-[var(--k-text-secondary)]">
                    <th className="px-4 py-3 font-medium">{t('admin.booking.date')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.booking.time')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.booking.customer')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.booking.service')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.booking.status')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('admin.booking.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map(b => (
                    <tr
                      key={b.id}
                      className="border-b border-[var(--k-border)] hover:bg-[var(--k-bg-secondary)]/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedBooking(b)}
                    >
                      <td className="px-4 py-3 text-[var(--k-text-primary)]">{formatDate(b.startTime)}</td>
                      <td className="px-4 py-3 text-[var(--k-text-primary)]">
                        {formatTime(b.startTime)} - {formatTime(b.endTime)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[var(--k-text-primary)]">{b.customerName}</div>
                        <div className="text-xs text-[var(--k-text-muted)]">{b.customerEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.service.color || '#3b82f6' }} />
                          {b.service.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[b.status] || ''}`}>
                          {b.status === 'confirmed' ? t('admin.booking.statusConfirmed')
                            : b.status === 'completed' ? t('admin.booking.statusCompleted')
                            : b.status === 'cancelled' ? t('admin.booking.statusCancelled')
                            : t('admin.booking.statusNoShow')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          {b.status === 'confirmed' && (
                            <>
                              <button
                                onClick={() => updateBookingStatus(b.id, 'completed')}
                                className="p-1.5 rounded hover:bg-green-500/10 transition-colors"
                                title={t('admin.booking.markCompleted')}
                              >
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              </button>
                              <button
                                onClick={() => updateBookingStatus(b.id, 'no_show')}
                                className="p-1.5 rounded hover:bg-yellow-500/10 transition-colors"
                                title={t('admin.booking.markNoShow')}
                              >
                                <AlertCircle className="w-4 h-4 text-yellow-400" />
                              </button>
                              <button
                                onClick={() => updateBookingStatus(b.id, 'cancelled')}
                                className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
                                title={t('admin.booking.cancel')}
                              >
                                <XCircle className="w-4 h-4 text-red-400" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Booking Detail Side Panel ── */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedBooking(null)} />
          <div className="relative w-full max-w-md bg-[var(--k-bg-primary)] border-l border-[var(--k-border)] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--k-text-primary)]">
                  {t('admin.booking.bookingDetail')}
                </h2>
                <button onClick={() => setSelectedBooking(null)} className="p-1 rounded hover:bg-[var(--k-bg-secondary)]">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--k-text-muted)] uppercase tracking-wider">{t('admin.booking.service')}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedBooking.service.color || '#3b82f6' }} />
                    <span className="font-medium text-[var(--k-text-primary)]">{selectedBooking.service.name}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--k-text-muted)] uppercase tracking-wider">{t('admin.booking.date')}</label>
                    <div className="mt-1 text-[var(--k-text-primary)]">{formatDate(selectedBooking.startTime)}</div>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--k-text-muted)] uppercase tracking-wider">{t('admin.booking.time')}</label>
                    <div className="mt-1 text-[var(--k-text-primary)]">
                      {formatTime(selectedBooking.startTime)} - {formatTime(selectedBooking.endTime)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[var(--k-text-muted)] uppercase tracking-wider">{t('admin.booking.customer')}</label>
                  <div className="mt-1">
                    <div className="font-medium text-[var(--k-text-primary)]">{selectedBooking.customerName}</div>
                    <div className="text-sm text-[var(--k-text-secondary)]">{selectedBooking.customerEmail}</div>
                    {selectedBooking.customerPhone && (
                      <div className="text-sm text-[var(--k-text-secondary)]">{selectedBooking.customerPhone}</div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[var(--k-text-muted)] uppercase tracking-wider">{t('admin.booking.status')}</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[selectedBooking.status] || ''}`}>
                      {selectedBooking.status}
                    </span>
                  </div>
                </div>

                {selectedBooking.notes && (
                  <div>
                    <label className="text-xs text-[var(--k-text-muted)] uppercase tracking-wider">{t('admin.booking.notes')}</label>
                    <div className="mt-1 text-sm text-[var(--k-text-secondary)]">{selectedBooking.notes}</div>
                  </div>
                )}

                {selectedBooking.paymentAmount && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[var(--k-text-muted)] uppercase tracking-wider">{t('admin.booking.payment')}</label>
                      <div className="mt-1 text-[var(--k-text-primary)]">${Number(selectedBooking.paymentAmount).toFixed(2)}</div>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--k-text-muted)] uppercase tracking-wider">{t('admin.booking.paymentStatus')}</label>
                      <div className="mt-1 text-[var(--k-text-primary)]">{selectedBooking.paymentStatus || '-'}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              {selectedBooking.status === 'confirmed' && (
                <div className="flex gap-2 pt-4 border-t border-[var(--k-border)]">
                  <Button variant="primary" className="flex-1" onClick={() => { updateBookingStatus(selectedBooking.id, 'completed'); setSelectedBooking(null); }}>
                    <CheckCircle className="w-4 h-4 mr-1" /> {t('admin.booking.markCompleted')}
                  </Button>
                  <Button variant="secondary" onClick={() => { updateBookingStatus(selectedBooking.id, 'cancelled'); setSelectedBooking(null); }}>
                    <XCircle className="w-4 h-4 mr-1" /> {t('admin.booking.cancel')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Service Modal ── */}
      {showServiceModal && (
        <Modal
          isOpen={showServiceModal}
          onClose={() => setShowServiceModal(false)}
          title={editingService ? t('admin.booking.editService') : t('admin.booking.newService')}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <FormField label={t('admin.booking.serviceName')} required>
              <Input
                value={serviceForm.name}
                onChange={e => setServiceForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Consultation, Massage, Coaching..."
              />
            </FormField>

            <FormField label={t('admin.booking.serviceDescription')}>
              <textarea
                value={serviceForm.description}
                onChange={e => setServiceForm(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--k-bg-secondary)] border border-[var(--k-border)] text-sm min-h-[80px]"
                placeholder="Description du service..."
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.booking.duration')} required>
                <Input
                  type="number"
                  value={serviceForm.duration}
                  onChange={e => setServiceForm(p => ({ ...p, duration: parseInt(e.target.value) || 0 }))}
                  min={5}
                  max={480}
                />
              </FormField>
              <FormField label={t('admin.booking.price')}>
                <Input
                  type="number"
                  value={serviceForm.price}
                  onChange={e => setServiceForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                  min={0}
                  step={0.01}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.booking.bufferBefore')}>
                <Input
                  type="number"
                  value={serviceForm.bufferBefore}
                  onChange={e => setServiceForm(p => ({ ...p, bufferBefore: parseInt(e.target.value) || 0 }))}
                  min={0}
                  max={120}
                />
              </FormField>
              <FormField label={t('admin.booking.bufferAfter')}>
                <Input
                  type="number"
                  value={serviceForm.bufferAfter}
                  onChange={e => setServiceForm(p => ({ ...p, bufferAfter: parseInt(e.target.value) || 0 }))}
                  min={0}
                  max={120}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.booking.maxAdvance')}>
                <Input
                  type="number"
                  value={serviceForm.maxAdvanceDays}
                  onChange={e => setServiceForm(p => ({ ...p, maxAdvanceDays: parseInt(e.target.value) || 30 }))}
                  min={1}
                  max={365}
                />
              </FormField>
              <FormField label={t('admin.booking.color')}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={serviceForm.color}
                    onChange={e => setServiceForm(p => ({ ...p, color: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <span className="text-sm text-[var(--k-text-secondary)]">{serviceForm.color}</span>
                </div>
              </FormField>
            </div>

            {/* Availability Slots */}
            <div>
              <label className="block text-sm font-medium text-[var(--k-text-primary)] mb-2">
                {t('admin.booking.availabilitySlots')}
              </label>
              <div className="space-y-2">
                {[0, 1, 2, 3, 4, 5, 6].map(day => {
                  const slot = serviceForm.slots.find(s => s.dayOfWeek === day);
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 min-w-[100px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!slot}
                          onChange={() => toggleSlotDay(day)}
                          className="rounded"
                        />
                        <span className="text-sm">{DAY_NAMES_FULL[day]}</span>
                      </label>
                      {slot && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={e => updateSlotTime(day, 'startTime', e.target.value)}
                            className="px-2 py-1 rounded bg-[var(--k-bg-secondary)] border border-[var(--k-border)] text-sm"
                          />
                          <span className="text-[var(--k-text-muted)]">-</span>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={e => updateSlotTime(day, 'endTime', e.target.value)}
                            className="px-2 py-1 rounded bg-[var(--k-bg-secondary)] border border-[var(--k-border)] text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="service-active"
                checked={serviceForm.isActive}
                onChange={e => setServiceForm(p => ({ ...p, isActive: e.target.checked }))}
              />
              <label htmlFor="service-active" className="text-sm">
                {t('admin.booking.serviceActive')}
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setShowServiceModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={saveService} disabled={savingService}>
              {savingService ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Booking Modal ── */}
      {showBookingModal && (
        <Modal
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          title={t('admin.booking.newBooking')}
        >
          <div className="space-y-4">
            <FormField label={t('admin.booking.service')} required>
              <select
                value={bookingForm.serviceId}
                onChange={e => setBookingForm(p => ({ ...p, serviceId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--k-bg-secondary)] border border-[var(--k-border)] text-sm"
              >
                <option value="">{t('admin.booking.selectService')}</option>
                {services.filter(s => s.isActive).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>
                ))}
              </select>
            </FormField>

            <FormField label={t('admin.booking.dateTime')} required>
              <Input
                type="datetime-local"
                value={bookingForm.startTime}
                onChange={e => setBookingForm(p => ({ ...p, startTime: e.target.value }))}
              />
            </FormField>

            <FormField label={t('admin.booking.customerName')} required>
              <Input
                value={bookingForm.customerName}
                onChange={e => setBookingForm(p => ({ ...p, customerName: e.target.value }))}
                placeholder="Jean Dupont"
              />
            </FormField>

            <FormField label={t('admin.booking.customerEmail')} required>
              <Input
                type="email"
                value={bookingForm.customerEmail}
                onChange={e => setBookingForm(p => ({ ...p, customerEmail: e.target.value }))}
                placeholder="jean@example.com"
              />
            </FormField>

            <FormField label={t('admin.booking.customerPhone')}>
              <Input
                type="tel"
                value={bookingForm.customerPhone}
                onChange={e => setBookingForm(p => ({ ...p, customerPhone: e.target.value }))}
                placeholder="+1 514 000 0000"
              />
            </FormField>

            <FormField label={t('admin.booking.notes')}>
              <textarea
                value={bookingForm.notes}
                onChange={e => setBookingForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--k-bg-secondary)] border border-[var(--k-border)] text-sm min-h-[60px]"
                placeholder="Notes optionnelles..."
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setShowBookingModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={saveBooking} disabled={savingBooking}>
              {savingBooking ? t('common.saving') : t('admin.booking.confirmBooking')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Month Calendar Sub-Component ──────────────────────────────

function MonthCalendar({
  date,
  bookings,
  onBookingClick,
  onDateClick,
}: {
  date: Date;
  bookings: Booking[];
  onBookingClick: (b: Booking) => void;
  onDateClick: (d: Date) => void;
}) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="grid grid-cols-7 gap-px mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-xs font-medium text-[var(--k-text-muted)] py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="min-h-[80px]" />;
          const cellDate = new Date(year, month, day);
          const isToday = isSameDay(cellDate, today);
          const dayBookings = bookings.filter(b =>
            isSameDay(new Date(b.startTime), cellDate) && b.status !== 'cancelled'
          );

          return (
            <div
              key={i}
              className={`min-h-[80px] p-1 border border-[var(--k-border)] rounded-md cursor-pointer hover:bg-[var(--k-bg-secondary)]/50 transition-colors ${
                isToday ? 'bg-blue-500/5 border-blue-500/30' : ''
              }`}
              onClick={() => onDateClick(cellDate)}
            >
              <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-500' : 'text-[var(--k-text-secondary)]'}`}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayBookings.slice(0, 3).map(b => (
                  <div
                    key={b.id}
                    className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer"
                    style={{
                      backgroundColor: (b.service.color || '#3b82f6') + '25',
                      color: b.service.color || '#3b82f6',
                    }}
                    onClick={e => { e.stopPropagation(); onBookingClick(b); }}
                    title={`${formatTime(b.startTime)} ${b.customerName}`}
                  >
                    {formatTime(b.startTime)} {b.customerName}
                  </div>
                ))}
                {dayBookings.length > 3 && (
                  <div className="text-[10px] text-[var(--k-text-muted)] pl-1">
                    +{dayBookings.length - 3}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
