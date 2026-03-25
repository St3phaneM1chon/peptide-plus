'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';
import { Package, BookOpen, Clock, Star } from 'lucide-react';

interface BundleItem {
  course: { id: string; title: string; slug: string; thumbnailUrl: string | null; estimatedHours: number | null; level: string };
}

interface Bundle {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  price: number | null;
  corporatePrice: number | null;
  courseCount: number;
  enrollmentCount: number;
  items: BundleItem[];
}

export default function ForfaitsPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslations();

  useEffect(() => {
    fetch('/api/lms/bundles')
      .then(r => r.json())
      .then(d => setBundles(d.data ?? []))
      .catch(() => setBundles([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t('common.loading')}</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-3">{t('learn.bundles.bundleCatalog')}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Nos forfaits regroupent les formations essentielles pour votre certification.
          Economisez en choisissant un forfait plutot que des cours individuels.
        </p>
      </div>

      {bundles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t('learn.bundles.noBundles')}</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {bundles.map(bundle => {
            const totalHours = bundle.items.reduce((sum, item) => sum + Number(item.course.estimatedHours ?? 0), 0);
            return (
              <Link key={bundle.id} href={`/learn/forfaits/${bundle.slug}`} className="group">
                <div className="rounded-xl border overflow-hidden transition-shadow hover:shadow-lg">
                  {/* Header */}
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="h-5 w-5 text-primary" />
                      <span className="text-xs font-medium text-primary uppercase tracking-wide">Forfait</span>
                    </div>
                    <h2 className="text-xl font-bold group-hover:text-primary transition-colors">{bundle.name}</h2>
                    {bundle.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{bundle.description}</p>
                    )}
                  </div>

                  {/* Course list */}
                  <div className="p-4 space-y-2">
                    {bundle.items.map((item, i) => (
                      <div key={item.course.id} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">{i + 1}</span>
                        <span className="truncate">{item.course.title}</span>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="border-t p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {bundle.courseCount} cours</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {totalHours}h</span>
                        {bundle.enrollmentCount > 0 && (
                          <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" /> {bundle.enrollmentCount} inscrit(s)</span>
                        )}
                      </div>
                      <div className="text-right">
                        {bundle.price ? (
                          <span className="text-lg font-bold">{Number(bundle.price).toFixed(0)} $</span>
                        ) : (
                          <span className="text-lg font-bold text-green-600">Gratuit</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
