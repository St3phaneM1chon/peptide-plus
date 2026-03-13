'use client';

/**
 * ProspectMarker — AdvancedMarker with category-based icons and CRM status colors.
 */

import { useEffect, useRef, useCallback } from 'react';
import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { useCluster } from './MarkerCluster';
import type { ScrapedPlace } from './types';

interface ProspectMarkerProps {
  place: ScrapedPlace;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
}

/** Category → emoji icon mapping */
function getCategoryIcon(category: string | null): string {
  if (!category) return '\u{1F4CD}'; // pin
  const cat = category.toLowerCase();
  if (cat.includes('restaurant') || cat.includes('café') || cat.includes('cafe')) return '\u{1F37D}';
  if (cat.includes('clinique') || cat.includes('clinic') || cat.includes('médecin') || cat.includes('doctor')) return '\u{1FA7A}';
  if (cat.includes('dentist')) return '\u{1F9B7}';
  if (cat.includes('pharmacie') || cat.includes('pharmacy')) return '\u{1F48A}';
  if (cat.includes('hôtel') || cat.includes('hotel') || cat.includes('hébergement')) return '\u{1F3E8}';
  if (cat.includes('gym') || cat.includes('fitness') || cat.includes('sport')) return '\u{1F4AA}';
  if (cat.includes('salon') || cat.includes('coiffure') || cat.includes('beauty')) return '\u{1F487}';
  if (cat.includes('garage') || cat.includes('auto') || cat.includes('mécanique')) return '\u{1F697}';
  if (cat.includes('école') || cat.includes('school') || cat.includes('university')) return '\u{1F393}';
  if (cat.includes('avocat') || cat.includes('lawyer') || cat.includes('notaire')) return '\u{2696}';
  if (cat.includes('banque') || cat.includes('bank') || cat.includes('financial')) return '\u{1F3E6}';
  if (cat.includes('magasin') || cat.includes('store') || cat.includes('shop') || cat.includes('boutique')) return '\u{1F6CD}';
  if (cat.includes('labo') || cat.includes('lab') || cat.includes('research')) return '\u{1F52C}';
  if (cat.includes('bar') || cat.includes('pub') || cat.includes('brasserie')) return '\u{1F37A}';
  return '\u{1F4CD}';
}

/** Get marker background color based on selection state */
function getMarkerStyle(isSelected: boolean, isActive: boolean, hasEmail: boolean) {
  if (isActive) return { bg: 'bg-blue-500', ring: 'ring-2 ring-white', scale: 'scale-125' };
  if (isSelected) return { bg: 'bg-green-500', ring: 'ring-2 ring-green-300', scale: 'scale-110' };
  if (hasEmail) return { bg: 'bg-amber-500', ring: '', scale: '' };
  return { bg: 'bg-zinc-600', ring: '', scale: '' };
}

export default function ProspectMarker({ place, isSelected, isActive, onClick }: ProspectMarkerProps) {
  const cluster = useCluster();
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  // Register/unregister with cluster
  useEffect(() => {
    if (!cluster || !markerRef.current) return;
    const marker = markerRef.current;
    cluster.addMarker(marker);
    return () => { cluster.removeMarker(marker); };
  }, [cluster]);

  const setRef = useCallback((marker: google.maps.marker.AdvancedMarkerElement | null) => {
    markerRef.current = marker;
  }, []);

  if (place.latitude == null || place.longitude == null) return null;

  const icon = getCategoryIcon(place.category);
  const style = getMarkerStyle(isSelected, isActive, !!place.email);

  return (
    <AdvancedMarker
      ref={setRef}
      position={{ lat: place.latitude, lng: place.longitude }}
      onClick={onClick}
      title={place.name}
    >
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full ${style.bg} ${style.ring} ${style.scale} shadow-lg cursor-pointer transition-all duration-200 hover:scale-110`}
      >
        <span className="text-sm leading-none">{icon}</span>
      </div>
    </AdvancedMarker>
  );
}
