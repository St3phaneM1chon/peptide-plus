'use client';

import { useState, useEffect } from 'react';

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
  filters: any;
  useCount: number;
}

const typeLabels: Record<string, string> = {
  ENTRY: 'Écriture',
  INVOICE: 'Facture client',
  SUPPLIER: 'Facture fournisseur',
  TRANSACTION: 'Transaction bancaire',
};

const typeColors: Record<string, string> = {
  ENTRY: 'bg-amber-900/30 text-amber-400',
  INVOICE: 'bg-green-900/30 text-green-400',
  SUPPLIER: 'bg-blue-900/30 text-blue-400',
  TRANSACTION: 'bg-purple-900/30 text-purple-400',
};

export default function SearchPage() {
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
  const popularTerms = ['Stripe', 'TPS', 'Remboursement', 'Postes Canada', 'Azure', 'Marketing'];

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
  }, [query]);

  const handleSearch = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({ q: query });
      if (filters.types.length < 4) {
        params.set('types', filters.types.join(','));
      }
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.status) params.set('status', filters.status);

      const response = await fetch(`/api/accounting/search?${params}`);
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Error searching:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSearch = () => {
    const name = prompt('Nom de la recherche sauvegardée:');
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
      setFilters(prev => ({ ...prev, types: saved.filters.types }));
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

  const formatCurrency = (amount: number) => 
    amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });

  // Facets (empty until loaded from API)
  const facets = {
    byType: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    byMonth: {} as Record<string, number>,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Recherche avancée</h1>
        <p className="text-neutral-400 mt-1">Trouvez rapidement vos écritures, factures et transactions</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par numéro, description, montant, référence..."
              className="w-full px-4 py-3 pl-12 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-lg focus:border-amber-500 focus:outline-none"
              autoFocus
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
            
            {loading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="animate-spin h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-xl border ${
              showFilters ? 'bg-amber-600 border-amber-600 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-300'
            }`}
          >
            ⚙️ Filtres
          </button>
          
          {query && (
            <button
              onClick={handleSaveSearch}
              className="px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-300 hover:text-white"
            >
              ⭐ Sauvegarder
            </button>
          )}
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden z-10">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => setQuery(suggestion)}
                className="w-full px-4 py-2 text-left text-neutral-300 hover:bg-neutral-700"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-neutral-400 mb-2">Type de document</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(typeLabels).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      filters.types.includes(type)
                        ? 'bg-amber-600 text-white'
                        : 'bg-neutral-700 text-neutral-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Date du</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Date au</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Statut</label>
              <select
                value={filters.status}
                onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white text-sm"
              >
                <option value="">Tous</option>
                <option value="POSTED">Validé</option>
                <option value="DRAFT">Brouillon</option>
                <option value="PAID">Payé</option>
                <option value="PENDING">En attente</option>
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
            <h3 className="text-sm text-neutral-400 mb-2">Recherches populaires</h3>
            <div className="flex flex-wrap gap-2">
              {popularTerms.map(term => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-full text-sm text-neutral-300"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Saved searches */}
          {savedSearches.length > 0 && (
            <div>
              <h3 className="text-sm text-neutral-400 mb-2">Recherches sauvegardées</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {savedSearches.map(saved => (
                  <button
                    key={saved.id}
                    onClick={() => applySavedSearch(saved)}
                    className="p-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-left"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-white">⭐ {saved.name}</p>
                        <p className="text-sm text-neutral-400 mt-1">"{saved.query}"</p>
                      </div>
                      <span className="text-xs text-neutral-500">{saved.useCount}x</span>
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
                className="p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-left"
              >
                <span className={`px-2 py-1 rounded text-xs ${typeColors[type]}`}>
                  {typeLabels[type]}
                </span>
                <p className="text-2xl font-bold text-white mt-2">{count}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-neutral-400">
              {results.length} résultat{results.length > 1 ? 's' : ''} pour "{query}"
            </p>
            <div className="flex gap-2">
              <select className="px-3 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-white">
                <option value="relevance">Pertinence</option>
                <option value="date">Date</option>
                <option value="amount">Montant</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {results.map(result => (
              <div
                key={result.id}
                className="bg-neutral-800 rounded-xl p-4 border border-neutral-700 hover:border-neutral-600 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${typeColors[result.type]}`}>
                        {typeLabels[result.type]}
                      </span>
                      <span className="font-medium text-white">{result.title}</span>
                      {result.reference && (
                        <span className="text-sm text-neutral-500">#{result.reference}</span>
                      )}
                    </div>
                    {result.description && (
                      <p className="text-sm text-neutral-400 mt-1">{result.description}</p>
                    )}
                    {result.highlights && (
                      <p 
                        className="text-sm text-neutral-300 mt-2 [&_mark]:bg-amber-500/30 [&_mark]:text-amber-300"
                        dangerouslySetInnerHTML={{ __html: result.highlights }}
                      />
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-white">{formatCurrency(result.amount)}</p>
                    <p className="text-sm text-neutral-500">
                      {result.date.toLocaleDateString('fr-CA')}
                    </p>
                    <span className={`text-xs ${
                      result.status === 'POSTED' || result.status === 'PAID' || result.status === 'MATCHED'
                        ? 'text-green-400'
                        : 'text-amber-400'
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

      {/* No results */}
      {query && !loading && results.length === 0 && (
        <div className="bg-neutral-800 rounded-xl p-8 border border-neutral-700 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-white mb-2">Aucun résultat</h3>
          <p className="text-sm text-neutral-400">
            Essayez avec d'autres termes ou ajustez vos filtres
          </p>
        </div>
      )}
    </div>
  );
}
