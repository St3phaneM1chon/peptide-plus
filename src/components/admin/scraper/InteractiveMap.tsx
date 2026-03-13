'use client';

/**
 * InteractiveMap — Full-featured Google Maps component using @vis.gl/react-google-maps.
 * Replaces the basic MapSelector with AdvancedMarkers, clustering, drawing tools,
 * Street View, and heatmap support.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Map,
  useMap,
  useMapsLibrary,
  MapCameraChangedEvent,
} from '@vis.gl/react-google-maps';
import ProspectMarker from './ProspectMarker';
import ProspectInfoWindow from './ProspectInfoWindow';
import MarkerCluster from './MarkerCluster';
import DrawingTools, { type DrawnShape } from './DrawingTools';
import StreetViewPanel from './StreetViewPanel';
import HeatmapLayer from './HeatmapLayer';
import type { ScrapedPlace, ProspectCrmStatus } from './types';
import { getPlaceId } from './types';

interface InteractiveMapProps {
  results: ScrapedPlace[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onShapeDrawn: (shape: DrawnShape | null) => void;
  onAddToCrm: (place: ScrapedPlace) => void;
  crmLoading?: boolean;
  drawingMode: boolean;
  showHeatmap: boolean;
  showStreetView: boolean;
  streetViewTarget: ScrapedPlace | null;
  onCloseStreetView: () => void;
  highlightedPlace?: ScrapedPlace | null;
  onHighlightHandled?: () => void;
}

const DEFAULT_CENTER = { lat: 45.5017, lng: -73.5673 };
const DEFAULT_ZOOM = 11;
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

export default function InteractiveMap({
  results,
  selectedIds,
  onToggleSelect,
  onShapeDrawn,
  onAddToCrm,
  crmLoading,
  drawingMode,
  showHeatmap,
  showStreetView,
  streetViewTarget,
  onCloseStreetView,
  highlightedPlace,
  onHighlightHandled,
}: InteractiveMapProps) {
  const map = useMap();
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);

  // Auto-fit map to results when they change
  useEffect(() => {
    if (!map || results.length === 0) return;

    const validResults = results.filter(r => r.latitude != null && r.longitude != null);
    if (validResults.length === 0) return;

    if (validResults.length === 1) {
      map.panTo({ lat: validResults[0].latitude!, lng: validResults[0].longitude! });
      map.setZoom(15);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const r of validResults) {
      bounds.extend({ lat: r.latitude!, lng: r.longitude! });
    }
    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  }, [map, results]);

  // Stable ref for onHighlightHandled to avoid infinite re-render loop
  const onHighlightHandledRef = useRef(onHighlightHandled);
  onHighlightHandledRef.current = onHighlightHandled;

  // Handle highlight from ResultsList click — pan to place + open InfoWindow
  useEffect(() => {
    if (!map || !highlightedPlace || highlightedPlace.latitude == null || highlightedPlace.longitude == null) return;
    map.panTo({ lat: highlightedPlace.latitude, lng: highlightedPlace.longitude });
    if (map.getZoom()! < 15) map.setZoom(15);
    setActiveMarker(getPlaceId(highlightedPlace));
    onHighlightHandledRef.current?.();
  }, [map, highlightedPlace]);

  const handleCameraChange = useCallback((ev: MapCameraChangedEvent) => {
    const detail = ev.detail;
    setMapCenter(detail.center);
    setMapZoom(detail.zoom);
  }, []);

  const handleMarkerClick = useCallback((placeId: string) => {
    setActiveMarker(prev => prev === placeId ? null : placeId);
  }, []);

  const activePlace = useMemo(
    () => results.find(r => getPlaceId(r) === activeMarker),
    [results, activeMarker],
  );

  // Markers with geo coordinates
  const geoResults = useMemo(
    () => results.filter(r => r.latitude != null && r.longitude != null),
    [results],
  );

  return (
    <div className="relative w-full h-full">
      <Map
        mapId={MAP_ID}
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI={false}
        zoomControl={true}
        fullscreenControl={true}
        mapTypeControl={true}
        streetViewControl={false}
        onCameraChanged={handleCameraChange}
        className="w-full h-full rounded-xl"
      >
        {/* Marker Cluster wraps individual markers */}
        <MarkerCluster>
          {geoResults.map((place) => {
            const id = getPlaceId(place);
            return (
              <ProspectMarker
                key={id}
                place={place}
                isSelected={selectedIds.has(id)}
                isActive={activeMarker === id}
                onClick={() => handleMarkerClick(id)}
              />
            );
          })}
        </MarkerCluster>

        {/* Info Window for active marker */}
        {activePlace && activePlace.latitude != null && activePlace.longitude != null && (
          <ProspectInfoWindow
            place={activePlace}
            position={{ lat: activePlace.latitude, lng: activePlace.longitude }}
            onClose={() => setActiveMarker(null)}
            onSelect={() => onToggleSelect(getPlaceId(activePlace))}
            onAddToCrm={() => onAddToCrm(activePlace)}
            isSelected={selectedIds.has(getPlaceId(activePlace))}
            crmLoading={crmLoading}
          />
        )}

        {/* Drawing tools overlay */}
        {drawingMode && (
          <DrawingTools onShapeDrawn={onShapeDrawn} />
        )}

        {/* Heatmap layer */}
        {showHeatmap && geoResults.length > 0 && (
          <HeatmapLayer places={geoResults} />
        )}
      </Map>

      {/* Street View panel overlay */}
      {showStreetView && streetViewTarget && streetViewTarget.latitude != null && streetViewTarget.longitude != null && (
        <StreetViewPanel
          position={{ lat: streetViewTarget.latitude, lng: streetViewTarget.longitude }}
          placeName={streetViewTarget.name}
          onClose={onCloseStreetView}
        />
      )}
    </div>
  );
}
