'use client';

/**
 * Public Booking Page
 * Allows customers to:
 * 1. Choose a service
 * 2. Pick a date
 * 3. Select an available time slot
 * 4. Fill in their info
 * 5. Confirm the booking
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, ArrowLeft, ArrowRight, CheckCircle, User,
  Mail, Phone, FileText, ChevronLeft,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────

interface BookingServicePublic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration: number;
  price: number;
  currency: string;
  color: string | null;
  maxAdvanceDays: number;
  sortOrder: number;
  slots: { dayOfWeek: number; startTime: string; endTime: string }[];
}

interface AvailableSlot {
  startTime: string;
  endTime: string;
}

type Step = 'service' | 'date' | 'time' | 'info' | 'confirmation';

// ── Constants ─────────────────────────────────────────────────

const DAY_NAMES_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ── Helpers ───────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
}

function formatDateFull(date: Date): string {
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

// ── Main Component ────────────────────────────────────────────

export default function BookingPage() {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('service');
  const [services, setServices] = useState<BookingServicePublic[]>([]);
  const [loading, setLoading] = useState(true);

  // Selections
  const [selectedService, setSelectedService] = useState<BookingServicePublic | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Customer form
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    id: string;
    serviceName: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());

  // ── Fetch Services ──────────────────────────────────────────

  useEffect(() => {
    fetch('/api/booking')
      .then(r => r.json())
      .then(data => setServices(data.services || []))
      .catch(() => toast.error('Erreur lors du chargement'))
      .finally(() => setLoading(false));
  }, []);

  // ── Fetch Availability ──────────────────────────────────────

  const fetchAvailability = useCallback(async (serviceId: string, date: Date) => {
    setLoadingSlots(true);
    try {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const res = await fetch(`/api/booking/availability?serviceId=${serviceId}&date=${dateStr}`);
      const data = await res.json();
      setAvailableSlots(data.availableSlots || []);
    } catch {
      toast.error('Erreur lors de la vérification des disponibilités');
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  // ── Handlers ────────────────────────────────────────────────

  const selectService = (service: BookingServicePublic) => {
    setSelectedService(service);
    setSelectedDate(null);
    setSelectedSlot(null);
    setStep('date');
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (selectedService) {
      fetchAvailability(selectedService.id, date);
    }
    setStep('time');
  };

  const selectSlot = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setStep('info');
  };

  const goBack = () => {
    if (step === 'date') setStep('service');
    else if (step === 'time') setStep('date');
    else if (step === 'info') setStep('time');
  };

  const submitBooking = async () => {
    if (!form.customerName || !form.customerEmail) {
      toast.error(t('booking.fillRequired'));
      return;
    }
    if (!selectedService || !selectedSlot) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          startTime: selectedSlot.startTime,
          ...form,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }

      const data = await res.json();
      setBookingResult(data.booking);
      setStep('confirmation');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la réservation');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Calendar Rendering ─────────────────────────────────────

  const renderCalendar = () => {
    if (!selectedService) return null;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + selectedService.maxAdvanceDays);

    // Days with availability
    const availableDays = new Set(selectedService.slots.map(s => s.dayOfWeek));

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-semibold">
            {MONTH_NAMES[month]} {year}
          </h3>
          <button
            onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES_SHORT.map((d, i) => (
            <div key={i} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;

            const cellDate = new Date(year, month, day);
            const isToday = cellDate.getTime() === today.getTime();
            const isPast = cellDate < today;
            const isTooFar = cellDate > maxDate;
            const hasSlots = availableDays.has(cellDate.getDay());
            const isDisabled = isPast || isTooFar || !hasSlots;
            const isSelected = selectedDate && cellDate.getTime() === selectedDate.getTime();

            return (
              <button
                key={i}
                onClick={() => !isDisabled && selectDate(cellDate)}
                disabled={isDisabled}
                className={`
                  aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all
                  ${isDisabled ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed' : 'hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer'}
                  ${isToday && !isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
                  ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                  ${!isDisabled && !isSelected ? 'text-gray-900 dark:text-gray-100' : ''}
                `}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Loading State ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  // ── No Services ────────────────────────────────────────────

  if (services.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">{t('booking.noServicesTitle')}</h1>
        <p className="text-gray-500">{t('booking.noServicesDesc')}</p>
      </div>
    );
  }

  // ── Render Steps ───────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Progress bar */}
      {step !== 'confirmation' && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {['service', 'date', 'time', 'info'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s ? 'bg-blue-600 text-white'
                  : ['service', 'date', 'time', 'info'].indexOf(step) > i
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                    : 'bg-gray-200 text-gray-500 dark:bg-gray-700'
                }`}>
                  {i + 1}
                </div>
                {i < 3 && (
                  <div className={`w-16 sm:w-24 h-0.5 ${
                    ['service', 'date', 'time', 'info'].indexOf(step) > i ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{t('booking.stepService')}</span>
            <span>{t('booking.stepDate')}</span>
            <span>{t('booking.stepTime')}</span>
            <span>{t('booking.stepInfo')}</span>
          </div>
        </div>
      )}

      {/* Back button */}
      {step !== 'service' && step !== 'confirmation' && (
        <button onClick={goBack} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </button>
      )}

      {/* Step 1: Service Selection */}
      {step === 'service' && (
        <div>
          <h1 className="text-2xl font-bold mb-2">{t('booking.chooseService')}</h1>
          <p className="text-gray-500 mb-6">{t('booking.chooseServiceDesc')}</p>

          <div className="space-y-3">
            {services.map(svc => (
              <button
                key={svc.id}
                onClick={() => selectService(svc)}
                className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-1 h-12 rounded-full mt-0.5" style={{ backgroundColor: svc.color || '#3b82f6' }} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                      {svc.name}
                    </h3>
                    {svc.description && (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{svc.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" /> {svc.duration} min
                      </span>
                      <span className="font-medium">
                        {Number(svc.price) > 0
                          ? `${Number(svc.price).toFixed(2)} ${svc.currency}`
                          : t('booking.free')
                        }
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors mt-3" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Date Selection */}
      {step === 'date' && selectedService && (
        <div>
          <h2 className="text-2xl font-bold mb-2">{t('booking.chooseDate')}</h2>
          <p className="text-gray-500 mb-6">
            {selectedService.name} - {selectedService.duration} min
          </p>
          {renderCalendar()}
        </div>
      )}

      {/* Step 3: Time Selection */}
      {step === 'time' && selectedService && selectedDate && (
        <div>
          <h2 className="text-2xl font-bold mb-2">{t('booking.chooseTime')}</h2>
          <p className="text-gray-500 mb-6">
            {selectedService.name} - {formatDateFull(selectedDate)}
          </p>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">{t('booking.noSlots')}</p>
              <button
                onClick={() => setStep('date')}
                className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {t('booking.chooseAnotherDate')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableSlots.map((slot, i) => {
                const isSelected = selectedSlot?.startTime === slot.startTime;
                return (
                  <button
                    key={i}
                    onClick={() => selectSlot(slot)}
                    className={`
                      py-3 px-2 rounded-lg text-sm font-medium transition-all border
                      ${isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 text-gray-900 dark:text-white'
                      }
                    `}
                  >
                    {formatTime(slot.startTime)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Customer Info */}
      {step === 'info' && selectedService && selectedDate && selectedSlot && (
        <div>
          <h2 className="text-2xl font-bold mb-2">{t('booking.yourInfo')}</h2>
          <p className="text-gray-500 mb-6">
            {selectedService.name} - {formatDateFull(selectedDate)} {t('booking.at')} {formatTime(selectedSlot.startTime)}
          </p>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <User className="w-4 h-4" /> {t('booking.name')} *
              </label>
              <input
                type="text"
                value={form.customerName}
                onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))}
                placeholder="Jean Dupont"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Mail className="w-4 h-4" /> {t('booking.email')} *
              </label>
              <input
                type="email"
                value={form.customerEmail}
                onChange={e => setForm(p => ({ ...p, customerEmail: e.target.value }))}
                placeholder="jean@example.com"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Phone className="w-4 h-4" /> {t('booking.phone')}
              </label>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={e => setForm(p => ({ ...p, customerPhone: e.target.value }))}
                placeholder="+1 514 000 0000"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <FileText className="w-4 h-4" /> {t('booking.notes')}
              </label>
              <textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder={t('booking.notesPlaceholder')}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px]"
                maxLength={1000}
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-sm mb-3">{t('booking.summary')}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('booking.service')}</span>
                  <span className="font-medium">{selectedService.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('booking.date')}</span>
                  <span className="font-medium">{formatDateFull(selectedDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('booking.time')}</span>
                  <span className="font-medium">{formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('booking.duration')}</span>
                  <span className="font-medium">{selectedService.duration} min</span>
                </div>
                {Number(selectedService.price) > 0 && (
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                    <span className="text-gray-500 font-medium">{t('booking.total')}</span>
                    <span className="font-bold text-blue-600">{Number(selectedService.price).toFixed(2)} {selectedService.currency}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={submitBooking}
              disabled={submitting || !form.customerName || !form.customerEmail}
              className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold text-sm transition-colors"
            >
              {submitting ? t('booking.submitting') : t('booking.confirm')}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Confirmation */}
      {step === 'confirmation' && bookingResult && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{t('booking.confirmed')}</h2>
          <p className="text-gray-500 mb-8">{t('booking.confirmedDesc')}</p>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-left max-w-sm mx-auto">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('booking.service')}</span>
                <span className="font-medium">{bookingResult.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('booking.date')}</span>
                <span className="font-medium">{formatDateFull(new Date(bookingResult.startTime))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('booking.time')}</span>
                <span className="font-medium">{formatTime(bookingResult.startTime)} - {formatTime(bookingResult.endTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('booking.reference')}</span>
                <span className="font-mono text-xs">{bookingResult.id.slice(0, 12)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={() => {
                setStep('service');
                setSelectedService(null);
                setSelectedDate(null);
                setSelectedSlot(null);
                setBookingResult(null);
                setForm({ customerName: '', customerEmail: '', customerPhone: '', notes: '' });
              }}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
            >
              {t('booking.bookAnother')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
