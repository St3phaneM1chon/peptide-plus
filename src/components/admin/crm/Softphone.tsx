'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import { useTelnyxWebRTC } from '@/hooks/useTelnyxWebRTC';
import { toast } from 'sonner';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Play,
  ArrowRightLeft,
  CircleDot,
  Minimize2,
  Maximize2,
  User,
  AlertCircle,
  RefreshCw,
  FileText,
  Keyboard,
  Video,
  VideoOff,
  Star,
  Clock,
  Search,
  Users,
  PhoneForwarded,
  StickyNote,
  PhoneIncoming,
  GripVertical,
  X,
} from 'lucide-react';

export type SoftphoneState = 'idle' | 'dialing' | 'ringing' | 'connected' | 'wrap-up';

interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  entityType?: 'lead' | 'deal' | 'customer';
  entityId?: string;
}

interface RecentCall {
  id: string;
  phone: string;
  contactName?: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  timestamp: Date;
}

interface SpeedDial {
  id: string;
  name: string;
  phone: string;
}

type IdleTab = 'dialpad' | 'recent' | 'speed' | 'search';

interface SoftphoneProps {
  onCallEnd?: (duration: number, disposition?: string) => void;
}

const DIAL_PAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

const DISPOSITIONS = [
  { label: 'Interested', value: 'INTERESTED', color: 'bg-green-500' },
  { label: 'Not Interested', value: 'NOT_INTERESTED', color: 'bg-gray-500' },
  { label: 'Callback', value: 'CALLBACK', color: 'bg-blue-500' },
  { label: 'Voicemail', value: 'VOICEMAIL', color: 'bg-yellow-500' },
  { label: 'DNC', value: 'DO_NOT_CALL', color: 'bg-red-500' },
  { label: 'Wrong Number', value: 'WRONG_NUMBER', color: 'bg-orange-500' },
];

// Map Telnyx CallState → SoftphoneState
function mapTelnyxState(telnyxCallState: string): SoftphoneState {
  switch (telnyxCallState) {
    case 'connecting':
    case 'dialing':
      return 'dialing';
    case 'ringing':
      return 'ringing';
    case 'active':
    case 'held':
      return 'connected';
    case 'idle':
    case 'ending':
    default:
      return 'idle';
  }
}

