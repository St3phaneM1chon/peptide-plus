'use client';

import { useState, useEffect } from 'react';

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zones de livraison</h1>
          <p className="text-gray-500">Configurez les zones et méthodes de livraison</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle zone
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Zones</p>
          <p className="text-2xl font-bold text-gray-900">{zones.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Actives</p>
          <p className="text-2xl font-bold text-green-700">{zones.filter(z => z.isActive).length}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">Pays couverts</p>
          <p className="text-2xl font-bold text-blue-700">
            {new Set(zones.flatMap(z => z.countries)).size}
          </p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-600">Méthodes</p>
          <p className="text-2xl font-bold text-amber-700">
            {zones.reduce((sum, z) => sum + z.methods.length, 0)}
          </p>
        </div>
      </div>

      {/* Zones List */}
      <div className="space-y-4">
        {zones.map((zone) => (
          <div 
            key={zone.id} 
            className={`bg-white rounded-xl border ${zone.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{zone.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {zone.countries.map((code) => (
                      <span key={code} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {countriesData[code] || code}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleZoneActive(zone.id)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      zone.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      zone.isActive ? 'right-1' : 'left-1'
                    }`} />
                  </button>
                  <button
                    onClick={() => setEditingZone(zone)}
                    className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm hover:bg-amber-200"
                  >
                    Modifier
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase">
                    <th className="text-left py-2">Méthode</th>
                    <th className="text-left py-2">Transporteur</th>
                    <th className="text-center py-2">Délai</th>
                    <th className="text-right py-2">Prix</th>
                    <th className="text-right py-2">Gratuit dès</th>
                    <th className="text-center py-2">Actif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {zone.methods.map((method) => (
                    <tr key={method.id} className={!method.isActive ? 'opacity-50' : ''}>
                      <td className="py-3 font-medium text-gray-900">{method.name}</td>
                      <td className="py-3 text-gray-600">{method.carrier}</td>
                      <td className="py-3 text-center text-gray-600">
                        {method.minDays}-{method.maxDays} jours
                      </td>
                      <td className="py-3 text-right font-medium text-gray-900">
                        {method.price.toFixed(2)} $
                      </td>
                      <td className="py-3 text-right text-gray-600">
                        {method.freeAbove ? `${method.freeAbove} $` : '-'}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => toggleMethodActive(zone.id, method.id)}
                          className={`w-10 h-5 rounded-full transition-colors relative ${
                            method.isActive ? 'bg-green-500' : 'bg-gray-300'
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
              <button className="mt-3 text-sm text-amber-600 hover:text-amber-700">
                + Ajouter une méthode
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {(showForm || editingZone) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingZone ? 'Modifier la zone' : 'Nouvelle zone'}
            </h2>
            <p className="text-gray-500 mb-4">Fonctionnalité en cours de développement...</p>
            <button
              onClick={() => { setShowForm(false); setEditingZone(null); }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
