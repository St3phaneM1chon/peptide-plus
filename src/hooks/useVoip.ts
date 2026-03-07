'use client';

/**
 * useVoip Hook (Phase S4A - Multi-Line)
 * Manages JsSIP WebRTC connection for the softphone.
 * Supports multiple simultaneous calls (lines), call parking,
 * call flip, conference, noise cancellation, recording, screen share,
 * CNAM enrichment, and browser notifications for incoming calls.
 *
 * Backward-compatible: `currentCall` is still exposed as a computed
 * getter that returns the focused call.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ---- VoIP lib imports ----
// cnam-lookup: server-side module, accessed via API route (lookupCnam uses Prisma/Telnyx)
// multi-line: multi-line logic is intentionally inline in this hook (client-side state only,
//   the server-side MultiLineManager from '@/lib/voip/multi-line' manages Telnyx call control)
import { IncomingNotificationManager } from '@/lib/voip/incoming-notification';
import { RingtoneManager } from '@/lib/voip/ringtone-manager';
import { ScreenShareManager } from '@/lib/voip/screen-share';
import { SpatialAudioEngine } from '@/lib/voip/spatial-audio';
import type { CallQualityMetrics, QualityHistory } from '@/lib/voip/call-quality-monitor';
import type { PresenceStatus } from '@/lib/voip/presence-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoipStatus = 'disconnected' | 'connecting' | 'registered' | 'error';
export type CallState =
  | 'idle'
  | 'ringing'
  | 'calling'
  | 'in_progress'
  | 'on_hold'
  | 'ended';

export interface CnamInfo {
  callerName: string | null;
  callerLocation: string | null;
  callerType: string | null; // e.g. "business", "residential"
}

export interface VoipCall {
  id: string;
  direction: 'inbound' | 'outbound';
  remoteNumber: string;
  remoteName: string | null;
  state: CallState;
  startTime: Date | null;
  answerTime: Date | null;
  isMuted: boolean;
  isOnHold: boolean;
  /** Line number (1-based) assigned to this call */
  lineNumber: number;
  /** Whether this call is currently parked */
  isParked: boolean;
  /** Orbit number if parked */
  parkOrbit: number | null;
  /** CNAM-enriched caller info (populated via /api/voip/cnam) */
  cnamInfo: CnamInfo | null;
  /** Whether this call is being recorded */
  isRecording: boolean;
}

export interface UseVoipReturn {
  // --- State ---
  status: VoipStatus;
  /** All active calls across all lines */
  calls: VoipCall[];
  /** The id of the currently focused call */
  focusedCallId: string | null;
  /** Backward-compatible: returns the focused call or null */
  currentCall: VoipCall | null;
  error: string | null;
  /** Whether noise cancellation is enabled */
  noiseCancelEnabled: boolean;
  /** Whether screen sharing is active */
  isScreenSharing: boolean;
  /** Whether video is enabled on the current call */
  isVideoEnabled: boolean;
  /** Local camera video stream (for PiP preview) */
  localVideoStream: MediaStream | null;
  /** Remote video stream from the other party */
  remoteVideoStream: MediaStream | null;
  /** Real-time call quality metrics (MOS, jitter, etc.) */
  callQualityMetrics: CallQualityMetrics | null;
  /** Current user presence status */
  presenceStatus: PresenceStatus;

  // --- Connection ---
  register: () => Promise<void>;
  unregister: () => void;

  // --- Call management (operates on focused call unless noted) ---
  makeCall: (number: string) => void;
  answerCall: (callId?: string) => void;
  hangup: (callId?: string) => void;
  toggleMute: () => void;
  toggleHold: () => void;
  sendDtmf: (digit: string) => void;
  transfer: (number: string) => void;

  // --- Multi-line ---
  /** Switch focus to a different call/line */
  switchLine: (callId: string) => void;

  // --- Parking ---
  /** Park the focused call */
  parkCall: () => Promise<void>;
  /** Retrieve a parked call from orbit */
  retrieveParkedCall: (orbit: number) => Promise<void>;

  // --- Call flip ---
  /** Flip the focused call to another device */
  flipCall: (deviceType: string) => Promise<void>;

  // --- Call pickup ---
  /** Pick up a ringing call on a specific extension */
  pickupCall: (targetExtension: string) => Promise<void>;
  /** Pick up any ringing call in the user's pickup group */
  groupPickup: () => Promise<void>;

  // --- Conference ---
  /** Add a participant to the focused call */
  startConference: (number: string) => Promise<void>;

  // --- Media features ---
  /** Toggle noise cancellation */
  toggleNoiseCancel: () => void;
  /** Toggle call recording on focused call */
  toggleRecording: () => Promise<void>;
  /** Start/stop screen sharing on focused call */
  screenShare: () => Promise<void>;
  /** Stop screen sharing */
  stopScreenShare: () => void;
  /** Toggle video on/off for the active call */
  toggleVideo: () => Promise<void>;

