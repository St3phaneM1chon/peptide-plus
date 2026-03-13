/**
 * Shared types for the scraper admin components.
 */

export interface ScrapedPlace {
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: string[] | null;
  googleMapsUrl?: string | null;
}

/** Stable unique ID for a scraped place (avoids duplicate React keys for same-name businesses). */
export function getPlaceId(place: ScrapedPlace): string {
  if (place.googleMapsUrl) return place.googleMapsUrl;
  // Fallback: name + address (or lat/lng if no address)
  const name = place.name?.toLowerCase() ?? '';
  if (place.address) return `${name}|${place.address.toLowerCase()}`;
  if (place.latitude != null && place.longitude != null) return `${name}|${place.latitude},${place.longitude}`;
  return name;
}

export type ProspectCrmStatus = 'new' | 'prospect' | 'lead' | 'deal';

export interface ScrapeJobInfo {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  query: string;
  engine: 'playwright' | 'places_api';
  totalFound: number;
  totalImported: number;
  totalDupes: number;
  errorLog: string | null;
  progress: number; // 0-100
  region?: unknown;
  prospectListId?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface MapSelection {
  latitude: number;
  longitude: number;
  radius: number;
  label: string;
}

export interface RegionSelection {
  type: 'circle' | 'rectangle' | 'polygon';
  // Circle
  center?: { lat: number; lng: number };
  radius?: number;
  // Rectangle
  bounds?: { north: number; south: number; east: number; west: number };
  // Polygon
  path?: Array<{ lat: number; lng: number }>;
}
