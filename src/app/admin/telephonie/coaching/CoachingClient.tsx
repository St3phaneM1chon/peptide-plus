'use client';

/**
 * CoachingClient - Coaching dashboard with sessions and agent scores.
 */

import { useState, useMemo } from 'react';
import { useI18n } from '@/i18n/client';
import {
  GraduationCap, Headphones, MessageSquare, PhoneIncoming,
  Clock, Trophy, Star, Plus, X, Check, User,
} from 'lucide-react';
import { toast } from 'sonner';

interface CoachingScore {
  id: string;
  criterion: string;
  score: number;
  weight: number;
  comment: string | null;
  isAutoScored: boolean;
}

interface CoachingSession {
  id: string;
  coachId: string;
  studentId: string;
  status: string;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMin: number | null;
  topic: string | null;
  objectives: string | null;
  feedback: string | null;
  coach: { id: string; name: string | null; email: string };
  student: { id: string; name: string | null; email: string };
  scores: CoachingScore[];
}

interface AvailableUser {
  id: string;
  name: string | null;
  email: string;
}

type CoachingMode = 'listen' | 'whisper' | 'barge';

export default function CoachingClient({
  initialSessions,
  availableUsers,
  currentUserId,
}: {
  initialSessions: CoachingSession[];
  availableUsers: AvailableUser[];
  currentUserId: string;
}) {
  const { t, locale } = useI18n();
  const [sessions, setSessions] = useState<CoachingSession[]>(initialSessions);
  const [showNewSession, setShowNewSession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentId: '',
    topic: '',
    objectives: '',
    scheduledAt: new Date().toISOString().slice(0, 16),
  });

  // Separate active vs completed sessions
  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS'),
    [sessions]
  );
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'COMPLETED'),
    [sessions]
  );

  // Compute per-agent average scores
  const agentScores = useMemo(() => {
    const map = new Map<string, { name: string; totalScore: number; count: number; sessionCount: number }>();
    for (const session of completedSessions) {
      const key = session.studentId;
      if (!map.has(key)) {
        map.set(key, {
          name: session.student.name || session.student.email,
          totalScore: 0,
          count: 0,
          sessionCount: 0,
        });
      }
      const entry = map.get(key)!;
      entry.sessionCount++;
      for (const score of session.scores) {
        entry.totalScore += score.score * score.weight;
        entry.count += score.weight;
      }
    }
    return Array.from(map.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        avgScore: data.count > 0 ? Math.round((data.totalScore / data.count) * 10) / 10 : 0,
        sessionCount: data.sessionCount,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [completedSessions]);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return { color: 'bg-teal-50 text-teal-700', label: 'Scheduled' };
      case 'IN_PROGRESS': return { color: 'bg-emerald-50 text-emerald-700', label: 'In Progress' };
      case 'COMPLETED': return { color: 'bg-gray-100 text-gray-600', label: 'Completed' };
      case 'CANCELLED': return { color: 'bg-red-50 text-red-600', label: 'Cancelled' };
      case 'NO_SHOW': return { color: 'bg-amber-50 text-amber-700', label: 'No Show' };
      default: return { color: 'bg-gray-100 text-gray-500', label: status };
    }
  };

  const modeIcon = (mode: CoachingMode) => {
    switch (mode) {
      case 'listen': return <Headphones className="w-4 h-4" />;
      case 'whisper': return <MessageSquare className="w-4 h-4" />;
      case 'barge': return <PhoneIncoming className="w-4 h-4" />;
    }
  };

  const modeColor = (mode: CoachingMode) => {
    switch (mode) {
      case 'listen': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'whisper': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'barge': return 'bg-red-50 text-red-700 border-red-200';
    }
  };

  const handleCoachAction = async (sessionId: string, mode: CoachingMode) => {
    try {
      const res = await fetch('/api/admin/voip/coaching', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: mode }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed');
        return;
      }
      toast.success(`${mode.charAt(0).toUpperCase() + mode.slice(1)} mode activated`);
      // Update session status to IN_PROGRESS locally
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, status: 'IN_PROGRESS', startedAt: s.startedAt || new Date().toISOString() } : s
        )
      );
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleNewSession = async () => {
    if (!form.studentId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/voip/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: currentUserId,
          studentId: form.studentId,
          topic: form.topic || null,
          objectives: form.objectives || null,
          scheduledAt: form.scheduledAt,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed');
        return;
      }
      const data = await res.json();
      setSessions((prev) => [data.session, ...prev]);
      toast.success(t('common.saved'));
      setShowNewSession(false);
      setForm({ studentId: '', topic: '', objectives: '', scheduledAt: new Date().toISOString().slice(0, 16) });
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      const res = await fetch('/api/admin/voip/coaching', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'end' }),
      });
      if (!res.ok) {
        toast.error('Failed');
        return;
      }
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, status: 'COMPLETED', endedAt: new Date().toISOString() } : s
        )
      );
      toast.success(t('common.saved'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const formatDuration = (session: CoachingSession): string => {
    if (session.durationMin) return `${session.durationMin} min`;
    if (session.startedAt) {
      const start = new Date(session.startedAt).getTime();
      const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
      const mins = Math.round((end - start) / 60000);
      return `${mins} min`;
    }
    return '-';
  };

  const scoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-600';
    if (score >= 6) return 'text-amber-600';
    if (score >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('voip.admin.coaching.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('voip.admin.coaching.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowNewSession(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> {t('voip.admin.coaching.startSession')}
        </button>
      </div>

      {/* Agent Scores Summary Cards */}
      {agentScores.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            {t('voip.admin.coaching.agentScores')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {agentScores.slice(0, 8).map((agent, idx) => (
              <div key={agent.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.sessionCount} sessions</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${scoreColor(agent.avgScore)}`}>
                      {agent.avgScore}
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${star <= Math.round(agent.avgScore / 2) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Sessions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-teal-600" />
          {t('voip.admin.coaching.activeSessions')}
        </h2>

        {activeSessions.length > 0 ? (
          <div className="space-y-3">
            {activeSessions.map((session) => {
              const badge = statusBadge(session.status);
              return (
                <div key={session.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Coach */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-teal-600" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Coach</div>
                          <div className="text-sm font-medium text-gray-900">
                            {session.coach.name || session.coach.email}
                          </div>
                        </div>
                      </div>

                      <div className="text-gray-300">&#8594;</div>

                      {/* Agent */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">{t('voip.admin.coaching.agent')}</div>
                          <div className="text-sm font-medium text-gray-900">
                            {session.student.name || session.student.email}
                          </div>
                        </div>
                      </div>

                      {/* Status */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                        {badge.label}
                      </span>

                      {/* Duration */}
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        {formatDuration(session)}
                      </div>

                      {/* Topic */}
                      {session.topic && (
                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                          {session.topic}
                        </span>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-2">
                      {(['listen', 'whisper', 'barge'] as CoachingMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => handleCoachAction(session.id, mode)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:shadow-sm ${modeColor(mode)}`}
                        >
                          {modeIcon(mode)}
                          {mode === 'listen' && t('voip.admin.coaching.listen')}
                          {mode === 'whisper' && t('voip.admin.coaching.whisper')}
                          {mode === 'barge' && t('voip.admin.coaching.barge')}
                        </button>
                      ))}
                      <button
                        onClick={() => handleEndSession(session.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        {t('voip.admin.coaching.endSession')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
            <GraduationCap className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>{t('voip.admin.coaching.noSessions')}</p>
          </div>
        )}
      </div>

      {/* Recent Completed Sessions */}
      {completedSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Sessions</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Coach</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('voip.admin.coaching.agent')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Topic</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">{t('voip.admin.coaching.score')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {completedSessions.slice(0, 10).map((session) => {
                  const avgScore = session.scores.length > 0
                    ? Math.round(
                        (session.scores.reduce((sum, s) => sum + s.score * s.weight, 0) /
                          session.scores.reduce((sum, s) => sum + s.weight, 0)) * 10
                      ) / 10
                    : null;
                  return (
                    <tr key={session.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-gray-900">{session.coach.name || session.coach.email}</td>
                      <td className="px-4 py-3 text-gray-900">{session.student.name || session.student.email}</td>
                      <td className="px-4 py-3 text-gray-600">{session.topic || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {avgScore !== null ? (
                          <span className={`font-bold ${scoreColor(avgScore)}`}>{avgScore}/10</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(session.scheduledAt).toLocaleDateString(locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Session Modal */}
      {showNewSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('voip.admin.coaching.startSession')}
              </h2>
              <button onClick={() => setShowNewSession(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Agent select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('voip.admin.coaching.agent')}
                </label>
                <select
                  value={form.studentId}
                  onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">--</option>
                  {availableUsers
                    .filter((u) => u.id !== currentUserId)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email}
                      </option>
                    ))}
                </select>
              </div>

              {/* Topic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="Sales techniques, Complaint handling..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Objectives */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objectives</label>
                <textarea
                  value={form.objectives}
                  onChange={(e) => setForm((f) => ({ ...f, objectives: e.target.value }))}
                  placeholder="What should be practiced..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y"
                />
              </div>

              {/* Scheduled At */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowNewSession(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleNewSession}
                disabled={saving || !form.studentId}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> {t('voip.admin.coaching.startSession')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
