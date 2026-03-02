'use client';

/**
 * useVoip Hook
 * Manages JsSIP WebRTC connection for the softphone.
 * Handles registration, call state, and SIP events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoipStatus = 'disconnected' | 'connecting' | 'registered' | 'error';
export type CallState = 'idle' | 'ringing' | 'calling' | 'in_progress' | 'on_hold' | 'ended';

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
}

export interface UseVoipReturn {
  status: VoipStatus;
  currentCall: VoipCall | null;
  error: string | null;
  register: () => Promise<void>;
  unregister: () => void;
  makeCall: (number: string) => void;
  answerCall: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  sendDtmf: (digit: string) => void;
  transfer: (number: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoip(): UseVoipReturn {
  const [status, setStatus] = useState<VoipStatus>('disconnected');
  const [currentCall, setCurrentCall] = useState<VoipCall | null>(null);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uaRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (uaRef.current) {
        try {
          uaRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  /**
   * Register with the SIP server via WebSocket.
   */
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

      // Create audio element for remote stream
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.autoplay = true;
      }

      // Event handlers
      ua.on('registered', () => {
        setStatus('registered');
        setError(null);
        // Update agent status
        fetch('/api/admin/voip/extensions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update-status', status: 'ONLINE' }),
        }).catch(() => {});
      });

      ua.on('unregistered', () => {
        setStatus('disconnected');
      });

      ua.on('registrationFailed', (e: { cause: string }) => {
        setStatus('error');
        setError(`Registration failed: ${e.cause}`);
      });

      ua.on('newRTCSession', (data: { originator: string; session: unknown }) => {
        handleNewSession(data);
      });

      ua.start();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, []);

  /**
   * Handle a new RTC session (incoming or outgoing call).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNewSession = useCallback((data: any) => {
    const session = data.session;
    sessionRef.current = session;

    const isInbound = data.originator === 'remote';
    const remoteUri = isInbound
      ? session.remote_identity?.uri?.user || 'unknown'
      : session.remote_identity?.uri?.user || 'unknown';
    const remoteName = session.remote_identity?.display_name || null;

    const call: VoipCall = {
      id: session.id || Date.now().toString(),
      direction: isInbound ? 'inbound' : 'outbound',
      remoteNumber: remoteUri,
      remoteName,
      state: isInbound ? 'ringing' : 'calling',
      startTime: new Date(),
      answerTime: null,
      isMuted: false,
      isOnHold: false,
    };
    setCurrentCall(call);

    // Session events
    session.on('accepted', () => {
      setCurrentCall((prev) => prev ? { ...prev, state: 'in_progress', answerTime: new Date() } : null);
    });

    session.on('confirmed', () => {
      // Attach remote audio stream
      if (session.connection) {
        const receivers = session.connection.getReceivers();
        if (receivers.length > 0 && audioRef.current) {
          const stream = new MediaStream();
          receivers.forEach((receiver: RTCRtpReceiver) => {
            if (receiver.track) stream.addTrack(receiver.track);
          });
          audioRef.current.srcObject = stream;
        }
      }
    });

    session.on('ended', () => {
      setCurrentCall((prev) => prev ? { ...prev, state: 'ended' } : null);
      setTimeout(() => setCurrentCall(null), 2000);
      sessionRef.current = null;
    });

    session.on('failed', () => {
      setCurrentCall((prev) => prev ? { ...prev, state: 'ended' } : null);
      setTimeout(() => setCurrentCall(null), 2000);
      sessionRef.current = null;
    });

    session.on('hold', () => {
      setCurrentCall((prev) => prev ? { ...prev, isOnHold: true, state: 'on_hold' } : null);
    });

    session.on('unhold', () => {
      setCurrentCall((prev) => prev ? { ...prev, isOnHold: false, state: 'in_progress' } : null);
    });

    session.on('muted', () => {
      setCurrentCall((prev) => prev ? { ...prev, isMuted: true } : null);
    });

    session.on('unmuted', () => {
      setCurrentCall((prev) => prev ? { ...prev, isMuted: false } : null);
    });
  }, []);

  const unregister = useCallback(() => {
    if (uaRef.current) {
      uaRef.current.stop();
      uaRef.current = null;
    }
    setStatus('disconnected');
    // Update agent status
    fetch('/api/admin/voip/extensions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-status', status: 'OFFLINE' }),
    }).catch(() => {});
  }, []);

  const makeCall = useCallback((number: string) => {
    if (!uaRef.current || status !== 'registered') return;

    const options = {
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      },
    };

    uaRef.current.call(`sip:${number}@${uaRef.current.configuration.uri.host}`, options);
  }, [status]);

  const answerCall = useCallback(() => {
    if (sessionRef.current && currentCall?.state === 'ringing') {
      sessionRef.current.answer({
        mediaConstraints: { audio: true, video: false },
      });
    }
  }, [currentCall]);

  const hangup = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.terminate();
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!sessionRef.current) return;
    if (currentCall?.isMuted) {
      sessionRef.current.unmute();
    } else {
      sessionRef.current.mute();
    }
  }, [currentCall]);

  const toggleHold = useCallback(() => {
    if (!sessionRef.current) return;
    if (currentCall?.isOnHold) {
      sessionRef.current.unhold();
    } else {
      sessionRef.current.hold();
    }
  }, [currentCall]);

  const sendDtmf = useCallback((digit: string) => {
    if (sessionRef.current) {
      sessionRef.current.sendDTMF(digit);
    }
  }, []);

  const transfer = useCallback((number: string) => {
    if (sessionRef.current) {
      sessionRef.current.refer(`sip:${number}@${uaRef.current?.configuration.uri.host}`);
    }
  }, []);

  return {
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
  };
}
