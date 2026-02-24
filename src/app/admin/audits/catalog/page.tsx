'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import PageHeader from '@/components/admin/PageHeader';

interface AuditFn {
  id: string;
  name: string;
  filePath: string;
  type: string;
  exportType: string | null;
  description: string | null;
  relatedModels: string | null;
  relatedAPIs: string | null;
  linesOfCode: number | null;
  status: string;
}

const typeColors: Record<string, string> = {
  api_handler: 'bg-emerald-100 text-emerald-800',
  page: 'bg-sky-100 text-sky-800',
  component: 'bg-purple-100 text-purple-800',
  hook: 'bg-amber-100 text-amber-800',
  lib: 'bg-slate-100 text-slate-800',
  middleware: 'bg-pink-100 text-pink-800',
};

export default function AuditCatalogPage() {
  const { locale } = useI18n();
  const isFr = locale === 'fr';

  const [functions, setFunctions] = useState<AuditFn[]>([]);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (typeFilter) params.set('type', typeFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/audits/catalog?${params}`);
      const json = await res.json();
      if (json.data) {
        setFunctions(json.data.functions);
        setTypeCounts(json.data.typeCounts);
        setPagination(json.data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch catalog:', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const totalFunctions = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  if (loading && functions.length === 0) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="h-64 bg-slate-200 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin/audits" className="hover:text-sky-600">
          {isFr ? 'Audits' : 'Audits'}
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">{isFr ? 'Catalogue' : 'Catalog'}</span>
      </div>

      <PageHeader
        title={isFr ? 'Catalogue de Fonctions' : 'Function Catalog'}
        subtitle={isFr
          ? `${totalFunctions} fonctions cataloguées dans le codebase`
          : `${totalFunctions} functions cataloged in the codebase`}
      />

      {/* Type counts */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter('')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !typeFilter ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {isFr ? 'Tous' : 'All'} ({totalFunctions})
        </button>
        {Object.entries(typeCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([type, count]) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type === typeFilter ? '' : type)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                typeFilter === type
                  ? 'bg-sky-50 border-sky-300 text-sky-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {type} ({count})
            </button>
          ))}
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isFr ? 'Rechercher par nom, fichier ou description...' : 'Search by name, file, or description...'}
          className="w-full sm:w-96 text-sm border border-slate-300 rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
        />
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-start px-4 py-2.5 font-medium text-slate-600 w-20">{isFr ? 'Type' : 'Type'}</th>
              <th className="text-start px-4 py-2.5 font-medium text-slate-600">{isFr ? 'Nom' : 'Name'}</th>
              <th className="text-start px-4 py-2.5 font-medium text-slate-600 hidden md:table-cell">{isFr ? 'Fichier' : 'File'}</th>
              <th className="text-start px-4 py-2.5 font-medium text-slate-600 w-16 hidden lg:table-cell">{isFr ? 'Lignes' : 'Lines'}</th>
              <th className="text-start px-4 py-2.5 font-medium text-slate-600 w-20">{isFr ? 'Export' : 'Export'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {functions.map((fn) => (
              <>
                <tr
                  key={fn.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === fn.id ? null : fn.id)}
                >
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[fn.type] || 'bg-slate-100 text-slate-700'}`}>
                      {fn.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-800 font-mono text-xs">{fn.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs hidden md:table-cell truncate max-w-xs">
                    {fn.filePath}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs hidden lg:table-cell">{fn.linesOfCode || '-'}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{fn.exportType || '-'}</td>
                </tr>
                {expandedId === fn.id && (
                  <tr key={`${fn.id}-detail`}>
                    <td colSpan={5} className="px-4 py-3 bg-slate-50">
                      <div className="space-y-2 text-xs">
                        {fn.description && <p className="text-slate-700">{fn.description}</p>}
                        <p className="text-slate-500 font-mono">{fn.filePath}</p>
                        {fn.relatedModels && (
                          <div>
                            <span className="font-medium text-slate-600">{isFr ? 'Modèles Prisma:' : 'Prisma Models:'}</span>{' '}
                            <span className="text-slate-500">{JSON.parse(fn.relatedModels).join(', ') || 'None'}</span>
                          </div>
                        )}
                        {fn.relatedAPIs && (
                          <div>
                            <span className="font-medium text-slate-600">{isFr ? 'Routes API:' : 'API Routes:'}</span>{' '}
                            <span className="text-slate-500">{JSON.parse(fn.relatedAPIs).join(', ') || 'None'}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {functions.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            {isFr ? 'Aucune fonction trouvée.' : 'No functions found.'}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              {isFr ? 'Page' : 'Page'} {pagination.page} / {pagination.totalPages} ({pagination.total} {isFr ? 'fonctions' : 'functions'})
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchData(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="text-xs px-3 py-1 border rounded disabled:opacity-50"
              >
                {isFr ? 'Précédent' : 'Previous'}
              </button>
              <button
                onClick={() => fetchData(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="text-xs px-3 py-1 border rounded disabled:opacity-50"
              >
                {isFr ? 'Suivant' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
