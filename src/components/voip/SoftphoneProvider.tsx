'use client';

/**
 * SoftphoneProvider
 * React context that wraps the useVoip hook for global access.
 * Place in admin layout to make softphone state available everywhere.
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import { useVoip, type UseVoipReturn } from '@/hooks/useVoip';

const SoftphoneContext = createContext<UseVoipReturn | null>(null);

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const voip = useVoip();

  return (
    <SoftphoneContext.Provider value={voip}>
      {children}
    </SoftphoneContext.Provider>
  );
}

export function useSoftphone(): UseVoipReturn {
  const ctx = useContext(SoftphoneContext);
  if (!ctx) {
    throw new Error('useSoftphone must be used within SoftphoneProvider');
  }
  return ctx;
}
