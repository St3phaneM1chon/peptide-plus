/**
 * useTelnyxWebRTC Hook
 * Wrapper hook for the Telnyx WebRTC JavaScript SDK.
 * Manages WebRTC session, call state, and provides call control functions.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CallState = 'idle' | 'connecting' | 'dialing' | 'ringing' | 'active' | 'held' | 'ending';

/** Minimal Telnyx call object shape for type safety */
interface TelnyxCallObject {
  id: string;
  state: string;
  direction?: 'inbound' | 'outbound';
  options?: { callerName?: string; callerNumber?: string; destinationNumber?: string };
  answer: () => void;
  hangup: () => void;
  hold: (params?: { hold: boolean }) => void;
  unhold: () => void;
  dtmf: (digit: string) => void;
  muteAudio: () => void;
  unmuteAudio: () => void;
  transfer: (destination: string) => void;
  [key: string]: unknown;
}

/** Telnyx notification event */
interface TelnyxNotification {
  type: string;
  call?: TelnyxCallObject;
}

export interface TelnyxCallInfo {
  callId: string | null;
  state: CallState;
  direction: 'inbound' | 'outbound' | null;
  callerName: string | null;
  callerNumber: string | null;
  duration: number; // seconds
  isMuted: boolean;
  isHeld: boolean;
  isRecording: boolean;
}

export interface UseTelnyxWebRTCReturn {
  isRegistered: boolean;
  isConnecting: boolean;
  call: TelnyxCallInfo;
  error: string | null;
  connect: (token: string) => void;
  disconnect: () => void;
  makeCall: (destination: string, callerIdNumber?: string) => void;
  answerCall: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  sendDTMF: (digit: string) => void;
  transfer: (destination: string) => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_CALL: TelnyxCallInfo = {
  callId: null,
  state: 'idle',
  direction: null,
  callerName: null,
  callerNumber: null,
  duration: 0,
  isMuted: false,
  isHeld: false,
  isRecording: false,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTelnyxWebRTC(): UseTelnyxWebRTCReturn {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [call, setCall] = useState<TelnyxCallInfo>(INITIAL_CALL);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TelnyxRTC SDK client has complex internal types from dynamic import
  const clientRef = useRef<any>(null);
  const activeCallRef = useRef<TelnyxCallObject | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Duration timer
  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = setInterval(() => {
      setCall((prev) => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDurationTimer();
      if (clientRef.current) {
        try { clientRef.current.disconnect(); } catch { /* ignore */ }
      }
    };
  }, [stopDurationTimer]);

  // ---------------------------------------------------------------------------
  // Connect to Telnyx
  // ---------------------------------------------------------------------------

  const connect = useCallback(async (token: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      // Dynamic import to avoid SSR issues
      const { TelnyxRTC } = await import('@telnyx/webrtc');
      const client = new TelnyxRTC({ login_token: token });

      client.on('telnyx.ready', () => {
        setIsRegistered(true);
        setIsConnecting(false);
      });

      client.on('telnyx.error', (err: { message?: string }) => {
        setError(err?.message || 'Connection error');
        setIsConnecting(false);
      });

      client.on('telnyx.socket.close', () => {
        setIsRegistered(false);
        setCall(INITIAL_CALL);
        stopDurationTimer();
      });

      client.on('telnyx.notification', (notification: TelnyxNotification) => {
        const telnyxCall = notification.call;
        if (!telnyxCall) return;

        activeCallRef.current = telnyxCall;

        switch (notification.type) {
          case 'callUpdate':
            handleCallUpdate(telnyxCall);
            break;
          case 'ringing':
            setCall((prev) => ({
              ...prev,
              callId: telnyxCall.id,
              state: 'ringing',
              direction: telnyxCall.direction || 'inbound',
              callerName: telnyxCall.options?.callerName || null,
              callerNumber: telnyxCall.options?.callerNumber || null,
            }));
            break;
        }
      });

      client.connect();
      clientRef.current = client;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnecting(false);
    }
  }, [stopDurationTimer]);

  const handleCallUpdate = useCallback((telnyxCall: TelnyxCallObject) => {
    const callState = telnyxCall.state;
    let mapped: CallState = 'idle';

    switch (callState) {
      case 'new':
      case 'trying':
        mapped = 'connecting';
        break;
      case 'early':
      case 'ringing':
        mapped = telnyxCall.direction === 'outbound' ? 'dialing' : 'ringing';
        break;
      case 'active':
        mapped = 'active';
        if (call.state !== 'active') startDurationTimer();
        break;
      case 'held':
        mapped = 'held';
        break;
      case 'hangup':
      case 'destroy':
      case 'purge':
        mapped = 'idle';
        stopDurationTimer();
        activeCallRef.current = null;
        setCall(INITIAL_CALL);
        return;
      default:
        mapped = 'idle';
    }

    setCall((prev) => ({
      ...prev,
      callId: telnyxCall.id,
      state: mapped,
      direction: telnyxCall.direction || prev.direction,
      callerName: telnyxCall.options?.callerName || prev.callerName,
      callerNumber: telnyxCall.options?.callerNumber || prev.callerNumber,
    }));
  }, [call.state, startDurationTimer, stopDurationTimer]);

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setIsRegistered(false);
    setCall(INITIAL_CALL);
    stopDurationTimer();
  }, [stopDurationTimer]);

  // ---------------------------------------------------------------------------
  // Call controls
  // ---------------------------------------------------------------------------

  const makeCall = useCallback((destination: string, callerIdNumber?: string) => {
    if (!clientRef.current || !isRegistered) {
      setError('Not connected');
      return;
    }
    setCall((prev) => ({
      ...prev,
      state: 'connecting',
      direction: 'outbound',
      callerNumber: destination,
      duration: 0,
      isMuted: false,
      isHeld: false,
    }));
    clientRef.current.newCall({
      destinationNumber: destination,
      callerIdNumber: callerIdNumber || undefined,
    });
  }, [isRegistered]);

  const answerCall = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.answer();
    }
  }, []);

  const hangup = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.hangup();
    }
    stopDurationTimer();
  }, [stopDurationTimer]);

  const toggleMute = useCallback(() => {
    if (!activeCallRef.current) return;
    if (call.isMuted) {
      activeCallRef.current.unmuteAudio();
    } else {
      activeCallRef.current.muteAudio();
    }
    setCall((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  }, [call.isMuted]);

  const toggleHold = useCallback(() => {
    if (!activeCallRef.current) return;
    if (call.isHeld) {
      activeCallRef.current.unhold();
    } else {
      activeCallRef.current.hold();
    }
    setCall((prev) => ({ ...prev, isHeld: !prev.isHeld }));
  }, [call.isHeld]);

  const sendDTMF = useCallback((digit: string) => {
    if (activeCallRef.current) {
      activeCallRef.current.dtmf(digit);
    }
  }, []);

  const transfer = useCallback((destination: string) => {
    if (activeCallRef.current) {
      activeCallRef.current.transfer(destination);
    }
  }, []);

  return {
    isRegistered,
    isConnecting,
    call,
    error,
    connect,
    disconnect,
    makeCall,
    answerCall,
    hangup,
    toggleMute,
    toggleHold,
    sendDTMF,
    transfer,
  };
}
