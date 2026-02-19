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
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

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

export default function LivraisonPage() {
  const { t } = useI18n();
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

  const toggleZoneActive = async (id: string) => {
    const zone = zones.find(z => z.id === id);
    if (!zone) return;

    const newActive = !zone.isActive;
    // Optimistic update
    setZones(zones.map(z => z.id === id ? { ...z, isActive: newActive } : z));

    try {
      const res = await fetch(`/api/admin/shipping/zones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive }),
      });
      if (!res.ok) {
        // Revert on failure
        setZones(zones.map(z => z.id === id ? { ...z, isActive: !newActive } : z));
        toast.error(t('admin.shipping.updateError') || 'Failed to update zone');
      }
    } catch {
      setZones(zones.map(z => z.id === id ? { ...z, isActive: !newActive } : z));
      toast.error(t('admin.shipping.updateError') || 'Failed to update zone');
    }
  };

  const toggleMethodActive = async (zoneId: string, methodId: string) => {
    // The methods are synthesized from the zone data on the API side.
    // Each zone currently has a single synthesized method where the method's
    // isActive mirrors the zone's isActive. For now, toggling a method also
    // toggles the zone's isActive since there is no separate ShippingMethod model.
    // This is a pragmatic approach until a dedicated ShippingMethod table is added.
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;

    const method = zone.methods.find(m => m.id === methodId);
    if (!method) return;

    const newActive = !method.isActive;

    // Optimistic update
    setZones(zones.map(z => {
      if (z.id === zoneId) {
        return {
          ...z,
          methods: z.methods.map(m =>
            m.id === methodId ? { ...m, isActive: newActive } : m
          ),
        };
      }
      return z;
    }));

    try {
      const res = await fetch(`/api/admin/shipping/zones/${zoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive }),
      });
      if (!res.ok) {
        // Revert on failure
        setZones(zones.map(z => {
          if (z.id === zoneId) {
            return {
              ...z,
              methods: z.methods.map(m =>
                m.id === methodId ? { ...m, isActive: !newActive } : m
              ),
            };
          }
          return z;
        }));
        toast.error(t('admin.shipping.updateError') || 'Failed to update shipping method');
      }
    } catch {
      setZones(zones.map(z => {
        if (z.id === zoneId) {
          return {
            ...z,
            methods: z.methods.map(m =>
              m.id === methodId ? { ...m, isActive: !newActive } : m
            ),
          };
        }
        return z;
      }));
      toast.error(t('admin.shipping.updateError') || 'Failed to update shipping method');
    }
  };

  const getCountryName = (code: string): string => {
    return t(`admin.shipping.countries.${code}`) || code;
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
        title={t('admin.shipping.title')}
        subtitle={t('admin.shipping.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setShowForm(true)}
          >
            {t('admin.shipping.newZone')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label={t('admin.shipping.zones')}
          value={zones.length}
          icon={MapPin}
        />
        <StatCard
          label={t('admin.shipping.active')}
          value={zones.filter(z => z.isActive).length}
          icon={Check}
          className="!border-green-200 !bg-green-50"
        />
        <StatCard
          label={t('admin.shipping.countriesCovered')}
          value={new Set(zones.flatMap(z => z.countries)).size}
          icon={Globe}
          className="!border-sky-200 !bg-sky-50"
        />
        <StatCard
          label={t('admin.shipping.methods')}
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
                        {getCountryName(code)}
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
                    {t('admin.shipping.edit')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase">
                    <th className="text-start py-2">{t('admin.shipping.method')}</th>
                    <th className="text-start py-2">{t('admin.shipping.carrier')}</th>
                    <th className="text-center py-2">{t('admin.shipping.delay')}</th>
                    <th className="text-end py-2">{t('admin.shipping.price')}</th>
                    <th className="text-end py-2">{t('admin.shipping.freeAbove')}</th>
                    <th className="text-center py-2">{t('admin.shipping.activeCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {zone.methods.map((method) => (
                    <tr key={method.id} className={!method.isActive ? 'opacity-50' : ''}>
                      <td className="py-3 font-medium text-slate-900">{method.name}</td>
                      <td className="py-3 text-slate-600">{method.carrier}</td>
                      <td className="py-3 text-center text-slate-600">
                        {method.minDays}-{method.maxDays} {t('admin.shipping.days')}
                      </td>
                      <td className="py-3 text-end font-medium text-slate-900">
                        {method.price.toFixed(2)} $
                      </td>
                      <td className="py-3 text-end text-slate-600">
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
                {t('admin.shipping.addMethod')}
              </button>
            </div>
          </div>
        ))}

        {zones.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-slate-200 rounded-lg">
            <div className="p-3 bg-slate-100 rounded-xl mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-900">{t('admin.shipping.emptyTitle')}</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm">
              {t('admin.shipping.emptyDescription')}
            </p>
            <div className="mt-4">
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setShowForm(true)}
              >
                {t('admin.shipping.newZone')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={modalIsOpen}
        onClose={() => { setShowForm(false); setEditingZone(null); }}
        title={editingZone ? t('admin.shipping.editZone') : t('admin.shipping.newZoneTitle')}
        size="md"
        footer={
          <Button
            variant="secondary"
            onClick={() => { setShowForm(false); setEditingZone(null); }}
          >
            {t('admin.shipping.close')}
          </Button>
        }
      >
        <p className="text-slate-500">{t('admin.shipping.inDevelopment')}</p>
      </Modal>
    </>
  );
}
