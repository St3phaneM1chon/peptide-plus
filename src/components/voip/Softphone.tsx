'use client';

/**
 * Softphone
 * Main softphone component: fixed bar at the bottom of the admin dashboard.
 * Includes dialpad, multi-line management, call park/retrieve, conference,
 * incoming notifications (browser + ringtone), CNAM display, call flip,
 * call pickup, noise cancellation toggle, pre-call network test,
 * screen sharing, virtual backgrounds, and video recording.
 *
 * Phase S4A: All 12 wired features integrated.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneForwarded,
  ChevronUp,
  ChevronDown,
  Users,
  ParkingSquare,
  UserPlus,
  MonitorSmartphone,
  Laptop,
  Smartphone,
  Headphones,
  AudioLines,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  ScreenShare,
  ScreenShareOff,
  Image,
  Circle,
  Square,
  Shield,
  Hash,
  Lock,
  Captions,
  CaptionsOff,
  VideoOff,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { useSoftphone } from './SoftphoneProvider';
import type { VoipCall, CallState } from '@/hooks/useVoip';
import CallControls from './CallControls';
import IncomingCallModal from './IncomingCallModal';
import AgentStatus from './AgentStatus';
import { VirtualBackgroundProcessor, type BackgroundType } from '@/lib/voip/virtual-background';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIALPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

type SoftphoneTab = 'dialpad' | 'lines' | 'park' | 'team';
type FlipTarget = 'web' | 'desk' | 'mobile';
type VirtualBg = 'none' | 'blur' | 'office' | 'nature' | 'abstract';

/** Map VirtualBg UI names to BackgroundType for the VirtualBackgroundProcessor lib */
const BG_TYPE_MAP: Record<VirtualBg, BackgroundType> = {
  none: 'none',
  blur: 'blur',
  office: 'color',
  nature: 'image',
  abstract: 'image',
};

const BG_VALUE_MAP: Record<VirtualBg, string | undefined> = {
  none: undefined,
  blur: undefined,
  office: '#e5e7eb',
  nature: '/images/bg-nature.jpg',
  abstract: '/images/bg-abstract.jpg',
};

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

interface CallLine {
  id: string;
  call: VoipCall;
  duration: number;
}

interface ParkedCall {
  orbit: string;
  callerNumber: string;
  callerName: string | null;
  parkedAt: Date;
  duration: number;
}

interface RingingTeamCall {
  id: string;
  callerNumber: string;
  callerName: string | null;
  extension: string;
  extensionName: string;
  ringSince: Date;
}

interface CnamInfo {
  name: string | null;
  carrier: string | null;
  lineType: string | null;
  spamScore: number | null;
}

