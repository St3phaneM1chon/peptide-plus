/**
 * Polygon Decomposition — Decomposes arbitrary shapes into overlapping circles
 * for Google Maps/Places API search coverage.
 *
 * Strategy: Grid-based circle placement with adaptive radius based on density.
 * 20% overlap between circles to avoid gaps.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoCircle {
  center: GeoPoint;
  radius: number; // meters
}

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type RegionShape =
  | { type: 'circle'; center: GeoPoint; radius: number }
  | { type: 'rectangle'; bounds: GeoBounds }
  | { type: 'polygon'; path: GeoPoint[] };

// Earth radius in meters
const EARTH_RADIUS = 6371000;

/** Convert degrees to radians */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Convert radians to degrees */
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Haversine distance between two points in meters */
export function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

/** Convert meters to approximate latitude degrees */
function metersToLatDeg(meters: number): number {
  return meters / 111320;
}

/** Convert meters to approximate longitude degrees at a given latitude */
function metersToLngDeg(meters: number, lat: number): number {
  return meters / (111320 * Math.cos(toRad(lat)));
}

/** Get bounding box of a polygon */
function getPolygonBounds(path: GeoPoint[]): GeoBounds {
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  for (const p of path) {
    if (p.lat > north) north = p.lat;
    if (p.lat < south) south = p.lat;
    if (p.lng > east) east = p.lng;
    if (p.lng < west) west = p.lng;
  }
  return { north, south, east, west };
}

/** Ray-casting point-in-polygon test */
function pointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Calculate area of polygon in square meters (Shoelace formula on projected coords) */
export function polygonArea(path: GeoPoint[]): number {
  if (path.length < 3) return 0;
  const centerLat = path.reduce((s, p) => s + p.lat, 0) / path.length;
  let area = 0;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const xi = path[i].lng * Math.cos(toRad(centerLat)) * 111320;
    const yi = path[i].lat * 111320;
    const xj = path[j].lng * Math.cos(toRad(centerLat)) * 111320;
    const yj = path[j].lat * 111320;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area / 2);
}

/**
 * Decompose a region shape into overlapping search circles.
 *
 * @param region - The shape to decompose
 * @param baseRadius - Base circle radius in meters (default 2000m)
 * @param overlapFactor - Overlap between circles (0.2 = 20%)
 * @returns Array of circles covering the region
 */
export function decomposeRegion(
  region: RegionShape,
  baseRadius: number = 2000,
  overlapFactor: number = 0.2,
): GeoCircle[] {
  if (region.type === 'circle') {
    // If the search radius is small enough, single circle
    if (region.radius <= baseRadius * 1.5) {
      return [{ center: region.center, radius: region.radius }];
    }
    // Decompose large circle into grid of smaller circles
    const bounds: GeoBounds = {
      north: region.center.lat + metersToLatDeg(region.radius),
      south: region.center.lat - metersToLatDeg(region.radius),
      east: region.center.lng + metersToLngDeg(region.radius, region.center.lat),
      west: region.center.lng - metersToLngDeg(region.radius, region.center.lat),
    };
    return gridCircles(bounds, baseRadius, overlapFactor, (p) =>
      haversineDistance(p, region.center) <= region.radius + baseRadius * overlapFactor
    );
  }

  if (region.type === 'rectangle') {
    return gridCircles(region.bounds, baseRadius, overlapFactor);
  }

  if (region.type === 'polygon') {
    const bounds = getPolygonBounds(region.path);
    return gridCircles(bounds, baseRadius, overlapFactor, (p) =>
      pointInPolygon(p, region.path)
    );
  }

  return [];
}

/** Generate a grid of overlapping circles within bounds */
function gridCircles(
  bounds: GeoBounds,
  radius: number,
  overlapFactor: number,
  filter?: (p: GeoPoint) => boolean,
): GeoCircle[] {
  const step = radius * 2 * (1 - overlapFactor);
  const latStep = metersToLatDeg(step);
  const centerLat = (bounds.north + bounds.south) / 2;
  const lngStep = metersToLngDeg(step, centerLat);

  const circles: GeoCircle[] = [];

  for (let lat = bounds.south; lat <= bounds.north; lat += latStep) {
    for (let lng = bounds.west; lng <= bounds.east; lng += lngStep) {
      const point: GeoPoint = { lat, lng };
      if (!filter || filter(point)) {
        circles.push({ center: point, radius });
      }
    }
  }

  // Safety: cap at 50 circles to avoid excessive API usage
  if (circles.length > 50) {
    const scaleFactor = Math.sqrt(circles.length / 50);
    return decomposeRegion(
      { type: 'rectangle', bounds },
      radius * scaleFactor,
      overlapFactor,
    );
  }

  return circles;
}

/** Format area for display */
export function formatArea(sqMeters: number): string {
  if (sqMeters >= 1_000_000) {
    return `${(sqMeters / 1_000_000).toFixed(1)} km²`;
  }
  return `${Math.round(sqMeters).toLocaleString()} m²`;
}

/** Format radius for display */
export function formatRadius(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)} km`;
  }
  return `${Math.round(meters)} m`;
}
