'use client';

/**
 * Google Maps Scraper — Admin page
 *
 * Full interactive map + search panel + results list + job pipeline.
 * Split layout: 70% map / 30% panel on desktop, stacked on mobile.
 */

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from '@/hooks/useTranslations';
import {
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { addCSRFHeader } from '@/lib/csrf';
import MapProvider from '@/components/admin/scraper/MapProvider';
import SearchPanel, { type SearchParams } from '@/components/admin/scraper/SearchPanel';
import ResultsList from '@/components/admin/scraper/ResultsList';
import ScraperToolbar from '@/components/admin/scraper/ScraperToolbar';
import JobsPanel from '@/components/admin/scraper/JobsPanel';
import type { ScrapedPlace } from '@/components/admin/scraper/types';
import { getPlaceId } from '@/components/admin/scraper/types';
import type { DrawnShape } from '@/components/admin/scraper/DrawingTools';

// Dynamic import for InteractiveMap (loads Google Maps API client-side)
const InteractiveMap = dynamic(
  () => import('@/components/admin/scraper/InteractiveMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-gray-100/50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-600 dark:text-zinc-400" />
      </div>
    ),
  },
);

export default function ScraperPage() {
  const { t, locale } = useTranslations();

  // Search state
  const [results, setResults] = useState<ScrapedPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map state
  const [drawingMode, setDrawingMode] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showStreetView, setShowStreetView] = useState(false);
  const [streetViewTarget, setStreetViewTarget] = useState<ScrapedPlace | null>(null);
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // UI state
  const [showJobsPanel, setShowJobsPanel] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [activePanel, setActivePanel] = useState<'search' | 'results'>('search');
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSuccess, setCrmSuccess] = useState<string | null>(null);
  // Track last search center for distance sorting
  const lastSearchCenter = useRef<{ lat: number; lng: number } | null>(null);

  // Build search payload — sends full region for proper polygon decomposition on the backend
  const buildPayload = useCallback((params: SearchParams) => {
    const payload: Record<string, unknown> = {
      query: params.query,
      maxResults: params.maxResults,
      crawlWebsites: params.crawlWebsites,
      engine: params.engine || 'playwright',
    };

    if (params.region) {
      // Send the full region shape — backend handles decomposition
      payload.region = params.region;

      // Track search center for distance sorting in ResultsList
      if (params.region.type === 'circle' && params.region.center) {
        lastSearchCenter.current = params.region.center;
      } else if (params.region.type === 'rectangle' && params.region.bounds) {
        const b = params.region.bounds;
        lastSearchCenter.current = { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 };
      } else if (params.region.type === 'polygon' && params.region.path && params.region.path.length > 0) {
        const p = params.region.path;
        lastSearchCenter.current = {
          lat: p.reduce((s, pt) => s + pt.lat, 0) / p.length,
          lng: p.reduce((s, pt) => s + pt.lng, 0) / p.length,
        };
      }
    } else if (params.location) {
      payload.location = params.location;
    }

    return payload;
  }, []);

  // Search handler
  const handleSearch = useCallback(async (params: SearchParams) => {
    setLoading(true);
    setError(null);
    setActivePanel('results');

    try {
      const payload = buildPayload(params);
      const res = await fetch('/api/admin/scraper/search', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Search failed');
      setResults(data.data || []);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [buildPayload]);

  // Export handlers
  const handleExport = useCallback(async (format: 'csv' | 'excel') => {
    if (results.length === 0) return;
    const isExcel = format === 'excel';
    if (isExcel) setExportingExcel(true); else setExporting(true);

    try {
      const endpoint = isExcel ? '/api/admin/scraper/export-excel' : '/api/admin/scraper/export';
      // Re-export current results via a lightweight approach - send cached results
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ results, locale }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `google-maps-${new Date().toISOString().slice(0, 10)}.${isExcel ? 'xlsx' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      if (isExcel) setExportingExcel(false); else setExporting(false);
    }
  }, [results, locale]);

  // Selection handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(results.map(r => getPlaceId(r))));
  }, [results]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // CRM state for link
  const [crmListId, setCrmListId] = useState<string | null>(null);

  // CRM handlers
  const addPlacesToCrm = useCallback(async (places: ScrapedPlace[]) => {
    if (places.length === 0) return;
    const msg = t('admin.scraper.confirmCrmImport').replace('{count}', String(places.length));
    if (!window.confirm(msg)) return;
    setCrmLoading(true);
    setCrmSuccess(null);
    setCrmListId(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/scraper/add-to-crm', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ places }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'CRM import failed');
      const resultData = data.data;
      setCrmSuccess(`${resultData.added} ${t('admin.scraper.crmImportSuccess')}, ${resultData.duplicates} ${t('admin.scraper.dupes')}`);
      setCrmListId(resultData.listId || null);
      setSelectedIds(new Set()); // Clear selection after successful import
      setTimeout(() => { setCrmSuccess(null); setCrmListId(null); }, 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CRM import failed');
    } finally {
      setCrmLoading(false);
    }
  }, [t]);

  const handleAddToCrm = useCallback(async (place: ScrapedPlace) => {
    await addPlacesToCrm([place]);
  }, [addPlacesToCrm]);

  const handleAddSelectedToCrm = useCallback(async () => {
    const selected = results.filter(r => selectedIds.has(getPlaceId(r)));
    await addPlacesToCrm(selected);
  }, [results, selectedIds, addPlacesToCrm]);

  // Street View handlers
  const handleOpenStreetView = useCallback((place: ScrapedPlace) => {
    setStreetViewTarget(place);
    setShowStreetView(true);
  }, []);

  const handleCloseStreetView = useCallback(() => {
    setShowStreetView(false);
    setStreetViewTarget(null);
  }, []);

  // Shape handler
  const handleShapeDrawn = useCallback((shape: DrawnShape | null) => {
    setDrawnShape(shape);
    if (shape) setDrawingMode(false);
  }, []);

  // Highlight marker — pan map to place + open InfoWindow
  const [highlightedPlace, setHighlightedPlace] = useState<ScrapedPlace | null>(null);
  const handleHighlightMarker = useCallback((place: ScrapedPlace) => {
    setHighlightedPlace(place);
  }, []);

  const handleHighlightHandled = useCallback(() => {
    setHighlightedPlace(null);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header + Toolbar */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700/50 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
              {t('admin.scraper.title')}
            </h1>
            <p className="text-xs text-zinc-500">
              {t('admin.scraper.description')}
            </p>
          </div>
        </div>

        <ScraperToolbar
          drawingMode={drawingMode}
          showHeatmap={showHeatmap}
          showStreetView={showStreetView}
          hasResults={results.length > 0}
          onToggleDrawing={() => setDrawingMode(d => !d)}
          onToggleHeatmap={() => setShowHeatmap(h => !h)}
          onToggleStreetView={() => setShowStreetView(s => !s)}
          onExportCsv={() => handleExport('csv')}
          onExportExcel={() => handleExport('excel')}
          onShowJobs={() => setShowJobsPanel(j => !j)}
          exporting={exporting}
          exportingExcel={exportingExcel}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-900/20 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-300">
            &times;
          </button>
        </div>
      )}

      {/* CRM success banner */}
      {crmSuccess && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-green-800/50 bg-green-900/20 px-3 py-2 text-xs text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          CRM: {crmSuccess}
          {crmListId && (
            <a
              href={`/admin/crm/lists/${crmListId}`}
              className="ml-2 underline hover:text-green-300 font-medium"
            >
              {t('admin.scraper.viewInCrm')}
            </a>
          )}
        </div>
      )}

      {/* Main content: Map + Side panel */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Map area (70%) */}
        <div className="flex-1 lg:w-[70%] relative min-h-[300px]">
          <MapProvider>
            <InteractiveMap
              results={results}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onShapeDrawn={handleShapeDrawn}
              onAddToCrm={handleAddToCrm}
              crmLoading={crmLoading}
              drawingMode={drawingMode}
              showHeatmap={showHeatmap}
              showStreetView={showStreetView}
              streetViewTarget={streetViewTarget}
              onCloseStreetView={handleCloseStreetView}
              highlightedPlace={highlightedPlace}
              onHighlightHandled={handleHighlightHandled}
            />
          </MapProvider>
        </div>

        {/* Side panel (30%) */}
        <div className="lg:w-[30%] lg:min-w-[320px] lg:max-w-[420px] border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-700/50 flex flex-col bg-gray-50/50 dark:bg-zinc-800/30">
          {/* Panel tabs */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-700/50">
            <button
              onClick={() => setActivePanel('search')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activePanel === 'search'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {t('admin.scraper.searchTab')}
            </button>
            <button
              onClick={() => setActivePanel('results')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activePanel === 'results'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {t('admin.scraper.resultsTab')}
              {results.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-600/30 text-blue-400 text-[10px]">
                  {results.length}
                </span>
              )}
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {activePanel === 'search' ? (
              <div className="p-3 overflow-y-auto h-full">
                <SearchPanel
                  onSearch={handleSearch}
                  loading={loading}
                  drawnShape={drawnShape}
                />
              </div>
            ) : (
              results.length > 0 ? (
                <ResultsList
                  results={results}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onSelectAll={selectAll}
                  onDeselectAll={deselectAll}
                  onAddSelectedToCrm={handleAddSelectedToCrm}
                  onOpenStreetView={handleOpenStreetView}
                  onHighlightMarker={handleHighlightMarker}
                  crmLoading={crmLoading}
                  searchCenter={lastSearchCenter.current}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-500 dark:text-zinc-500">
                  <MapPin className="h-10 w-10 mb-3 text-zinc-400 dark:text-zinc-600" />
                  <p className="text-xs">{t('admin.scraper.emptyState')}</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Jobs Pipeline panel (bottom) */}
      <JobsPanel
        visible={showJobsPanel}
        onClose={() => setShowJobsPanel(false)}
      />
    </div>
  );
}
