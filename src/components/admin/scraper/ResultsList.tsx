'use client';

/**
 * ResultsList — Scrollable list of scraped results with selection, sorting, and filtering.
 */

import { useState, useMemo } from 'react';
import {
  Phone,
  Mail,
  Globe,
  Star,
  MapPin,
  Check,
  ChevronDown,
  Eye,
  Loader2,
} from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';
import { haversineDistance } from '@/lib/scraper/polygon-decomposition';
import type { ScrapedPlace } from './types';
import { getPlaceId } from './types';

interface ResultsListProps {
  results: ScrapedPlace[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAddSelectedToCrm: () => void;
  onOpenStreetView: (place: ScrapedPlace) => void;
  onHighlightMarker: (place: ScrapedPlace) => void;
  crmLoading?: boolean;
  searchCenter?: { lat: number; lng: number } | null;
}

type SortField = 'name' | 'rating' | 'reviews' | 'distance';
type SortDir = 'asc' | 'desc';

export default function ResultsList({
  results,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onAddSelectedToCrm,
  onOpenStreetView,
  onHighlightMarker,
  crmLoading,
  searchCenter,
}: ResultsListProps) {
  const { t } = useTranslations();
  const [sortField, setSortField] = useState<SortField>('rating');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('');

  const emailCount = results.filter(r => r.email).length;
  const allSelected = results.length > 0 && selectedIds.size === results.length;

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const r of results) {
      if (r.category) cats.add(r.category);
    }
    return Array.from(cats).sort();
  }, [results]);

  // Sort and filter
  const sortedResults = useMemo(() => {
    let filtered = results;
    if (filterCategory) {
      filtered = filtered.filter(r => r.category === filterCategory);
    }

    return [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'rating':
          return dir * ((a.googleRating ?? 0) - (b.googleRating ?? 0));
        case 'reviews':
          return dir * ((a.googleReviewCount ?? 0) - (b.googleReviewCount ?? 0));
        case 'distance': {
          if (!searchCenter) return 0;
          const dA = (a.latitude != null && a.longitude != null)
            ? haversineDistance(searchCenter, { lat: a.latitude, lng: a.longitude })
            : Infinity;
          const dB = (b.latitude != null && b.longitude != null)
            ? haversineDistance(searchCenter, { lat: b.latitude, lng: b.longitude })
            : Infinity;
          return dir * (dA - dB);
        }
        default:
          return 0;
      }
    });
  }, [results, sortField, sortDir, filterCategory, searchCenter]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const renderStars = (rating: number | null) => {
    if (rating === null) return <span className="text-zinc-600 text-xs">—</span>;
    return (
      <span className="flex items-center gap-0.5">
        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        <span className="text-xs text-zinc-700 dark:text-zinc-300">{rating.toFixed(1)}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700/50 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-white">{results.length}</span>{' '}
            {t('admin.scraper.resultsFound')}
            {emailCount > 0 && (
              <span className="ml-2">
                <Mail className="inline h-3 w-3 mr-0.5" />
                <span className="font-semibold text-zinc-900 dark:text-white">{emailCount}</span>
              </span>
            )}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            {allSelected ? t('admin.scraper.deselectAll') : t('admin.scraper.selectAll')}
          </button>

          {selectedIds.size > 0 && (
            <button
              onClick={onAddSelectedToCrm}
              disabled={crmLoading}
              className="text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              {crmLoading && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              + CRM ({selectedIds.size})
            </button>
          )}

          {/* Sort */}
          <div className="ml-auto flex items-center gap-1">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="bg-gray-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[10px] text-zinc-600 dark:text-zinc-400 px-1 py-0.5 outline-none"
            >
              <option value="rating">{t('admin.scraper.colRating')}</option>
              <option value="reviews">{t('admin.scraper.colReviews')}</option>
              <option value="name">{t('admin.scraper.colName')}</option>
              {searchCenter && <option value="distance">{t('admin.scraper.distance')}</option>}
            </select>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Category filter */}
        {categories.length > 1 && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[10px] text-zinc-600 dark:text-zinc-400 px-2 py-1 outline-none"
          >
            <option value="">{t('admin.scraper.allCategories')}</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
      </div>

      {/* Scrollable results */}
      <div className="flex-1 overflow-y-auto">
        {sortedResults.map((place) => {
          const id = getPlaceId(place);
          const selected = selectedIds.has(id);

          return (
            <div
              key={id}
              className={`px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-700/30 transition-colors cursor-pointer ${
                selected ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : ''
              }`}
              onClick={() => onHighlightMarker(place)}
            >
              <div className="flex items-start gap-2">
                {/* Select checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleSelect(id); }}
                  className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border ${
                    selected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400'
                  } flex items-center justify-center transition-colors`}
                >
                  {selected && <Check className="h-2.5 w-2.5" />}
                </button>

                <div className="min-w-0 flex-1">
                  {/* Name + category */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-zinc-900 dark:text-white truncate">{place.name}</span>
                    {renderStars(place.googleRating)}
                  </div>

                  {/* Category */}
                  {place.category && (
                    <span className="text-[10px] text-zinc-500">{place.category}</span>
                  )}

                  {/* Address */}
                  {place.address && (
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">{place.address}</p>
                  )}

                  {/* Contact info */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {place.phone && (
                      <a
                        href={`tel:${place.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-blue-400"
                      >
                        <Phone className="h-2.5 w-2.5" />
                        {place.phone}
                      </a>
                    )}
                    {place.email && (
                      <a
                        href={`mailto:${place.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 text-[10px] text-blue-400 hover:text-blue-300"
                      >
                        <Mail className="h-2.5 w-2.5" />
                        {place.email}
                      </a>
                    )}
                    {place.website && (
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-blue-400 truncate max-w-[120px]"
                      >
                        <Globe className="h-2.5 w-2.5 shrink-0" />
                        {place.website.replace(/^https?:\/\/(www\.)?/, '')}
                      </a>
                    )}
                  </div>
                </div>

                {/* Street View button */}
                {place.latitude != null && place.longitude != null && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenStreetView(place); }}
                    className="flex-shrink-0 p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                    title={t('admin.scraper.streetViewButton')}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