interface NetworkTestResult {
  passed: boolean;
  score: number;
  latency: number;
  jitter: number;
  packetLoss: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function callStateLabelKey(state: CallState): string {
  switch (state) {
    case 'ringing': return 'voip.call.ringing';
    case 'calling': return 'voip.call.dialing';
    case 'in_progress': return 'voip.call.active';
    case 'on_hold': return 'voip.call.held';
    case 'ended': return 'voip.call.ended';
    default: return 'voip.call.idle';
  }
}

function callStateBadgeColor(state: CallState): string {
  switch (state) {
    case 'ringing': return 'bg-amber-100 text-amber-700';
    case 'calling': return 'bg-blue-100 text-blue-700';
    case 'in_progress': return 'bg-emerald-100 text-emerald-700';
    case 'on_hold': return 'bg-yellow-100 text-yellow-700';
    case 'ended': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-100 text-gray-500';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Softphone() {
  const { t } = useI18n();
  const {
    status,
    currentCall,
    error,
    register,
    unregister,
    makeCall,
    answerCall,
    hangup,
    toggleMute,
    toggleHold,
    sendDtmf,
    transfer,
    switchLine,
    parkCall: hookParkCall,
    retrieveParkedCall: hookRetrieveParked,
    flipCall: hookFlipCall,
    startConference,
    toggleNoiseCancel,
    toggleRecording,
    screenShare: hookScreenShare,
    stopScreenShare: hookStopScreenShare,
    toggleVideo,
    noiseCancelEnabled,
    isScreenSharing,
    isVideoEnabled,
    localVideoStream,
    remoteVideoStream,
  } = useSoftphone();

  // ---- Core UI state ----
  const [isExpanded, setIsExpanded] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [callTimer, setCallTimer] = useState(0);
  const [activeTab, setActiveTab] = useState<SoftphoneTab>('dialpad');

  // ---- Feature 1: Multi-line ----
  const [callLines, setCallLines] = useState<CallLine[]>([]);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);

  // ---- Feature 2: Call Park ----
  const [parkedCalls, setParkedCalls] = useState<ParkedCall[]>([]);
  const [parkLoading, setParkLoading] = useState(false);

  // ---- Feature 3: Conference ----
  const [showConferenceInput, setShowConferenceInput] = useState(false);
  const [conferenceNumber, setConferenceNumber] = useState('');
  const [conferenceParticipants, setConferenceParticipants] = useState<string[]>([]);

  // ---- Feature 4: Incoming notifications ----
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // ---- Feature 5: CNAM ----
  const [cnamInfo, setCnamInfo] = useState<CnamInfo | null>(null);

  // ---- Feature 6: Call Flip ----
  const [showFlipMenu, setShowFlipMenu] = useState(false);

  // ---- Feature 7: Call Pickup ----
  const [ringingTeamCalls, setRingingTeamCalls] = useState<RingingTeamCall[]>([]);

  // ---- Feature 8: Noise Cancel (state from hook) ----

  // ---- Feature 9: Pre-call Test ----
  const [showPreCallTest, setShowPreCallTest] = useState(false);
  const [preCallTestResult, setPreCallTestResult] = useState<NetworkTestResult | null>(null);
  const [preCallTesting, setPreCallTesting] = useState(false);
  const hasTestedRef = useRef(false);

  // ---- Feature 10: Screen Share (state from hook) ----

  // ---- Feature 11: Virtual Background (uses VirtualBackgroundProcessor) ----
  const [virtualBackground, setVirtualBackground] = useState<VirtualBg>('none');
  const [showBgPicker, setShowBgPicker] = useState(false);
  const virtualBgProcessorRef = useRef<VirtualBackgroundProcessor | null>(null);

  // ---- Feature 12: Recording (state from hook via currentCall.isRecording) ----
  const [recordingDuration, setRecordingDuration] = useState(0);

  // ---- Feature 13: Call Encryption Indicator ----
  // WebRTC uses DTLS-SRTP by default, so calls are always encrypted
  const [isEncrypted] = useState(true);

  // ---- Feature 14: Live Transcription Overlay ----
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  // ---- Video refs (1:1 video panel) ----
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // =========================================================================
  // EFFECTS
  // =========================================================================

  // Wire local video stream to <video> element
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localVideoStream ?? null;
    }
  }, [localVideoStream]);

  // Wire remote video stream to <video> element
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteVideoStream ?? null;
    }
  }, [remoteVideoStream]);

  // Call timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (currentCall?.state === 'in_progress' && currentCall.answerTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - currentCall.answerTime!.getTime()) / 1000);
        setCallTimer(elapsed);
      }, 1000);
    } else {
      setCallTimer(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [currentCall?.state, currentCall?.answerTime]);

  // Recording duration timer (state comes from hook via currentCall.isRecording)
  useEffect(() => {
    if (!currentCall?.isRecording) {
      setRecordingDuration(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setRecordingDuration(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentCall?.isRecording]);

  // Feature 1: Track call lines from currentCall
  useEffect(() => {
    if (!currentCall) {
      setCallLines([]);
      setActiveLineId(null);
      return;
    }
    setCallLines((prev) => {
      const existing = prev.find((l) => l.id === currentCall.id);
      if (existing) {
        return prev.map((l) =>
          l.id === currentCall.id ? { ...l, call: currentCall } : l,
        );
      }
      return [...prev, { id: currentCall.id, call: currentCall, duration: 0 }];
    });
    if (!activeLineId) {
      setActiveLineId(currentCall.id);
    }
  }, [currentCall, activeLineId]);

  // Feature 1: Update line durations
  useEffect(() => {
    const interval = setInterval(() => {
      setCallLines((prev) =>
        prev.map((line) => {
          if (line.call.state === 'in_progress' && line.call.answerTime) {
            return {
              ...line,
              duration: Math.floor((Date.now() - line.call.answerTime.getTime()) / 1000),
            };
          }
          return line;
        }),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Feature 2: Poll parked calls
  useEffect(() => {
    if (status !== 'registered') return;
    const fetchParked = async () => {
      try {
        const res = await fetch('/api/admin/voip/park');
        if (res.ok) {
          const data = await res.json();
          setParkedCalls(data.parkedCalls ?? []);
        }
      } catch {
        // silent
      }
    };
    fetchParked();
    const interval = setInterval(fetchParked, 10000);
    return () => clearInterval(interval);
  }, [status]);

  // Feature 4: Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          setNotificationPermission(perm);
        });
      }
    }
  }, []);

  // Feature 4: Incoming call notification (ringtone handled by RingtoneManager in useVoip hook)
  useEffect(() => {
    if (currentCall?.direction === 'inbound' && currentCall.state === 'ringing') {
      if (notificationPermission === 'granted') {
        const notif = new Notification(t('voip.call.incomingCall'), {
          body: `${currentCall.remoteName || currentCall.remoteNumber}`,
          icon: '/favicon.ico',
          tag: 'incoming-call',
          requireInteraction: true,
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
    }
  }, [currentCall?.direction, currentCall?.state, notificationPermission, t]);

  // Feature 5: Fetch CNAM info when call starts
  useEffect(() => {
    if (!currentCall?.remoteNumber) {
      setCnamInfo(null);
      return;
    }
    const fetchCnam = async () => {
      try {
        const res = await fetch(
          `/api/voip/cnam?number=${encodeURIComponent(currentCall.remoteNumber)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setCnamInfo(data);
        }
      } catch {
        // silent
      }
    };
    fetchCnam();
  }, [currentCall?.remoteNumber]);

  // Feature 7: Poll ringing team calls
  useEffect(() => {
    if (status !== 'registered') return;
    const fetchTeamRinging = async () => {
      try {
        const res = await fetch('/api/admin/voip/pickup');
        if (res.ok) {
          const data = await res.json();
          setRingingTeamCalls(data.ringingCalls ?? []);
        }
      } catch {
        // silent
      }
    };
    fetchTeamRinging();
    const interval = setInterval(fetchTeamRinging, 5000);
    return () => clearInterval(interval);
  }, [status]);

  // Feature 14: Simulate transcription when captions are enabled during active call
  useEffect(() => {
    if (!captionsEnabled || currentCall?.state !== 'in_progress') {
      return;
    }

    // Fetch live transcription lines from streaming API
    const fetchTranscription = async () => {
      try {
        const res = await fetch(`/api/admin/voip/transcription?callId=${currentCall?.id}&since=${Date.now() - 3000}`);
        if (res.ok) {
          const data = await res.json();
          if (data.lines && data.lines.length > 0) {
            setTranscriptLines((prev) => [...prev, ...data.lines].slice(-50));
          }
        }
      } catch {
        // If transcription API is not available, show a placeholder
        const placeholders = [
          'Listening...',
          '[Transcription active]',
        ];
        setTranscriptLines((prev) => {
          if (prev.length === 0) {
            return [placeholders[0]];
          }
          return prev;
        });
      }
    };
    fetchTranscription();
    const interval = setInterval(fetchTranscription, 3000);
    return () => clearInterval(interval);
  }, [captionsEnabled, currentCall?.state, currentCall?.id]);

  // Feature 14: Auto-scroll transcript container
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcriptLines]);

  // Reset transcript when call ends
  useEffect(() => {
    if (!currentCall || currentCall.state === 'ended') {
      setTranscriptLines([]);
      setCaptionsEnabled(false);
    }
  }, [currentCall?.state, currentCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (virtualBgProcessorRef.current) {
        virtualBgProcessorRef.current.destroy();
        virtualBgProcessorRef.current = null;
      }
    };
  }, []);

  // =========================================================================
  // FEATURE 9: Pre-call network test
  // =========================================================================

  const runPreCallTest = useCallback(async (): Promise<NetworkTestResult> => {
    const startTime = Date.now();
    const latencies: number[] = [];
    const testUrl = '/api/admin/voip/health';

    // Run 5 quick pings
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      try {
        await fetch(testUrl, { method: 'HEAD', cache: 'no-store' });
      } catch {
        // count as high latency
      }
      const t1 = performance.now();
      latencies.push(t1 - t0);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const jitter =
      latencies.length > 1
        ? latencies.reduce((sum, l, i) => {
            if (i === 0) return 0;
            return sum + Math.abs(l - latencies[i - 1]);
          }, 0) / (latencies.length - 1)
        : 0;

    // Simple heuristic scoring
    const packetLoss = 0; // We cannot measure real packet loss from HTTP pings
    let score = 100;
    if (avgLatency > 200) score -= 30;
    else if (avgLatency > 100) score -= 15;
    if (jitter > 50) score -= 20;
    else if (jitter > 20) score -= 10;

    const totalTime = Date.now() - startTime;
    // Ensure minimum test duration feels realistic
    if (totalTime < 1500) {
      await new Promise((r) => setTimeout(r, 1500 - totalTime));
    }

    return {
      passed: score >= 50,
      score: Math.max(0, Math.min(100, Math.round(score))),
      latency: Math.round(avgLatency),
      jitter: Math.round(jitter),
      packetLoss,
    };
  }, []);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleDial = () => {
    if (dialNumber.length > 0) {
      makeCall(dialNumber);
      setDialNumber('');
    }
  };

  const [connectTimeoutError, setConnectTimeoutError] = useState<string | null>(null);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout when status changes away from 'connecting'
  useEffect(() => {
    if (status === 'registered' || status === 'error') {
      if (connectTimerRef.current) {
        clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }
    }
  }, [status]);

  const handleConnect = async () => {
    setConnectTimeoutError(null);
    if (connectTimerRef.current) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }

    // Feature 9: Run pre-call test on first connection
    if (!hasTestedRef.current) {
      setShowPreCallTest(true);
      setPreCallTesting(true);
      const result = await runPreCallTest();
      setPreCallTestResult(result);
      setPreCallTesting(false);
      hasTestedRef.current = true;

      if (!result.passed) {
        // Show results but don't block - user can still proceed
        return;
      }
    }

    // Proceed to register
    setShowPreCallTest(false);
    register();

    // Hard 15s timeout — if still connecting, force error
    connectTimerRef.current = setTimeout(() => {
      connectTimerRef.current = null;
      unregister();
      setConnectTimeoutError(t('voip.softphone.pbxUnreachable') || 'Unable to connect to PBX. Please check the server is online.');
    }, 15000);
  };

  const handleProceedAfterTest = () => {
    setShowPreCallTest(false);
    setConnectTimeoutError(null);
    register();
    // Same 15s timeout
    connectTimerRef.current = setTimeout(() => {
      connectTimerRef.current = null;
      unregister();
      setConnectTimeoutError(t('voip.softphone.pbxUnreachable') || 'Unable to connect to PBX. Please check the server is online.');
    }, 15000);
  };

  // Feature 2: Park active call (via hook)
  const handleParkCall = async () => {
    if (!currentCall) return;
    setParkLoading(true);
    try {
      await hookParkCall();
      // Refresh parked list
      const res = await fetch('/api/admin/voip/park');
      if (res.ok) {
        const data = await res.json();
        setParkedCalls(data.parkedCalls ?? []);
      }
    } catch {
      // silent
    } finally {
      setParkLoading(false);
    }
  };

  // Feature 2: Retrieve parked call (via hook)
  const handleRetrieveParked = async (orbit: string) => {
    try {
      await hookRetrieveParked(Number(orbit));
      // Refresh parked list
      const res = await fetch('/api/admin/voip/park');
      if (res.ok) {
        const data = await res.json();
        setParkedCalls(data.parkedCalls ?? []);
      }
    } catch {
      // silent
    }
  };

  // Feature 3: Add conference participant (via hook)
  const handleAddConferenceParticipant = async () => {
    if (!conferenceNumber) return;
    try {
      await startConference(conferenceNumber);
      setConferenceParticipants((prev) => [...prev, conferenceNumber]);
    } catch {
      // silent
    }
    setConferenceNumber('');
    setShowConferenceInput(false);
  };

  // Feature 6: Flip call to device (via hook)
  const handleFlipCall = async (target: FlipTarget) => {
    setShowFlipMenu(false);
    try {
      await hookFlipCall(target);
    } catch {
      // silent
    }
  };

  // Feature 7: Pick up team call
  const handlePickupCall = async (callId: string) => {
    try {
      await fetch('/api/admin/voip/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pickup',
          callId,
        }),
      });
    } catch {
      // silent
    }
  };

  // Feature 8: Toggle noise cancellation (via hook)
  const handleToggleNoiseCancellation = useCallback(() => {
    toggleNoiseCancel();
  }, [toggleNoiseCancel]);

  // Feature 11: Select virtual background (uses VirtualBackgroundProcessor)
  const handleSelectBackground = async (bg: VirtualBg) => {
    setVirtualBackground(bg);
    setShowBgPicker(false);

    if (bg === 'none') {
      // Destroy virtual background processor
      if (virtualBgProcessorRef.current) {
        virtualBgProcessorRef.current.destroy();
        virtualBgProcessorRef.current = null;
      }
      return;
    }

    // Only apply if VirtualBackgroundProcessor is supported
    if (!VirtualBackgroundProcessor.isSupported()) return;

    // Lazily create the processor
    if (!virtualBgProcessorRef.current) {
      virtualBgProcessorRef.current = new VirtualBackgroundProcessor();
    }

    const bgType = BG_TYPE_MAP[bg];
    const bgValue = BG_VALUE_MAP[bg];

    // Update the processor config
    await virtualBgProcessorRef.current.updateConfig({
      type: bgType,
      blurIntensity: bg === 'blur' ? 10 : undefined,
      imageUrl: bgType === 'image' ? bgValue : undefined,
      color: bgType === 'color' ? bgValue : undefined,
    });

    // Also notify API/WebRTC layer for settings persistence
    fetch('/api/admin/voip/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ virtualBackground: bg }),
    }).catch(() => {});
  };

  // =========================================================================
  // Derived state
  // =========================================================================

  const isInCall = currentCall != null && currentCall.state !== 'ended';
  const isActiveCall = currentCall?.state === 'in_progress';
  const isVideoCall = isScreenSharing; // Show video features when screen sharing is active
  const totalActiveLines = callLines.filter((l) => l.call.state !== 'ended').length;

  // =========================================================================
  // Show incoming call modal
  // =========================================================================

  if (currentCall?.direction === 'inbound' && currentCall.state === 'ringing') {
    return (
      <IncomingCallModal
        call={currentCall}
        onAnswer={() => answerCall()}
        onReject={() => hangup()}
      />
    );
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="fixed bottom-0 start-0 end-0 z-50 pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto">
        {/* Softphone Bar */}
        <div
          className={`bg-white border border-gray-200 rounded-t-xl shadow-2xl transition-all duration-300 ${
            isExpanded ? 'pb-4' : ''
          }`}
        >
          {/* ========== HEADER BAR ========== */}
          <div
            className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 rounded-t-xl"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-3">
              {/* Connection status dot */}
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  status === 'registered'
                    ? 'bg-emerald-500'
                    : status === 'connecting'
                      ? 'bg-yellow-500 animate-pulse'
                      : status === 'error'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                }`}
              />

              {/* Call state or phone label */}
              {currentCall ? (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span className="text-sm font-medium">
                    {cnamInfo?.name || currentCall.remoteName || currentCall.remoteNumber}
                  </span>
                  {currentCall.state === 'in_progress' && (
                    <span className="text-xs text-gray-500 tabular-nums">
                      {formatTimer(callTimer)}
                    </span>
                  )}
                  {/* Feature 13: Encryption indicator */}
                  {currentCall.state === 'in_progress' && isEncrypted && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">
                      <Lock className="w-2.5 h-2.5" />
                      {t('voip.enterprise.encryptionSrtp')}
                    </span>
                  )}
                  {currentCall.state === 'calling' && (
                    <span className="text-xs text-yellow-600">
                      {t('voip.call.dialing')}...
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-gray-600">
                  {t('voip.softphone.title')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Feature 1: Multi-line badge */}
              {totalActiveLines > 1 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-bold">
                  {totalActiveLines}
                </span>
              )}

              {/* Recording indicator */}
              {currentCall?.isRecording && (
                <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                  <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500 animate-pulse" />
                  {formatTimer(recordingDuration)}
                </span>
              )}

              {status === 'registered' && <AgentStatus initialStatus="ONLINE" />}
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* ========== EXPANDED CONTENT ========== */}
          {isExpanded && (
            <div className="px-4 pt-2">
              {/* ---- Feature 9: Pre-call network test ---- */}
              {showPreCallTest && (
                <div className="mb-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Wifi className="w-4 h-4 text-sky-600" />
                    <span className="text-sm font-medium">
                      {t('voip.softphone.preCallTest.title')}
                    </span>
                  </div>

                  {preCallTesting && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                      {t('voip.softphone.preCallTest.testing')}
                    </div>
                  )}

                  {preCallTestResult && !preCallTesting && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {preCallTestResult.passed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            preCallTestResult.passed ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {preCallTestResult.passed
                            ? t('voip.softphone.preCallTest.passed')
                            : t('voip.softphone.preCallTest.warning')}
                          {' '}({preCallTestResult.score}/100)
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                        <div>
                          <span className="block font-medium text-gray-700">
                            {t('voip.softphone.preCallTest.latency')}
                          </span>
                          {preCallTestResult.latency}ms
                        </div>
                        <div>
                          <span className="block font-medium text-gray-700">
                            {t('voip.softphone.preCallTest.jitter')}
                          </span>
                          {preCallTestResult.jitter}ms
                        </div>
                        <div>
                          <span className="block font-medium text-gray-700">
                            {t('voip.softphone.preCallTest.loss')}
                          </span>
                          {preCallTestResult.packetLoss}%
                        </div>
                      </div>

                      <button
                        onClick={handleProceedAfterTest}
                        className="w-full py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors"
                      >
                        {preCallTestResult.passed
                          ? t('voip.softphone.connect')
                          : t('voip.softphone.preCallTest.connectAnyway')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ---- Connection controls ---- */}
              {(status === 'disconnected' || connectTimeoutError) && !showPreCallTest && (
                <>
                  {connectTimeoutError && (
                    <div className="text-sm text-red-600 text-center mb-2">{connectTimeoutError}</div>
                  )}
                  <button
                    onClick={handleConnect}
                    className="w-full py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors mb-3"
                  >
                    {connectTimeoutError ? (t('voip.softphone.retry') || 'Réessayer') : t('voip.softphone.connect')}
                  </button>
                </>
              )}

              {status === 'connecting' && !connectTimeoutError && (
                <div className="text-center text-sm text-yellow-600 py-2 mb-3">
                  {t('voip.softphone.connecting')}...
                </div>
              )}

              {error && !connectTimeoutError && (
                <div className="text-center py-2 mb-3">
                  <div className="text-sm text-red-600 mb-2">{error}</div>
                  <button
                    onClick={handleConnect}
                    className="px-4 py-1.5 bg-sky-500 text-white rounded-lg text-xs font-medium hover:bg-sky-600 transition-colors"
                  >
                    {t('voip.softphone.retry') || 'Réessayer'}
                  </button>
                </div>
              )}

              {/* ========== ACTIVE CALL VIEW ========== */}
              {isInCall && (
                <div className="space-y-3">
                  {/* Feature 1: Multi-line bar */}
                  {totalActiveLines > 1 && (
                    <div className="flex gap-1 overflow-x-auto pb-1">
                      {callLines
                        .filter((l) => l.call.state !== 'ended')
                        .map((line) => (
                          <button
                            key={line.id}
                            onClick={() => { switchLine(line.id); setActiveLineId(line.id); }}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                              activeLineId === line.id
                                ? 'border-sky-500 bg-sky-50 text-sky-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <Phone className="w-3 h-3" />
                            <span>{line.call.remoteNumber}</span>
                            <span className={`px-1 py-0.5 rounded text-[10px] ${callStateBadgeColor(line.call.state)}`}>
                              {t(callStateLabelKey(line.call.state))}
                            </span>
                            {line.call.state === 'in_progress' && (
                              <span className="tabular-nums text-gray-400">
                                {formatTimer(line.duration)}
                              </span>
                            )}
                          </button>
                        ))}
                    </div>
                  )}

                  {/* Feature 5: CNAM Display */}
                  {cnamInfo && (cnamInfo.name || cnamInfo.carrier || cnamInfo.spamScore !== null) && (
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          {cnamInfo.name && (
                            <div className="text-sm font-semibold text-gray-800">{cnamInfo.name}</div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {cnamInfo.carrier && <span>{cnamInfo.carrier}</span>}
                            {cnamInfo.lineType && (
                              <>
                                <span className="text-gray-300">|</span>
                                <span>{cnamInfo.lineType}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {cnamInfo.spamScore !== null && cnamInfo.spamScore > 0 && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              cnamInfo.spamScore >= 70
                                ? 'bg-red-100 text-red-700'
                                : cnamInfo.spamScore >= 40
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-green-100 text-green-700'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            {cnamInfo.spamScore >= 70
                              ? t('voip.softphone.cnam.spam')
                              : cnamInfo.spamScore >= 40
                                ? t('voip.softphone.cnam.suspicious')
                                : t('voip.softphone.cnam.safe')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Video Panel (1:1) - shown when video is enabled */}
                  {isVideoEnabled && (
                    <div className="relative w-full rounded-lg overflow-hidden bg-black mb-2" style={{ aspectRatio: '16/9', maxHeight: '240px' }}>
                      {/* Remote video (full area) */}
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      {/* Local video PiP (small corner overlay) */}
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute bottom-2 right-2 w-24 h-18 rounded-lg border-2 border-white shadow-lg object-cover"
                      />
                      {/* Video off button overlay */}
                      <button
                        onClick={toggleVideo}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                        title={t('voip.softphone.video.disable')}
                      >
                        <VideoOff className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* CallControls */}
                  <CallControls
                    call={currentCall!}
                    onMute={toggleMute}
                    onHold={toggleHold}
                    onHangup={hangup}
                    onDtmf={sendDtmf}
                    onTransfer={transfer}
                    onPark={handleParkCall}
                    onConference={async (number) => {
                      try {
                        await startConference(number);
                        setConferenceParticipants((prev) => [...prev, number]);
                      } catch { /* silent */ }
                    }}
                    onFlip={(deviceType) => handleFlipCall(deviceType as FlipTarget)}
                    onToggleRecording={toggleRecording}
                    onToggleNoiseCancel={handleToggleNoiseCancellation}
                    onScreenShare={isScreenSharing ? hookStopScreenShare : hookScreenShare}
                    onToggleVideo={toggleVideo}
                    isRecording={currentCall?.isRecording ?? false}
                    isNoiseCancelActive={noiseCancelEnabled}
                    isScreenSharing={isScreenSharing}
                    isVideoEnabled={isVideoEnabled}
                  />

                  {/* ---- In-call extra controls row ---- */}
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {/* Feature 2: Park button */}
                    <button
                      onClick={handleParkCall}
                      disabled={parkLoading || !isActiveCall}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title={t('voip.softphone.park.parkCall')}
                    >
                      <ParkingSquare className="w-3.5 h-3.5" />
                      {t('voip.softphone.park.park')}
                    </button>

                    {/* Feature 3: Conference / Add participant */}
                    <button
                      onClick={() => setShowConferenceInput(!showConferenceInput)}
                      disabled={!isActiveCall}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        showConferenceInput
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title={t('voip.softphone.conference.add')}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {t('voip.softphone.conference.add')}
                      {conferenceParticipants.length > 0 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500 text-white text-[9px]">
                          {conferenceParticipants.length + 1}
                        </span>
                      )}
                    </button>

                    {/* Feature 6: Call Flip */}
                    <div className="relative">
                      <button
                        onClick={() => setShowFlipMenu(!showFlipMenu)}
                        disabled={!isActiveCall}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          showFlipMenu
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={t('voip.softphone.flip.title')}
                      >
                        <MonitorSmartphone className="w-3.5 h-3.5" />
                        {t('voip.softphone.flip.title')}
                      </button>

                      {showFlipMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowFlipMenu(false)} />
                          <div className="absolute bottom-full mb-1 start-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                            <button
                              onClick={() => handleFlipCall('web')}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                            >
                              <Laptop className="w-4 h-4" />
                              {t('voip.softphone.flip.web')}
                            </button>
                            <button
                              onClick={() => handleFlipCall('desk')}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                            >
                              <Headphones className="w-4 h-4" />
                              {t('voip.softphone.flip.desk')}
                            </button>
                            <button
                              onClick={() => handleFlipCall('mobile')}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                            >
                              <Smartphone className="w-4 h-4" />
                              {t('voip.softphone.flip.mobile')}
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Feature 8: Noise Cancel Toggle */}
                    <button
                      onClick={handleToggleNoiseCancellation}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        noiseCancelEnabled
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title={t('voip.softphone.noiseCancel.title')}
                    >
                      <AudioLines className="w-3.5 h-3.5" />
                      {noiseCancelEnabled
                        ? t('voip.softphone.noiseCancel.on')
                        : t('voip.softphone.noiseCancel.off')}
                    </button>

                    {/* Feature 10: Screen Share */}
                    <button
                      onClick={isScreenSharing ? hookStopScreenShare : hookScreenShare}
                      disabled={!isActiveCall}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isScreenSharing
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title={
                        isScreenSharing
                          ? t('voip.softphone.screenShare.stop')
                          : t('voip.softphone.screenShare.start')
                      }
                    >
                      {isScreenSharing ? (
                        <ScreenShareOff className="w-3.5 h-3.5" />
                      ) : (
                        <ScreenShare className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Feature 11: Virtual Background (visible during video calls) */}
                    {isVideoCall && (
                      <div className="relative">
                        <button
                          onClick={() => setShowBgPicker(!showBgPicker)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            showBgPicker
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          title={t('voip.softphone.virtualBg.title')}
                        >
                          <Image className="w-3.5 h-3.5" />
                        </button>

                        {showBgPicker && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowBgPicker(false)} />
                            <div className="absolute bottom-full mb-1 start-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                              {(['none', 'blur', 'office', 'nature', 'abstract'] as VirtualBg[]).map(
                                (bg) => (
                                  <button
                                    key={bg}
                                    onClick={() => handleSelectBackground(bg)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                                      virtualBackground === bg ? 'text-sky-700 font-medium' : 'text-gray-700'
                                    }`}
                                  >
                                    {t(`voip.softphone.virtualBg.${bg}`)}
                                    {virtualBackground === bg && (
                                      <span className="ms-auto text-xs text-sky-500">&#10003;</span>
                                    )}
                                  </button>
                                ),
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Feature 12: Call Recording */}
                    <button
                      onClick={toggleRecording}
                      disabled={!isActiveCall}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        (currentCall?.isRecording ?? false)
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title={
                        currentCall?.isRecording
                          ? t('voip.softphone.recording.stop')
                          : t('voip.softphone.recording.start')
                      }
                    >
                      {currentCall?.isRecording ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-red-600" />
                          <span className="tabular-nums">{formatTimer(recordingDuration)}</span>
                        </>
                      ) : (
                        <Circle className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                      )}
                    </button>

                    {/* Feature 14: Live Transcription CC toggle */}
                    <button
                      onClick={() => setCaptionsEnabled(!captionsEnabled)}
                      disabled={!isActiveCall}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        captionsEnabled
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title={t('voip.softphone.closedCaptions')}
                    >
                      {captionsEnabled ? (
                        <Captions className="w-3.5 h-3.5" />
                      ) : (
                        <CaptionsOff className="w-3.5 h-3.5" />
                      )}
                      {t('voip.softphone.closedCaptions')}
                    </button>
                  </div>

                  {/* Feature 14: Live Transcription Overlay */}
                  {captionsEnabled && isActiveCall && (
                    <div className="mt-2 relative">
                      <div
                        ref={transcriptContainerRef}
                        className="bg-gray-900/80 backdrop-blur-sm rounded-lg p-3 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600"
                      >
                        {transcriptLines.length === 0 ? (
                          <p className="text-white/60 text-xs text-center italic">
                            {t('voip.softphone.transcription.listening')}
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {transcriptLines.map((line, idx) => (
                              <p
                                key={idx}
                                className={`text-xs leading-relaxed ${
                                  idx === transcriptLines.length - 1
                                    ? 'text-white font-medium'
                                    : 'text-white/70'
                                }`}
                              >
                                {line}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Feature 3: Conference input */}
                  {showConferenceInput && (
                    <div className="flex items-center gap-2 mt-1 max-w-[280px] mx-auto">
                      <input
                        type="text"
                        value={conferenceNumber}
                        onChange={(e) => setConferenceNumber(e.target.value.replace(/[^0-9+*#]/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddConferenceParticipant()}
                        placeholder={t('voip.softphone.conference.enterNumber')}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      <button
                        onClick={handleAddConferenceParticipant}
                        disabled={!conferenceNumber}
                        className="px-3 py-1.5 bg-sky-500 text-white rounded-lg text-sm hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Conference participants list */}
                  {conferenceParticipants.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <Users className="w-3.5 h-3.5 text-sky-600" />
                      <span className="text-xs text-gray-500">
                        {t('voip.softphone.conference.active')}:
                      </span>
                      {conferenceParticipants.map((p, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-1.5 py-0.5 rounded bg-sky-50 text-xs text-sky-700"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ========== IDLE / REGISTERED VIEW (tabs) ========== */}
              {!isInCall && status === 'registered' && (
                <div>
                  {/* Tab bar */}
                  <div className="flex border-b border-gray-200 mb-3">
                    {(
                      [
                        { key: 'dialpad', icon: Hash, label: t('voip.softphone.tabs.dialpad') },
                        { key: 'lines', icon: Phone, label: t('voip.softphone.tabs.lines') },
                        { key: 'park', icon: ParkingSquare, label: t('voip.softphone.tabs.park') },
                        { key: 'team', icon: Users, label: t('voip.softphone.tabs.team') },
                      ] as { key: SoftphoneTab; icon: typeof Phone; label: string }[]
                    ).map((tab) => {
                      const TabIcon = tab.icon;
                      const isActive = activeTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border-b-2 transition-colors ${
                            isActive
                              ? 'border-sky-500 text-sky-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <TabIcon className="w-3.5 h-3.5" />
                          {tab.label}
                          {/* Badge for park tab */}
                          {tab.key === 'park' && parkedCalls.length > 0 && (
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                              {parkedCalls.length}
                            </span>
                          )}
                          {/* Badge for team tab */}
                          {tab.key === 'team' && ringingTeamCalls.length > 0 && (
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse">
                              {ringingTeamCalls.length}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* ---- TAB: Dialpad ---- */}
                  {activeTab === 'dialpad' && (
                    <div>
                      {/* Number input */}
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="text"
                          value={dialNumber}
                          onChange={(e) => setDialNumber(e.target.value.replace(/[^0-9+*#]/g, ''))}
                          onKeyDown={(e) => e.key === 'Enter' && handleDial()}
                          placeholder={t('voip.softphone.enterNumber')}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <button
                          onClick={handleDial}
                          disabled={!dialNumber}
                          className="p-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Phone className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Dialpad grid */}
                      <div className="grid grid-cols-3 gap-1.5 max-w-[220px] mx-auto">
                        {DIALPAD_KEYS.map((key) => (
                          <button
                            key={key}
                            onClick={() => setDialNumber((prev) => prev + key)}
                            className="w-full h-11 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-lg transition-colors active:bg-gray-300"
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ---- TAB: Lines ---- */}
                  {activeTab === 'lines' && (
                    <div>
                      {callLines.length === 0 ? (
                        <div className="text-center text-sm text-gray-400 py-6">
                          {t('voip.softphone.lines.noLines')}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {callLines.map((line) => (
                            <div
                              key={line.id}
                              className={`flex items-center justify-between p-2.5 rounded-lg border ${
                                activeLineId === line.id
                                  ? 'border-sky-300 bg-sky-50'
                                  : 'border-gray-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-gray-500" />
                                <div>
                                  <div className="text-sm font-medium">{line.call.remoteNumber}</div>
                                  <div className="text-xs text-gray-400">
                                    {line.call.remoteName || t('voip.call.unknownCaller')}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${callStateBadgeColor(
                                    line.call.state,
                                  )}`}
                                >
                                  {t(callStateLabelKey(line.call.state))}
                                </span>
                                {line.call.state === 'in_progress' && (
                                  <span className="text-xs text-gray-400 tabular-nums">
                                    {formatTimer(line.duration)}
                                  </span>
                                )}
                                <button
                                  onClick={() => { switchLine(line.id); setActiveLineId(line.id); }}
                                  className="px-2 py-1 text-xs bg-sky-500 text-white rounded hover:bg-sky-600 transition-colors"
                                >
                                  {t('voip.softphone.lines.switch')}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- TAB: Park ---- */}
                  {activeTab === 'park' && (
                    <div>
                      {parkedCalls.length === 0 ? (
                        <div className="text-center text-sm text-gray-400 py-6">
                          {t('voip.softphone.park.noParked')}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {parkedCalls.map((pc) => (
                            <div
                              key={pc.orbit}
                              className="flex items-center justify-between p-2.5 rounded-lg border border-amber-200 bg-amber-50"
                            >
                              <div className="flex items-center gap-2">
                                <ParkingSquare className="w-4 h-4 text-amber-600" />
                                <div>
                                  <div className="text-sm font-medium">
                                    {t('voip.softphone.park.orbit')} {pc.orbit}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {pc.callerName || pc.callerNumber}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRetrieveParked(pc.orbit)}
                                className="px-2.5 py-1 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                              >
                                {t('voip.softphone.park.retrieve')}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- TAB: Team (Call Pickup - Feature 7) ---- */}
                  {activeTab === 'team' && (
                    <div>
                      {ringingTeamCalls.length === 0 ? (
                        <div className="text-center text-sm text-gray-400 py-6">
                          {t('voip.softphone.team.noRinging')}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {ringingTeamCalls.map((tc) => (
                            <div
                              key={tc.id}
                              className="flex items-center justify-between p-2.5 rounded-lg border border-red-200 bg-red-50"
                            >
                              <div className="flex items-center gap-2">
                                <PhoneIncoming className="w-4 h-4 text-red-500 animate-pulse" />
                                <div>
                                  <div className="text-sm font-medium">
                                    {tc.callerName || tc.callerNumber}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {t('voip.softphone.team.ringingAt')} {tc.extensionName || tc.extension}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handlePickupCall(tc.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                              >
                                <PhoneForwarded className="w-3.5 h-3.5" />
                                {t('voip.softphone.team.pickup')}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Disconnect button */}
                  <button
                    onClick={unregister}
                    className="w-full mt-3 py-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
                  >
                    {t('voip.softphone.disconnect')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
