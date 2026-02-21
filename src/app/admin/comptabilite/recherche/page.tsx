'use client';

import { useState, useEffect } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';

interface SearchResult {
  id: string;
  type: 'ENTRY' | 'INVOICE' | 'SUPPLIER' | 'TRANSACTION';
  title: string;
  description?: string;
  date: Date;
  amount: number;
  status: string;
  reference?: string;
  highlights?: string;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, unknown>;
  useCount: number;
}

// Type labels will be resolved via t() inside the component
const typeLabelsKeys: Record<string, string> = {
  ENTRY: 'admin.search.typeEntry',
  INVOICE: 'admin.search.typeCustomerInvoice',
  SUPPLIER: 'admin.search.typeSupplierInvoice',
  TRANSACTION: 'admin.search.typeBankTransaction',
};

const typeColors: Record<string, string> = {
  ENTRY: 'bg-sky-100 text-sky-700',
  INVOICE: 'bg-green-100 text-green-700',
  SUPPLIER: 'bg-blue-100 text-blue-700',
  TRANSACTION: 'bg-purple-100 text-purple-700',
};

export default function SearchPage() {
  const { t, formatCurrency, formatDate } = useI18n();
  const typeLabels: Record<string, string> = Object.fromEntries(
    Object.entries(typeLabelsKeys).map(([k, v]) => [k, t(v)])
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    types: ['ENTRY', 'INVOICE', 'SUPPLIER', 'TRANSACTION'],
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    status: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Popular search terms
  const popularTerms = ['Stripe', t('admin.accounting.tax.tps'), t('admin.search.termRefund'), 'Postes Canada', 'Azure', 'Marketing'];

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        handleSearch();
        setSuggestions([]);
      } else {
        setResults([]);
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setSearchError(null);

    try {
      const params = new URLSearchParams({ q: query });
      if (filters.types.length < 4) {
        params.set('type', filters.types.join(','));
      }
      if (filters.dateFrom) params.set('from', filters.dateFrom);
      if (filters.dateTo) params.set('to', filters.dateTo);
      if (filters.status) params.set('status', filters.status);

      const response = await fetch(`/api/accounting/search?${params}`);
      if (!response.ok) throw new Error(`${t('admin.search.searchError')} (${response.status})`);
      const data = await response.json();
      setResults(data.results || data.data || []);
    } catch (err) {
      console.error('Error searching:', err);
      toast.error(t('common.errorOccurred'));
      setSearchError(t('admin.search.searchError'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSearch = () => {
    const name = prompt(t('admin.search.saveSearchPrompt'));
    if (!name) return;

    const newSearch: SavedSearch = {
      id: `saved-${Date.now()}`,
      name,
      query,
      filters,
      useCount: 0,
    };

    setSavedSearches(prev => [newSearch, ...prev]);
  };

  const applySavedSearch = (saved: SavedSearch) => {
    setQuery(saved.query);
    if (saved.filters.types) {
      setFilters(prev => ({ ...prev, types: saved.filters.types as string[] }));
    }
    
    // Update use count
    setSavedSearches(prev => prev.map(s =>
      s.id === saved.id ? { ...s, useCount: s.useCount + 1 } : s
    ));
  };

  const toggleType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type],
    }));
  };

  // formatCurrency is now provided by useI18n()

  // Facets (empty until loaded from API)
  const facets = {
    byType: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    byMonth: {} as Record<string, number>,
  };

  const theme = sectionThemes.overview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`border-l-4 ${theme.accentBar} pl-4 mb-6`}>
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.search.title')}</h1>
        <p className="text-slate-500 mt-1">{t('admin.search.subtitle')}</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('admin.search.searchPlaceholder')}
              className="w-full px-4 py-3 ps-12 bg-white border border-slate-200 rounded-xl text-slate-900 text-lg focus:border-sky-500 focus:outline-none"
              autoFocus
            />
            <span className="absolute start-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
            
            {loading && (
              <div className="absolute end-4 top-1/2 -translate-y-1/2" role="status" aria-label="Loading">
                <div className="animate-spin h-5 w-5 border-2 border-sky-500 border-t-transparent rounded-full"></div>
                <span className="sr-only">Loading...</span>
              </div>
            )}
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-xl border ${
              showFilters ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-200 text-slate-600'
            }`}
            aria-label={t('admin.search.filters')}
            aria-expanded={showFilters}
          >
            ⚙️ {t('admin.search.filters')}
          </button>
          
          {query && (
            <button
              onClick={handleSaveSearch}
              className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900"
            >
              ⭐ {t('admin.search.save')}
            </button>
          )}
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl overflow-hidden z-10">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => setQuery(suggestion)}
                className="w-full px-4 py-2 text-start text-slate-600 hover:bg-slate-100"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-2">{t('admin.search.documentType')}</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(typeLabels).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      filters.types.includes(type)
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('admin.search.dateFrom')}</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('admin.search.dateTo')}</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('admin.search.statusLabel')}</label>
              <select
                value={filters.status}
                onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm"
              >
                <option value="">{t('admin.search.all')}</option>
                <option value="POSTED">{t('admin.search.validated')}</option>
                <option value="DRAFT">{t('admin.search.draft')}</option>
                <option value="PAID">{t('admin.search.paid')}</option>
                <option value="PENDING">{t('admin.search.pendingStatus')}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Quick access */}
      {!query && (
        <div className="space-y-6">
          {/* Popular terms */}
          <div>
            <h3 className="text-sm text-slate-500 mb-2">{t('admin.search.popularSearches')}</h3>
            <div className="flex flex-wrap gap-2">
              {popularTerms.map(term => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-full text-sm text-slate-600"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Saved searches */}
          {savedSearches.length > 0 && (
            <div>
              <h3 className="text-sm text-slate-500 mb-2">{t('admin.search.savedSearches')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {savedSearches.map(saved => (
                  <button
                    key={saved.id}
                    onClick={() => applySavedSearch(saved)}
                    className="p-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-start"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-slate-900">⭐ {saved.name}</p>
                        <p className="text-sm text-slate-500 mt-1">"{saved.query}"</p>
                      </div>
                      <span className="text-xs text-slate-400">{saved.useCount}x</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(facets.byType).map(([type, count]) => (
              <button
                key={type}
                onClick={() => {
                  setFilters(prev => ({ ...prev, types: [type] }));
                  setQuery('*');
                }}
                className="p-4 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-start"
              >
                <span className={`px-2 py-1 rounded text-xs ${typeColors[type]}`}>
                  {typeLabels[type]}
                </span>
                <p className="text-2xl font-bold text-slate-900 mt-2">{count}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">
              {t('admin.search.resultCount', { count: results.length, query })}
            </p>
            <div className="flex gap-2">
              <select className="px-3 py-1 bg-white border border-slate-200 rounded text-sm text-slate-900">
                <option value="relevance">{t('admin.search.relevance')}</option>
                <option value="date">{t('admin.search.sortDate')}</option>
                <option value="amount">{t('admin.search.sortAmount')}</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {results.map(result => (
              <div
                key={result.id}
                className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${typeColors[result.type]}`}>
                        {typeLabels[result.type]}
                      </span>
                      <span className="font-medium text-slate-900">{result.title}</span>
                      {result.reference && (
                        <span className="text-sm text-slate-400">#{result.reference}</span>
                      )}
                    </div>
                    {result.description && (
                      <p className="text-sm text-slate-500 mt-1">{result.description}</p>
                    )}
                    {result.highlights && (
                      <p
                        className="text-sm text-slate-600 mt-2 [&_mark]:bg-sky-100 [&_mark]:text-sky-700"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.highlights, { ALLOWED_TAGS: ['mark'] }) }}
                      />
                    )}
                  </div>
                  <div className="text-end ms-4">
                    <p className="font-bold text-slate-900">{formatCurrency(result.amount)}</p>
                    <p className="text-sm text-slate-400">
                      {formatDate(result.date)}
                    </p>
                    <span className={`text-xs ${
                      result.status === 'POSTED' || result.status === 'PAID' || result.status === 'MATCHED'
                        ? 'text-green-600'
                        : 'text-yellow-600'
                    }`}>
                      {result.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {searchError && (
        <div className="bg-white rounded-xl p-8 border border-red-300 text-center">
          <p className="text-red-600">{searchError}</p>
        </div>
      )}

      {/* No results */}
      {query && !loading && !searchError && results.length === 0 && (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">{t('admin.search.noResults')}</h3>
          <p className="text-sm text-slate-500">
            {t('admin.search.noResultsHint')}
          </p>
        </div>
      )}
    </div>
  );
}
