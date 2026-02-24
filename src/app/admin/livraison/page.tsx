/**
 * ADMIN - GESTION DES ZONES DE LIVRAISON
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { useRibbonAction } from '@/hooks/useRibbonAction';

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
  const { t, formatCurrency } = useI18n();
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
      console.error('Error fetching shipping zones:', err);
      toast.error(t('common.error'));
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

  const [formName, setFormName] = useState('');
  const [formCountries, setFormCountries] = useState('');
  const [formBaseFee, setFormBaseFee] = useState('0');
  const [formPerItemFee, setFormPerItemFee] = useState('0');
  const [formFreeThreshold, setFormFreeThreshold] = useState('');
  const [formMinDays, setFormMinDays] = useState('3');
  const [formMaxDays, setFormMaxDays] = useState('7');
  const [saving, setSaving] = useState(false);

  // Add Method modal state
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [addMethodZoneId, setAddMethodZoneId] = useState<string | null>(null);
  const [methodName, setMethodName] = useState('');
  const [methodCarrier, setMethodCarrier] = useState('');
  const [methodBaseRate, setMethodBaseRate] = useState('0');
  const [methodMinDays, setMethodMinDays] = useState('3');
  const [methodMaxDays, setMethodMaxDays] = useState('7');
  const [methodFreeAbove, setMethodFreeAbove] = useState('');
  const [savingMethod, setSavingMethod] = useState(false);

  const resetForm = () => {
    setFormName('');
    setFormCountries('');
    setFormBaseFee('0');
    setFormPerItemFee('0');
    setFormFreeThreshold('');
    setFormMinDays('3');
    setFormMaxDays('7');
  };

  const loadZoneIntoForm = (zone: ShippingZone) => {
    setFormName(zone.name);
    setFormCountries(zone.countries.join(', '));
    const method = zone.methods[0];
    if (method) {
      setFormBaseFee(String(method.price));
      setFormMinDays(String(method.minDays));
      setFormMaxDays(String(method.maxDays));
      setFormFreeThreshold(method.freeAbove ? String(method.freeAbove) : '');
    }
    setFormPerItemFee('0');
  };

  const handleSaveZone = async () => {
    if (!formName.trim()) {
      toast.error(t('admin.shipping.nameRequired') || 'Zone name is required');
      return;
    }
    const countries = formCountries.split(',').map(c => c.trim()).filter(Boolean);
    if (countries.length === 0) {
      toast.error(t('admin.shipping.countriesRequired') || 'At least one country is required');
      return;
    }
    setSaving(true);
    const payload = {
      name: formName.trim(),
      countries,
      baseFee: parseFloat(formBaseFee) || 0,
      perItemFee: parseFloat(formPerItemFee) || 0,
      freeShippingThreshold: formFreeThreshold ? parseFloat(formFreeThreshold) : null,
      estimatedDaysMin: parseInt(formMinDays) || 3,
      estimatedDaysMax: parseInt(formMaxDays) || 7,
    };
    try {
      const url = editingZone
        ? `/api/admin/shipping/zones/${editingZone.id}`
        : '/api/admin/shipping/zones';
      const res = await fetch(url, {
        method: editingZone ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(editingZone
          ? (t('admin.shipping.zoneUpdated') || 'Zone updated')
          : (t('admin.shipping.zoneCreated') || 'Zone created'));
        setShowForm(false);
        setEditingZone(null);
        resetForm();
        await fetchZones();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save zone');
      }
    } catch {
      toast.error('Failed to save zone');
    } finally {
      setSaving(false);
    }
  };

  const openAddMethodModal = (zoneId: string) => {
    setAddMethodZoneId(zoneId);
    setMethodName('');
    setMethodCarrier('');
    setMethodBaseRate('0');
    setMethodMinDays('3');
    setMethodMaxDays('7');
    setMethodFreeAbove('');
    setShowAddMethodModal(true);
  };

  const handleAddMethod = async () => {
    if (!addMethodZoneId || !methodName.trim()) {
      toast.error(t('admin.shipping.nameRequired') || 'Method name is required');
      return;
    }
    setSavingMethod(true);
    try {
      // Since there's no dedicated ShippingMethod model yet, we update the zone
      // with new method data. The API synthesizes methods from zone data.
      // For now, we update the zone's base fee and delivery days via PATCH.
      const res = await fetch(`/api/admin/shipping/zones/${addMethodZoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseFee: parseFloat(methodBaseRate) || 0,
          estimatedDaysMin: parseInt(methodMinDays) || 3,
          estimatedDaysMax: parseInt(methodMaxDays) || 7,
          freeShippingThreshold: methodFreeAbove ? parseFloat(methodFreeAbove) : null,
          notes: `Method: ${methodName.trim()} | Carrier: ${methodCarrier.trim()}`,
        }),
      });
      if (res.ok) {
        toast.success(t('admin.shipping.methodCreated'));
        setShowAddMethodModal(false);
        await fetchZones();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.shipping.methodError'));
      }
    } catch {
      toast.error(t('admin.shipping.methodError'));
    } finally {
      setSavingMethod(false);
    }
  };

  const getCountryName = (code: string): string => {
    return t(`admin.shipping.countries.${code}`) || code;
  };

  // Ribbon action handlers
  const handleRibbonSave = useCallback(() => {
    handleSaveZone();
  }, []);

  const handleRibbonResetDefaults = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonImportConfig = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonExportConfig = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonTest = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  useRibbonAction('save', handleRibbonSave);
  useRibbonAction('resetDefaults', handleRibbonResetDefaults);
  useRibbonAction('importConfig', handleRibbonImportConfig);
  useRibbonAction('exportConfig', handleRibbonExportConfig);
  useRibbonAction('test', handleRibbonTest);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                    onClick={() => { setEditingZone(zone); loadZoneIntoForm(zone); }}
                  >
                    {t('admin.shipping.edit')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 overflow-x-auto">
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
                        {formatCurrency(method.price)}
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
              <button
                onClick={() => openAddMethodModal(zone.id)}
                className="mt-3 text-sm text-sky-600 hover:text-sky-700 inline-flex items-center gap-1"
              >
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
        onClose={() => { setShowForm(false); setEditingZone(null); resetForm(); }}
        title={editingZone ? t('admin.shipping.editZone') : t('admin.shipping.newZoneTitle')}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.zoneName') || 'Zone Name'}</label>
            <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Canada, USA, Europe..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.countriesLabel') || 'Countries (comma-separated ISO codes)'}</label>
            <input type="text" value={formCountries} onChange={e => setFormCountries(e.target.value)} placeholder="CA, US, FR, DE..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
            <p className="text-xs text-slate-400 mt-1">{t('admin.shipping.countriesHint') || 'Use ISO 3166-1 alpha-2 codes'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.baseFee') || 'Base Fee ($)'}</label>
              <input type="number" step="0.01" min="0" value={formBaseFee} onChange={e => setFormBaseFee(e.target.value)} aria-label={t('admin.shipping.baseFee') || 'Base Fee'} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.perItemFee') || 'Per Item Fee ($)'}</label>
              <input type="number" step="0.01" min="0" value={formPerItemFee} onChange={e => setFormPerItemFee(e.target.value)} aria-label={t('admin.shipping.perItemFee') || 'Per Item Fee'} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.freeAbove') || 'Free Shipping Threshold ($)'}</label>
            <input type="number" step="0.01" min="0" value={formFreeThreshold} onChange={e => setFormFreeThreshold(e.target.value)} placeholder={t('admin.shipping.optional') || 'Optional'} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.minDays') || 'Min Delivery Days'}</label>
              <input type="number" min="1" value={formMinDays} onChange={e => setFormMinDays(e.target.value)} aria-label={t('admin.shipping.minDays') || 'Min Delivery Days'} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.maxDays') || 'Max Delivery Days'}</label>
              <input type="number" min="1" value={formMaxDays} onChange={e => setFormMaxDays(e.target.value)} aria-label={t('admin.shipping.maxDays') || 'Max Delivery Days'} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditingZone(null); resetForm(); }}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" onClick={handleSaveZone} loading={saving}>
              {editingZone ? (t('common.save') || 'Save') : (t('admin.shipping.createZone') || 'Create Zone')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Method Modal */}
      <Modal
        isOpen={showAddMethodModal}
        onClose={() => setShowAddMethodModal(false)}
        title={t('admin.shipping.addMethodTitle')}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.methodName')}</label>
            <input
              type="text"
              value={methodName}
              onChange={e => setMethodName(e.target.value)}
              placeholder="Standard, Express, Economy..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.methodCarrier')}</label>
            <input
              type="text"
              value={methodCarrier}
              onChange={e => setMethodCarrier(e.target.value)}
              placeholder="Canada Post, UPS, FedEx..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.methodBaseRate')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={methodBaseRate}
              onChange={e => setMethodBaseRate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.methodMinDays')}</label>
              <input
                type="number"
                min="1"
                value={methodMinDays}
                onChange={e => setMethodMinDays(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.methodMaxDays')}</label>
              <input
                type="number"
                min="1"
                value={methodMaxDays}
                onChange={e => setMethodMaxDays(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.shipping.methodFreeAbove')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={methodFreeAbove}
              onChange={e => setMethodFreeAbove(e.target.value)}
              placeholder={t('admin.shipping.optional') || 'Optional'}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowAddMethodModal(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" onClick={handleAddMethod} loading={savingMethod}>
              {t('admin.shipping.addMethod')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
