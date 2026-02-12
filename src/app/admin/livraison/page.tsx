/**
 * ADMIN - GESTION DES ZONES DE LIVRAISON
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  MapPin,
  Truck,
  Globe,
  Package,
  Pencil,
  Check,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  StatCard,
} from '@/components/admin';

interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  methods: Array<{
    id: string;
    name: string;
    carrier: string;
    minDays: number;
    maxDays: number;
    price: number;
    freeAbove?: number;
    isActive: boolean;
  }>;
  isActive: boolean;
}

const countriesData: Record<string, string> = {
  CA: 'Canada',
  US: 'États-Unis',
  FR: 'France',
  GB: 'Royaume-Uni',
  DE: 'Allemagne',
  ES: 'Espagne',
  IT: 'Italie',
  AU: 'Australie',
  MX: 'Mexique',
  BR: 'Brésil',
};

export default function LivraisonPage() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const res = await fetch('/api/admin/shipping/zones');
      const data = await res.json();
      setZones(data.zones || []);
    } catch (err) {
      setZones([]);
    }
    setLoading(false);
  };

  const toggleZoneActive = (id: string) => {
    setZones(zones.map(z => z.id === id ? { ...z, isActive: !z.isActive } : z));
  };

  const toggleMethodActive = (zoneId: string, methodId: string) => {
    setZones(zones.map(z => {
      if (z.id === zoneId) {
        return {
          ...z,
          methods: z.methods.map(m =>
            m.id === methodId ? { ...m, isActive: !m.isActive } : m
          ),
        };
      }
      return z;
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  const modalIsOpen = showForm || !!editingZone;

  return (
    <>
      <PageHeader
        title="Zones de livraison"
        subtitle="Configurez les zones et méthodes de livraison"
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setShowForm(true)}
          >
            Nouvelle zone
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Zones"
          value={zones.length}
          icon={MapPin}
        />
        <StatCard
          label="Actives"
          value={zones.filter(z => z.isActive).length}
          icon={Check}
          className="!border-green-200 !bg-green-50"
        />
        <StatCard
          label="Pays couverts"
          value={new Set(zones.flatMap(z => z.countries)).size}
          icon={Globe}
          className="!border-sky-200 !bg-sky-50"
        />
        <StatCard
          label="Méthodes"
          value={zones.reduce((sum, z) => sum + z.methods.length, 0)}
          icon={Truck}
          className="!border-sky-200 !bg-sky-50"
        />
      </div>

      {/* Zones List */}
      <div className="space-y-4">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className={`bg-white rounded-lg border ${zone.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}
          >
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg">{zone.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {zone.countries.map((code) => (
                      <span key={code} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                        {countriesData[code] || code}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleZoneActive(zone.id)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      zone.isActive ? 'bg-green-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      zone.isActive ? 'right-1' : 'left-1'
                    }`} />
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Pencil}
                    onClick={() => setEditingZone(zone)}
                  >
                    Modifier
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase">
                    <th className="text-left py-2">Méthode</th>
                    <th className="text-left py-2">Transporteur</th>
                    <th className="text-center py-2">Délai</th>
                    <th className="text-right py-2">Prix</th>
                    <th className="text-right py-2">Gratuit dès</th>
                    <th className="text-center py-2">Actif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {zone.methods.map((method) => (
                    <tr key={method.id} className={!method.isActive ? 'opacity-50' : ''}>
                      <td className="py-3 font-medium text-slate-900">{method.name}</td>
                      <td className="py-3 text-slate-600">{method.carrier}</td>
                      <td className="py-3 text-center text-slate-600">
                        {method.minDays}-{method.maxDays} jours
                      </td>
                      <td className="py-3 text-right font-medium text-slate-900">
                        {method.price.toFixed(2)} $
                      </td>
                      <td className="py-3 text-right text-slate-600">
                        {method.freeAbove ? `${method.freeAbove} $` : '-'}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => toggleMethodActive(zone.id, method.id)}
                          className={`w-10 h-5 rounded-full transition-colors relative ${
                            method.isActive ? 'bg-green-500' : 'bg-slate-300'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            method.isActive ? 'right-0.5' : 'left-0.5'
                          }`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="mt-3 text-sm text-sky-600 hover:text-sky-700 inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                Ajouter une méthode
              </button>
            </div>
          </div>
        ))}

        {zones.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-slate-200 rounded-lg">
            <div className="p-3 bg-slate-100 rounded-xl mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-900">Aucune zone de livraison</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm">
              Créez votre première zone pour configurer les options de livraison.
            </p>
            <div className="mt-4">
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setShowForm(true)}
              >
                Nouvelle zone
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={modalIsOpen}
        onClose={() => { setShowForm(false); setEditingZone(null); }}
        title={editingZone ? 'Modifier la zone' : 'Nouvelle zone'}
        size="md"
        footer={
          <Button
            variant="secondary"
            onClick={() => { setShowForm(false); setEditingZone(null); }}
          >
            Fermer
          </Button>
        }
      >
        <p className="text-slate-500">Fonctionnalité en cours de développement...</p>
      </Modal>
    </>
  );
}
