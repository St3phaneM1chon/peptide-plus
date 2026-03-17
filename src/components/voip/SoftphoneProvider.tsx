'use client';

/**
 * SoftphoneProvider
 * React context that wraps the Telnyx WebRTC SDK for global softphone access.
 * Place in admin layout to make softphone state available everywhere.
 *
 * On mount: health check → fetch WebRTC JWT → connect TelnyxRTC.
 * Bridges useTelnyxWebRTC into the UseVoipReturn interface expected by Softphone.tsx.
 */

import React, { createContext, useContext, useEffect, useRef, useCallback, useState, useMemo, type ReactNode } from 'react';
import { useTelnyxWebRTC } from '@/hooks/useTelnyxWebRTC';
import type { UseVoipReturn, VoipCall, VoipStatus, RegisteredExtension } from '@/hooks/useVoip';
import { addCSRFHeader } from '@/lib/csrf';
import { useI18n } from '@/i18n/client';

export interface HealthInfo {
  database: string;
  sipExtension: { configured: boolean; extensionNumber?: string; domain?: string; registered?: boolean } | null;
  pbx: { provider?: string; host?: string } | null;
}

interface SoftphoneContextValue extends UseVoipReturn {
  /** Whether auto-registration has been attempted */
  autoRegisterAttempted: boolean;
  /** Error from the auto-register health check */
  healthError: string | null;
  /** Health check data from the server */
  healthInfo: HealthInfo | null;
  /** Force a manual re-registration attempt */
  retryRegister: () => void;
}

const SoftphoneContext = createContext<SoftphoneContextValue | null>(null);

/** Max retries for auto-registration */
const MAX_AUTO_RETRIES = 2;
/** Delay between retries (ms) */
const RETRY_DELAY_MS = 5000;