  // --- Presence ---
  /** Set user presence status */
  setPresence: (status: PresenceStatus) => void;

  // --- Quality ---
  /** Get call quality history for the last completed call */
  getLastCallQualityHistory: () => QualityHistory | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Assign a line number that is not yet in use. */
function nextLineNumber(calls: VoipCall[]): number {
  const used = new Set(calls.map((c) => c.lineNumber));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

/** Create a default VoipCall object */
function createCall(
  id: string,
  direction: 'inbound' | 'outbound',
  remoteNumber: string,
  remoteName: string | null,
  lineNumber: number,
): VoipCall {
  return {
    id,
    direction,
    remoteNumber,
    remoteName,
    state: direction === 'inbound' ? 'ringing' : 'calling',
    startTime: new Date(),
    answerTime: null,
    isMuted: false,
    isOnHold: false,
    lineNumber,
    isParked: false,
    parkOrbit: null,
    cnamInfo: null,
    isRecording: false,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoip(): UseVoipReturn {
  const [status, setStatus] = useState<VoipStatus>('disconnected');
  const [calls, setCalls] = useState<VoipCall[]>([]);
  const [focusedCallId, setFocusedCallId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noiseCancelEnabled, setNoiseCancelEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const [remoteVideoStream, setRemoteVideoStream] = useState<MediaStream | null>(null);
  const [callQualityMetrics, setCallQualityMetrics] = useState<CallQualityMetrics | null>(null);
  const [presenceStatus, setPresenceStatusState] = useState<PresenceStatus>('available');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uaRef = useRef<any>(null);

  /**
   * Map of JsSIP session objects keyed by call id.
   * Using a ref to a Map so we can manage multiple simultaneous sessions.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionsRef = useRef<Map<string, any>>(new Map());

  /** Audio elements for each call's remote stream, keyed by call id */
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  /** RingtoneManager instance (from @/lib/voip/ringtone-manager) */
  const ringtoneManagerRef = useRef<RingtoneManager | null>(null);

  /** IncomingNotificationManager instance (from @/lib/voip/incoming-notification) */
  const notificationManagerRef = useRef<IncomingNotificationManager | null>(null);

  /** ScreenShareManager instance (from @/lib/voip/screen-share) */
  const screenShareManagerRef = useRef<ScreenShareManager | null>(null);

  /** AudioNoiseCancellation instance (dynamically imported from krisp-noise-cancel) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noiseCancelRef = useRef<any>(null);

  /** Noise cancellation stream processor ref */
  const noiseCancelStreamRef = useRef<MediaStream | null>(null);

  /**
   * Spatial audio engine for conference calls with 3+ participants.
   * Positions each participant in 3D space using HRTF panning.
   */
  const spatialAudioRef = useRef<SpatialAudioEngine | null>(null);

  /** CallQualityMonitor instance (dynamically imported) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qualityMonitorRef = useRef<any>(null);

  /** Last call quality history */
  const lastQualityHistoryRef = useRef<QualityHistory | null>(null);

  // ---------------------------------------------------------------------------
  // Derived: currentCall (backward compat)
  // ---------------------------------------------------------------------------

  const currentCall = useMemo<VoipCall | null>(() => {
    if (!focusedCallId) {
      // If nothing focused, return the first non-ended call
      return calls.find((c) => c.state !== 'ended') ?? null;
    }
    return calls.find((c) => c.id === focusedCallId) ?? null;
  }, [calls, focusedCallId]);

  // ---------------------------------------------------------------------------
  // Internal state updaters
  // ---------------------------------------------------------------------------

  /** Update a specific call in the calls array */
  const updateCall = useCallback(
    (callId: string, updater: (prev: VoipCall) => VoipCall) => {
      setCalls((prev) =>
        prev.map((c) => (c.id === callId ? updater(c) : c)),
      );
    },
    [],
  );

  /** Remove a call from the list (after ended timeout) */
  const removeCall = useCallback((callId: string) => {
    setCalls((prev) => prev.filter((c) => c.id !== callId));
    setFocusedCallId((prev) => {
      if (prev === callId) {
        // Auto-focus next available call
        return null; // will fall back to useMemo logic
      }
      return prev;
    });
    // Clean up session and audio refs
    sessionsRef.current.delete(callId);
    const audioEl = audioElementsRef.current.get(callId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioElementsRef.current.delete(callId);
    }
    // Remove from spatial audio engine if active
    if (spatialAudioRef.current?.hasParticipant(callId)) {
      spatialAudioRef.current.removeParticipant(callId);
      // Re-arrange remaining participants after removal
      if (spatialAudioRef.current.getParticipantCount() > 0) {
        spatialAudioRef.current.arrangeCircle();
      }
    }
  }, []);

  /** Stop ringtone for a call (uses RingtoneManager) */
  const stopRingtone = useCallback((_callId: string) => {
    if (ringtoneManagerRef.current) {
      ringtoneManagerRef.current.stop();
    }
  }, []);

  // ---------------------------------------------------------------------------
  // CNAM enrichment (uses @/lib/voip/cnam-lookup via API route)
  // The CnamLookup lib (cnam-lookup.ts) runs server-side with Telnyx API.
  // From the client, we call the API route which internally uses lookupCnam().
  // ---------------------------------------------------------------------------

  const enrichCnam = useCallback(
    async (callId: string, phoneNumber: string) => {
      try {
        const res = await fetch(
          `/api/voip/cnam?number=${encodeURIComponent(phoneNumber)}`,
        );
        if (!res.ok) return;
        // Response shape matches CnamResult from @/lib/voip/cnam-lookup
        const data: CnamInfo = await res.json();
        updateCall(callId, (c) => ({
          ...c,
          cnamInfo: data,
          // Also set remoteName if not already set and CNAM returned a name
          remoteName: c.remoteName || data.callerName,
        }));
      } catch {
        // CNAM lookup is best-effort
      }
    },
    [updateCall],
  );

  // ---------------------------------------------------------------------------
  // Browser notifications for incoming calls (uses IncomingNotificationManager)
  // ---------------------------------------------------------------------------

  const showIncomingNotification = useCallback(
    (call: VoipCall) => {
      if (typeof window === 'undefined') return;

      // Lazily create the IncomingNotificationManager
      if (!notificationManagerRef.current) {
        notificationManagerRef.current = new IncomingNotificationManager({
          enabled: true,
          playRingtone: false, // We handle ringtone separately via RingtoneManager
          showBrowserNotification: true,
        });
      }

      notificationManagerRef.current.notify({
        callerNumber: call.remoteNumber,
        callerName: call.remoteName ?? undefined,
        callControlId: call.id,
        direction: 'inbound',
      });
    },
    [],
  );

  /** Start ringtone for incoming call (uses RingtoneManager) */
  const startRingtone = useCallback((_callId: string) => {
    if (typeof window === 'undefined') return;

    // Lazily create the RingtoneManager
    if (!ringtoneManagerRef.current) {
      ringtoneManagerRef.current = new RingtoneManager();
    }

    ringtoneManagerRef.current.play();
  }, []);

  // ---------------------------------------------------------------------------
  // Session handler
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNewSession = useCallback((data: any) => {
    const session = data.session;
    const isInbound = data.originator === 'remote';
    const remoteUri =
      session.remote_identity?.uri?.user || 'unknown';
    const remoteName: string | null =
      session.remote_identity?.display_name || null;
    const callId: string = session.id || Date.now().toString();

    // Store JsSIP session
    sessionsRef.current.set(callId, session);

    // Determine line number based on current calls
    setCalls((prev) => {
      const lineNumber = nextLineNumber(prev);
      const call = createCall(callId, isInbound ? 'inbound' : 'outbound', remoteUri, remoteName, lineNumber);
      return [...prev, call];
    });

    // Auto-focus if no other call is focused
    setFocusedCallId((prev) => prev ?? callId);

    // For incoming calls: notify, ringtone, CNAM
    if (isInbound) {
      const tempCall = createCall(callId, 'inbound', remoteUri, remoteName, 0);
      showIncomingNotification(tempCall);
      startRingtone(callId);
      enrichCnam(callId, remoteUri);
    }

    // --- Session event handlers ---

    session.on('accepted', () => {
      stopRingtone(callId);
      updateCall(callId, (c) => ({
        ...c,
        state: 'in_progress',
        answerTime: new Date(),
      }));
    });

    session.on('confirmed', () => {
      // Attach remote audio stream
      if (session.connection) {
        const receivers: RTCRtpReceiver[] = session.connection.getReceivers();
        if (receivers.length > 0) {
          const stream = new MediaStream();
          receivers.forEach((receiver: RTCRtpReceiver) => {
            if (receiver.track) stream.addTrack(receiver.track);
          });
          let audioEl = audioElementsRef.current.get(callId);
          if (!audioEl) {
            audioEl = new Audio();
            audioEl.autoplay = true;
            audioElementsRef.current.set(callId, audioEl);
          }
          audioEl.srcObject = stream;
        }

        // Extract remote video tracks (if any) into remoteVideoStream
        const videoReceivers = receivers.filter(
          (r: RTCRtpReceiver) => r.track && r.track.kind === 'video',
        );
        if (videoReceivers.length > 0) {
          const videoStream = new MediaStream();
          videoReceivers.forEach((r: RTCRtpReceiver) => {
            if (r.track) videoStream.addTrack(r.track);
          });
          setRemoteVideoStream(videoStream);
        }

        // Start CallQualityMonitor on the peer connection
        import('@/lib/voip/call-quality-monitor').then(({ CallQualityMonitor }) => {
          const monitor = new CallQualityMonitor();
          monitor.onMetrics((metrics) => {
            setCallQualityMetrics(metrics);
          });
          monitor.start(session.connection as RTCPeerConnection);
          qualityMonitorRef.current = monitor;
        }).catch(() => {
          // Quality monitoring is best-effort
        });
      }

      // Update presence to busy via presence API
      fetch('/api/voip/presence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'busy' }),
      }).catch(() => {});
      setPresenceStatusState('busy');
    });

    session.on('ended', () => {
      stopRingtone(callId);
      // Dismiss notification on call end
      if (notificationManagerRef.current) {
        notificationManagerRef.current.dismiss();
      }
      updateCall(callId, (c) => ({ ...c, state: 'ended' }));
      setTimeout(() => removeCall(callId), 2000);

      // Stop CallQualityMonitor and save history
      if (qualityMonitorRef.current) {
        lastQualityHistoryRef.current = qualityMonitorRef.current.stop();
        qualityMonitorRef.current = null;
        setCallQualityMetrics(null);
      }

      // Clean up video streams
      if (localVideoStream) {
        localVideoStream.getTracks().forEach((t) => t.stop());
        setLocalVideoStream(null);
      }
      setRemoteVideoStream(null);
      setIsVideoEnabled(false);

      // Restore presence to available
      fetch('/api/voip/presence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'available' }),
      }).catch(() => {});
      setPresenceStatusState('available');
    });

    session.on('failed', () => {
      stopRingtone(callId);
      if (notificationManagerRef.current) {
        notificationManagerRef.current.dismiss();
      }
      updateCall(callId, (c) => ({ ...c, state: 'ended' }));
      setTimeout(() => removeCall(callId), 2000);

      // Stop CallQualityMonitor on failure too
      if (qualityMonitorRef.current) {
        lastQualityHistoryRef.current = qualityMonitorRef.current.stop();
        qualityMonitorRef.current = null;
        setCallQualityMetrics(null);
      }

      // Clean up video streams
      if (localVideoStream) {
        localVideoStream.getTracks().forEach((t) => t.stop());
        setLocalVideoStream(null);
      }
      setRemoteVideoStream(null);
      setIsVideoEnabled(false);

      // Restore presence
      setPresenceStatusState('available');
    });

    session.on('hold', () => {
      updateCall(callId, (c) => ({
        ...c,
        isOnHold: true,
        state: 'on_hold',
      }));
    });

    session.on('unhold', () => {
      updateCall(callId, (c) => ({
        ...c,
        isOnHold: false,
        state: 'in_progress',
      }));
    });

    session.on('muted', () => {
      updateCall(callId, (c) => ({ ...c, isMuted: true }));
    });

    session.on('unmuted', () => {
      updateCall(callId, (c) => ({ ...c, isMuted: false }));
    });
  }, [updateCall, removeCall, stopRingtone, showIncomingNotification, startRingtone, enrichCnam]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      // Stop UA
      if (uaRef.current) {
        try {
          uaRef.current.stop();
        } catch {
          // ignore
        }
        uaRef.current = null;
      }

      // Terminate all sessions
      sessionsRef.current.forEach((session) => {
        try {
          session.terminate();
        } catch {
          // ignore
        }
      });
      sessionsRef.current.clear();

      // Clean up audio elements
      audioElementsRef.current.forEach((el) => {
        el.srcObject = null;
      });
      audioElementsRef.current.clear();

      // Stop RingtoneManager
      if (ringtoneManagerRef.current) {
        ringtoneManagerRef.current.stop();
        ringtoneManagerRef.current = null;
      }

      // Dismiss IncomingNotificationManager
      if (notificationManagerRef.current) {
        notificationManagerRef.current.dismiss();
        notificationManagerRef.current = null;
      }

      // Stop ScreenShareManager
      if (screenShareManagerRef.current) {
        screenShareManagerRef.current.stop();
        screenShareManagerRef.current = null;
      }

      // Stop CallQualityMonitor
      if (qualityMonitorRef.current) {
        qualityMonitorRef.current.stop();
        qualityMonitorRef.current = null;
      }

      // Destroy AudioNoiseCancellation
      if (noiseCancelRef.current) {
        noiseCancelRef.current.destroy().catch(() => {});
        noiseCancelRef.current = null;
      }

      // Clean up noise cancel stream
      if (noiseCancelStreamRef.current) {
        noiseCancelStreamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        noiseCancelStreamRef.current = null;
      }

      // Clean up spatial audio engine
      if (spatialAudioRef.current) {
        spatialAudioRef.current.destroy();
        spatialAudioRef.current = null;
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Connection: register / unregister
  // ---------------------------------------------------------------------------

  const register = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);

      // Fetch credentials from API
      const res = await fetch('/api/admin/voip/extensions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-credentials' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get SIP credentials');
      }

      const creds = await res.json();

      if (!creds.sipUsername || !creds.sipPassword) {
        throw new Error('SIP credentials are missing or could not be decrypted');
      }

      // Dynamic import JsSIP (only loaded when needed)
      const JsSIP = await import('jssip');

      const socket = new JsSIP.WebSocketInterface(creds.wsUrl);

      const config = {
        sockets: [socket],
        uri: `sip:${creds.sipUsername}@${creds.sipDomain}`,
        password: creds.sipPassword,
        display_name: creds.extension,
        register: true,
        session_timers: false,
      };

      const ua = new JsSIP.UA(config);
      uaRef.current = ua;

      // Pre-request notification permission
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'default'
      ) {
        Notification.requestPermission().catch(() => {});
      }

      // Event handlers
      let didRegister = false;

      ua.on('registered', () => {
        didRegister = true;
        setStatus('registered');
        setError(null);
        fetch('/api/admin/voip/extensions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update-status', status: 'ONLINE' }),
        }).catch(() => {});
      });

