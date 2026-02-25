'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Mail, Gift, Tag } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'email' | 'promo' | 'social';
  color: string;
}

const typeConfig = {
  email: { icon: Mail, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  promo: { icon: Tag, color: 'bg-green-100 text-green-700 border-green-200' },
  social: { icon: Gift, color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export default function CampaignCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events] = useState<CalendarEvent[]>([
    { id: '1', title: 'Newsletter mensuelle', date: new Date(2026, 1, 28), type: 'email', color: '#3b82f6' },
    { id: '2', title: 'Promo printemps', date: new Date(2026, 2, 1), type: 'promo', color: '#10b981' },
    { id: '3', title: 'Post Instagram', date: new Date(2026, 2, 3), type: 'social', color: '#8b5cf6' },
  ]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const monthName = new Intl.DateTimeFormat('fr-CA', { month: 'long', year: 'numeric' }).format(currentDate);

  const days = useMemo(() => {
    const result: Array<{ day: number; events: CalendarEvent[]; isToday: boolean }> = [];
    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayEvents = events.filter(e => e.date.toDateString() === date.toDateString());
      result.push({
        day: d,
        events: dayEvents,
        isToday: date.toDateString() === today.toDateString(),
      });
    }
    return result;
  }, [year, month, daysInMonth, events]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-5 h-5" /></button>
          <h3 className="text-lg font-semibold text-slate-800 capitalize min-w-[200px] text-center">{monthName}</h3>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700">
          <Plus className="w-4 h-4" /> Événement
        </button>
      </div>

      <div className="grid grid-cols-7">
        {weekDays.map(d => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-100">{d}</div>
        ))}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[100px] border-b border-e border-slate-100 bg-slate-50/50" />
        ))}
        {days.map(({ day, events: dayEvents, isToday }) => (
          <div key={day} className={`min-h-[100px] border-b border-e border-slate-100 p-1.5 ${isToday ? 'bg-sky-50/50' : ''}`}>
            <div className={`text-sm mb-1 ${isToday ? 'w-7 h-7 bg-sky-600 text-white rounded-full flex items-center justify-center font-bold' : 'text-slate-600 ps-1'}`}>
              {day}
            </div>
            <div className="space-y-1">
              {dayEvents.map(evt => {
                const cfg = typeConfig[evt.type];
                return (
                  <div key={evt.id} className={`px-1.5 py-0.5 text-[10px] rounded border truncate ${cfg.color}`}>
                    {evt.title}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