// No-op async for stubs
const asyncNoop = async () => {};
const noop = () => {};

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const telnyx = useTelnyxWebRTC();
  const { t } = useI18n();
  const [autoRegisterAttempted, setAutoRegisterAttempted] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null);
  const [regExtension, setRegExtension] = useState<RegisteredExtension | null>(null);
  const attemptCountRef = useRef(0);
  const alertSentRef = useRef(false);
  const mountedRef = useRef(true);

  // ---- Derived VoIP status ----
  const status: VoipStatus = useMemo(() => {
    if (telnyx.error) return 'error';
    if (telnyx.isRegistered) return 'registered';
    if (telnyx.isConnecting) return 'connecting';
    return 'disconnected';
  }, [telnyx.isRegistered, telnyx.isConnecting, telnyx.error]);

  // ---- Bridge TelnyxCallInfo → VoipCall ----
  const currentCall: VoipCall | null = useMemo(() => {
    if (telnyx.call.state === 'idle' || !telnyx.call.callId) return null;

    // Map TelnyxCallInfo states to VoipCall CallState
    let callState: VoipCall['state'] = 'idle';
    switch (telnyx.call.state) {
      case 'connecting':
      case 'dialing':
        callState = 'calling';
        break;
      case 'ringing':
        callState = 'ringing';
        break;
      case 'active':
        callState = 'in_progress';
        break;
      case 'held':
        callState = 'on_hold';
        break;
      case 'ending':
        callState = 'ended';
        break;
    }

    return {
      id: telnyx.call.callId,
      direction: telnyx.call.direction || 'outbound',
      remoteNumber: telnyx.call.callerNumber || '',
      remoteName: telnyx.call.callerName || null,
      state: callState,
      startTime: callState !== 'idle' ? new Date() : null,
      answerTime: callState === 'in_progress' ? new Date() : null,
      isMuted: telnyx.call.isMuted,
      isOnHold: telnyx.call.isHeld,
      lineNumber: 1,
      isParked: false,
      parkOrbit: null,
      cnamInfo: null,
      isRecording: telnyx.call.isRecording,
    };
  }, [telnyx.call]);

  const calls: VoipCall[] = useMemo(() => currentCall ? [currentCall] : [], [currentCall]);
  const focusedCallId = currentCall?.id ?? null;

  // ---- Send failure alert to all owners ----
  const sendFailureAlert = useCallback(async (errorMessage: string, checks?: Record<string, { ok: boolean; detail?: string }>) => {
    if (alertSentRef.current) return;
    alertSentRef.current = true;
    try {
      await fetch('/api/admin/voip/alert-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errorMessage, checks }),
      });
    } catch {
      // Alert is best-effort
    }
  }, []);

  // ---- Fetch WebRTC token and connect ----
  const fetchTokenAndConnect = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/voip/webrtc-token', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Token fetch failed' }));
        throw new Error(errBody?.error || `Token request failed (${res.status})`);
      }

      const json = await res.json();
      // apiSuccess wraps in { success, data, meta }
      const tokenData = json.data || json;
      const token = tokenData.token;

      if (!token) {
        throw new Error('No WebRTC token in response');
      }

      // Save extension info
      if (tokenData.sip_username) {
        setRegExtension({
          extension: tokenData.sip_username,
          sipDomain: 'sip.telnyx.com',
        });
      }

      // Connect TelnyxRTC SDK
      telnyx.connect(token);
    } catch (err) {
      throw err;
    }
  }, [telnyx]);

  // ---- register(): health check → token → connect ----
  const register = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      // 1. Health check
      const healthRes = await fetch('/api/admin/voip/health');
      if (!healthRes.ok) {
        const msg = 'VoIP health check endpoint unreachable';
        setHealthError(msg);
        await sendFailureAlert(msg);
        return;
      }

      const health = await healthRes.json();

      setHealthInfo({
        database: health.database || 'unknown',
        sipExtension: health.sipExtension || null,
        pbx: health.pbx || null,
      });

      if (!health.canAutoRegister) {
        const reasons: string[] = [];
        if (health.database === 'error') reasons.push(t('voip.dbUnavailable'));
        if (!health.sipExtension?.configured) reasons.push(t('voip.noSipExtension'));
        if (!health.pbx?.provider) reasons.push(t('voip.noVoipConnection'));

        const msg = reasons.length > 0 ? reasons.join('; ') : t('voip.initFailed');
        setHealthError(msg);
        await sendFailureAlert(msg, health.checks);
        return;
      }

      setHealthError(null);

      // 2. Fetch WebRTC token and connect
      await fetchTokenAndConnect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('voip.connectionFailed');
      setHealthError(msg);
      await sendFailureAlert(msg);
    }
  }, [fetchTokenAndConnect, sendFailureAlert, t]);

  // ---- unregister ----
  const unregister = useCallback(() => {
    telnyx.disconnect();
    setRegExtension(null);
  }, [telnyx]);

  // ---- Auto-register on mount ----
  useEffect(() => {
    mountedRef.current = true;

    const doAutoRegister = async () => {
      await new Promise((r) => setTimeout(r, 1500));
      if (!mountedRef.current) return;
      await register();
      setAutoRegisterAttempted(true);
    };

    doAutoRegister();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Retry on registration failure ----
  useEffect(() => {
    if (!autoRegisterAttempted) return undefined;

    if (status === 'error' && attemptCountRef.current < MAX_AUTO_RETRIES) {
      attemptCountRef.current++;
      const timer = setTimeout(() => {
        if (mountedRef.current) register();
      }, RETRY_DELAY_MS);
      return () => clearTimeout(timer);
    }

    if (status === 'error' && attemptCountRef.current >= MAX_AUTO_RETRIES) {
      const msg = telnyx.error || t('voip.registrationFailed');
      sendFailureAlert(msg);
    }

    return undefined;
  }, [status, telnyx.error, autoRegisterAttempted, register, sendFailureAlert, t]);

  // ---- Manual retry ----
  const retryRegister = useCallback(() => {
    attemptCountRef.current = 0;
    alertSentRef.current = false;
    setHealthError(null);
    register();
  }, [register]);

  // ---- Bridged call controls ----
  const makeCall = useCallback((number: string) => {
    telnyx.makeCall(number);
  }, [telnyx]);

  const answerCall = useCallback((_callId?: string) => {
    telnyx.answerCall();
  }, [telnyx]);

  const hangup = useCallback((_callId?: string) => {
    telnyx.hangup();
  }, [telnyx]);

  const toggleMute = useCallback(() => {
    telnyx.toggleMute();
  }, [telnyx]);

  const toggleHold = useCallback(() => {
    telnyx.toggleHold();
  }, [telnyx]);

  const sendDtmf = useCallback((digit: string) => {
    telnyx.sendDTMF(digit);
  }, [telnyx]);

  const transfer = useCallback((number: string) => {
    telnyx.transfer(number);
  }, [telnyx]);

  // ---- Build the full UseVoipReturn-compatible context ----
  const value: SoftphoneContextValue = useMemo(() => ({
    // Core state
    status,
    calls,
    focusedCallId,
    currentCall,
    error: telnyx.error || healthError,
    registeredExtension: regExtension,

    // Media features (not available via basic Telnyx WebRTC — stubbed)
    noiseCancelEnabled: false,
    isScreenSharing: false,
    isVideoEnabled: false,
    localVideoStream: null,
    remoteVideoStream: null,
    callQualityMetrics: null,
    presenceStatus: 'available' as const,

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

    // Multi-line (single-line via Telnyx SDK)
    switchLine: noop,

    // Parking (not implemented at SDK level)
    parkCall: asyncNoop,
    retrieveParkedCall: asyncNoop,

    // Call flip (not implemented at SDK level)
    flipCall: asyncNoop,

    // Call pickup (not implemented at SDK level)
    pickupCall: asyncNoop,
    groupPickup: asyncNoop,

    // Conference (not implemented at SDK level)
    startConference: asyncNoop,

    // Media features (not implemented at SDK level)
    toggleNoiseCancel: noop,
    toggleRecording: asyncNoop,
    screenShare: asyncNoop,
    stopScreenShare: noop,
    toggleVideo: asyncNoop,

    // Presence
    setPresence: noop,

    // Quality
    getLastCallQualityHistory: () => null,

    // Provider-specific
    autoRegisterAttempted,
    healthError,
    healthInfo,
    retryRegister,
  }), [
    status, calls, focusedCallId, currentCall, telnyx.error, healthError, regExtension,
    register, unregister, makeCall, answerCall, hangup, toggleMute, toggleHold, sendDtmf, transfer,
    autoRegisterAttempted, healthInfo, retryRegister,
  ]);

  return (
    <SoftphoneContext.Provider value={value}>
      {children}
    </SoftphoneContext.Provider>
  );
}

export function useSoftphone(): SoftphoneContextValue {
  const ctx = useContext(SoftphoneContext);
  if (!ctx) {
    throw new Error('useSoftphone must be used within SoftphoneProvider');
  }
  return ctx;
}
