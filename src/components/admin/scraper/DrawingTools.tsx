'use client';

/**
 * DrawingTools — Google Maps Drawing Manager integration.
 * Supports circle, rectangle, and polygon drawing modes.
 * Reports drawn shapes back to parent for search zone definition.
 */

import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Circle, Square, Pentagon, Trash2 } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';
import { formatArea, formatRadius, polygonArea } from '@/lib/scraper/polygon-decomposition';

export interface DrawnShape {
  type: 'circle' | 'rectangle' | 'polygon';
  // Circle
  center?: { lat: number; lng: number };
  radius?: number;
  // Rectangle
  bounds?: { north: number; south: number; east: number; west: number };
  // Polygon
  path?: Array<{ lat: number; lng: number }>;
  // Computed
  area?: number; // square meters
}

interface DrawingToolsProps {
  onShapeDrawn: (shape: DrawnShape | null) => void;
}

type DrawingModeType = 'circle' | 'rectangle' | 'polygon' | null;

export default function DrawingTools({ onShapeDrawn }: DrawingToolsProps) {
  const map = useMap();
  const drawingLib = useMapsLibrary('drawing');
  const { t } = useTranslations();

  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const overlayRef = useRef<google.maps.Circle | google.maps.Rectangle | google.maps.Polygon | null>(null);

  const [activeMode, setActiveMode] = useState<DrawingModeType>(null);
  const [shapeInfo, setShapeInfo] = useState<string | null>(null);

  // Initialize drawing manager
  useEffect(() => {
    if (!map || !drawingLib) return;

    const dm = new google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false, // We use custom controls
      circleOptions: {
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.7,
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
      rectangleOptions: {
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.7,
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
      polygonOptions: {
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.7,
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
    });

    dm.setMap(map);
    drawingManagerRef.current = dm;

    // Handle shape completion events
    google.maps.event.addListener(dm, 'circlecomplete', (circle: google.maps.Circle) => {
      clearOverlay();
      overlayRef.current = circle;
      const shape = extractCircleShape(circle);
      onShapeDrawn(shape);
      updateShapeInfo(shape);
      setActiveMode(null);
      dm.setDrawingMode(null);

      // Listen for edits
      google.maps.event.addListener(circle, 'radius_changed', () => {
        const s = extractCircleShape(circle);
        onShapeDrawn(s);
        updateShapeInfo(s);
      });
      google.maps.event.addListener(circle, 'center_changed', () => {
        const s = extractCircleShape(circle);
        onShapeDrawn(s);
        updateShapeInfo(s);
      });
    });

    google.maps.event.addListener(dm, 'rectanglecomplete', (rect: google.maps.Rectangle) => {
      clearOverlay();
      overlayRef.current = rect;
      const shape = extractRectShape(rect);
      onShapeDrawn(shape);
      updateShapeInfo(shape);
      setActiveMode(null);
      dm.setDrawingMode(null);

      google.maps.event.addListener(rect, 'bounds_changed', () => {
        const s = extractRectShape(rect);
        onShapeDrawn(s);
        updateShapeInfo(s);
      });
    });

    google.maps.event.addListener(dm, 'polygoncomplete', (poly: google.maps.Polygon) => {
      clearOverlay();
      overlayRef.current = poly;
      const shape = extractPolygonShape(poly);
      onShapeDrawn(shape);
      updateShapeInfo(shape);
      setActiveMode(null);
      dm.setDrawingMode(null);

      // Listen for path edits
      const path = poly.getPath();
      google.maps.event.addListener(path, 'set_at', () => {
        const s = extractPolygonShape(poly);
        onShapeDrawn(s);
        updateShapeInfo(s);
      });
      google.maps.event.addListener(path, 'insert_at', () => {
        const s = extractPolygonShape(poly);
        onShapeDrawn(s);
        updateShapeInfo(s);
      });
    });

    return () => {
      dm.setMap(null);
      clearOverlay();
    };
  }, [map, drawingLib]);

  const clearOverlay = useCallback(() => {
    if (overlayRef.current) {
      overlayRef.current.setMap(null);
      overlayRef.current = null;
    }
  }, []);

  const setDrawingMode = useCallback((mode: DrawingModeType) => {
    if (!drawingManagerRef.current) return;

    if (mode === activeMode) {
      // Toggle off
      drawingManagerRef.current.setDrawingMode(null);
      setActiveMode(null);
      return;
    }

    setActiveMode(mode);
    if (mode === 'circle') {
      drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.CIRCLE);
    } else if (mode === 'rectangle') {
      drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.RECTANGLE);
    } else if (mode === 'polygon') {
      drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    } else {
      drawingManagerRef.current.setDrawingMode(null);
    }
  }, [activeMode]);

  const handleClear = useCallback(() => {
    clearOverlay();
    onShapeDrawn(null);
    setShapeInfo(null);
    setActiveMode(null);
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(null);
    }
  }, [clearOverlay, onShapeDrawn]);

  const updateShapeInfo = (shape: DrawnShape) => {
    if (shape.type === 'circle' && shape.radius) {
      setShapeInfo(`${formatRadius(shape.radius)}`);
    } else if (shape.area) {
      setShapeInfo(formatArea(shape.area));
    }
  };

  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/90 dark:bg-zinc-900/90 rounded-lg p-1.5 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700/50">
      <button
        onClick={() => setDrawingMode('circle')}
        className={`p-2 rounded-md transition-colors ${
          activeMode === 'circle' ? 'bg-blue-600 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white'
        }`}
        title={t('admin.scraper.drawCircle')}
      >
        <Circle className="h-4 w-4" />
      </button>
      <button
        onClick={() => setDrawingMode('rectangle')}
        className={`p-2 rounded-md transition-colors ${
          activeMode === 'rectangle' ? 'bg-blue-600 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white'
        }`}
        title={t('admin.scraper.drawRectangle')}
      >
        <Square className="h-4 w-4" />
      </button>
      <button
        onClick={() => setDrawingMode('polygon')}
        className={`p-2 rounded-md transition-colors ${
          activeMode === 'polygon' ? 'bg-blue-600 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white'
        }`}
        title={t('admin.scraper.drawPolygon')}
      >
        <Pentagon className="h-4 w-4" />
      </button>

      {overlayRef.current && (
        <>
          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />
          <button
            onClick={handleClear}
            className="p-2 rounded-md text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
            title={t('admin.scraper.clearShape')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {shapeInfo && (
            <span className="text-xs text-zinc-600 dark:text-zinc-400 px-1">{shapeInfo}</span>
          )}
        </>
      )}
    </div>
  );
}

