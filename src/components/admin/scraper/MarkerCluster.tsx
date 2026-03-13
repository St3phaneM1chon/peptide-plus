'use client';

/**
 * MarkerCluster — Wraps child AdvancedMarker components with @googlemaps/markerclusterer.
 * Automatically clusters markers when zoomed out.
 */

import { useMap } from '@vis.gl/react-google-maps';
import { MarkerClusterer as GMMarkerClusterer } from '@googlemaps/markerclusterer';
import {
  type ReactNode,
  useEffect,
  useRef,
  createContext,
  useContext,
  useCallback,
  useState,
} from 'react';

interface ClusterContextValue {
  addMarker: (marker: google.maps.marker.AdvancedMarkerElement) => void;
  removeMarker: (marker: google.maps.marker.AdvancedMarkerElement) => void;
}

const ClusterContext = createContext<ClusterContextValue | null>(null);

export function useCluster() {
  return useContext(ClusterContext);
}

interface MarkerClusterProps {
  children: ReactNode;
}

export default function MarkerCluster({ children }: MarkerClusterProps) {
  const map = useMap();
  const clustererRef = useRef<GMMarkerClusterer | null>(null);
  const [markers, setMarkers] = useState<Set<google.maps.marker.AdvancedMarkerElement>>(new Set());

  // Initialize clusterer
  useEffect(() => {
    if (!map) return;

    if (!clustererRef.current) {
      clustererRef.current = new GMMarkerClusterer({
        map,
        markers: [],
        renderer: {
          render: ({ count, position }) => {
            const el = document.createElement('div');
            el.className = 'cluster-marker';
            el.style.cssText = `
              display: flex; align-items: center; justify-content: center;
              width: ${32 + Math.min(count, 100) * 0.2}px;
              height: ${32 + Math.min(count, 100) * 0.2}px;
              border-radius: 50%;
              background: rgba(59, 130, 246, 0.85);
              border: 3px solid rgba(255, 255, 255, 0.9);
              color: white; font-weight: 700; font-size: 13px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              cursor: pointer;
            `;
            el.textContent = count > 99 ? '99+' : String(count);

            return new google.maps.marker.AdvancedMarkerElement({
              position,
              content: el,
            });
          },
        },
      });
    }

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
      }
    };
  }, [map]);

  // Sync markers with clusterer
  useEffect(() => {
    if (!clustererRef.current) return;
    clustererRef.current.clearMarkers();
    clustererRef.current.addMarkers(Array.from(markers));
  }, [markers]);

  const addMarker = useCallback((marker: google.maps.marker.AdvancedMarkerElement) => {
    setMarkers(prev => {
      const next = new Set(prev);
      next.add(marker);
      return next;
    });
  }, []);

  const removeMarker = useCallback((marker: google.maps.marker.AdvancedMarkerElement) => {
    setMarkers(prev => {
      const next = new Set(prev);
      next.delete(marker);
      return next;
    });
  }, []);

  return (
    <ClusterContext.Provider value={{ addMarker, removeMarker }}>
      {children}
    </ClusterContext.Provider>
  );
}
