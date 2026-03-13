'use client';

/**
 * HeatmapLayer — Google Maps heatmap visualization based on result density.
 * Weight = rating * reviewCount for quality-weighted density.
 */

import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';
import type { ScrapedPlace } from './types';

interface HeatmapLayerProps {
  places: ScrapedPlace[];
}

export default function HeatmapLayer({ places }: HeatmapLayerProps) {
  const map = useMap();
  const vizLib = useMapsLibrary('visualization');
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  useEffect(() => {
    if (!map || !vizLib || typeof google === 'undefined') return;

    // Build weighted data points
    const data = places
      .filter(p => p.latitude != null && p.longitude != null)
      .map(p => {
        const rating = p.googleRating ?? 3;
        const reviews = p.googleReviewCount ?? 1;
        const weight = rating * Math.log10(Math.max(reviews, 1) + 1);
        return {
          location: new google.maps.LatLng(p.latitude!, p.longitude!),
          weight: Math.max(weight, 0.5),
        };
      });

    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
    }

    const heatmap = new google.maps.visualization.HeatmapLayer({
      data,
      map,
      radius: 40,
      opacity: 0.6,
      gradient: [
        'rgba(0, 0, 0, 0)',
        'rgba(59, 130, 246, 0.4)',
        'rgba(59, 130, 246, 0.6)',
        'rgba(16, 185, 129, 0.7)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(239, 68, 68, 0.9)',
      ],
    });

    heatmapRef.current = heatmap;

    return () => {
      heatmap.setMap(null);
      heatmapRef.current = null;
    };
  }, [map, vizLib, places]);

  return null; // This component manages the heatmap layer directly
}
