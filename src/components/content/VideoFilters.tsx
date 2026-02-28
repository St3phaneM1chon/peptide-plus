'use client';

/**
 * VideoFilters — Filter bar for video library
 * Categories, content type, source, search, sort
 */

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import { Search, X, SlidersHorizontal } from 'lucide-react';

interface VideoCategory {
  id: string;
  name: string;
  slug: string;
}

interface Filters {
  search: string;
  categoryId: string;
  contentType: string;
  source: string;
  sort: string;
}

interface Props {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  categories?: VideoCategory[];
}

const contentTypeKeys = [
  { value: 'PODCAST', labelKey: 'videoContentType.PODCAST' },
  { value: 'TRAINING', labelKey: 'videoContentType.TRAINING' },
  { value: 'PRODUCT_DEMO', labelKey: 'videoContentType.PRODUCT_DEMO' },
  { value: 'TESTIMONIAL', labelKey: 'videoContentType.TESTIMONIAL' },
  { value: 'FAQ_VIDEO', labelKey: 'videoContentType.FAQ_VIDEO' },
  { value: 'WEBINAR_RECORDING', labelKey: 'videoContentType.WEBINAR_RECORDING' },
  { value: 'TUTORIAL', labelKey: 'videoContentType.TUTORIAL' },
  { value: 'BRAND_STORY', labelKey: 'videoContentType.BRAND_STORY' },
  { value: 'OTHER', labelKey: 'videoContentType.OTHER' },
];

const sourceEntries = [
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'VIMEO', label: 'Vimeo' },
  { value: 'TEAMS', label: 'Teams' },
  { value: 'ZOOM', label: 'Zoom' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'X_TWITTER', label: 'X/Twitter' },
];

export default function VideoFilters({ filters, onFiltersChange, categories = [] }: Props) {
  const { t } = useI18n();
  const [searchInput, setSearchInput] = useState(filters.search);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasFilters = filters.categoryId || filters.contentType || filters.source || filters.search;

  const handleSearch = () => {
    onFiltersChange({ ...filters, search: searchInput });
  };

  const clearAll = () => {
    setSearchInput('');
    onFiltersChange({ search: '', categoryId: '', contentType: '', source: '', sort: 'newest' });
  };

  return (
    <div className="space-y-3">
      {/* Main search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={t('common.search') !== 'common.search' ? t('common.search') : 'Search videos...'}
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
          />
        </div>
        <button onClick={handleSearch} className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
          {t('common.search') !== 'common.search' ? t('common.search') : 'Search'}
        </button>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3 py-2.5 border rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1.5 ${showAdvanced ? 'bg-orange-50 border-orange-200 text-orange-700' : ''}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">{t('videos.filters')}</span>
        </button>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="flex flex-wrap gap-3 items-center p-3 bg-gray-50 rounded-lg border">
          {/* Category */}
          {categories.length > 0 && (
            <select
              value={filters.categoryId}
              onChange={e => onFiltersChange({ ...filters, categoryId: e.target.value })}
              className="border rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <option value="">{t('videos.allCategories')}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          {/* Content Type */}
          <select
            value={filters.contentType}
            onChange={e => onFiltersChange({ ...filters, contentType: e.target.value })}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            <option value="">{t('videos.allTypes')}</option>
            {contentTypeKeys.map(ct => (
              <option key={ct.value} value={ct.value}>{t(ct.labelKey)}</option>
            ))}
          </select>

          {/* Source */}
          <select
            value={filters.source}
            onChange={e => onFiltersChange({ ...filters, source: e.target.value })}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            <option value="">{t('videos.allSources')}</option>
            {sourceEntries.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={filters.sort}
            onChange={e => onFiltersChange({ ...filters, sort: e.target.value })}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            <option value="newest">{t('videos.sortNewest')}</option>
            <option value="oldest">{t('videos.sortOldest')}</option>
            <option value="views">{t('videos.sortViews')}</option>
            <option value="title">{t('videos.sortTitle')}</option>
          </select>

          {/* Clear */}
          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
            >
              <X className="h-3 w-3" /> {t('videos.clearFilters')}
            </button>
          )}
        </div>
      )}

      {/* Active filter pills */}
      {hasFilters && !showAdvanced && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-xs">
              Search: &quot;{filters.search}&quot;
              <button onClick={() => { setSearchInput(''); onFiltersChange({ ...filters, search: '' }); }}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.categoryId && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs">
              Category: {categories.find(c => c.id === filters.categoryId)?.name}
              <button onClick={() => onFiltersChange({ ...filters, categoryId: '' })}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.contentType && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
              {t(`videoContentType.${filters.contentType}`)}
              <button onClick={() => onFiltersChange({ ...filters, contentType: '' })}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <button onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-700 underline">
            {t('videos.clearFilters')}
          </button>
        </div>
      )}
    </div>
  );
}
