'use client';

/**
 * SearchPanel — Right-side panel with search controls (keyword, category, engine, radius).
 */

import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';
import type { DrawnShape } from './DrawingTools';

interface SearchPanelProps {
  onSearch: (params: SearchParams) => void;
  loading: boolean;
  drawnShape: DrawnShape | null;
}

export interface SearchParams {
  query: string;
  location: string;
  maxResults: number;
  crawlWebsites: boolean;
  engine: 'playwright' | 'places_api';
  region: DrawnShape | null;
}

export default function SearchPanel({ onSearch, loading, drawnShape }: SearchPanelProps) {
  const { t } = useTranslations();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState(100);
  const [crawlWebsites, setCrawlWebsites] = useState(true);
  const [engine, setEngine] = useState<'playwright' | 'places_api'>('playwright');

  const handleSubmit = () => {
    if (!query.trim()) return;
    onSearch({
      query: query.trim(),
      location: location.trim(),
      maxResults,
      crawlWebsites,
      engine,
      region: drawnShape,
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-200">
        {t('admin.scraper.searchTitle')}
      </h3>

      {/* Keyword */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-400">
          {t('admin.scraper.queryLabel')}
        </label>
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={t('admin.scraper.queryPlaceholder')}
            className="w-full rounded-lg border border-zinc-600 bg-zinc-900 ps-8 pe-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Location (disabled if shape drawn) */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-400">
          {t('admin.scraper.locationLabel')}
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={t('admin.scraper.locationPlaceholder')}
          disabled={!!drawnShape}
          className={`w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none ${
            drawnShape ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
        {drawnShape && (
          <p className="text-[10px] text-blue-400">
            {t('admin.scraper.usingDrawnZone')}
          </p>
        )}
      </div>

      {/* Engine select */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-400">
          {t('admin.scraper.engineLabel')}
        </label>
        <select
          value={engine}
          onChange={(e) => setEngine(e.target.value as 'playwright' | 'places_api')}
          className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        >
          <option value="playwright">{t('admin.scraper.enginePlaywright')}</option>
          <option value="places_api">{t('admin.scraper.engineGooglePlaces')}</option>
        </select>
      </div>

      {/* Max results */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-400">
          {t('admin.scraper.maxResultsLabel')}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={500}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            className="flex-1 accent-blue-500 h-1"
          />
          <input
            type="number"
            min={1}
            max={500}
            value={maxResults}
            onChange={(e) => setMaxResults(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
            className="w-14 rounded border border-zinc-600 bg-zinc-900 px-1.5 py-1 text-xs text-white text-center focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Crawl websites checkbox */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={crawlWebsites}
          onChange={(e) => setCrawlWebsites(e.target.checked)}
          className="rounded border-zinc-600 bg-zinc-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 h-3.5 w-3.5"
        />
        <span className="text-xs text-zinc-300">
          {t('admin.scraper.crawlWebsites')}
        </span>
      </label>

      {/* Search button */}
      <button
        onClick={handleSubmit}
        disabled={loading || !query.trim()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        {t('admin.scraper.searchButton')}
      </button>
    </div>
  );
}
