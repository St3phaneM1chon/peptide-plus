'use client';

/**
 * CTI (Computer Telephony Integration) Toolbar — C34
 *
 * Persistent toolbar at the bottom of admin pages providing:
 * - Agent status indicator (available/busy/break/acw)
 * - Current call info (number, duration, contact name)
 * - Quick actions (hold, transfer, mute, hang up)
 * - Minimized mode showing just the status dot
 *
 * Listens to the same softphone events to stay in sync.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Play,
  ArrowRightLeft,
  ChevronUp,
  ChevronDown,
  Coffee,
  UserCheck,
  Clock,
  Headphones,
  Ear,
  MessageSquare,
  LogIn,
  Users,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentStatus = 'available' | 'busy' | 'break' | 'acw';

interface ActiveCallInfo {
  phone: string;
  contactName?: string;
  duration: number;
  isOnHold: boolean;
  isMuted: boolean;
}

interface SupervisedCall {
  callControlId: string;
  agentName: string;
  callerNumber: string;
  duration: number;
}

interface CtiToolbarProps {
  className?: string;
  /** Enable supervisor mode (listen/whisper/barge) */
  isSupervisor?: boolean;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; icon: typeof UserCheck }> = {
  available: { label: 'Available', color: 'bg-green-500', icon: UserCheck },
  busy:      { label: 'In Call',   color: 'bg-red-500',   icon: Headphones },
  break:     { label: 'On Break',  color: 'bg-yellow-500', icon: Coffee },
  acw:       { label: 'ACW',       color: 'bg-orange-500', icon: Clock },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CtiToolbar({ className = '', isSupervisor = false }: CtiToolbarProps) {
  const { t } = useI18n();
  const [minimized, setMinimized] = useState(false);
  const [status, setStatus] = useState<AgentStatus>('available');
  const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Supervisor mode
  const [showSupervisorPanel, setShowSupervisorPanel] = useState(false);
  const [supervisedCalls, setSupervisedCalls] = useState<SupervisedCall[]>([]);
  const [coachingMode, setCoachingMode] = useState<'none' | 'listen' | 'whisper' | 'barge'>('none');
  const [coachingCallId, setCoachingCallId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Listen for softphone state changes via CustomEvents
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleCallStart = (e: CustomEvent<{ phone: string; contactName?: string }>) => {
      setStatus('busy');
      setActiveCall({
        phone: e.detail.phone,
        contactName: e.detail.contactName,
        duration: 0,
        isOnHold: false,
        isMuted: false,
      });
    };

    const handleCallEnd = () => {
      setStatus('acw');
      setActiveCall(null);
      // Auto-transition back to available after 60s
      setTimeout(() => {
        setStatus((prev) => (prev === 'acw' ? 'available' : prev));
      }, 60000);
    };

    const handleCallUpdate = (e: CustomEvent<Partial<ActiveCallInfo>>) => {
      setActiveCall((prev) => prev ? { ...prev, ...e.detail } : null);
    };

    window.addEventListener('cti:callStart' as string, handleCallStart as EventListener);
    window.addEventListener('cti:callEnd' as string, handleCallEnd as EventListener);
    window.addEventListener('cti:callUpdate' as string, handleCallUpdate as EventListener);

    return () => {
      window.removeEventListener('cti:callStart' as string, handleCallStart as EventListener);
      window.removeEventListener('cti:callEnd' as string, handleCallEnd as EventListener);
      window.removeEventListener('cti:callUpdate' as string, handleCallUpdate as EventListener);
    };
  }, []);

  // Duration ticker
  useEffect(() => {
    if (activeCall && status === 'busy') {
      durationIntervalRef.current = setInterval(() => {
        setActiveCall((prev) =>
          prev ? { ...prev, duration: prev.duration + 1 } : null
        );
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [activeCall, status]);

  // ---------------------------------------------------------------------------
  // Actions dispatched back to the softphone
  // ---------------------------------------------------------------------------

  const dispatchAction = useCallback((action: string) => {
    window.dispatchEvent(new CustomEvent('cti:action', { detail: { action } }));
  }, []);

  const toggleBreak = useCallback(() => {
    if (status === 'break') {
      setStatus('available');
    } else if (status === 'available') {
      setStatus('break');
    }
  }, [status]);

  // ---------------------------------------------------------------------------
  // Supervisor: Listen to active calls updates
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isSupervisor) return;

    const handleActiveCalls = (e: CustomEvent<{ calls: SupervisedCall[] }>) => {
      setSupervisedCalls(e.detail.calls);
    };

    window.addEventListener('cti:activeCalls' as string, handleActiveCalls as EventListener);
    return () => window.removeEventListener('cti:activeCalls' as string, handleActiveCalls as EventListener);
  }, [isSupervisor]);

  const startCoaching = useCallback((callId: string, mode: 'listen' | 'whisper' | 'barge') => {
    setCoachingMode(mode);
    setCoachingCallId(callId);
    window.dispatchEvent(new CustomEvent('cti:action', {
      detail: { action: `coaching:${mode}`, callControlId: callId },
    }));
  }, []);

  const stopCoaching = useCallback(() => {
    if (coachingCallId) {
      window.dispatchEvent(new CustomEvent('cti:action', {
        detail: { action: 'coaching:stop', callControlId: coachingCallId },
      }));
    }
    setCoachingMode('none');
    setCoachingCallId(null);
  }, [coachingCallId]);

  // ---------------------------------------------------------------------------
  // Format duration
  // ---------------------------------------------------------------------------

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const currentStatusConfig = STATUS_CONFIG[status];
  const StatusIcon = currentStatusConfig.icon;

  // Minimized: just a status dot
  if (minimized) {
    return (
      <div className={`fixed bottom-0 start-0 end-0 z-40 ${className}`}>
        <div className="bg-gray-900 border-t border-gray-800 px-4 py-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${currentStatusConfig.color}`} />
            <span className="text-xs text-gray-400">{currentStatusConfig.label}</span>
            {activeCall && (
              <span className="text-xs text-green-400 font-mono ms-2">
                {formatDuration(activeCall.duration)}
              </span>
            )}
          </div>
          <button
            onClick={() => setMinimized(false)}
            className="p-1 text-gray-500 hover:text-gray-300"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-0 start-0 end-0 z-40 ${className}`}>
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Agent status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-3 w-3 rounded-full ${currentStatusConfig.color}`} />
              <StatusIcon className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-300 font-medium">{currentStatusConfig.label}</span>
            </div>

            {/* Break toggle (only when not on call) */}
            {!activeCall && (status === 'available' || status === 'break') && (
              <button
                onClick={toggleBreak}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                  status === 'break'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Coffee className="h-3 w-3" />
                {status === 'break' ? t('admin.crm.endBreak') || 'End Break' : t('admin.crm.takeBreak') || 'Break'}
              </button>
            )}
          </div>

          {/* Center: Active call info */}
          {activeCall && (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-sm text-white font-medium">
                  {activeCall.contactName || activeCall.phone}
                </p>
                <p className="text-xs text-gray-400 font-mono">{formatDuration(activeCall.duration)}</p>
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => dispatchAction('toggleMute')}
                  className={`p-1.5 rounded ${
                    activeCall.isMuted ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:bg-gray-800'
                  }`}
                  title={activeCall.isMuted ? 'Unmute' : 'Mute'}
                >
                  {activeCall.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>

                <button
                  onClick={() => dispatchAction('toggleHold')}
                  className={`p-1.5 rounded ${
                    activeCall.isOnHold ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400 hover:bg-gray-800'
                  }`}
                  title={activeCall.isOnHold ? 'Resume' : 'Hold'}
                >
                  {activeCall.isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>

                <button
                  onClick={() => dispatchAction('transfer')}
                  className="p-1.5 rounded text-gray-400 hover:bg-gray-800"
                  title="Transfer"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </button>

                <button
                  onClick={() => dispatchAction('hangup')}
                  className="p-1.5 rounded bg-red-600 text-white hover:bg-red-700 ms-1"
                  title="Hang up"
                >
                  <PhoneOff className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Supervisor panel toggle */}
          {isSupervisor && (
            <div className="flex items-center gap-2">
              {coachingMode !== 'none' && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs">
                  {coachingMode === 'listen' && <Ear className="h-3 w-3" />}
                  {coachingMode === 'whisper' && <MessageSquare className="h-3 w-3" />}
                  {coachingMode === 'barge' && <LogIn className="h-3 w-3" />}
                  <span className="capitalize">{coachingMode}</span>
                  <button onClick={stopCoaching} className="ms-1 text-red-400 hover:text-red-300 font-bold">×</button>
                </div>
              )}
              <button
                onClick={() => setShowSupervisorPanel(!showSupervisorPanel)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                  showSupervisorPanel ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Supervise
              </button>
            </div>
          )}

          {/* Right: no active call placeholder + minimize */}
          <div className="flex items-center gap-2">
            {!activeCall && status === 'available' && !isSupervisor && (
              <div className="flex items-center gap-1 text-gray-500">
                <Phone className="h-3.5 w-3.5" />
                <span className="text-xs">{t('admin.crm.readyForCalls') || 'Ready for calls'}</span>
              </div>
            )}
            <button
              onClick={() => setMinimized(true)}
              className="p-1 text-gray-500 hover:text-gray-300"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Supervisor panel (expanded) */}
      {showSupervisorPanel && isSupervisor && (
        <div className="bg-gray-900 border-t border-gray-800 px-4 py-2">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs text-gray-500 mb-2">Active Agent Calls</p>
            {supervisedCalls.length === 0 ? (
              <p className="text-xs text-gray-600 py-1">No active calls to supervise</p>
            ) : (
              <div className="space-y-1">
                {supervisedCalls.map(call => (
                  <div key={call.callControlId} className="flex items-center gap-3 py-1">
                    <span className="text-sm text-gray-300 w-28 truncate">{call.agentName}</span>
                    <span className="text-xs text-gray-500 font-mono">{call.callerNumber}</span>
                    <span className="text-xs text-gray-500 font-mono">{formatDuration(call.duration)}</span>
                    <div className="flex items-center gap-1 ms-auto">
                      <button
                        onClick={() => startCoaching(call.callControlId, 'listen')}
                        disabled={coachingMode !== 'none'}
                        className={`p-1 rounded text-xs ${
                          coachingCallId === call.callControlId && coachingMode === 'listen'
                            ? 'bg-green-500/20 text-green-400'
                            : 'text-gray-400 hover:bg-gray-800 disabled:opacity-30'
                        }`}
                        title="Listen (silent monitor)"
                      >
                        <Ear className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => startCoaching(call.callControlId, 'whisper')}
                        disabled={coachingMode !== 'none'}
                        className={`p-1 rounded text-xs ${
                          coachingCallId === call.callControlId && coachingMode === 'whisper'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'text-gray-400 hover:bg-gray-800 disabled:opacity-30'
                        }`}
                        title="Whisper (agent hears you)"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => startCoaching(call.callControlId, 'barge')}
                        disabled={coachingMode !== 'none'}
                        className={`p-1 rounded text-xs ${
                          coachingCallId === call.callControlId && coachingMode === 'barge'
                            ? 'bg-red-500/20 text-red-400'
                            : 'text-gray-400 hover:bg-gray-800 disabled:opacity-30'
                        }`}
                        title="Barge (join call)"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
