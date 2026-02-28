/**
 * CalendarView — Month/Week calendar for Social Scheduler
 * Chantier 3.2: Visual calendar with events.
 */
'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  platform: string;
  status: string;
  color?: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  view?: 'month' | 'week';
}

// Platform colors
const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-600',
  twitter: 'bg-sky-500',
  tiktok: 'bg-gray-900 dark:bg-gray-200 dark:text-gray-900',
  linkedin: 'bg-blue-700',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function getWeekDays(date: Date): Date[] {
  const days: Date[] = [];
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay()); // Start from Sunday
  for (let i = 0; i < 7; i++) {
    days.push(new Date(start));
    start.setDate(start.getDate() + 1);
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarView({
  events,
  onEventClick,
  onDateClick,
  view: initialView = 'month',
}: CalendarViewProps) {
  const { t } = useI18n();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState(initialView);
  const today = new Date();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation
  const prev = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const next = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };
  const goToday = () => setCurrentDate(new Date());

  // Days to display
  const days = useMemo(() => {
    if (view === 'week') return getWeekDays(currentDate);
    const monthDays = getDaysInMonth(year, month);
    // Pad start to align with weekday
    const startPad = monthDays[0].getDay();
    const paddedStart = new Date(year, month, 1 - startPad);
    const allDays: Date[] = [];
    for (let i = 0; i < startPad; i++) {
      allDays.push(new Date(paddedStart.getFullYear(), paddedStart.getMonth(), paddedStart.getDate() + i));
    }
    allDays.push(...monthDays);
    // Pad end to complete the last week
    while (allDays.length % 7 !== 0) {
      const last = allDays[allDays.length - 1];
      allDays.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
    }
    return allDays;
  }, [currentDate, view, year, month]);

  // Events grouped by day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = event.date.toISOString().split('T')[0];
      const existing = map.get(key) || [];
      existing.push(event);
      map.set(key, existing);
    }
    return map;
  }, [events]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-semibold min-w-[200px] text-center">
            {view === 'month'
              ? `${MONTH_NAMES[month]} ${year}`
              : `${t('admin.media.week') || 'Week'} — ${days[0].toLocaleDateString()} - ${days[6].toLocaleDateString()}`
            }
          </h3>
          <button onClick={next} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {t('common.today') || 'Today'}
          </button>
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1 text-sm ${view === 'week' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              {t('admin.media.weekView') || 'Week'}
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1 text-sm ${view === 'month' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              {t('admin.media.monthView') || 'Month'}
            </button>
          </div>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b dark:border-gray-700">
        {DAY_NAMES.map((day) => (
          <div key={day} className="p-2 text-center text-xs font-medium text-gray-500 uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={`grid grid-cols-7 ${view === 'week' ? 'min-h-[300px]' : ''}`}>
        {days.map((day, idx) => {
          const key = day.toISOString().split('T')[0];
          const dayEvents = eventsByDay.get(key) || [];
          const isCurrentMonth = day.getMonth() === month;
          const isToday = isSameDay(day, today);

          return (
            <div
              key={idx}
              onClick={() => onDateClick?.(day)}
              className={`min-h-[80px] p-1 border-b border-r dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                !isCurrentMonth && view === 'month' ? 'opacity-40' : ''
              }`}
            >
              <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                isToday ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400'
              }`}>
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(ev);
                    }}
                    className={`w-full text-left text-[10px] px-1 py-0.5 rounded text-white truncate ${
                      ev.color || PLATFORM_COLORS[ev.platform] || 'bg-gray-500'
                    }`}
                    title={ev.title}
                  >
                    {ev.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-[10px] text-gray-400 pl-1">
                    +{dayEvents.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
