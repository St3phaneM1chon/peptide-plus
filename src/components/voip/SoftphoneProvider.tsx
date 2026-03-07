'use client';

/**
 * SoftphoneProvider
 * React context that wraps the useVoip hook for global access.
 * Place in admin layout to make softphone state available everywhere.
 *
 * Auto-registers the softphone line when an EMPLOYEE or OWNER opens a session.
 * If the line fails to initialize, sends an email alert to all OWNERs.
 */

import React, { createContext, useContext, useEffect, useRef, useCallback, useState, type ReactNode } from 'react';
import { useVoip, type UseVoipReturn } from '@/hooks/useVoip';

interface SoftphoneContextValue extends UseVoipReturn {
  /** Whether auto-registration has been attempted */
  autoRegisterAttempted: boolean;
  /** Error from the auto-register health check */
  healthError: string | null;
  /** Force a manual re-registration attempt */
  retryRegister: () => void;
}

const SoftphoneContext = createContext<SoftphoneContextValue | null>(null);

/** Max retries for auto-registration */
const MAX_AUTO_RETRIES = 2;
/** Delay between retries (ms) */
const RETRY_DELAY_MS = 5000;

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const voip = useVoip();
  const [autoRegisterAttempted, setAutoRegisterAttempted] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const attemptCountRef = useRef(0);
  const alertSentRef = useRef(false);
  const mountedRef = useRef(true);

  /** Send failure alert to all owners */
  const sendFailureAlert = useCallback(async (errorMessage: string, checks?: Record<string, { ok: boolean; detail?: string }>) => {
    if (alertSentRef.current) return; // Only alert once per session
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

  /** Attempt auto-registration with health check */
  const attemptAutoRegister = useCallback(async () => {
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

      if (!health.canAutoRegister) {
        // Identify specific failure reasons
        const reasons: string[] = [];
        if (health.database === 'error') reasons.push('Base de données inaccessible');
        if (!health.sipExtension?.configured) reasons.push('Aucune extension SIP assignée à cet utilisateur');
        if (!health.pbx?.provider) reasons.push('Aucune connexion VoIP configurée');

        const msg = reasons.length > 0
          ? reasons.join('; ')
          : 'Impossible d\'initialiser la ligne téléphonique';

        setHealthError(msg);
        await sendFailureAlert(msg, health.checks);
        return;
      }

      setHealthError(null);

      // 2. Register the softphone line
      await voip.register();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec de connexion au serveur VoIP';
      setHealthError(msg);
      await sendFailureAlert(msg);
    }
  }, [voip, sendFailureAlert]);

  /** Auto-register on mount */
  useEffect(() => {
    mountedRef.current = true;

    const doAutoRegister = async () => {
      // Small delay to let the session/layout fully initialize
      await new Promise((r) => setTimeout(r, 1500));

      if (!mountedRef.current) return;

      await attemptAutoRegister();
      setAutoRegisterAttempted(true);
    };

    doAutoRegister();

    return () => {
      mountedRef.current = false;
    };
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Watch for registration failure and retry */
  useEffect(() => {
    if (!autoRegisterAttempted) return undefined;

    if (voip.status === 'error' && attemptCountRef.current < MAX_AUTO_RETRIES) {
      attemptCountRef.current++;
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          attemptAutoRegister();
        }
      }, RETRY_DELAY_MS);
      return () => clearTimeout(timer);
    }

    // All retries exhausted, still in error — send alert
    if (voip.status === 'error' && attemptCountRef.current >= MAX_AUTO_RETRIES) {
      const msg = voip.error || 'Échec de l\'enregistrement SIP après plusieurs tentatives';
      sendFailureAlert(msg);
    }

    return undefined;
  }, [voip.status, voip.error, autoRegisterAttempted, attemptAutoRegister, sendFailureAlert]);

  /** Manual retry */
  const retryRegister = useCallback(() => {
    attemptCountRef.current = 0;
    alertSentRef.current = false;
    setHealthError(null);
    attemptAutoRegister();
  }, [attemptAutoRegister]);

  const value: SoftphoneContextValue = {
    ...voip,
    autoRegisterAttempted,
    healthError,
    retryRegister,
  };

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
