'use client';

/**
 * StreetViewPanel — Overlay panel showing Google Street View panorama.
 * Opens from a marker click or toolbar button.
 */

import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { X, AlertTriangle } from 'lucide-react';

interface StreetViewPanelProps {
  position: { lat: number; lng: number };
  placeName: string;
  onClose: () => void;
}

export default function StreetViewPanel({ position, placeName, onClose }: StreetViewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const streetViewLib = useMapsLibrary('streetView');
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!containerRef.current || typeof google === 'undefined') return;
    setUnavailable(false);

    const panorama = new google.maps.StreetViewPanorama(containerRef.current, {
      position,
      pov: { heading: 0, pitch: 0 },
      zoom: 1,
      addressControl: true,
      enableCloseButton: false,
      fullscreenControl: true,
      motionTracking: false,
      motionTrackingControl: false,
    });

    panoramaRef.current = panorama;

    // Check if Street View is available at this location
    const svService = new google.maps.StreetViewService();
    svService.getPanorama(
      { location: position, radius: 100 },
      (data, status) => {
        if (status !== google.maps.StreetViewStatus.OK) {
          // Try with larger radius
          svService.getPanorama(
            { location: position, radius: 500 },
            (_data2, status2) => {
              if (status2 !== google.maps.StreetViewStatus.OK) {
                setUnavailable(true);
              }
            },
          );
        }
      },
    );

    return () => {
      panoramaRef.current = null;
    };
  }, [position]);

  return (
    <div className="absolute inset-y-0 right-0 w-1/2 max-w-lg z-20 flex flex-col bg-zinc-900 border-l border-zinc-700/50 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-700/50 bg-zinc-800/80">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{placeName}</h3>
          <p className="text-xs text-zinc-500">Street View</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Unavailable message */}
      {unavailable && (
        <div className="absolute inset-0 top-12 flex flex-col items-center justify-center bg-zinc-900/90 z-10 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400 mb-3" />
          <p className="text-sm font-medium text-zinc-200 mb-1">Street View unavailable</p>
          <p className="text-xs text-zinc-500 mb-4">No coverage at this location</p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-700 text-xs text-zinc-300 hover:bg-zinc-600 transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* Panorama container */}
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