      ua.on('unregistered', () => {
        setStatus('disconnected');
      });

      ua.on('disconnected', () => {
        // JsSIP fires 'disconnected' on each failed WebSocket attempt before retrying.
        // Only show error if we were already registered (connection was lost mid-session).
        if (didRegister) {
          setStatus('error');
          setError('Connexion WebSocket perdue. Tentative de reconnexion...');
        }
      });

      ua.on(
        'registrationFailed',
        (e: { response: unknown; cause?: string }) => {
          setStatus('error');
          setError(`Registration failed: ${e.cause || 'unknown'}`);
        },
      );

      ua.on(
        'newRTCSession',
        (data: { originator: string; session: unknown }) => {
          handleNewSession(data);
        },
      );

      ua.start();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [handleNewSession]);

  const unregister = useCallback(() => {
    if (uaRef.current) {
      uaRef.current.stop();
      uaRef.current = null;
    }
    setStatus('disconnected');
    setCalls([]);
    setFocusedCallId(null);

    // Clean up all sessions
    sessionsRef.current.forEach((session) => {
      try {
        session.terminate();
      } catch {
        // ignore
      }
    });
    sessionsRef.current.clear();

    // Clean up audio
    audioElementsRef.current.forEach((el) => {
      el.srcObject = null;
    });
    audioElementsRef.current.clear();

    // Stop RingtoneManager
    if (ringtoneManagerRef.current) {
      ringtoneManagerRef.current.stop();
    }

    // Dismiss notifications
    if (notificationManagerRef.current) {
      notificationManagerRef.current.dismiss();
    }

    // Stop screen share
    if (screenShareManagerRef.current) {
      screenShareManagerRef.current.stop();
      setIsScreenSharing(false);
    }

    // Stop quality monitor
    if (qualityMonitorRef.current) {
      qualityMonitorRef.current.stop();
      qualityMonitorRef.current = null;
      setCallQualityMetrics(null);
    }

    // Update agent status
    fetch('/api/admin/voip/extensions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-status', status: 'OFFLINE' }),
    }).catch(() => {});

    // Update presence to offline
    fetch('/api/voip/presence', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'offline' }),
    }).catch(() => {});
    setPresenceStatusState('offline');
  }, []);

  // ---------------------------------------------------------------------------
  // Call management
  // ---------------------------------------------------------------------------

  /** Get the session for the focused call (or a specific callId) */
  const getSession = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (callId?: string): any | null => {
      const id = callId ?? focusedCallId;
      if (!id) return null;
      return sessionsRef.current.get(id) ?? null;
    },
    [focusedCallId],
  );

  const makeCall = useCallback(
    (number: string) => {
      if (!uaRef.current || status !== 'registered') return;

      const options = {
        mediaConstraints: { audio: true, video: isVideoEnabled },
        pcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      };

      uaRef.current.call(
        `sip:${number}@${uaRef.current.configuration.uri.host}`,
        options,
      );
    },
    [status],
  );

  const answerCall = useCallback(
    (callId?: string) => {
      const id = callId ?? focusedCallId;
      if (!id) return;

      const session = sessionsRef.current.get(id);
      const call = calls.find((c) => c.id === id);

      if (session && call?.state === 'ringing') {
        stopRingtone(id);
        session.answer({
          mediaConstraints: { audio: true, video: isVideoEnabled },
          pcConfig: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        });
      }
    },
    [focusedCallId, calls, stopRingtone],
  );

  const hangup = useCallback(
    (callId?: string) => {
      const id = callId ?? focusedCallId;
      if (!id) return;

      const session = sessionsRef.current.get(id);
      if (session) {
        stopRingtone(id);
        session.terminate();
      }
    },
    [focusedCallId, stopRingtone],
  );

  const toggleMute = useCallback(() => {
    const session = getSession();
    if (!session || !focusedCallId) return;

    const call = calls.find((c) => c.id === focusedCallId);
    if (!call) return;

    if (call.isMuted) {
      session.unmute();
    } else {
      session.mute();
    }
  }, [getSession, focusedCallId, calls]);

  const toggleHold = useCallback(() => {
    const session = getSession();
    if (!session || !focusedCallId) return;

    const call = calls.find((c) => c.id === focusedCallId);
    if (!call) return;

    if (call.isOnHold) {
      session.unhold();
    } else {
      session.hold();
    }
  }, [getSession, focusedCallId, calls]);

  const sendDtmf = useCallback(
    (digit: string) => {
      const session = getSession();
      if (session) {
        session.sendDTMF(digit);
      }
    },
    [getSession],
  );

  const transfer = useCallback(
    (number: string) => {
      const session = getSession();
      if (session && uaRef.current) {
        session.refer(
          `sip:${number}@${uaRef.current.configuration.uri.host}`,
        );
      }
    },
    [getSession],
  );

  // ---------------------------------------------------------------------------
  // Multi-line: switchLine
  // ---------------------------------------------------------------------------

  const switchLine = useCallback(
    (callId: string) => {
      const call = calls.find((c) => c.id === callId);
      if (!call || call.state === 'ended') return;
      setFocusedCallId(callId);
    },
    [calls],
  );

  // ---------------------------------------------------------------------------
  // Parking
  // ---------------------------------------------------------------------------

  const parkCall = useCallback(async () => {
    if (!focusedCallId) return;

    const call = calls.find((c) => c.id === focusedCallId);
    if (!call || call.state === 'ended') return;

    try {
      const res = await fetch('/api/voip/park', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: focusedCallId,
          lineNumber: call.lineNumber,
          remoteNumber: call.remoteNumber,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Park failed');
      }

      const { orbit } = await res.json();

      // Put the session on hold locally
      const session = sessionsRef.current.get(focusedCallId);
      if (session) {
        session.hold();
      }

      updateCall(focusedCallId, (c) => ({
        ...c,
        isParked: true,
        parkOrbit: orbit,
        state: 'on_hold',
        isOnHold: true,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Park failed');
    }
  }, [focusedCallId, calls, updateCall]);

  const retrieveParkedCall = useCallback(
    async (orbit: number) => {
      try {
        const res = await fetch('/api/voip/park/retrieve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orbit }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Retrieve failed');
        }

        const { callId } = await res.json();

        // Find the parked call and unpark it
        const parkedCall = calls.find(
          (c) => c.parkOrbit === orbit || c.id === callId,
        );

        if (parkedCall) {
          const session = sessionsRef.current.get(parkedCall.id);
          if (session) {
            session.unhold();
          }
          updateCall(parkedCall.id, (c) => ({
            ...c,
            isParked: false,
            parkOrbit: null,
            state: 'in_progress',
            isOnHold: false,
          }));
          setFocusedCallId(parkedCall.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Retrieve failed');
      }
    },
    [calls, updateCall],
  );

  // ---------------------------------------------------------------------------
  // Call flip
  // ---------------------------------------------------------------------------

  const flipCall = useCallback(
    async (deviceType: string) => {
      if (!focusedCallId) return;

      try {
        const res = await fetch('/api/voip/flip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId: focusedCallId,
            deviceType,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Flip failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Flip failed');
      }
    },
    [focusedCallId],
  );

  // ---------------------------------------------------------------------------
  // Conference
  // ---------------------------------------------------------------------------

  const startConference = useCallback(
    async (number: string) => {
      if (!focusedCallId || !uaRef.current || status !== 'registered') return;

      const focusedSession = sessionsRef.current.get(focusedCallId);
      if (!focusedSession) return;

      try {
        // Put current call on hold while we add participant
        focusedSession.hold();

        // Initiate the new call (JsSIP will fire newRTCSession)
        const options = {
          mediaConstraints: { audio: true, video: isVideoEnabled },
          pcConfig: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        };

        uaRef.current.call(
          `sip:${number}@${uaRef.current.configuration.uri.host}`,
          options,
        );

        // Notify backend to set up conference bridge
        await fetch('/api/voip/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'conference',
            callId: focusedCallId,
            targetNumber: number,
          }),
        });

        // Enable spatial audio when conference has 3+ participants.
        // Each participant's audio stream is positioned in 3D space
        // using HRTF panning for a natural multi-speaker experience.
        const activeCallCount = calls.filter(
          (c) => c.state === 'in_progress' || c.state === 'calling',
        ).length;

        if (activeCallCount >= 2) {
          // 2 existing calls + 1 new = 3+ participants
          if (!spatialAudioRef.current) {
            spatialAudioRef.current = new SpatialAudioEngine();
            spatialAudioRef.current.init();
          }

          const engine = spatialAudioRef.current;

          // Add each active call's remote stream to the spatial engine
          for (const call of calls) {
            if (call.state === 'ended' || engine.hasParticipant(call.id)) continue;

            const audioEl = audioElementsRef.current.get(call.id);
            if (audioEl?.srcObject instanceof MediaStream) {
              engine.addParticipant(
                call.id,
                call.remoteName || call.remoteNumber,
                audioEl.srcObject,
              );
            }
          }

          // Arrange all participants in a circle for optimal spatial separation
          engine.arrangeCircle();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Conference failed');
        // Attempt to unhold original call
        try {
          focusedSession.unhold();
        } catch {
          // ignore
        }
      }
    },
    [focusedCallId, status, calls],
  );

  // ---------------------------------------------------------------------------
  // Noise cancellation (uses AudioNoiseCancellation from krisp-noise-cancel)
  // ---------------------------------------------------------------------------

  const toggleNoiseCancel = useCallback(() => {
    setNoiseCancelEnabled((prev) => {
      const next = !prev;

      if (next) {
        // Dynamically import krisp-noise-cancel to avoid bundle bloat
        import('@/lib/voip/krisp-noise-cancel').then(({ AudioNoiseCancellation }) => {
          if (!noiseCancelRef.current) {
            noiseCancelRef.current = new AudioNoiseCancellation({
              enabled: true,
              level: 'medium',
              aecEnabled: true,
              agcEnabled: true,
              vadEnabled: true,
            });
          }
          noiseCancelRef.current.setEnabled(true);

          // Process audio through the pipeline for each active session
          sessionsRef.current.forEach((session) => {
            if (!session.connection) return;
            const senders: RTCRtpSender[] = session.connection.getSenders();
            senders.forEach((sender: RTCRtpSender) => {
              if (sender.track?.kind === 'audio') {
                // Get the raw audio stream and process through noise cancellation
                const rawStream = new MediaStream([sender.track]);
                noiseCancelRef.current.processStream(rawStream).then((processedStream: MediaStream) => {
                  const processedTrack = processedStream.getAudioTracks()[0];
                  if (processedTrack) {
                    sender.replaceTrack(processedTrack).catch(() => {});
                    noiseCancelStreamRef.current = processedStream;
                  }
                }).catch(() => {});
              }
            });
          });
        }).catch(() => {
          // Fallback: use browser-native constraints
          sessionsRef.current.forEach((session) => {
            if (!session.connection) return;
            const senders: RTCRtpSender[] = session.connection.getSenders();
            senders.forEach((sender: RTCRtpSender) => {
              if (sender.track?.kind === 'audio') {
                sender.track.applyConstraints({
                  noiseSuppression: true,
                  echoCancellation: true,
                  autoGainControl: true,
                } as MediaTrackConstraints).catch(() => {});
              }
            });
          });
        });
      } else {
        // Disable noise cancellation
        if (noiseCancelRef.current) {
          noiseCancelRef.current.setEnabled(false);
        }
        // Revert to non-processed tracks
        sessionsRef.current.forEach((session) => {
          if (!session.connection) return;
          const senders: RTCRtpSender[] = session.connection.getSenders();
          senders.forEach((sender: RTCRtpSender) => {
            if (sender.track?.kind === 'audio') {
              sender.track.applyConstraints({
                noiseSuppression: false,
                echoCancellation: false,
                autoGainControl: false,
              } as MediaTrackConstraints).catch(() => {});
            }
          });
        });
      }

      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  const toggleRecording = useCallback(async () => {
    if (!focusedCallId) return;

    const call = calls.find((c) => c.id === focusedCallId);
    if (!call || call.state === 'ended') return;

    const newState = !call.isRecording;

    try {
      const res = await fetch('/api/voip/call', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: newState ? 'start-recording' : 'stop-recording',
          callId: focusedCallId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Recording toggle failed');
      }

      updateCall(focusedCallId, (c) => ({
        ...c,
        isRecording: newState,
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Recording toggle failed',
      );
    }
  }, [focusedCallId, calls, updateCall]);

  // ---------------------------------------------------------------------------
  // Screen sharing (uses ScreenShareManager)
  // ---------------------------------------------------------------------------

  const screenShare = useCallback(async () => {
    if (!focusedCallId) return;

    const session = sessionsRef.current.get(focusedCallId);
    if (!session?.connection) return;

    // Lazily create the ScreenShareManager
    if (!screenShareManagerRef.current) {
      screenShareManagerRef.current = new ScreenShareManager();

      // Listen for share ended (user clicked browser stop button)
      screenShareManagerRef.current.onShareEnded(() => {
        setIsScreenSharing(false);
      });
    }

    const manager = screenShareManagerRef.current;

    if (manager.getState().isSharing) {
      // Already sharing - stop it
      manager.stop();
      setIsScreenSharing(false);
      return;
    }

    try {
      const screenStream = await manager.start({
        width: 1920,
        height: 1080,
        frameRate: 15,
      });

      // Add screen share track to the peer connection using the manager
      const pc = session.connection as RTCPeerConnection;
      const senders: RTCRtpSender[] = pc.getSenders();
      const videoSender = senders.find(
        (s: RTCRtpSender) => s.track?.kind === 'video',
      );

      if (videoSender) {
        await manager.replaceTrack(videoSender, screenStream);
      } else {
        await manager.addToPeerConnection(pc, screenStream);
      }

      setIsScreenSharing(true);
    } catch (err) {
      // User cancelled or permission denied
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    }
  }, [focusedCallId]);

  /** Stop screen sharing */
  const stopScreenShareHook = useCallback(() => {
    if (screenShareManagerRef.current) {
      screenShareManagerRef.current.stop();
    }
    setIsScreenSharing(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Video toggle (1:1 video calling)
  // ---------------------------------------------------------------------------

  const toggleVideo = useCallback(async () => {
    if (!focusedCallId) return;

    const session = sessionsRef.current.get(focusedCallId);
    if (!session?.connection) return;

    const pc = session.connection as RTCPeerConnection;

    if (isVideoEnabled) {
      // Disable video: stop local video tracks and remove from peer connection
      if (localVideoStream) {
        localVideoStream.getTracks().forEach((track) => track.stop());
      }
      const senders = pc.getSenders();
      senders.forEach((sender) => {
        if (sender.track && sender.track.kind === 'video') {
          pc.removeTrack(sender);
        }
      });
      setLocalVideoStream(null);
      setRemoteVideoStream(null);
      setIsVideoEnabled(false);
    } else {
      // Enable video: get camera stream and add to peer connection
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          pc.addTrack(videoTrack, stream);
        }
        setLocalVideoStream(stream);
        setIsVideoEnabled(true);

        // Listen for incoming video tracks from the remote party
        const receivers = pc.getReceivers();
        const videoReceivers = receivers.filter(
          (r) => r.track && r.track.kind === 'video',
        );
        if (videoReceivers.length > 0) {
          const remoteStream = new MediaStream();
          videoReceivers.forEach((r) => {
            if (r.track) remoteStream.addTrack(r.track);
          });
          setRemoteVideoStream(remoteStream);
        }

        // Also listen for future negotiation/track events
        pc.addEventListener('track', (event) => {
          if (event.track.kind === 'video') {
            setRemoteVideoStream((prev) => {
              const s = prev ?? new MediaStream();
              s.addTrack(event.track);
              return s;
            });
          }
        });
      } catch (err) {
        // Camera access failed
        const message =
          err instanceof DOMException && err.name === 'NotFoundError'
            ? 'No camera detected'
            : err instanceof DOMException && err.name === 'NotAllowedError'
              ? 'Camera permission denied'
              : err instanceof DOMException && err.name === 'NotReadableError'
                ? 'Camera is in use by another application'
                : 'Failed to enable video';
        setError(message);
      }
    }
  }, [focusedCallId, isVideoEnabled, localVideoStream]);

  // ---------------------------------------------------------------------------
  // Call pickup (uses @/lib/voip/call-pickup via API route)
  // The CallPickup lib runs server-side with Telnyx answer/bridge APIs.
  // ---------------------------------------------------------------------------

  const pickupCall = useCallback(
    async (targetExtension: string) => {
      if (!focusedCallId) return;

      try {
        // API route uses directedPickup() from @/lib/voip/call-pickup
        const res = await fetch('/api/voip/pickup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'directed',
            targetExtension,
            callControlId: focusedCallId,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Pickup failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Pickup failed');
      }
    },
    [focusedCallId],
  );

  const groupPickupFn = useCallback(async () => {
    if (!focusedCallId) return;

    try {
      // API route uses groupPickup() from @/lib/voip/call-pickup
      const res = await fetch('/api/voip/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'group',
          callControlId: focusedCallId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Group pickup failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Group pickup failed');
    }
  }, [focusedCallId]);

  // ---------------------------------------------------------------------------
  // Presence (uses @/lib/voip/presence-manager via API route)
  // The server-side presence-manager tracks user status with VoipStateMap.
  // ---------------------------------------------------------------------------

  const setPresence = useCallback((newStatus: PresenceStatus) => {
    setPresenceStatusState(newStatus);
    // Notify server-side presence-manager via API route
    fetch('/api/voip/presence', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
  }, []);

  // ---------------------------------------------------------------------------
  // Quality history accessor
  // ---------------------------------------------------------------------------

  const getLastCallQualityHistory = useCallback((): QualityHistory | null => {
    return lastQualityHistoryRef.current;
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // State
    status,
    calls,
    focusedCallId,
    currentCall,
    error,
    noiseCancelEnabled,
    isScreenSharing,
    isVideoEnabled,
    localVideoStream,
    remoteVideoStream,
    callQualityMetrics,
    presenceStatus,

    // Connection
    register,
    unregister,

    // Call management
    makeCall,
    answerCall,
    hangup,
    toggleMute,
    toggleHold,
    sendDtmf,
    transfer,

    // Multi-line
    switchLine,

    // Parking
    parkCall,
    retrieveParkedCall,

    // Call flip
    flipCall,

    // Call pickup
    pickupCall,
    groupPickup: groupPickupFn,

    // Conference
    startConference,

    // Media features
    toggleNoiseCancel,
    toggleRecording,
    screenShare,
    stopScreenShare: stopScreenShareHook,
    toggleVideo,

    // Presence
    setPresence,

    // Quality
    getLastCallQualityHistory,
  };
}
