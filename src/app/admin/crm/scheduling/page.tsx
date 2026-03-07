'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  Calendar, Clock, Users, ChevronLeft, ChevronRight, Plus, X, Save,
  ArrowUpDown, Zap, GraduationCap, Star, Check, Filter,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShiftType = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT' | 'SPLIT' | 'CUSTOM';

interface Agent {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface Schedule {
  id: string;
  agentId: string;
  agent: Agent;
  date: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  isOff: boolean;
  notes: string | null;
  createdAt: string;
}

interface ScheduleModalData {
  agentId: string;
  date: string; // YYYY-MM-DD
  existing?: Schedule;
}

interface ShiftBid {
  id: string;
  agentId: string;
  agentName: string;
  shiftType: ShiftType;
  preference: number; // 1=first choice, 2=second, etc.
  status: 'pending' | 'approved' | 'rejected';
  date: string;
}

interface AgentSkill {
  name: string;
  category: string;
  level: number;
}

interface TrainingSession {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'training' | 'coaching' | 'onboarding';
  status: 'scheduled' | 'completed' | 'cancelled';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHIFT_CONFIG: Record<ShiftType, { label: string; color: string; defaultStart: string; defaultEnd: string }> = {
  MORNING:   { label: 'Morning',   color: 'bg-teal-100 text-teal-700 border-teal-200',     defaultStart: '09:00', defaultEnd: '17:00' },
  AFTERNOON: { label: 'Afternoon', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', defaultStart: '13:00', defaultEnd: '21:00' },
  EVENING:   { label: 'Evening',   color: 'bg-purple-100 text-purple-700 border-purple-200', defaultStart: '17:00', defaultEnd: '01:00' },
  NIGHT:     { label: 'Night',     color: 'bg-gray-100 text-gray-700 border-gray-200',       defaultStart: '21:00', defaultEnd: '05:00' },
  SPLIT:     { label: 'Split',     color: 'bg-orange-100 text-orange-700 border-orange-200', defaultStart: '09:00', defaultEnd: '21:00' },
  CUSTOM:    { label: 'Custom',    color: 'bg-teal-100 text-teal-700 border-teal-200',       defaultStart: '09:00', defaultEnd: '17:00' },
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekDates(referenceDate: Date): Date[] {
  const dates: Date[] = [];
  const start = new Date(referenceDate);
  start.setDate(start.getDate() - start.getDay()); // Go to Sunday
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

// ---------------------------------------------------------------------------
// Schedule Modal
// ---------------------------------------------------------------------------

interface ScheduleModalProps {
  data: ScheduleModalData;
  onClose: () => void;
  onSaved: (schedule: Schedule) => void;
}

function ScheduleModal({ data, onClose, onSaved }: ScheduleModalProps) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    shiftType: (data.existing?.shiftType || 'MORNING') as ShiftType,
    startTime: data.existing?.startTime || '09:00',
    endTime: data.existing?.endTime || '17:00',
    isOff: data.existing?.isOff || false,
    notes: data.existing?.notes || '',
  });

  const handleShiftChange = (shiftType: ShiftType) => {
    const config = SHIFT_CONFIG[shiftType];
    setForm((prev) => ({
      ...prev,
      shiftType,
      startTime: config.defaultStart,
      endTime: config.defaultEnd,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        agentId: data.agentId,
        date: data.date,
        shiftType: form.shiftType,
        startTime: form.startTime,
        endTime: form.endTime,
        isOff: form.isOff,
        notes: form.notes || null,
      };

      const res = await fetch('/api/admin/crm/agent-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to save schedule');
      }

      toast.success(t('admin.crm.scheduling.saved') || 'Schedule saved');
      onSaved(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {data.existing
              ? (t('admin.crm.scheduling.editSchedule') || 'Edit Schedule')
              : (t('admin.crm.scheduling.addSchedule') || 'Add Schedule')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-sm text-gray-500 mb-2">
            {new Date(data.date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })}
          </div>

          {/* Day Off Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isOff}
              onChange={(e) => setForm((prev) => ({ ...prev, isOff: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              {t('admin.crm.scheduling.dayOff') || 'Day Off / Vacation'}
            </span>
          </label>

          {!form.isOff && (
            <>
              {/* Shift Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  {t('admin.crm.scheduling.shiftType') || 'Shift Type'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(SHIFT_CONFIG) as ShiftType[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleShiftChange(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        form.shiftType === key
                          ? SHIFT_CONFIG[key].color + ' ring-2 ring-offset-1 ring-teal-400'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {SHIFT_CONFIG[key].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('admin.crm.scheduling.startTime') || 'Start Time'}
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('admin.crm.scheduling.endTime') || 'End Time'}
                  </label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.scheduling.notes') || 'Notes'}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className={inputCls + ' resize-none'}
              rows={2}
              placeholder={t('admin.crm.scheduling.notesPlaceholder') || 'Optional notes...'}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving
                ? (t('common.saving') || 'Saving...')
                : (t('common.save') || 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SchedulingPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'schedule' | 'bidding' | 'skills' | 'training'>('schedule');
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay()); // Go to Sunday
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState<string>('');
  const [modal, setModal] = useState<ScheduleModalData | null>(null);

  // Shift Bidding state (F2)
  const [bids, setBids] = useState<ShiftBid[]>([]);
  const [newBidAgent, setNewBidAgent] = useState('');
  const [newBidShift, setNewBidShift] = useState<ShiftType>('MORNING');
  const [newBidDate, setNewBidDate] = useState('');

  // Multi-skill state (F14)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [agentSkills, _setAgentSkills] = useState<Record<string, AgentSkill[]>>({});
  const [filterSkill, setFilterSkill] = useState('');

  // Training state (F15)
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [trainingForm, setTrainingForm] = useState({
    title: '',
    agentId: '',
    date: '',
    startTime: '10:00',
    endTime: '11:00',
    type: 'training' as 'training' | 'coaching' | 'onboarding',
  });

  const weekDates = getWeekDates(weekStart);
  const weekDateFrom = formatDate(weekDates[0]);
  const weekDateTo = formatDate(weekDates[6]);

  // Fetch schedules for the current week
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom: weekDateFrom,
        dateTo: weekDateTo,
        limit: '500',
      });
      if (filterAgent) {
        params.set('agentId', filterAgent);
      }

      const res = await fetch(`/api/admin/crm/agent-schedules?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setSchedules(json.data);
        // Extract unique agents from schedules
        const agentMap = new Map<string, Agent>();
        json.data.forEach((s: Schedule) => {
          if (!agentMap.has(s.agentId)) {
            agentMap.set(s.agentId, s.agent);
          }
        });
        // Merge with existing agents (keep previously seen agents)
        setAgents((prev) => {
          const merged = new Map<string, Agent>();
          prev.forEach((a) => merged.set(a.id, a));
          agentMap.forEach((a, id) => merged.set(id, a));
          return Array.from(merged.values());
        });
      }
    } catch {
      toast.error('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, [weekDateFrom, weekDateTo, filterAgent]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Navigation
  const goToPrevWeek = () => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const goToNextWeek = () => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const goToThisWeek = () => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    setWeekStart(d);
  };

  // Get schedule for a specific agent + date
  const getSchedule = (agentId: string, date: Date): Schedule | undefined => {
    const dateStr = formatDate(date);
    return schedules.find(
      (s) => s.agentId === agentId && s.date.startsWith(dateStr)
    );
  };

  // Determine which agents to show
  const displayAgents = filterAgent
    ? agents.filter((a) => a.id === filterAgent)
    : agents;

  const handleScheduleSaved = (schedule: Schedule) => {
    setSchedules((prev) => {
      const idx = prev.findIndex(
        (s) => s.agentId === schedule.agentId && s.date.startsWith(schedule.date.split('T')[0])
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = schedule;
        return updated;
      }
      return [...prev, schedule];
    });
    // Add agent if not already in list
    if (!agents.find((a) => a.id === schedule.agentId)) {
      setAgents((prev) => [...prev, schedule.agent]);
    }
    setModal(null);
  };

  // Shift Bidding handlers
  const handleAddBid = () => {
    if (!newBidAgent || !newBidDate) {
      toast.error('Please select an agent and date');
      return;
    }
    const newBid: ShiftBid = {
      id: `bid-${Date.now()}`,
      agentId: newBidAgent,
      agentName: agents.find(a => a.id === newBidAgent)?.name || 'Unknown',
      shiftType: newBidShift,
      preference: bids.filter(b => b.agentId === newBidAgent && b.date === newBidDate).length + 1,
      status: 'pending',
      date: newBidDate,
    };
    setBids(prev => [...prev, newBid]);
    toast.success('Shift bid submitted');
  };

  const handleBidAction = (bidId: string, action: 'approved' | 'rejected') => {
    setBids(prev => prev.map(b => b.id === bidId ? { ...b, status: action } : b));
    toast.success(`Bid ${action}`);
  };

  // Training handlers
  const handleAddTraining = () => {
    if (!trainingForm.title || !trainingForm.agentId || !trainingForm.date) {
      toast.error('Please fill all required fields');
      return;
    }
    const session: TrainingSession = {
      id: `training-${Date.now()}`,
      title: trainingForm.title,
      agentId: trainingForm.agentId,
      agentName: agents.find(a => a.id === trainingForm.agentId)?.name || 'Unknown',
      date: trainingForm.date,
      startTime: trainingForm.startTime,
      endTime: trainingForm.endTime,
      type: trainingForm.type,
      status: 'scheduled',
    };
    setTrainingSessions(prev => [...prev, session]);
    setShowTrainingModal(false);
    setTrainingForm({ title: '', agentId: '', date: '', startTime: '10:00', endTime: '11:00', type: 'training' });
    toast.success('Training session scheduled');
  };

  // Skill display helpers
  const allSkillNames = Array.from(
    new Set(Object.values(agentSkills).flat().map(s => s.name))
  );

  const filteredDisplayAgents = filterSkill && activeTab === 'skills'
    ? displayAgents.filter(a => (agentSkills[a.id] ?? []).some(s => s.name === filterSkill))
    : displayAgents;

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-teal-600" />
            {t('admin.crm.scheduling.title') || 'Agent Scheduling'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.scheduling.subtitle') || 'Manage agent shifts and schedules'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {([
          { key: 'schedule' as const, icon: Calendar, label: t('admin.crm.scheduling.scheduleTab') || 'Schedule' },
          { key: 'bidding' as const, icon: ArrowUpDown, label: t('admin.crm.scheduling.biddingTab') || 'Shift Bidding' },
          { key: 'skills' as const, icon: Zap, label: t('admin.crm.scheduling.skillsTab') || 'Multi-Skill' },
          { key: 'training' as const, icon: GraduationCap, label: t('admin.crm.scheduling.trainingTab') || 'Training' },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Icon className="h-4 w-4" />
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* ================================================================== */}
      {/* SCHEDULE TAB (original) */}
      {/* ================================================================== */}
      {activeTab === 'schedule' && (
        <>
          {/* Controls Bar */}
          <div className="flex items-center justify-between mb-4 bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <button onClick={goToPrevWeek} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={goToThisWeek} className="px-3 py-1.5 text-sm font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100">
                {t('admin.crm.scheduling.today') || 'Today'}
              </button>
              <button onClick={goToNextWeek} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="text-sm font-medium text-gray-700 ml-2">
                {formatDateDisplay(weekDates[0])} - {formatDateDisplay(weekDates[6])},{' '}
                {weekDates[0].getFullYear()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <select
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">{t('admin.crm.scheduling.allAgents') || 'All Agents'}</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name || agent.email || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Schedule Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
            </div>
          ) : displayAgents.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">
                {t('admin.crm.scheduling.noSchedules') || 'No schedules found'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {t('admin.crm.scheduling.noSchedulesDesc') || 'Click on a cell to add a schedule for an agent.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">
                      {t('admin.crm.scheduling.agent') || 'Agent'}
                    </th>
                    {weekDates.map((date, idx) => (
                      <th
                        key={idx}
                        className={`text-center px-2 py-3 text-xs font-semibold uppercase tracking-wider ${
                          isToday(date) ? 'text-teal-600 bg-teal-50/50' : 'text-gray-500'
                        }`}
                      >
                        <div>{DAYS_OF_WEEK[idx]}</div>
                        <div className={`text-lg font-bold mt-0.5 ${isToday(date) ? 'text-teal-600' : 'text-gray-900'}`}>
                          {date.getDate()}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayAgents.map((agent) => (
                    <tr key={agent.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {agent.image ? (
                            <Image src={agent.image} alt="" width={40} height={40} className="h-7 w-7 rounded-full" unoptimized />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                              {(agent.name || agent.email || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900 truncate max-w-[140px]">
                            {agent.name || agent.email || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      {weekDates.map((date, idx) => {
                        const schedule = getSchedule(agent.id, date);
                        return (
                          <td
                            key={idx}
                            className={`px-1 py-2 text-center cursor-pointer transition-colors ${
                              isToday(date) ? 'bg-teal-50/30' : ''
                            } hover:bg-gray-100`}
                            onClick={() => setModal({
                              agentId: agent.id,
                              date: formatDate(date),
                              existing: schedule,
                            })}
                          >
                            {schedule ? (
                              schedule.isOff ? (
                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-600 border border-red-100 text-xs font-medium">
                                  {t('admin.crm.scheduling.off') || 'OFF'}
                                </div>
                              ) : (
                                <div className={`inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg border text-xs font-medium ${SHIFT_CONFIG[schedule.shiftType].color}`}>
                                  <span>{SHIFT_CONFIG[schedule.shiftType].label}</span>
                                  <span className="text-[10px] opacity-75 flex items-center gap-0.5">
                                    <Clock className="h-2.5 w-2.5" />
                                    {schedule.startTime}-{schedule.endTime}
                                  </span>
                                </div>
                              )
                            ) : (
                              <button className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-300 hover:text-teal-500 hover:bg-teal-50 transition-colors">
                                <Plus className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ================================================================== */}
      {/* SHIFT BIDDING TAB (F2) */}
      {/* ================================================================== */}
      {activeTab === 'bidding' && (
        <div className="space-y-6">
          {/* Submit a Bid */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-teal-600" />
              {t('admin.crm.scheduling.submitBid') || 'Submit Shift Preference'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('admin.crm.scheduling.agent') || 'Agent'}
                </label>
                <select
                  value={newBidAgent}
                  onChange={(e) => setNewBidAgent(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select agent...</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name || a.email || 'Unknown'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('admin.crm.scheduling.preferredShift') || 'Preferred Shift'}
                </label>
                <select
                  value={newBidShift}
                  onChange={(e) => setNewBidShift(e.target.value as ShiftType)}
                  className={inputCls}
                >
                  {(Object.keys(SHIFT_CONFIG) as ShiftType[]).map(k => (
                    <option key={k} value={k}>{SHIFT_CONFIG[k].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('admin.crm.scheduling.bidDate') || 'Date'}
                </label>
                <input
                  type="date"
                  value={newBidDate}
                  onChange={(e) => setNewBidDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddBid}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 w-full justify-center"
                >
                  <Plus className="h-4 w-4" />
                  {t('admin.crm.scheduling.addBid') || 'Add Bid'}
                </button>
              </div>
            </div>
          </div>

          {/* Bids List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">
                {t('admin.crm.scheduling.pendingBids') || 'Shift Bids'} ({bids.length})
              </h3>
            </div>
            {bids.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                {t('admin.crm.scheduling.noBids') || 'No shift bids submitted yet.'}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Agent</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Shift</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Preference</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map(bid => (
                    <tr key={bid.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-sm text-gray-900">{bid.agentName}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{bid.date}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${SHIFT_CONFIG[bid.shiftType].color}`}>
                          {SHIFT_CONFIG[bid.shiftType].label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 3 }, (_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < bid.preference ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          bid.status === 'approved' ? 'bg-green-100 text-green-700' :
                          bid.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {bid.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {bid.status === 'pending' && (
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => handleBidAction(bid.id, 'approved')}
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleBidAction(bid.id, 'rejected')}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MULTI-SKILL SCHEDULING TAB (F14) */}
      {/* ================================================================== */}
      {activeTab === 'skills' && (
        <div className="space-y-6">
          {/* Skill filter */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterSkill}
              onChange={(e) => setFilterSkill(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">{t('admin.crm.scheduling.allSkills') || 'All Skills'}</option>
              {allSkillNames.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              {t('admin.crm.scheduling.filterBySkill') || 'Filter agents by skill to optimize scheduling'}
            </span>
          </div>

          {/* Schedule Grid with Skills */}
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">
                      {t('admin.crm.scheduling.agent') || 'Agent'}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">
                      {t('admin.crm.scheduling.skills') || 'Skills'}
                    </th>
                    {weekDates.map((date, idx) => (
                      <th
                        key={idx}
                        className={`text-center px-2 py-3 text-xs font-semibold uppercase tracking-wider ${
                          isToday(date) ? 'text-teal-600 bg-teal-50/50' : 'text-gray-500'
                        }`}
                      >
                        <div>{DAYS_OF_WEEK[idx]}</div>
                        <div className={`text-lg font-bold mt-0.5 ${isToday(date) ? 'text-teal-600' : 'text-gray-900'}`}>
                          {date.getDate()}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDisplayAgents.map((agent) => {
                    const skills = agentSkills[agent.id] ?? [];
                    return (
                      <tr key={agent.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {agent.image ? (
                              <Image src={agent.image} alt="" width={40} height={40} className="h-7 w-7 rounded-full" unoptimized />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                {(agent.name || agent.email || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                              {agent.name || agent.email || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {skills.length > 0 ? skills.slice(0, 3).map((s, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-medium">
                                {s.name} ({s.level})
                              </span>
                            )) : (
                              <span className="text-xs text-gray-400">No skills</span>
                            )}
                            {skills.length > 3 && (
                              <span className="text-[10px] text-gray-400">+{skills.length - 3}</span>
                            )}
                          </div>
                        </td>
                        {weekDates.map((date, idx) => {
                          const schedule = getSchedule(agent.id, date);
                          return (
                            <td key={idx} className={`px-1 py-2 text-center ${isToday(date) ? 'bg-teal-50/30' : ''}`}>
                              {schedule ? (
                                schedule.isOff ? (
                                  <span className="text-xs text-red-500 font-medium">OFF</span>
                                ) : (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${SHIFT_CONFIG[schedule.shiftType].color}`}>
                                    {SHIFT_CONFIG[schedule.shiftType].label}
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-gray-300">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredDisplayAgents.length === 0 && !loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Zap className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {t('admin.crm.scheduling.noAgentsWithSkill') || 'No agents found with the selected skill.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TRAINING TAB (F15) */}
      {/* ================================================================== */}
      {activeTab === 'training' && (
        <div className="space-y-6">
          {/* Add training button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowTrainingModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              <Plus className="h-4 w-4" />
              {t('admin.crm.scheduling.scheduleTraining') || 'Schedule Training'}
            </button>
          </div>

          {/* Training sessions list */}
          {trainingSessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">
                {t('admin.crm.scheduling.noTraining') || 'No training sessions scheduled'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {t('admin.crm.scheduling.noTrainingDesc') || 'Schedule training and coaching blocks for your agents.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trainingSessions.map(session => (
                <div key={session.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GraduationCap className={`h-5 w-5 ${
                        session.type === 'training' ? 'text-teal-500' :
                        session.type === 'coaching' ? 'text-green-500' : 'text-purple-500'
                      }`} />
                      <h4 className="font-medium text-gray-900 text-sm">{session.title}</h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      session.status === 'scheduled' ? 'bg-teal-100 text-teal-700' :
                      session.status === 'completed' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {session.status}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {session.agentName}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {session.date}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {session.startTime} - {session.endTime}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      session.type === 'training' ? 'bg-teal-50 text-teal-600' :
                      session.type === 'coaching' ? 'bg-green-50 text-green-600' :
                      'bg-purple-50 text-purple-600'
                    }`}>
                      {session.type.charAt(0).toUpperCase() + session.type.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Training Modal */}
          {showTrainingModal && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-green-600" />
                    {t('admin.crm.scheduling.newTraining') || 'Schedule Training Session'}
                  </h3>
                  <button onClick={() => setShowTrainingModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                    <input
                      type="text"
                      value={trainingForm.title}
                      onChange={(e) => setTrainingForm(prev => ({ ...prev, title: e.target.value }))}
                      className={inputCls}
                      placeholder="e.g., Product Knowledge - BPC-157"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Agent *</label>
                    <select
                      value={trainingForm.agentId}
                      onChange={(e) => setTrainingForm(prev => ({ ...prev, agentId: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">Select agent...</option>
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.name || a.email || 'Unknown'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select
                      value={trainingForm.type}
                      onChange={(e) => setTrainingForm(prev => ({ ...prev, type: e.target.value as 'training' | 'coaching' | 'onboarding' }))}
                      className={inputCls}
                    >
                      <option value="training">Training</option>
                      <option value="coaching">Coaching</option>
                      <option value="onboarding">Onboarding</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                    <input
                      type="date"
                      value={trainingForm.date}
                      onChange={(e) => setTrainingForm(prev => ({ ...prev, date: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={trainingForm.startTime}
                        onChange={(e) => setTrainingForm(prev => ({ ...prev, startTime: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                      <input
                        type="time"
                        value={trainingForm.endTime}
                        onChange={(e) => setTrainingForm(prev => ({ ...prev, endTime: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowTrainingModal(false)}
                      className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      {t('common.cancel') || 'Cancel'}
                    </button>
                    <button
                      onClick={handleAddTraining}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700"
                    >
                      <Save className="h-4 w-4" />
                      {t('admin.crm.scheduling.saveTraining') || 'Schedule'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Schedule Modal */}
      {modal && (
        <ScheduleModal
          data={modal}
          onClose={() => setModal(null)}
          onSaved={handleScheduleSaved}
        />
      )}
    </div>
  );
}
