'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Phone, PhoneOff, SkipForward,
  Flame, Thermometer, Snowflake,
  BarChart3,
} from 'lucide-react';
import { fetchWithCSRF } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lead {
  id: string;
  contactName: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  score: number;
  temperature: string;
  status: string;
  dncStatus: string;
  lastContactedAt?: string | null;
  tags: string[];
}

/** Backend DialerState values mapped to lowercase UI states */
type DialerState = 'idle' | 'dialing' | 'ringing' | 'connected' | 'wrap-up' | 'paused';

type BackendState = 'IDLE' | 'DIALING' | 'RINGING' | 'AMD_CHECK' | 'CONNECTED' | 'WRAP_UP' | 'PAUSED';

interface BackendSession {
  campaignId: string;
  agentUserId: string;
  state: BackendState;
  currentEntryId: string | null;
  currentCallControlId: string | null;
  startedAt: string;
  callCount: number;
  connectCount: number;
}

interface BackendEntry {
  id: string;
  phoneNumber: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  callAttempts: number;
  lastCalledAt: string | null;
}

interface SessionStateResponse {
  session: BackendSession | null;
  campaign: {
    id: string;
    name: string;
    callerIdNumber: string;
    scriptTitle: string | null;
    scriptBody: string | null;
    totalContacts: number;
    totalCalled: number;
    totalConnected: number;
  } | null;
  currentEntry: BackendEntry | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISPOSITIONS = [
  { label: 'Sale', value: 'INTERESTED', color: 'bg-green-600', icon: '🎉' },
  { label: 'Callback', value: 'CALLBACK', color: 'bg-blue-600', icon: '📞' },
  { label: 'Not Interested', value: 'NOT_INTERESTED', color: 'bg-gray-500', icon: '👎' },
  { label: 'Voicemail', value: 'VOICEMAIL', color: 'bg-yellow-600', icon: '📧' },
  { label: 'DNC', value: 'DO_NOT_CALL', color: 'bg-red-600', icon: '🚫' },
  { label: 'Wrong Number', value: 'WRONG_NUMBER', color: 'bg-orange-500', icon: '❌' },
];

// Caller ID to use for ad-hoc campaigns — falls back to a placeholder.
// In production this should be pulled from a PhoneNumber record.
const DEFAULT_CALLER_ID = process.env.NEXT_PUBLIC_DEFAULT_CALLER_ID || '+15141234567';

// Polling interval (ms) while a session is active
const POLL_INTERVAL_MS = 2000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapBackendState(state: BackendState): DialerState {
  switch (state) {
    case 'IDLE': return 'idle';
    case 'DIALING': return 'dialing';
    case 'RINGING': return 'ringing';
    case 'AMD_CHECK': return 'ringing'; // treat AMD check same as ringing in UI
    case 'CONNECTED': return 'connected';
    case 'WRAP_UP': return 'wrap-up';
    case 'PAUSED': return 'paused';
    default: return 'idle';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PowerDialerPage() {
  const { t, locale } = useI18n();

  // ── Lead list (fetched from CRM) ──
  const [leads, setLeads] = useState<Lead[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ temperature: '', status: 'NEW', source: '' });

  // ── Dialer state (driven by backend session polling) ──
  const [dialerState, setDialerState] = useState<DialerState>('idle');
  const [sessionActive, setSessionActive] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [backendEntry, setBackendEntry] = useState<BackendEntry | null>(null);

  // ── Local UI state ──
  const [callDuration, setCallDuration] = useState(0);
  const [sessionStats, setSessionStats] = useState({ calls: 0, connected: 0, conversions: 0, totalTalkTime: 0 });
  const [wrapUpTimer, setWrapUpTimer] = useState(30);
  const [autoDialEnabled, setAutoDialEnabled] = useState(true);
  const [actionInFlight, setActionInFlight] = useState(false);

  // refs for intervals so we can clear them across renders
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartRef = useRef<number>(Date.now());
  const wrapUpRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch CRM leads ──
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200', dncStatus: 'CALLABLE' });
      if (filters.temperature) params.set('temperature', filters.temperature);
      if (filters.status) params.set('status', filters.status);
      if (filters.source) params.set('source', filters.source);

      const res = await fetch(`/api/admin/crm/leads?${params}`);
      const json = await res.json();
      if (json.success) {
        setLeads(json.data?.filter((l: Lead) => l.phone && l.dncStatus === 'CALLABLE') || []);
        setCurrentIndex(0);
      }
    } catch {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Call timer (connected state) ──
  useEffect(() => {
    if (dialerState === 'connected') {
      callStartRef.current = Date.now();
      callTimerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (dialerState === 'idle') setCallDuration(0);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [dialerState]);

  // ── Wrap-up countdown (local UI only — backend handles the real timer) ──
  useEffect(() => {
    if (dialerState === 'wrap-up') {
      setWrapUpTimer(30);
      wrapUpRef.current = setInterval(() => {
        setWrapUpTimer(prev => {
          if (prev <= 1) {
            if (wrapUpRef.current) clearInterval(wrapUpRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (wrapUpRef.current) clearInterval(wrapUpRef.current);
    }
    return () => { if (wrapUpRef.current) clearInterval(wrapUpRef.current); };
  }, [dialerState]);

  // ── Session state polling ──
  const pollSession = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/dialer');
      if (!res.ok) return;
      const json: { success: boolean; data: SessionStateResponse } = await res.json();
      if (!json.success) return;

      const { session, currentEntry } = json.data;

      if (!session) {
        // Session ended
        setSessionActive(false);
        setCampaignId(null);
        setDialerState('idle');
        setBackendEntry(null);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        return;
      }

      const uiState = mapBackendState(session.state);
      setDialerState(uiState);
      setBackendEntry(currentEntry);

      // Keep stats in sync with backend
      setSessionStats(prev => ({
        ...prev,
        calls: session.callCount,
        connected: session.connectCount,
      }));

      // Advance lead index when backend moves to the next entry
      if (currentEntry) {
        const matchIdx = leads.findIndex(l => l.phone === currentEntry.phoneNumber);
        if (matchIdx !== -1 && matchIdx !== currentIndex) {
          setCurrentIndex(matchIdx);
        }
      }
    } catch {
      // Polling errors are silent — the dialer keeps working locally
    }
  }, [leads, currentIndex]);

  // Start/stop polling whenever session becomes active
  useEffect(() => {
    if (sessionActive) {
      // Immediate first poll
      pollSession();
      pollRef.current = setInterval(pollSession, POLL_INTERVAL_MS);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [sessionActive, pollSession]);

  // ── Current lead ──
  const currentLead = leads[currentIndex] || null;

  // ── Helpers ──
  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const dispatchAction = async (action: string, data?: Record<string, unknown>) => {
    if (actionInFlight) return;
    setActionInFlight(true);
    try {
      const res = await fetchWithCSRF('/api/admin/crm/dialer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(data ? { data } : {}) }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || `Action "${action}" failed`);
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setActionInFlight(false);
    }
  };

  // ── Start dialing ──
  const startDialing = async () => {
    if (!currentLead?.phone) { toast.error('No phone number'); return; }
    if (sessionActive) {
      // Session already active — just dispatch a resume if paused
      if (dialerState === 'paused') {
        await dispatchAction('resume');
      }
      return;
    }

    setActionInFlight(true);
    try {
      const res = await fetchWithCSRF('/api/admin/crm/dialer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'adhoc',
          callerIdNumber: DEFAULT_CALLER_ID,
          filters: {
            temperature: filters.temperature || undefined,
            status: filters.status || undefined,
          },
        }),
      });

      const json = await res.json();

      if (!json.success) {
        toast.error(json.error?.message || 'Failed to start dialer session');
        return;
      }

      setCampaignId(json.data.campaignId);
      setSessionActive(true);
      toast.success(`Dialer session started (${json.data.leadCount ?? ''} leads)`);
    } catch {
      toast.error('Failed to start dialer session');
    } finally {
      setActionInFlight(false);
    }
  };

  // ── Hang up / cancel current call ──
  const hangUp = async () => {
    setSessionStats(prev => ({
      ...prev,
      calls: prev.calls + 1,
      connected: prev.connected + (callDuration > 0 ? 1 : 0),
      totalTalkTime: prev.totalTalkTime + callDuration,
    }));
    setDialerState('wrap-up');
    // Backend will detect the Telnyx hangup webhook and set state to WRAP_UP automatically.
    // For the UI, we also request a stop so any manual hang-up is reflected.
    if (sessionActive) {
      await dispatchAction('stop');
      setSessionActive(false);
    }
  };

  // ── Submit disposition ──
  const selectDisposition = async (disposition: string) => {
    if (disposition === 'INTERESTED') {
      setSessionStats(prev => ({ ...prev, conversions: prev.conversions + 1 }));
    }
    toast.success(`Disposition: ${disposition}`);

    if (sessionActive) {
      await dispatchAction('disposition', { type: disposition });
      // The backend will auto-dial next; keep the session active and polling
      if (!autoDialEnabled) {
        await dispatchAction('pause');
      }
    } else {
      // Fallback: local-only advance
      setDialerState('idle');
      if (autoDialEnabled) dialNext();
    }
  };

  // ── Skip lead ──
  const skipLead = async () => {
    if (sessionActive) {
      await dispatchAction('skip');
      // Polling will update dialerState once the backend advances
    } else {
      dialNext();
    }
  };

  // ── Advance to next lead in local list (used in non-session mode) ──
  const dialNext = () => {
    setDialerState('idle');
    setCallDuration(0);
    setCurrentIndex(prev => {
      const next = prev + 1;
      if (next >= leads.length) {
        toast.info('End of list');
        return prev;
      }
      return next;
    });
  };

  // ── Campaign stop (stop dialer session completely) ──
  const stopSession = async () => {
    if (!sessionActive) return;
    await dispatchAction('stop');
    setSessionActive(false);
    setCampaignId(null);
    setDialerState('idle');
    toast.info('Dialer session stopped');
  };

  const TempIcon =
    currentLead?.temperature === 'HOT' ? Flame :
    currentLead?.temperature === 'WARM' ? Thermometer : Snowflake;
  const tempColor =
    currentLead?.temperature === 'HOT' ? 'text-red-500' :
    currentLead?.temperature === 'WARM' ? 'text-orange-500' : 'text-blue-400';

  // Use backend-reported phone/name when a session is active, fall back to lead list entry
  const displayPhone = backendEntry?.phoneNumber || currentLead?.phone || null;

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Left: Lead Info */}
      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : !currentLead ? (
          <div className="text-center text-gray-400 py-16">
            <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">{t('admin.crm.dialer.noLeads') || 'No leads to call'}</p>
            <p className="text-sm mt-1">{t('admin.crm.dialer.adjustFilters') || 'Adjust filters to load leads'}</p>
          </div>
        ) : (
          <div>
            {/* Session banner */}
            {sessionActive && campaignId && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4">
                <span className="text-sm text-blue-700 font-medium">
                  {t('admin.crm.dialer.sessionActive') || 'Session active'}
                </span>
                <button
                  onClick={stopSession}
                  disabled={actionInFlight}
                  className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  {t('admin.crm.dialer.stopSession') || 'Stop session'}
                </button>
              </div>
            )}

            {/* Current Lead Card */}
            <div className="bg-white rounded-xl border-2 border-blue-200 p-6 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">{currentLead.contactName}</h2>
                    <TempIcon className={`h-6 w-6 ${tempColor}`} />
                    <span className="text-lg font-bold text-gray-400">{currentLead.score}/100</span>
                  </div>
                  {currentLead.companyName && (
                    <p className="text-gray-500 mt-1">{currentLead.companyName}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                    {displayPhone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />{displayPhone}
                      </span>
                    )}
                    {currentLead.email && (
                      <span className="flex items-center gap-1">&#9993; {currentLead.email}</span>
                    )}
                  </div>
                  {currentLead.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-3">
                      {currentLead.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right text-sm text-gray-400">
                  <p>{currentIndex + 1} / {leads.length}</p>
                  {currentLead.lastContactedAt && (
                    <p className="mt-1">Last: {new Date(currentLead.lastContactedAt).toLocaleDateString(locale)}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Call Controls */}
            <div className="bg-white rounded-xl border p-6 mb-6">
              <div className="flex items-center justify-center gap-4">
                {dialerState === 'idle' && (
                  <>
                    <button
                      onClick={skipLead}
                      disabled={actionInFlight}
                      className="flex items-center gap-2 px-4 py-3 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      <SkipForward className="h-4 w-4" /> {t('common.skip') || 'Skip'}
                    </button>
                    <button
                      onClick={startDialing}
                      disabled={actionInFlight}
                      className="flex items-center gap-2 px-8 py-3 text-lg font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50"
                    >
                      <Phone className="h-5 w-5" /> {sessionActive ? (t('admin.crm.dialer.dialNext') || 'Dial Next') : (t('admin.crm.dialer.startDialing') || 'Start Dialing')}
                    </button>
                  </>
                )}
                {(dialerState === 'dialing' || dialerState === 'ringing') && (
                  <div className="text-center">
                    <div className="animate-pulse text-yellow-500 mb-2">
                      <Phone className="h-10 w-10 mx-auto" />
                    </div>
                    <p className="text-lg font-medium">
                      {dialerState === 'dialing' ? (t('admin.crm.dialer.dialing') || 'Dialing...') : (t('admin.crm.dialer.ringing') || 'Ringing...')}
                    </p>
                    <button
                      onClick={hangUp}
                      disabled={actionInFlight}
                      className="mt-4 flex items-center gap-2 px-6 py-2 text-white bg-red-600 rounded-lg mx-auto disabled:opacity-50"
                    >
                      <PhoneOff className="h-4 w-4" /> {t('common.cancel') || 'Cancel'}
                    </button>
                  </div>
                )}
                {dialerState === 'connected' && (
                  <div className="text-center">
                    <p className="text-4xl font-mono font-bold text-green-600 mb-4">
                      {formatDuration(callDuration)}
                    </p>
                    <button
                      onClick={hangUp}
                      disabled={actionInFlight}
                      className="flex items-center gap-2 px-8 py-3 text-lg text-white bg-red-600 rounded-xl hover:bg-red-700 mx-auto disabled:opacity-50"
                    >
                      <PhoneOff className="h-5 w-5" /> {t('admin.crm.dialer.endCall') || 'End Call'}
                    </button>
                  </div>
                )}
                {dialerState === 'wrap-up' && (
                  <div className="w-full">
                    <p className="text-center text-sm text-gray-500 mb-3">
                      {t('admin.crm.dialer.wrapUp') || 'Wrap-up'} ({wrapUpTimer}s) — {t('admin.crm.dialer.selectDisposition') || 'Select disposition'}:
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {DISPOSITIONS.map(d => (
                        <button
                          key={d.value}
                          onClick={() => selectDisposition(d.value)}
                          disabled={actionInFlight}
                          className={`py-3 px-4 rounded-lg text-white text-sm font-medium ${d.color} hover:opacity-90 disabled:opacity-50`}
                        >
                          <span className="mr-1">{d.icon}</span> {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {dialerState === 'paused' && (
                  <div className="text-center">
                    <p className="text-gray-500 text-lg mb-4">{t('admin.crm.dialer.sessionPaused') || 'Session paused'}</p>
                    <button
                      onClick={startDialing}
                      disabled={actionInFlight}
                      className="flex items-center gap-2 px-8 py-3 text-lg font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 mx-auto"
                    >
                      <Phone className="h-5 w-5" /> {t('admin.crm.dialer.resume') || 'Resume'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Lead Queue Preview */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('admin.crm.dialer.nextInQueue') || 'Next in Queue'}</h3>
              <div className="space-y-2">
                {leads.slice(currentIndex + 1, currentIndex + 6).map((lead, i) => (
                  <div key={lead.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 text-sm">
                    <span className="text-xs text-gray-400 w-6">{currentIndex + 2 + i}</span>
                    <span className="font-medium flex-1">{lead.contactName}</span>
                    <span className="text-gray-400">{lead.phone}</span>
                    <span className={`text-xs font-bold ${lead.score >= 70 ? 'text-green-600' : lead.score >= 40 ? 'text-yellow-600' : 'text-gray-400'}`}>
                      {lead.score}
                    </span>
                  </div>
                ))}
                {leads.length <= currentIndex + 1 && (
                  <p className="text-xs text-gray-400 text-center">{t('admin.crm.dialer.endOfList') || 'End of list'}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Session Stats + Filters */}
      <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
        {/* Session Stats */}
        <div className="bg-white rounded-lg border p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> {t('admin.crm.dialer.sessionStats') || 'Session Stats'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{sessionStats.calls}</p>
              <p className="text-xs text-gray-500">{t('admin.crm.calls') || 'Calls'}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{sessionStats.connected}</p>
              <p className="text-xs text-gray-500">{t('admin.crm.dialer.connected') || 'Connected'}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{sessionStats.conversions}</p>
              <p className="text-xs text-gray-500">{t('admin.crm.conversions') || 'Conversions'}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{formatDuration(sessionStats.totalTalkTime)}</p>
              <p className="text-xs text-gray-500">{t('admin.crm.dialer.talkTime') || 'Talk Time'}</p>
            </div>
          </div>
          {sessionStats.calls > 0 && (
            <div className="mt-3 pt-3 border-t text-xs text-gray-500">
              <p>Contact Rate: {Math.round((sessionStats.connected / sessionStats.calls) * 100)}%</p>
              <p>Conversion Rate: {Math.round((sessionStats.conversions / Math.max(sessionStats.connected, 1)) * 100)}%</p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('common.filters') || 'Filters'}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('common.status') || 'Status'}</label>
              <select
                value={filters.status}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                disabled={sessionActive}
                className="w-full text-sm border rounded-md px-2 py-1.5 disabled:opacity-50"
              >
                <option value="">All</option>
                {['NEW', 'CONTACTED', 'QUALIFIED'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('admin.crm.temperature') || 'Temperature'}</label>
              <select
                value={filters.temperature}
                onChange={e => setFilters(f => ({ ...f, temperature: e.target.value }))}
                disabled={sessionActive}
                className="w-full text-sm border rounded-md px-2 py-1.5 disabled:opacity-50"
              >
                <option value="">All</option>
                {['HOT', 'WARM', 'COLD'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {sessionActive && (
              <p className="text-xs text-amber-600">Filters locked during active session</p>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('common.settings') || 'Settings'}</h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={autoDialEnabled}
              onChange={e => setAutoDialEnabled(e.target.checked)}
              className="rounded"
            />
            {t('admin.crm.dialer.autoDialNext') || 'Auto-dial next lead'}
          </label>
        </div>
      </div>
    </div>
  );
}
