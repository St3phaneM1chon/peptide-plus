'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Mail, GitBranch, Loader2 } from 'lucide-react';
import { addCSRFHeader } from '@/lib/csrf';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'scheduled' | 'sent' | 'flow';
  color: string;
  /** 'campaign' or 'flow' - used for click routing */
  sourceType: 'campaign' | 'flow';
}

interface CampaignCalendarProps {
  /** Called when user clicks a campaign event */
  onCampaignClick?: (campaignId: string) => void;
}

const typeConfig = {
  scheduled: { icon: Mail, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  sent: { icon: Mail, color: 'bg-green-100 text-green-700 border-green-200' },
  flow: { icon: GitBranch, color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export default function CampaignCalendar({ onCampaignClick }: CampaignCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch campaigns and flows when component mounts or month changes
  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignsRes, flowsRes] = await Promise.all([
        fetch('/api/admin/emails/campaigns?limit=100', {
          headers: addCSRFHeader(),
        }),
        fetch('/api/admin/emails/flows?active=true', {
          headers: addCSRFHeader(),
        }),
      ]);

      const calendarEvents: CalendarEvent[] = [];

      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        const campaigns = data.campaigns || [];
        for (const campaign of campaigns) {
          // Sent campaigns: show on sentAt date
          if (campaign.status === 'SENT' && campaign.sentAt) {
            const sentDate = new Date(campaign.sentAt);
            calendarEvents.push({
              id: campaign.id,
              title: campaign.name,
              date: sentDate,
              type: 'sent',
              color: '#10b981',
              sourceType: 'campaign',
            });
          }
          // Scheduled campaigns: show on scheduledAt date
          else if ((campaign.status === 'SCHEDULED' || campaign.status === 'DRAFT') && campaign.scheduledAt) {
            const scheduledDate = new Date(campaign.scheduledAt);
            calendarEvents.push({
              id: campaign.id,
              title: campaign.name,
              date: scheduledDate,
              type: 'scheduled',
              color: '#3b82f6',
              sourceType: 'campaign',
            });
          }
          // Sending campaigns: show on current date
          else if (campaign.status === 'SENDING') {
            calendarEvents.push({
              id: campaign.id,
              title: `[En cours] ${campaign.name}`,
              date: new Date(),
              type: 'scheduled',
              color: '#f59e0b',
              sourceType: 'campaign',
            });
          }
        }
      }

      if (flowsRes.ok) {
        const data = await flowsRes.json();
        const flows = data.flows || [];
        for (const flow of flows) {
          if (!flow.isActive) continue;
          // Active automation flows: show as recurring indicator on the 1st of each visible month
          calendarEvents.push({
            id: flow.id,
            title: `Flow: ${flow.name}`,
            date: new Date(year, month, 1),
            type: 'flow',
            color: '#8b5cf6',
            sourceType: 'flow',
          });
        }
      }

      setEvents(calendarEvents);
    } catch {
      // Silently fail; calendar shows empty
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

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

  const handleEventClick = (evt: CalendarEvent) => {
    if (evt.sourceType === 'campaign' && onCampaignClick) {
      onCampaignClick(evt.id);
    }
  };

  const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-5 h-5" /></button>
          <h3 className="text-lg font-semibold text-slate-800 capitalize min-w-[200px] text-center">{monthName}</h3>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-3">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Planifie</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Envoye</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Flow actif</span>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700">
            <Plus className="w-4 h-4" /> Evenement
          </button>
        </div>
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
                  <button
                    key={evt.id}
                    onClick={() => handleEventClick(evt)}
                    className={`w-full text-left px-1.5 py-0.5 text-[10px] rounded border truncate ${cfg.color} ${evt.sourceType === 'campaign' ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                    title={evt.title}
                  >
                    {evt.title}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
