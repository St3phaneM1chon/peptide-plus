'use client';

/**
 * MapSelector
 * Interactive Google Maps component for selecting a search area.
 * Click on the map to place a marker, drag the radius circle to adjust.
 * Returns lat/lng/radius to the parent for scraper search.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, X, Minus, Plus } from 'lucide-react';

interface MapSelectorProps {
  onSelect: (selection: { latitude: number; longitude: number; radius: number; label: string } | null) => void;
  /** Google Maps API key (client-side) */
  apiKey: string | undefined;
}

/** Radius presets in meters */
const RADIUS_PRESETS = [
  { label: '500m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
  { label: '50 km', value: 50000 },
];

/** Default center: Montreal */
const DEFAULT_CENTER = { lat: 45.5017, lng: -73.5673 };
const DEFAULT_ZOOM = 11;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GMap = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GMarker = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GCircle = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GGeocoder = any;

export default function MapSelector({ onSelect, apiKey }: MapSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GMap>(null);
  const markerRef = useRef<GMarker>(null);
  const circleRef = useRef<GCircle>(null);
  const geocoderRef = useRef<GGeocoder>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(5000);
  const [locationLabel, setLocationLabel] = useState('');

  /** Load Google Maps JS API */
  const loadGoogleMaps = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Already loaded
    if ((window as any).google?.maps) {
      setIsLoaded(true);
      return;
    }

    if (!apiKey) {
      setLoadError('Google Maps API key not configured');
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geocoding`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => setLoadError('Failed to load Google Maps');
    document.head.appendChild(script);
  }, [apiKey]);

  /** Initialize map when opened and API loaded */
  useEffect(() => {
    if (!isOpen || !isLoaded || !mapRef.current || mapInstanceRef.current) return;

    const map = new (window as any).google.maps.Map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: (window as any).google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        position: (window as any).google.maps.ControlPosition.TOP_RIGHT,
      },
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    });

    mapInstanceRef.current = map;
    geocoderRef.current = new (window as any).google.maps.Geocoder();

    // Try to center on user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userCenter = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          map.setCenter(userCenter);
        },
        () => {}, // Ignore errors, keep default center
        { timeout: 5000 },
      );
    }

    // Click handler to place marker
    map.addListener('click', (e: any) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      placeMarker({ lat, lng });
    });
  }, [isOpen, isLoaded]);

  /** Place or move the marker and circle */
  const placeMarker = useCallback((point: { lat: number; lng: number }) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setSelectedPoint(point);

    // Update or create marker
    if (markerRef.current) {
      markerRef.current.setPosition(point);
    } else {
      markerRef.current = new (window as any).google.maps.Marker({
        position: point,
        map,
        draggable: true,
        animation: (window as any).google.maps.Animation.DROP,
        title: 'Search center',
      });

      // Drag handler
      markerRef.current.addListener('dragend', () => {
        const pos = markerRef.current?.getPosition();
        if (pos) {
          const newPoint = { lat: pos.lat(), lng: pos.lng() };
          setSelectedPoint(newPoint);
          if (circleRef.current) {
            circleRef.current.setCenter(newPoint);
          }
          reverseGeocode(newPoint);
        }
      });
    }

    // Update or create circle
    if (circleRef.current) {
      circleRef.current.setCenter(point);
      circleRef.current.setRadius(radius);
    } else {
      circleRef.current = new (window as any).google.maps.Circle({
        map,
        center: point,
        radius,
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.6,
        strokeWeight: 2,
        editable: true,
      });

      // Circle radius changed by user dragging
      circleRef.current.addListener('radius_changed', () => {
        const newRadius = circleRef.current?.getRadius();
        if (newRadius) {
          setRadius(Math.round(Math.min(50000, Math.max(100, newRadius))));
        }
      });

      // Circle center changed by user dragging
      circleRef.current.addListener('center_changed', () => {
        const center = circleRef.current?.getCenter();
        if (center) {
          const newPoint = { lat: center.lat(), lng: center.lng() };
          setSelectedPoint(newPoint);
          markerRef.current?.setPosition(newPoint);
          reverseGeocode(newPoint);
        }
      });
    }

    // Reverse geocode to get location name
    reverseGeocode(point);

    // Fit map to circle bounds
    const bounds = circleRef.current?.getBounds();
    if (bounds) {
      map.fitBounds(bounds);
    }
  }, [radius]);

  /** Update circle radius when state changes */
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius);
      // Re-fit map to new circle bounds
      const bounds = circleRef.current.getBounds();
      if (bounds && mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(bounds);
      }
    }
  }, [radius]);

  /** Reverse geocode to get a readable location name */
  const reverseGeocode = useCallback((point: { lat: number; lng: number }) => {
    if (!geocoderRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geocoderRef.current.geocode({ location: point }, (results: any, status: any) => {
      if (status === 'OK' && results?.[0]) {
        // Find the best locality name
        const locality = results.find((r: any) => r.types.includes('locality'));
        const area = results.find((r: any) => r.types.includes('administrative_area_level_2'));
        const result = locality || area || results[0];
        setLocationLabel(result.formatted_address);
      } else {
        setLocationLabel(`${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`);
      }
    });
  }, []);

  /** Confirm selection */
  const handleConfirm = useCallback(() => {
    if (!selectedPoint) return;
    onSelect({
      latitude: selectedPoint.lat,
      longitude: selectedPoint.lng,
      radius,
      label: locationLabel || `${selectedPoint.lat.toFixed(4)}, ${selectedPoint.lng.toFixed(4)}`,
    });
    setIsOpen(false);
  }, [selectedPoint, radius, locationLabel, onSelect]);

  /** Clear selection */
  const handleClear = useCallback(() => {
    onSelect(null);
    setSelectedPoint(null);
    setLocationLabel('');
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }
  }, [onSelect]);

  /** Format radius for display */
  const formatRadius = (r: number) => {
    if (r >= 1000) return `${(r / 1000).toFixed(r % 1000 === 0 ? 0 : 1)} km`;
    return `${r} m`;
  };

  return (
    <div>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => {
          if (!isOpen) loadGoogleMaps();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-700/50 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-600/50 hover:text-white transition-colors"
      >
        <MapPin className="h-4 w-4" />
        {selectedPoint
          ? locationLabel || `${selectedPoint.lat.toFixed(4)}, ${selectedPoint.lng.toFixed(4)}`
          : 'Choisir sur la carte'
        }
        {selectedPoint && (
          <span className="text-xs text-blue-400">({formatRadius(radius)})</span>
        )}
      </button>

      {/* Clear button */}
      {selectedPoint && (
        <button
          type="button"
          onClick={handleClear}
          className="ml-2 p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-700/50 transition-colors"
          title="Effacer la zone"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Map panel */}
      {isOpen && (
        <div className="mt-3 rounded-xl border border-zinc-700/50 bg-zinc-800/80 overflow-hidden">
          {loadError ? (
            <div className="p-8 text-center text-sm text-red-400">{loadError}</div>
          ) : !isLoaded ? (
            <div className="p-8 text-center text-sm text-zinc-500">Chargement de la carte...</div>
          ) : (
            <>
              {/* Map */}
              <div ref={mapRef} className="w-full h-[400px]" />

              {/* Controls */}
              <div className="p-3 space-y-3 border-t border-zinc-700/50">
                {/* Instructions */}
                {!selectedPoint && (
                  <p className="text-xs text-zinc-500 text-center">
                    Cliquez sur la carte pour placer un marqueur de recherche
                  </p>
                )}

                {/* Radius control */}
                {selectedPoint && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-400">
                        Rayon: {formatRadius(radius)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {locationLabel}
                      </span>
                    </div>

                    {/* Radius slider */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRadius((r) => Math.max(100, r - (r > 5000 ? 5000 : 500)))}
                        className="p-1 rounded bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="range"
                        min={100}
                        max={50000}
                        step={100}
                        value={radius}
                        onChange={(e) => setRadius(Number(e.target.value))}
                        className="flex-1 accent-blue-500 h-1.5"
                      />
                      <button
                        type="button"
                        onClick={() => setRadius((r) => Math.min(50000, r + (r >= 5000 ? 5000 : 500)))}
                        className="p-1 rounded bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Radius presets */}
                    <div className="flex flex-wrap gap-1.5">
                      {RADIUS_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setRadius(preset.value)}
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            radius === preset.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Confirm */}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        Confirmer cette zone
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-2 rounded-lg border border-zinc-600 text-zinc-400 text-sm hover:bg-zinc-700 transition-colors"
                      >
                        Fermer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
