'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Package, Pencil, Eye } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  comparePrice: number | null;
  isActive: boolean;
  createdAt: string;
  _count?: { items: number };
}

export default function AdminBundlesPage() {
  const { t } = useI18n();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBundles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/bundles');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setBundles(json.data || json.bundles || []);
    } catch {
      toast.error('Erreur chargement des bundles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBundles(); }, [fetchBundles]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title={t('admin.bundles.title') || 'Gestion des Bundles'}
        subtitle={t('admin.bundles.subtitle') || 'Creer et gerer les ensembles de produits'}
        actions={
          <Link
            href="/admin/bundles/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nouveau bundle
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : bundles.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-4">Aucun bundle cree</p>
          <Link
            href="/admin/bundles/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Creer un bundle
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundles.map(bundle => (
            <div key={bundle.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{bundle.name}</h3>
                  {bundle.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{bundle.description}</p>
                  )}
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                  bundle.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {bundle.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-lg font-bold text-slate-900">${Number(bundle.price).toFixed(2)}</span>
                {bundle.comparePrice && Number(bundle.comparePrice) > Number(bundle.price) && (
                  <span className="text-sm text-slate-400 line-through">${Number(bundle.comparePrice).toFixed(2)}</span>
                )}
              </div>

              {bundle._count && (
                <p className="text-xs text-slate-500 mb-3">{bundle._count.items} produit(s)</p>
              )}

              <div className="flex items-center gap-2">
                <Link
                  href={`/bundles/${bundle.slug}`}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Voir
                </Link>
                <Link
                  href={`/admin/bundles/${bundle.id}/edit`}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Modifier
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