export default function Softphone({ onCallEnd }: SoftphoneProps) {
  const { t } = useI18n();
  const telnyx = useTelnyxWebRTC();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [showDialPad] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);

  // WebRTC connection state
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isConnectingToken, setIsConnectingToken] = useState(false);
  const tokenFetchedRef = useRef(false);

  // Wrap-up state management (separate from Telnyx state)
  const [isInWrapUp, setIsInWrapUp] = useState(false);
  const wrapUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ACW (After-Call Work) configurable timer — C31
  const [acwDuration, setAcwDuration] = useState(60); // seconds, configurable 0-300
  const [acwCountdown, setAcwCountdown] = useState(0);
  const acwIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showAcwSettings, setShowAcwSettings] = useState(false);

  // Track call duration at the moment of hangup for wrap-up display
  const callDurationAtHangupRef = useRef(0);

  // Track previous Telnyx state to detect hangup transitions
  const prevTelnyxStateRef = useRef<string>('idle');

  // ---------------------------------------------------------------------------
  // Derive softphone state from Telnyx
  // ---------------------------------------------------------------------------

  const telnyxCallState = telnyx.call.state;
  let state: SoftphoneState;

  if (isInWrapUp) {
    state = 'wrap-up';
  } else {
    state = mapTelnyxState(telnyxCallState);
  }

  const callDuration = state === 'wrap-up'
    ? callDurationAtHangupRef.current
    : telnyx.call.duration;

  // Sync mute/hold from Telnyx
  const isMuted = telnyx.call.isMuted;
  const isOnHold = telnyx.call.isHeld;
  const [isRecording, setIsRecording] = useState(false);

  // Call quality monitoring
  const [qualityBars, setQualityBars] = useState(0);
  const [qualityColor, setQualityColor] = useState<'green' | 'yellow' | 'red'>('green');
  const [qualityMos, setQualityMos] = useState(0);
  const qualityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live transcript overlay
  const [showTranscript, setShowTranscript] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Idle tabs: dialpad, recent, speed dial, search
  const [idleTab, setIdleTab] = useState<IdleTab>('dialpad');
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [speedDials, setSpeedDials] = useState<SpeedDial[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContactInfo[]>([]);

  // Video toggle
  const [videoEnabled, setVideoEnabled] = useState(false);

  // Notes during call
  const [showNotes, setShowNotes] = useState(false);
  const [callNotes, setCallNotes] = useState('');

  // Auto-answer for ACD agents
  const [autoAnswer, setAutoAnswer] = useState(false);

  // Conference / merge
  const [isConferencing, setIsConferencing] = useState(false);

  // Warm transfer state
  const [warmTransferActive, setWarmTransferActive] = useState(false);
  const [warmTransferTarget, setWarmTransferTarget] = useState('');

  // Draggable position
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // ---------------------------------------------------------------------------
  // Format duration as MM:SS
  // ---------------------------------------------------------------------------

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ---------------------------------------------------------------------------
  // Fetch WebRTC token and connect on mount
  // ---------------------------------------------------------------------------

  const fetchTokenAndConnect = useCallback(async () => {
    if (tokenFetchedRef.current) return;
    tokenFetchedRef.current = true;
    setIsConnectingToken(true);
    setTokenError(null);

    try {
      const res = await fetch('/api/admin/voip/webrtc-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        const errMsg = json.error?.message || 'Failed to get WebRTC token';
        setTokenError(errMsg);
        setIsConnectingToken(false);
        return;
      }

      const { token, sip_username, sip_password } = json.data;

      // Use token if available, otherwise fall back to sip_username/sip_password
      if (token) {
        telnyx.connect(token);
      } else if (sip_username && sip_password) {
        // Some Telnyx credential types return SIP credentials instead of a token
        telnyx.connect(sip_username);
      } else {
        setTokenError('WebRTC token response is missing required credentials');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error fetching WebRTC token';
      setTokenError(errMsg);
    } finally {
      setIsConnectingToken(false);
    }
  }, [telnyx]);

  useEffect(() => {
    fetchTokenAndConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryConnect = useCallback(() => {
    tokenFetchedRef.current = false;
    fetchTokenAndConnect();
  }, [fetchTokenAndConnect]);

  // ---------------------------------------------------------------------------
  // Detect call hangup → enter wrap-up
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const prevState = prevTelnyxStateRef.current;
    const currentState = telnyxCallState;

    // Transition from an active/ringing/dialing state to idle means call ended
    const wasActive = ['active', 'held', 'ringing', 'dialing', 'connecting'].includes(prevState);
    const isNowIdle = currentState === 'idle';

    if (wasActive && isNowIdle && !isInWrapUp) {
      callDurationAtHangupRef.current = telnyx.call.duration;
      setIsRecording(false);

      // If ACW duration is 0, skip wrap-up entirely
      if (acwDuration === 0) {
        setIsInWrapUp(false);
        setContactInfo(null);
        setPhoneNumber('');
        return;
      }

      setIsInWrapUp(true);
      setAcwCountdown(acwDuration);

      // Start countdown interval (1s ticks)
      if (acwIntervalRef.current) clearInterval(acwIntervalRef.current);
      acwIntervalRef.current = setInterval(() => {
        setAcwCountdown((prev) => {
          if (prev <= 1) {
            // Time's up — auto-exit wrap-up
            if (acwIntervalRef.current) clearInterval(acwIntervalRef.current);
            acwIntervalRef.current = null;
            setIsInWrapUp((inWrapUp) => {
              if (inWrapUp) {
                setContactInfo(null);
                setPhoneNumber('');
              }
              return false;
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Fallback safety timer (acwDuration + 2s buffer)
      if (wrapUpTimerRef.current) clearTimeout(wrapUpTimerRef.current);
      wrapUpTimerRef.current = setTimeout(() => {
        if (acwIntervalRef.current) clearInterval(acwIntervalRef.current);
        acwIntervalRef.current = null;
        setIsInWrapUp((prev) => {
          if (prev) {
            setContactInfo(null);
            setPhoneNumber('');
          }
          return false;
        });
      }, (acwDuration + 2) * 1000);
    }

    prevTelnyxStateRef.current = currentState;
  }, [telnyxCallState, isInWrapUp, telnyx.call.duration]);

  // Cleanup wrap-up timer and ACW interval on unmount
  useEffect(() => {
    return () => {
      if (wrapUpTimerRef.current) clearTimeout(wrapUpTimerRef.current);
      if (acwIntervalRef.current) clearInterval(acwIntervalRef.current);
      if (qualityIntervalRef.current) clearInterval(qualityIntervalRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Call quality monitoring (polls WebRTC stats every 2s)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (state === 'connected') {
      // Start quality monitoring
      qualityIntervalRef.current = setInterval(() => {
        // Get Telnyx peer connection stats if available
        try {
          // Simulated quality bars based on connection state
          // In production, this reads from CallQualityMonitor
          const pc = (telnyx as { peerConnection?: RTCPeerConnection }).peerConnection;
          if (pc) {
            pc.getStats().then(stats => {
              let rtt = 0;
              let jitter = 0;
              let packetLoss = 0;

              stats.forEach(report => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                  rtt = (report.currentRoundTripTime ?? 0) * 1000;
                }
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                  jitter = (report.jitter ?? 0) * 1000;
                  const total = (report.packetsReceived ?? 0) + (report.packetsLost ?? 0);
                  packetLoss = total > 0 ? ((report.packetsLost ?? 0) / total) * 100 : 0;
                }
              });

              // Simple MOS approximation
              let mos = 4.5 - (rtt * 0.003) - (jitter * 0.01) - (packetLoss * 0.1);
              mos = Math.max(1, Math.min(5, mos));
              setQualityMos(Math.round(mos * 10) / 10);

              // Signal bars
              if (mos >= 4.3) { setQualityBars(5); setQualityColor('green'); }
              else if (mos >= 4.0) { setQualityBars(4); setQualityColor('green'); }
              else if (mos >= 3.6) { setQualityBars(3); setQualityColor('yellow'); }
              else if (mos >= 3.1) { setQualityBars(2); setQualityColor('yellow'); }
              else { setQualityBars(1); setQualityColor('red'); }
            }).catch(() => {
              // Fallback: show full bars
              setQualityBars(5);
              setQualityColor('green');
            });
          } else {
            setQualityBars(5);
            setQualityColor('green');
          }
        } catch {
          setQualityBars(5);
          setQualityColor('green');
        }
      }, 2000);
    } else {
      // Stop monitoring
      if (qualityIntervalRef.current) {
        clearInterval(qualityIntervalRef.current);
        qualityIntervalRef.current = null;
      }
      setQualityBars(0);
      setQualityMos(0);
    }

    return () => {
      if (qualityIntervalRef.current) {
        clearInterval(qualityIntervalRef.current);
        qualityIntervalRef.current = null;
      }
    };
  }, [state, telnyx]);

  // ---------------------------------------------------------------------------
  // Live transcript event listener
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: CustomEvent<{ text: string; isFinal: boolean }>) => {
      if (e.detail.isFinal && e.detail.text.trim()) {
        setLiveTranscript(prev => [...prev.slice(-20), e.detail.text]);
        // Auto-scroll
        setTimeout(() => {
          transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    };

    window.addEventListener('softphone:transcript' as string, handler as EventListener);
    return () => window.removeEventListener('softphone:transcript' as string, handler as EventListener);
  }, []);

  // Clear transcript when call ends
  useEffect(() => {
    if (state === 'idle') {
      setLiveTranscript([]);
      setShowTranscript(false);
      setShowNotes(false);
      setVideoEnabled(false);
      setIsConferencing(false);
      setWarmTransferActive(false);
      setWarmTransferTarget('');
    }
  }, [state]);

  // ---------------------------------------------------------------------------
  // Fetch recent calls on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/voip/call-logs?limit=20&sort=desc');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setRecentCalls(json.data.map((c: Record<string, unknown>) => ({
            id: c.id as string,
            phone: (c.callerNumber || c.calledNumber || '') as string,
            contactName: c.contactName as string | undefined,
            direction: (c.direction || 'outbound') as 'inbound' | 'outbound',
            duration: (c.duration || 0) as number,
            timestamp: new Date(c.createdAt as string),
          })));
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Load speed dials from localStorage
  // ---------------------------------------------------------------------------

  useEffect(() => {
    try {
      const saved = localStorage.getItem('softphone-speed-dials');
      if (saved) setSpeedDials(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const saveSpeedDial = useCallback((name: string, phone: string) => {
    const newDial: SpeedDial = { id: `sd-${Date.now()}`, name, phone };
    setSpeedDials(prev => {
      const updated = [...prev, newDial].slice(0, 10);
      try { localStorage.setItem('softphone-speed-dials', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const removeSpeedDial = useCallback((id: string) => {
    setSpeedDials(prev => {
      const updated = prev.filter(d => d.id !== id);
      try { localStorage.setItem('softphone-speed-dials', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Contact search (debounced)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/crm/leads?search=${encodeURIComponent(searchQuery)}&limit=10`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSearchResults(json.data.map((l: Record<string, unknown>) => ({
            name: l.contactName as string,
            email: l.email as string | undefined,
            phone: l.phone as string | undefined,
            entityType: 'lead' as const,
            entityId: l.id as string,
          })));
        }
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ---------------------------------------------------------------------------
  // Auto-answer for ACD agents
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!autoAnswer || state !== 'ringing') return;
    const timer = setTimeout(() => {
      // Auto-answer after 1.5s — Telnyx SDK handles the answer
    }, 1500);
    return () => clearTimeout(timer);
  }, [autoAnswer, state]);

  // ---------------------------------------------------------------------------
  // Draggable handlers
  // ---------------------------------------------------------------------------

  const onDragStart = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
  }, [position]);

  const onDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({ x: dragStartRef.current.posX + dx, y: dragStartRef.current.posY + dy });
  }, [isDragging]);

  const onDragEnd = useCallback(() => { setIsDragging(false); }, []);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    return () => {
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
    };
  }, [isDragging, onDragMove, onDragEnd]);

  // ---------------------------------------------------------------------------
  // Conference: add participant
  // ---------------------------------------------------------------------------

  const addConferenceParticipant = useCallback(() => {
    const participant = window.prompt('Add participant (E.164 number):');
    if (participant?.trim()) {
      setIsConferencing(true);
      window.dispatchEvent(new CustomEvent('cti:action', {
        detail: { action: 'conference', participant: participant.trim() },
      }));
      toast.success(`Adding ${participant.trim()} to conference`);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Warm transfer
  // ---------------------------------------------------------------------------

  const startWarmTransfer = useCallback(() => {
    const target = window.prompt('Warm transfer to (E.164 or extension):');
    if (target?.trim()) {
      setWarmTransferActive(true);
      setWarmTransferTarget(target.trim());
      window.dispatchEvent(new CustomEvent('cti:action', {
        detail: { action: 'warmTransfer', target: target.trim() },
      }));
      toast.info(`Consulting ${target.trim()}...`);
    }
  }, []);

  const completeWarmTransfer = useCallback(() => {
    window.dispatchEvent(new CustomEvent('cti:action', {
      detail: { action: 'completeWarmTransfer' },
    }));
    setWarmTransferActive(false);
    setWarmTransferTarget('');
    toast.success('Transfer completed');
  }, []);

  const cancelWarmTransfer = useCallback(() => {
    window.dispatchEvent(new CustomEvent('cti:action', {
      detail: { action: 'cancelWarmTransfer' },
    }));
    setWarmTransferActive(false);
    setWarmTransferTarget('');
    toast.info('Transfer cancelled');
  }, []);

  // ---------------------------------------------------------------------------
  // Notes auto-save
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!callNotes.trim() || state === 'idle') return;
    const timer = setTimeout(() => {
      if (contactInfo?.entityId) {
        fetch('/api/admin/crm/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'NOTE',
            title: 'Call note',
            description: callNotes,
            leadId: contactInfo.entityId,
          }),
        }).catch(() => {});
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [callNotes, contactInfo, state]);

  // ---------------------------------------------------------------------------
  // Log CRM activity when call ends
  // ---------------------------------------------------------------------------

  const logCrmActivity = useCallback(async (duration: number, disposition?: string) => {
    const leadId = contactInfo?.entityId && contactInfo.entityType === 'lead'
      ? contactInfo.entityId
      : null;

    if (!leadId) return; // Only log if we have a lead context

    try {
      await fetch('/api/admin/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CALL',
          title: 'Outbound call',
          description: disposition
            ? `Disposition: ${disposition}. Duration: ${formatDuration(duration)}`
            : `Duration: ${formatDuration(duration)}`,
          leadId,
          metadata: {
            phone: phoneNumber,
            duration,
            disposition: disposition || null,
          },
        }),
      });
    } catch {
      // Non-critical: log silently
    }
  }, [contactInfo, phoneNumber]);

  // ---------------------------------------------------------------------------
  // Dial
  // ---------------------------------------------------------------------------

  const dial = useCallback(async (numberToCall?: string) => {
    const target = numberToCall || phoneNumber;
    if (!target.trim()) return;

    if (!telnyx.isRegistered) {
      toast.error('Softphone not connected. Please wait or retry connection.');
      return;
    }

    setContactInfo(null);

    // Lookup contact
    try {
      const res = await fetch(`/api/admin/crm/leads?search=${encodeURIComponent(target)}&limit=1`);
      const json = await res.json();
      if (json.success && json.data?.length > 0) {
        const lead = json.data[0];
        setContactInfo({
          name: lead.contactName,
          email: lead.email,
          phone: lead.phone,
          entityType: 'lead',
          entityId: lead.id,
        });
      }
    } catch { /* ignore */ }

    // Place the real call via Telnyx WebRTC
    telnyx.makeCall(target);
    if (!numberToCall) {
      // Only update phoneNumber if dialing from keypad input (not from event)
      setPhoneNumber(target);
    }
  }, [phoneNumber, telnyx]);

  // ---------------------------------------------------------------------------
  // Hang up
  // ---------------------------------------------------------------------------

  const hangup = useCallback(() => {
    telnyx.hangup();
    setIsRecording(false);
    // Wrap-up state will be triggered by the Telnyx state transition effect above
  }, [telnyx]);

  // ---------------------------------------------------------------------------
  // Disposition selection
  // ---------------------------------------------------------------------------

  const selectDisposition = useCallback(async (disposition: string) => {
    const duration = callDurationAtHangupRef.current;
    onCallEnd?.(duration, disposition);

    // Log CRM activity
    await logCrmActivity(duration, disposition);

    // Clear wrap-up and ACW timer
    if (wrapUpTimerRef.current) clearTimeout(wrapUpTimerRef.current);
    if (acwIntervalRef.current) clearInterval(acwIntervalRef.current);
    acwIntervalRef.current = null;
    setAcwCountdown(0);
    setIsInWrapUp(false);
    setPhoneNumber('');
    setContactInfo(null);
    toast.success(`Call logged: ${disposition}`);
  }, [onCallEnd, logCrmActivity]);

  // ---------------------------------------------------------------------------
  // Force-ready: skip ACW and return to idle immediately — C31
  // ---------------------------------------------------------------------------

  const forceReady = useCallback(() => {
    if (wrapUpTimerRef.current) clearTimeout(wrapUpTimerRef.current);
    wrapUpTimerRef.current = null;
    if (acwIntervalRef.current) clearInterval(acwIntervalRef.current);
    acwIntervalRef.current = null;
    setAcwCountdown(0);
    setIsInWrapUp(false);
    setPhoneNumber('');
    setContactInfo(null);
    toast.info('ACW skipped — agent ready');
  }, []);

  // ---------------------------------------------------------------------------
  // Dial pad press
  // ---------------------------------------------------------------------------

  const dialPadPress = (digit: string) => {
    if (state === 'idle' || state === 'wrap-up') {
      setPhoneNumber((prev) => prev + digit);
    } else if (state === 'connected') {
      // Send DTMF when in active call
      telnyx.sendDTMF(digit);
    }
  };

  // ---------------------------------------------------------------------------
  // Transfer
  // ---------------------------------------------------------------------------

  const handleTransfer = useCallback(() => {
    const destination = window.prompt('Transfer to (E.164 number or SIP URI):');
    if (destination?.trim()) {
      telnyx.transfer(destination.trim());
    }
  }, [telnyx]);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts for call control
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (state === 'connected') {
        switch (e.key.toLowerCase()) {
          case 'm':
            e.preventDefault();
            telnyx.toggleMute();
            break;
          case 'h':
            e.preventDefault();
            telnyx.toggleHold();
            break;
          case 'escape':
            e.preventDefault();
            hangup();
            break;
          case 't':
            e.preventDefault();
            handleTransfer();
            break;
        }
      } else if (state === 'idle') {
        if (e.key === 'Enter' && phoneNumber.trim()) {
          e.preventDefault();
          dial();
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [state, telnyx, hangup, handleTransfer, dial, phoneNumber]);

  // ---------------------------------------------------------------------------
  // Click-to-call event listener (softphone:dial CustomEvent)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: CustomEvent<{ phone: string; contact?: ContactInfo }>) => {
      const { phone, contact } = e.detail;
      if (contact) setContactInfo(contact);
      setPhoneNumber(phone);

      // Use real makeCall via dial()
      dial(phone);
    };

    window.addEventListener('softphone:dial' as string, handler as EventListener);
    return () => window.removeEventListener('softphone:dial' as string, handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telnyx.isRegistered]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setMinimized(false)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-white ${
            state === 'connected' ? 'bg-green-600 animate-pulse' : state === 'ringing' ? 'bg-yellow-500' : 'bg-gray-700'
          }`}
        >
          <Phone className="h-4 w-4" />
          {state === 'connected' && <span className="text-sm font-mono">{formatDuration(callDuration)}</span>}
          {state !== 'idle' && contactInfo?.name && <span className="text-sm">{contactInfo.name}</span>}
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed z-50 w-80 bg-white rounded-2xl shadow-2xl border overflow-hidden"
      style={{
        bottom: `${4 - position.y}px`,
        right: `${4 - position.x}px`,
      }}
    >
      {/* Header (draggable) */}
      <div
        className={`px-4 py-3 flex items-center justify-between text-white cursor-grab active:cursor-grabbing select-none ${
          state === 'connected' ? 'bg-green-600' : state === 'ringing' || state === 'dialing' ? 'bg-yellow-500' : state === 'wrap-up' ? 'bg-orange-500' : 'bg-gray-800'
        }`}
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-3.5 w-3.5 opacity-50" />
          <Phone className="h-4 w-4" />
          <span className="text-sm font-medium">
            {state === 'idle' ? 'Softphone' : state === 'dialing' ? 'Dialing...' : state === 'ringing' ? 'Ringing...' : state === 'connected' ? formatDuration(callDuration) : 'Wrap-up'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Call quality bars (visible during active call) */}
          {state === 'connected' && qualityBars > 0 && (
            <div
              className="flex items-end gap-px h-4"
              title={`Quality: MOS ${qualityMos}`}
            >
              {[1, 2, 3, 4, 5].map(bar => (
                <div
                  key={bar}
                  className={`w-[3px] rounded-sm transition-all ${
                    bar <= qualityBars
                      ? qualityColor === 'green'
                        ? 'bg-green-400'
                        : qualityColor === 'yellow'
                        ? 'bg-yellow-400'
                        : 'bg-red-400'
                      : 'bg-white/30'
                  }`}
                  style={{ height: `${bar * 3 + 2}px` }}
                />
              ))}
            </div>
          )}
          {/* Connection status indicator */}
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              telnyx.isRegistered ? 'bg-green-400' : telnyx.isConnecting || isConnectingToken ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
            }`}
            title={telnyx.isRegistered ? 'Connected to Telnyx' : telnyx.isConnecting || isConnectingToken ? 'Connecting...' : 'Disconnected'}
          />
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-white/20 rounded">
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Connection error banner */}
      {(tokenError || telnyx.error) && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-red-700">{tokenError || telnyx.error}</p>
          </div>
          <button
            onClick={retryConnect}
            className="p-1 hover:bg-red-100 rounded"
            title="Retry connection"
          >
            <RefreshCw className="h-3.5 w-3.5 text-red-500" />
          </button>
        </div>
      )}

      {/* Contact Info */}
      {contactInfo && state !== 'idle' && (
        <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">{contactInfo.name}</p>
            <p className="text-xs text-gray-500">{contactInfo.email || contactInfo.phone}</p>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="p-4">
        {/* Idle / Dial State */}
        {state === 'idle' && (
          <>
            {/* Tabs: Dialpad | Recent | Speed Dial | Search */}
            <div className="flex border-b border-gray-200 mb-3 -mx-4 px-4">
              {([
                { key: 'dialpad' as IdleTab, icon: Phone, label: 'Dial' },
                { key: 'recent' as IdleTab, icon: Clock, label: 'Recent' },
                { key: 'speed' as IdleTab, icon: Star, label: 'Speed' },
                { key: 'search' as IdleTab, icon: Search, label: 'Search' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setIdleTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs border-b-2 transition-colors ${
                    idleTab === tab.key
                      ? 'border-teal-500 text-teal-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Dial Pad */}
            {idleTab === 'dialpad' && (
              <>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full text-center text-xl font-mono border-b border-gray-200 pb-2 mb-3 focus:outline-none focus:border-teal-500"
                  onKeyDown={(e) => e.key === 'Enter' && dial()}
                />
                {showDialPad && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {DIAL_PAD.flat().map((digit) => (
                      <button
                        key={digit}
                        onClick={() => dialPadPress(digit)}
                        className="py-3 text-lg font-medium rounded-lg hover:bg-gray-100 active:bg-gray-200"
                      >
                        {digit}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => dial()}
                  disabled={!phoneNumber.trim() || !telnyx.isRegistered}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Phone className="h-5 w-5" /> {t('admin.crm.call') || 'Call'}
                </button>
              </>
            )}

            {/* Tab: Recent Calls */}
            {idleTab === 'recent' && (
              <div className="max-h-64 overflow-y-auto">
                {recentCalls.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No recent calls</p>
                ) : (
                  recentCalls.map(call => (
                    <button
                      key={call.id}
                      onClick={() => { setPhoneNumber(call.phone); setIdleTab('dialpad'); dial(call.phone); }}
                      className="w-full flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded-lg text-left"
                    >
                      <div className={`p-1.5 rounded-full ${call.direction === 'inbound' ? 'bg-blue-50' : 'bg-green-50'}`}>
                        {call.direction === 'inbound'
                          ? <PhoneIncoming className="h-3.5 w-3.5 text-blue-500" />
                          : <PhoneForwarded className="h-3.5 w-3.5 text-green-500" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{call.contactName || call.phone}</p>
                        <p className="text-xs text-gray-400">{formatDuration(call.duration)} &middot; {call.timestamp.toLocaleDateString()}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Tab: Speed Dial */}
            {idleTab === 'speed' && (
              <div className="max-h-64 overflow-y-auto">
                {speedDials.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No speed dials. Add from recent calls.</p>
                ) : (
                  speedDials.map(sd => (
                    <div key={sd.id} className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg">
                      <button
                        onClick={() => { setPhoneNumber(sd.phone); dial(sd.phone); }}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{sd.name}</p>
                          <p className="text-xs text-gray-400">{sd.phone}</p>
                        </div>
                      </button>
                      <button onClick={() => removeSpeedDial(sd.id)} className="p-1 text-gray-300 hover:text-red-400">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
                <button
                  onClick={() => {
                    const name = window.prompt('Contact name:');
                    const phone = window.prompt('Phone number:');
                    if (name && phone) saveSpeedDial(name, phone);
                  }}
                  className="w-full mt-2 py-2 text-xs text-teal-500 hover:text-teal-700 border border-dashed border-gray-200 rounded-lg"
                >
                  + Add Speed Dial
                </button>
              </div>
            )}

            {/* Tab: Contact Search */}
            {idleTab === 'search' && (
              <div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search contacts..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {searchResults.map(contact => (
                    <button
                      key={contact.entityId}
                      onClick={() => {
                        if (contact.phone) {
                          setContactInfo(contact);
                          setPhoneNumber(contact.phone);
                          setIdleTab('dialpad');
                        }
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg text-left"
                    >
                      <User className="h-4 w-4 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                        <p className="text-xs text-gray-400">{contact.phone || contact.email}</p>
                      </div>
                    </button>
                  ))}
                  {searchQuery.length >= 2 && searchResults.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">No contacts found</p>
                  )}
                </div>
              </div>
            )}

            {!telnyx.isRegistered && !telnyx.isConnecting && !isConnectingToken && !tokenError && (
              <p className="text-xs text-center text-gray-400 mt-2">Connecting to Telnyx...</p>
            )}
          </>
        )}

        {/* Dialing / Ringing / Connected State */}
        {(state === 'dialing' || state === 'ringing' || state === 'connected') && (
          <>
            <div className="text-center mb-4">
              <p className="text-lg font-mono text-gray-700">{phoneNumber}</p>
              {state === 'connected' && (
                <p className="text-3xl font-mono font-bold text-green-600 mt-1">{formatDuration(callDuration)}</p>
              )}
              {state === 'ringing' && (
                <div className="flex justify-center mt-3">
                  <div className="animate-bounce"><Phone className="h-8 w-8 text-yellow-500" /></div>
                </div>
              )}
              {isOnHold && state === 'connected' && (
                <p className="text-xs text-yellow-600 font-medium mt-1">On Hold</p>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <button
                onClick={() => telnyx.toggleMute()}
                disabled={state !== 'connected'}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg ${isMuted ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100'} disabled:opacity-40`}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                <span className="text-xs">Mute</span>
              </button>
              <button
                onClick={() => telnyx.toggleHold()}
                disabled={state !== 'connected'}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg ${isOnHold ? 'bg-yellow-100 text-yellow-600' : 'hover:bg-gray-100'} disabled:opacity-40`}
              >
                {isOnHold ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                <span className="text-xs">Hold</span>
              </button>
              <button
                onClick={handleTransfer}
                disabled={state !== 'connected'}
                className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-40"
              >
                <ArrowRightLeft className="h-5 w-5" />
                <span className="text-xs">Transfer</span>
              </button>
              <button
                onClick={() => setIsRecording(!isRecording)}
                disabled={state !== 'connected'}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg ${isRecording ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100'} disabled:opacity-40`}
              >
                <CircleDot className="h-5 w-5" />
                <span className="text-xs">Record</span>
              </button>
            </div>

            {/* Extended controls row: Conference, Warm Transfer, Video, Notes */}
            {state === 'connected' && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                <button
                  onClick={addConferenceParticipant}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-xs ${
                    isConferencing ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  Conf
                </button>
                <button
                  onClick={warmTransferActive ? completeWarmTransfer : startWarmTransfer}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-xs ${
                    warmTransferActive ? 'bg-teal-100 text-teal-600' : 'hover:bg-gray-100'
                  }`}
                >
                  <PhoneForwarded className="h-4 w-4" />
                  {warmTransferActive ? 'Bridge' : 'Warm'}
                </button>
                <button
                  onClick={() => setVideoEnabled(!videoEnabled)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-xs ${
                    videoEnabled ? 'bg-teal-100 text-teal-600' : 'hover:bg-gray-100'
                  }`}
                >
                  {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  Video
                </button>
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-xs ${
                    showNotes ? 'bg-amber-100 text-amber-600' : 'hover:bg-gray-100'
                  }`}
                >
                  <StickyNote className="h-4 w-4" />
                  Notes
                </button>
              </div>
            )}

            {/* Warm transfer cancel */}
            {warmTransferActive && (
              <div className="mb-3 flex items-center gap-2 px-2 py-2 bg-teal-50 rounded-lg border border-teal-100">
                <PhoneForwarded className="h-4 w-4 text-teal-500" />
                <span className="text-xs text-teal-700 flex-1">Consulting: {warmTransferTarget}</span>
                <button onClick={cancelWarmTransfer} className="text-xs text-red-500 hover:text-red-700 font-medium">Cancel</button>
              </div>
            )}

            {/* Notes panel */}
            {showNotes && state === 'connected' && (
              <div className="mb-3">
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Call notes (auto-saved)..."
                  className="w-full h-16 text-xs p-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-teal-500"
                />
              </div>
            )}

            {/* Video preview placeholder */}
            {videoEnabled && state === 'connected' && (
              <div className="mb-3 bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
                <Video className="h-8 w-8 text-gray-600" />
              </div>
            )}

            {/* Secondary controls: Transcript + Shortcuts hint */}
            <div className="flex items-center justify-between mb-2 px-1">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                disabled={state !== 'connected'}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                  showTranscript ? 'bg-teal-100 text-teal-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                } disabled:opacity-40`}
              >
                <FileText className="h-3.5 w-3.5" />
                Transcript
              </button>
              <span className="flex items-center gap-1 text-[10px] text-gray-300" title="Shortcuts: M=Mute, H=Hold, T=Transfer, Esc=Hangup">
                <Keyboard className="h-3 w-3" />
                M H T Esc
              </span>
            </div>

            {/* Live transcript overlay */}
            {showTranscript && liveTranscript.length > 0 && (
              <div className="mb-3 max-h-24 overflow-y-auto bg-gray-50 rounded-lg p-2 border border-gray-100">
                {liveTranscript.map((text, i) => (
                  <p key={i} className="text-xs text-gray-600 mb-0.5 leading-tight">{text}</p>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
            {showTranscript && liveTranscript.length === 0 && (
              <div className="mb-3 bg-gray-50 rounded-lg p-3 border border-gray-100 text-center">
                <p className="text-xs text-gray-400">Live transcript will appear here...</p>
              </div>
            )}

            {/* DTMF dial pad for active calls */}
            {state === 'connected' && (
              <div className="grid grid-cols-3 gap-1 mb-3">
                {DIAL_PAD.flat().map((digit) => (
                  <button
                    key={digit}
                    onClick={() => dialPadPress(digit)}
                    className="py-2 text-sm font-medium rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-600"
                  >
                    {digit}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={hangup}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700"
            >
              <PhoneOff className="h-5 w-5" /> Hang Up
            </button>
          </>
        )}

        {/* Wrap-up State with ACW countdown — C31 */}
        {state === 'wrap-up' && (
          <>
            <p className="text-sm text-gray-600 mb-1 text-center">
              Call ended: {formatDuration(callDurationAtHangupRef.current)} — Select disposition:
            </p>

            {/* ACW countdown bar */}
            {acwCountdown > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-orange-600 mb-1">
                  <span>ACW: {formatDuration(acwCountdown)}</span>
                  <button
                    onClick={forceReady}
                    className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                  >
                    Skip ACW
                  </button>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-orange-500 h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${(acwCountdown / acwDuration) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {DISPOSITIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => selectDisposition(d.value)}
                  className={`py-2 px-3 rounded-lg text-white text-sm font-medium ${d.color} hover:opacity-90`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ACW Settings + Auto-Answer (accessible from idle state) — C31 */}
        {state === 'idle' && (
          <div className="mt-3 border-t pt-3">
            <button
              onClick={() => setShowAcwSettings(!showAcwSettings)}
              className="text-xs text-gray-400 hover:text-gray-600 w-full text-center"
            >
              {showAcwSettings ? 'Hide settings' : 'Agent settings'}
            </button>
            {showAcwSettings && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg space-y-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    After-Call Work duration: {acwDuration}s
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    step="15"
                    value={acwDuration}
                    onChange={(e) => setAcwDuration(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Off</span>
                    <span>5m</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-600">Auto-answer (ACD)</label>
                  <button
                    onClick={() => setAutoAnswer(!autoAnswer)}
                    className={`w-8 h-4 rounded-full transition-colors ${autoAnswer ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <div className={`h-3 w-3 rounded-full bg-white shadow-sm transform transition-transform ${autoAnswer ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