// --- Shape extraction helpers ---

function extractCircleShape(circle: google.maps.Circle): DrawnShape {
  const center = circle.getCenter();
  const radius = circle.getRadius();
  return {
    type: 'circle',
    center: center ? { lat: center.lat(), lng: center.lng() } : undefined,
    radius,
    area: Math.PI * radius * radius,
  };
}

function extractRectShape(rect: google.maps.Rectangle): DrawnShape {
  const bounds = rect.getBounds();
  if (!bounds) return { type: 'rectangle' };

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const b = { north: ne.lat(), south: sw.lat(), east: ne.lng(), west: sw.lng() };

  // Approximate area
  const path = [
    { lat: b.north, lng: b.west },
    { lat: b.north, lng: b.east },
    { lat: b.south, lng: b.east },
    { lat: b.south, lng: b.west },
  ];

  return {
    type: 'rectangle',
    bounds: b,
    area: polygonArea(path),
  };
}

function extractPolygonShape(poly: google.maps.Polygon): DrawnShape {
  const path = poly.getPath();
  const points: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < path.getLength(); i++) {
    const p = path.getAt(i);
    points.push({ lat: p.lat(), lng: p.lng() });
  }

  return {
    type: 'polygon',
    path: points,
    area: polygonArea(points),
  };
}
