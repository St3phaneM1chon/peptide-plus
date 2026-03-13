'use client';

/**
 * MapProvider — @vis.gl/react-google-maps APIProvider wrapper.
 * Provides Google Maps API context to all child map components.
 */

import { APIProvider } from '@vis.gl/react-google-maps';
import { type ReactNode } from 'react';

interface MapProviderProps {
  children: ReactNode;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default function MapProvider({ children }: MapProviderProps) {
  if (!API_KEY) {
    return (
      <div className="flex items-center justify-center h-64 bg-zinc-800/50 rounded-xl border border-zinc-700/50 text-zinc-500 text-sm">
        Google Maps API key not configured (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={API_KEY}
      libraries={['places', 'drawing', 'visualization', 'geocoding']}
    >
      {children}
    </APIProvider>
  );
}
