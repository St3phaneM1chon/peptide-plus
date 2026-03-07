'use client';

import { useState } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import {
  Search,
  Download,
  FileSpreadsheet,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import MapSelector from '@/components/admin/scraper/MapSelector';

interface ScrapedPlace {
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
}

interface MapSelection {
  latitude: number;
  longitude: number;
  radius: number;
  label: string;
}

export default function ScraperPage() {
  const { t } = useTranslations();

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [mapSelection, setMapSelection] = useState<MapSelection | null>(null);
  const [maxResults, setMaxResults] = useState(100);
  const [crawlWebsites, setCrawlWebsites] = useState(true);
  const [results, setResults] = useState<ScrapedPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailCount = results.filter((r) => r.email).length;
  const googleMapsApiKey = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || '')
    : '';

  /** Build search payload with either text location or map coordinates */
  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      query,
      maxResults,
      crawlWebsites,
    };

    if (mapSelection) {
      payload.latitude = mapSelection.latitude;
      payload.longitude = mapSelection.longitude;
      payload.radius = mapSelection.radius;
    } else if (location) {
      payload.location = location;
    }

    return payload;
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scraper/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Search failed');
      setResults(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'excel' = 'csv') => {
    if (!query.trim()) return;
    const isExcel = format === 'excel';
    if (isExcel) setExportingExcel(true); else setExporting(true);
    try {
      const endpoint = isExcel ? '/api/admin/scraper/export-excel' : '/api/admin/scraper/export';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = isExcel ? 'xlsx' : 'csv';
      a.download = `google-maps-${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      if (isExcel) setExportingExcel(false); else setExporting(false);
    }
  };

  const renderStars = (rating: number | null) => {
    if (rating === null) return <span className="text-zinc-500">—</span>;
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.5;
    return (
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${
              i < full
                ? 'fill-yellow-400 text-yellow-400'
                : i === full && hasHalf
                  ? 'fill-yellow-400/50 text-yellow-400'
                  : 'text-zinc-600'
            }`}
          />
        ))}
        <span className="ml-1 text-xs text-zinc-400">{rating.toFixed(1)}</span>
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {t('admin.scraper.title')}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {t('admin.scraper.description')}
        </p>
      </div>

      {/* Search Form */}
      <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Query */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">
              {t('admin.scraper.queryLabel')}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('admin.scraper.queryPlaceholder')}
                className="w-full rounded-lg border border-zinc-600 bg-zinc-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Location (text input, disabled when map selection active) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">
              {t('admin.scraper.locationLabel')}
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={mapSelection ? mapSelection.label : location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  if (mapSelection) setMapSelection(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('admin.scraper.locationPlaceholder')}
                disabled={!!mapSelection}
                className={`w-full rounded-lg border border-zinc-600 bg-zinc-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                  mapSelection ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>
        </div>

        {/* Map Selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-300">
            {t('admin.scraper.mapSelectorLabel') || 'Ou sélectionner une zone sur la carte'}
          </label>
          <MapSelector
            apiKey={googleMapsApiKey || undefined}
            onSelect={(selection) => {
              setMapSelection(selection);
              if (selection) {
                setLocation(''); // Clear text location when map is used
              }
            }}
          />
          {mapSelection && (
            <p className="text-xs text-blue-400">
              {t('admin.scraper.mapSearchArea') || 'Recherche par zone'}: {mapSelection.label} — rayon {
                mapSelection.radius >= 1000
                  ? `${(mapSelection.radius / 1000).toFixed(mapSelection.radius % 1000 === 0 ? 0 : 1)} km`
                  : `${mapSelection.radius} m`
              }
            </p>
          )}
        </div>

        {/* Max Results + Crawl Checkbox */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">
              {t('admin.scraper.maxResultsLabel')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={500}
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="w-40 accent-blue-500"
              />
              <input
                type="number"
                min={1}
                max={500}
                value={maxResults}
                onChange={(e) => {
                  const v = Math.min(500, Math.max(1, Number(e.target.value) || 1));
                  setMaxResults(v);
                }}
                className="w-16 rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-sm text-white text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={crawlWebsites}
              onChange={(e) => setCrawlWebsites(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 h-4 w-4"
            />
            <span className="text-sm text-zinc-300">
              {t('admin.scraper.crawlWebsites')}
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {t('admin.scraper.searchButton')}
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || !query.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('admin.scraper.exportButton')}
          </button>

          <button
            onClick={() => handleExport('excel')}
            disabled={exportingExcel || !query.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-green-700 bg-green-800/50 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exportingExcel ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {t('admin.scraper.exportExcelButton') || 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          {/* Stats Bar */}
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>
              <span className="font-semibold text-white">{results.length}</span>{' '}
              {t('admin.scraper.resultsFound')}
            </span>
            <span className="text-zinc-600">|</span>
            <span>
              <Mail className="inline h-3.5 w-3.5 mr-1" />
              <span className="font-semibold text-white">{emailCount}</span>{' '}
              {t('admin.scraper.emailsFound')}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-zinc-700/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/50 bg-zinc-800/80">
                  <th className="px-4 py-3 text-left font-medium text-zinc-300">
                    {t('admin.scraper.colName')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-300">
                    {t('admin.scraper.colAddress')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-300">
                    {t('admin.scraper.colPhone')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-300">
                    {t('admin.scraper.colEmail')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-300">
                    {t('admin.scraper.colWebsite')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-300">
                    {t('admin.scraper.colRating')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-300">
                    {t('admin.scraper.colReviews')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/30">
                {results.map((place, idx) => (
                  <tr
                    key={idx}
                    className="bg-zinc-800/30 hover:bg-zinc-700/30 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                      {place.name}
                    </td>

                    {/* Address */}
                    <td className="px-4 py-3 text-zinc-400 max-w-[200px] truncate">
                      {place.address || '—'}
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {place.phone ? (
                        <a
                          href={`tel:${place.phone}`}
                          className="inline-flex items-center gap-1 text-zinc-300 hover:text-blue-400 transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {place.phone}
                        </a>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {place.email ? (
                        <a
                          href={`mailto:${place.email}`}
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {place.email}
                        </a>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>

                    {/* Website */}
                    <td className="px-4 py-3 max-w-[180px] truncate">
                      {place.website ? (
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Globe className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {place.website.replace(/^https?:\/\/(www\.)?/, '')}
                          </span>
                        </a>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>

                    {/* Rating */}
                    <td className="px-4 py-3">{renderStars(place.googleRating)}</td>

                    {/* Reviews */}
                    <td className="px-4 py-3 text-right text-zinc-400">
                      {place.googleReviewCount !== null
                        ? place.googleReviewCount.toLocaleString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <MapPin className="h-12 w-12 mb-3 text-zinc-600" />
          <p className="text-sm">{t('admin.scraper.emptyState')}</p>
        </div>
      )}
    </div>
  );
}
