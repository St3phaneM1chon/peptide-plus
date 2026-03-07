'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileDown,
  Loader2,
  Package,
  PackageCheck,
  AlertTriangle,
  PackageX,
  DollarSign,
  Pencil,
  History,
  Check,
  X,
  Bell,
  BarChart3,
  ArrowRightLeft,
  Clock,
  TrendingDown,
  Plus,
  Building2,
  ClipboardList,
  Globe,
  Phone,
  Mail,
  Scale,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { Input } from '@/components/admin/FormField';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { useI18n } from '@/i18n/client';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { addCSRFHeader } from '@/lib/csrf';

// ── Types ─────────────────────────────────────────────────────

interface ProductFormat {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  formatName: string;
  sku?: string;
  price: number;
  stockQuantity: number;
  lowStockThreshold: number;
  availability: string;
  isActive: boolean;
}

interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  notes?: string;
  isActive?: boolean;
  createdAt?: string;
}

interface PurchaseOrder {
  id: string;
  supplierId: string;
  items: { productId: string; formatId?: string; quantity: number; unitCost: number }[];
  expectedDelivery?: string;
  notes?: string;
  status: 'DRAFT' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
  totalCost: number;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

type InventoryTab = 'stock' | 'suppliers' | 'purchase-orders' | 'reconciliation';

// ── Suppliers Sub-Component ──────────────────────────────────

function SuppliersTab() {
  const { t } = useI18n();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', contactName: '', email: '', phone: '', address: '', website: '', notes: '' });

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/inventory/suppliers');
      const data = await res.json();
      setSuppliers(data.suppliers || []);
    } catch {
      toast.error(t('common.error'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Supplier name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/inventory/suppliers', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: form.name,
          contactName: form.contactName || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          website: form.website || undefined,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to create supplier');
        return;
      }
      const newSupplier = await res.json();
      setSuppliers(prev => [...prev, newSupplier]);
      setForm({ name: '', contactName: '', email: '', phone: '', address: '', website: '', notes: '' });
      setShowForm(false);
      toast.success('Supplier created');
    } catch {
      toast.error(t('common.networkError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Suppliers</h2>
          <p className="text-sm text-slate-500">{suppliers.length} supplier(s)</p>
        </div>
        <Button variant="primary" icon={Plus} size="sm" onClick={() => setShowForm(true)}>
          Add Supplier
        </Button>
      </div>

      {/* Supplier creation form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">New Supplier</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="Supplier name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
              <input type="text" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="Contact person" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="email@supplier.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="+1 555 123 4567" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
              <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="123 Supplier St, City" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Website</label>
              <input type="url" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="https://supplier.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="Internal notes" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleCreate} loading={saving}>Create Supplier</Button>
          </div>
        </div>
      )}

      {/* Suppliers list */}
      {suppliers.length === 0 && !showForm ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No suppliers yet</h3>
          <p className="text-sm text-slate-500 mb-4">Add your first supplier to manage inventory procurement.</p>
          <Button variant="primary" icon={Plus} size="sm" onClick={() => setShowForm(true)}>Add Supplier</Button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Website</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{s.contactName || '-'}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {s.email ? (
                      <a href={`mailto:${s.email}`} className="text-teal-600 hover:underline flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {s.email}
                      </a>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">
                    {s.phone ? <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {s.phone}</span> : '-'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {s.website ? (
                      <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Visit
                      </a>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Purchase Orders Sub-Component ────────────────────────────

function PurchaseOrdersTab() {
  const { t, locale } = useI18n();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [form, setForm] = useState({
    supplierId: '',
    expectedDelivery: '',
    notes: '',
    items: [{ productId: '', formatId: '', quantity: 1, unitCost: 0 }],
  });

  const fetchData = useCallback(async () => {
    try {
      const [poRes, supRes] = await Promise.all([
        fetch('/api/admin/inventory/purchase-orders'),
        fetch('/api/admin/inventory/suppliers'),
      ]);
      const poData = await poRes.json();
      const supData = await supRes.json();
      setOrders(poData.purchaseOrders || []);
      setSuppliers(supData.suppliers || []);
    } catch {
      toast.error(t('common.error'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders;
    return orders.filter(o => o.status === statusFilter);
  }, [orders, statusFilter]);

  const addItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { productId: '', formatId: '', quantity: 1, unitCost: 0 }] }));
  };

  const removeItem = (idx: number) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, field: string, value: string | number) => {
    setForm(f => ({
      ...f,
      items: f.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const handleCreate = async () => {
    if (!form.supplierId) { toast.error('Select a supplier'); return; }
    if (form.items.some(i => !i.productId || i.quantity < 1 || i.unitCost <= 0)) {
      toast.error('Each item requires a product ID, quantity >= 1, and unit cost > 0');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/inventory/purchase-orders', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          supplierId: form.supplierId,
          items: form.items.map(i => ({
            productId: i.productId,
            formatId: i.formatId || undefined,
            quantity: Number(i.quantity),
            unitCost: Number(i.unitCost),
          })),
          expectedDelivery: form.expectedDelivery ? new Date(form.expectedDelivery).toISOString() : undefined,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to create PO');
        return;
      }
      const newPO = await res.json();
      setOrders(prev => [newPO, ...prev]);
      setForm({ supplierId: '', expectedDelivery: '', notes: '', items: [{ productId: '', formatId: '', quantity: 1, unitCost: 0 }] });
      setShowForm(false);
      toast.success('Purchase order created');
    } catch {
      toast.error(t('common.networkError'));
    } finally {
      setSaving(false);
    }
  };

  const poStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700' },
      ORDERED: { bg: 'bg-teal-100', text: 'text-teal-700' },
      PARTIAL: { bg: 'bg-amber-100', text: 'text-amber-700' },
      RECEIVED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
      CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
    };
    const s = map[status] || map.DRAFT;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.bg} ${s.text}`}>{status}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Purchase Orders</h2>
          <p className="text-sm text-slate-500">{orders.length} order(s)</p>
        </div>
        <Button variant="primary" icon={Plus} size="sm" onClick={() => setShowForm(true)}>
          New Purchase Order
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'DRAFT', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              statusFilter === s
                ? 'bg-teal-50 text-teal-700 border-teal-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s === 'all' ? 'All' : s}
            {s !== 'all' && <span className="ml-1 text-slate-400">({orders.filter(o => o.status === s).length})</span>}
          </button>
        ))}
      </div>

      {/* PO creation form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">New Purchase Order</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Supplier *</label>
              <select
                value={form.supplierId}
                onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Expected Delivery</label>
              <input type="date" value={form.expectedDelivery} onChange={e => setForm(f => ({ ...f, expectedDelivery: e.target.value }))}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="Internal notes" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">Line Items *</label>
              <button onClick={addItem} className="text-xs text-teal-600 hover:text-teal-700 font-medium">+ Add Item</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <input type="text" value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm" placeholder="Product ID" />
                  </div>
                  <div className="col-span-3">
                    <input type="text" value={item.formatId} onChange={e => updateItem(idx, 'formatId', e.target.value)}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm" placeholder="Format ID (opt)" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm" placeholder="Qty" min={1} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" value={item.unitCost} onChange={e => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm" placeholder="Unit $" min={0} step="0.01" />
                  </div>
                  <div className="col-span-1">
                    {form.items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Total: ${form.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0).toFixed(2)}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleCreate} loading={saving}>Create PO</Button>
          </div>
        </div>
      )}

      {/* PO list */}
      {filteredOrders.length === 0 && !showForm ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No purchase orders</h3>
          <p className="text-sm text-slate-500 mb-4">Create your first purchase order to track inventory procurement.</p>
          <Button variant="primary" icon={Plus} size="sm" onClick={() => setShowForm(true)}>New Purchase Order</Button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">PO ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Items</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Expected</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map(po => {
                const supplier = suppliers.find(s => s.id === po.supplierId);
                return (
                  <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{po.id.slice(0, 16)}...</td>
                    <td className="px-4 py-3 text-slate-900 font-medium">{supplier?.name || po.supplierId}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{po.items?.length || 0} item(s)</td>
                    <td className="px-4 py-3 font-medium text-slate-900">${Number(po.totalCost).toFixed(2)}</td>
                    <td className="px-4 py-3">{poStatusBadge(po.status)}</td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">
                      {po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString(locale) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">
                      {new Date(po.createdAt).toLocaleDateString(locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Reconciliation Sub-Component ──────────────────────────────

interface ReconciliationItem {
  productId: string;
  productName: string;
  formatId: string;
  formatName: string;
  recordedStock: number;
  calculatedStock: number;
  discrepancy: number;
  status: 'MATCH' | 'DISCREPANCY';
}

interface ReconciliationData {
  totalProducts: number;
  matchCount: number;
  discrepancyCount: number;
  lastReconciled: string | null;
  items: ReconciliationItem[];
}

function ReconciliationTab() {
  const { locale } = useI18n();
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'discrepancy'>('all');
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState({ adjustedStock: 0, reason: '' });

  const fetchReconciliation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithRetry('/api/admin/inventory/reconciliation');
      const json = await res.json();
      if (json.data) setData(json.data);
    } catch {
      toast.error('Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReconciliation(); }, [fetchReconciliation]);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (filter === 'discrepancy') return data.items.filter(i => i.status === 'DISCREPANCY');
    return data.items;
  }, [data, filter]);

  const handleReconcile = async (item: ReconciliationItem) => {
    if (!adjustForm.reason.trim()) {
      toast.error('A reason is required');
      return;
    }
    try {
      const res = await fetchWithRetry('/api/admin/inventory/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({
          productId: item.productId,
          formatId: item.formatId || undefined,
          adjustedStock: adjustForm.adjustedStock,
          reason: adjustForm.reason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        setAdjusting(null);
        setAdjustForm({ adjustedStock: 0, reason: '' });
        fetchReconciliation();
      } else {
        toast.error(json.error || 'Reconciliation failed');
      }
    } catch {
      toast.error('Failed to apply reconciliation');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-slate-500 text-center py-10">No reconciliation data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Products" value={data.totalProducts} icon={Package} />
        <StatCard label="Matched" value={data.matchCount} icon={PackageCheck} />
        <StatCard label="Discrepancies" value={data.discrepancyCount} icon={AlertTriangle} />
        <StatCard
          label="Last Reconciled"
          value={data.lastReconciled ? new Date(data.lastReconciled).toLocaleDateString(locale) : 'Never'}
          icon={Clock}
        />
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            filter === 'all' ? 'bg-teal-100 text-teal-700 font-medium' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          All ({data.totalProducts})
        </button>
        <button
          onClick={() => setFilter('discrepancy')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            filter === 'discrepancy' ? 'bg-orange-100 text-orange-700 font-medium' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          Discrepancies ({data.discrepancyCount})
        </button>
        <div className="flex-1" />
        <Button variant="ghost" icon={History} size="sm" onClick={fetchReconciliation}>
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Format</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Recorded</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Calculated</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Discrepancy</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    {filter === 'discrepancy' ? 'No discrepancies found' : 'No inventory items found'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const itemKey = `${item.productId}:${item.formatId}`;
                  const isAdjusting = adjusting === itemKey;

                  return (
                    <tr key={itemKey} className={item.status === 'DISCREPANCY' ? 'bg-orange-50/50' : ''}>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.productName}</td>
                      <td className="px-4 py-3 text-slate-600">{item.formatName}</td>
                      <td className="px-4 py-3 text-right font-mono">{item.recordedStock}</td>
                      <td className="px-4 py-3 text-right font-mono">{item.calculatedStock}</td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${
                        item.discrepancy !== 0 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {item.discrepancy > 0 ? '+' : ''}{item.discrepancy}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'MATCH'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {item.status === 'MATCH' ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.status === 'DISCREPANCY' && !isAdjusting && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Pencil}
                            onClick={() => {
                              setAdjusting(itemKey);
                              setAdjustForm({ adjustedStock: item.recordedStock, reason: '' });
                            }}
                          >
                            Reconcile
                          </Button>
                        )}
                        {isAdjusting && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={adjustForm.adjustedStock}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setAdjustForm(f => ({ ...f, adjustedStock: parseInt(e.target.value, 10) || 0 }))
                              }
                              className="w-20 text-sm"
                            />
                            <Input
                              type="text"
                              placeholder="Reason..."
                              value={adjustForm.reason}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setAdjustForm(f => ({ ...f, reason: e.target.value }))
                              }
                              className="w-32 text-sm"
                            />
                            <button
                              onClick={() => handleReconcile(item)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setAdjusting(null)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function stockBadgeVariant(item: ProductFormat): 'success' | 'warning' | 'error' | 'neutral' {
  if (item.stockQuantity === 0) return 'error';
  if (item.stockQuantity <= item.lowStockThreshold) return 'warning';
  if (item.availability === 'DISCONTINUED') return 'neutral';
  return 'success';
}

function stockBadgeText(item: ProductFormat, t: (key: string) => string): string {
  if (item.stockQuantity === 0) return t('admin.inventory.availOutOfStock');
  if (item.stockQuantity <= item.lowStockThreshold) return t('admin.inventory.lowStock');
  if (item.availability === 'DISCONTINUED') return t('admin.inventory.availDiscontinued');
  return t('admin.inventory.availInStock');
}

// ── ABC Classification Helper ─────────────────────────────────

function classifyABC(items: ProductFormat[]): Map<string, 'A' | 'B' | 'C'> {
  const classification = new Map<string, 'A' | 'B' | 'C'>();
  const sorted = [...items].sort((a, b) => (b.price * b.stockQuantity) - (a.price * a.stockQuantity));
  const totalValue = sorted.reduce((sum, i) => sum + i.price * i.stockQuantity, 0);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.price * item.stockQuantity;
    const pct = totalValue > 0 ? (cumulative / totalValue) * 100 : 0;
    if (pct <= 70) {
      classification.set(item.id, 'A');
    } else if (pct <= 90) {
      classification.set(item.id, 'B');
    } else {
      classification.set(item.id, 'C');
    }
  }
  return classification;
}

function reorderUrgency(item: ProductFormat): number {
  // Score 0-100: higher = more urgent
  if (item.stockQuantity === 0) return 100;
  if (item.lowStockThreshold === 0) return 0;
  const ratio = item.stockQuantity / item.lowStockThreshold;
  if (ratio <= 0.5) return 90;
  if (ratio <= 1) return 70;
  if (ratio <= 1.5) return 40;
  return 10;
}

const ABC_BADGE: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  B: { bg: 'bg-teal-100', text: 'text-teal-800' },
  C: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

// ── Main Component ────────────────────────────────────────────

export default function InventairePage() {
  const { t, locale, formatCurrency } = useI18n();
  const [activeTab, setActiveTab] = useState<InventoryTab>('stock');
  const [inventory, setInventory] = useState<ProductFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [stockFilter, setStockFilter] = useState('all');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // History modal state
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<Array<{
    id: string;
    type: string;
    quantity: number;
    reason: string | null;
    orderId: string | null;
    createdAt: string;
    productName: string;
    formatName: string | null;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showStockAlerts, setShowStockAlerts] = useState(false);
  const [showMonthlyStats, setShowMonthlyStats] = useState(false);
  const [showReorderDashboard, setShowReorderDashboard] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // ─── Data fetching ──────────────────────────────────────────

  useEffect(() => {
    fetchInventory();
  }, []);

  // Fetch real history data when the history modal opens
  useEffect(() => {
    if (!showHistory) {
      setHistoryData([]);
      return;
    }

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const item = inventory.find((i) => i.id === showHistory);
        const params = new URLSearchParams();
        if (item) {
          params.set('productId', item.productId);
          params.set('formatId', showHistory);
        }
        params.set('limit', '20');

        const res = await fetch(`/api/admin/inventory/history?${params.toString()}`);
        const data = await res.json();
        setHistoryData(data.data || data.transactions || []);
      } catch (err) {
        console.error('Error fetching inventory history:', err);
        setHistoryData([]);
      }
      setHistoryLoading(false);
    };

    fetchHistory();
  }, [showHistory, inventory]);

  const fetchInventory = async () => {
    try {
      const res = await fetchWithRetry('/api/admin/inventory');
      const data = await res.json();
      setInventory(data.data || data.inventory || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      toast.error(t('common.error'));
      setInventory([]);
    }
    setLoading(false);
  };

  const handleSelectItem = useCallback((id: string) => {
    setSelectedItemId(id);
    setEditingId(null);
    setAdjustmentReason('');
  }, []);

  // ─── Actions ──────────────────────────────────────────────

  const handleExportInventory = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/inventory/export');
      if (!res.ok) {
        toast.error(t('admin.inventory.exportError') || 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || 'inventory-export.csv';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('admin.inventory.exportSuccess') || 'Inventory exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('admin.inventory.exportError') || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const updateStock = async (id: string, newQuantity: number, reason: string) => {
    // G1-FLAW-05 FIX: Check response status and revert optimistic update on error
    const previousInventory = inventory;
    // Optimistic update
    setInventory(prev => prev.map(item =>
      item.id === id
        ? {
            ...item,
            stockQuantity: newQuantity,
            availability: newQuantity === 0 ? 'OUT_OF_STOCK' : 'IN_STOCK',
          }
        : item
    ));
    try {
      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: 'PATCH',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ stockQuantity: newQuantity, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
        // Revert optimistic update
        setInventory(previousInventory);
      } else {
        toast.success(t('admin.inventory.stockUpdated') || 'Stock updated');
      }
    } catch (err) {
      console.error('Error updating stock:', err);
      toast.error(t('common.networkError'));
      // Revert optimistic update on network error
      setInventory(previousInventory);
    }
    setEditingId(null);
    setAdjustmentReason('');
  };

  // ─── Selected item (must be before ribbon actions that reference it) ──
  const selectedItem = useMemo(() => {
    return inventory.find((i) => i.id === selectedItemId) || null;
  }, [inventory, selectedItemId]);

  // ─── Ribbon Actions ─────────────────────────────────────────

  const ribbonAddStock = useCallback(() => {
    if (selectedItem) {
      setEditingId(selectedItem.id);
      setEditValue(selectedItem.stockQuantity);
    } else {
      toast.info(t('admin.inventory.selectItemFirst') || 'Select an item first');
    }
  }, [selectedItem, t]);

  const ribbonAdjust = useCallback(() => {
    if (selectedItem) {
      setEditingId(selectedItem.id);
      setEditValue(selectedItem.stockQuantity);
    } else {
      toast.info(t('admin.inventory.selectItemFirst') || 'Select an item first');
    }
  }, [selectedItem, t]);

  const ribbonMonthlyStats = useCallback(() => {
    setShowMonthlyStats(true);
  }, []);

  const ribbonRenewalList = useCallback(() => {
    // Generate CSV of low-stock items that need reordering
    const lowStockItems = inventory.filter(i => i.stockQuantity <= i.lowStockThreshold);
    if (lowStockItems.length === 0) {
      toast.info(t('admin.inventory.noLowStockItems') || 'No items need reordering');
      return;
    }
    const headers = ['Product', 'Format', 'SKU', 'Current Stock', 'Threshold', 'Price', 'Status'];
    const rows = lowStockItems.map(item => [
      `"${item.productName.replace(/"/g, '""')}"`,
      `"${item.formatName.replace(/"/g, '""')}"`,
      item.sku || '',
      item.stockQuantity,
      item.lowStockThreshold,
      item.price.toFixed(2),
      item.availability,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reorder-list-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success(
      (t('admin.inventory.renewalListExported') || 'Reorder list exported ({count} items)').replace('{count}', String(lowStockItems.length))
    );
  }, [inventory, t]);

  const ribbonSubmissions = useCallback(() => {
    setShowStockAlerts(true);
  }, []);

  const ribbonOrderOnline = useCallback(() => {
    // Generate a CSV of out-of-stock items to order
    const outOfStock = inventory.filter(i => i.stockQuantity === 0);
    if (outOfStock.length === 0) {
      toast.info(t('admin.inventory.noOutOfStockItems') || 'No out-of-stock items');
      return;
    }
    const headers = ['Product', 'Format', 'SKU', 'Price', 'Suggested Order Qty'];
    const rows = outOfStock.map(item => [
      `"${item.productName.replace(/"/g, '""')}"`,
      `"${item.formatName.replace(/"/g, '""')}"`,
      item.sku || '',
      item.price.toFixed(2),
      Math.max(item.lowStockThreshold * 2, 10), // Suggest 2x threshold or min 10
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-order-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success(
      (t('admin.inventory.purchaseOrderExported') || 'Purchase order exported ({count} items)').replace('{count}', String(outOfStock.length))
    );
  }, [inventory, t]);

  const ribbonExport = useCallback(() => {
    handleExportInventory();
  }, []);

  useRibbonAction('addStock', ribbonAddStock);
  useRibbonAction('adjust', ribbonAdjust);
  useRibbonAction('monthlyStats', ribbonMonthlyStats);
  useRibbonAction('renewalList', ribbonRenewalList);
  useRibbonAction('submissions', ribbonSubmissions);
  useRibbonAction('orderOnline', ribbonOrderOnline);
  useRibbonAction('export', ribbonExport);

  // ─── Filtering ──────────────────────────────────────────────

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (
          !item.productName.toLowerCase().includes(search) &&
          !item.sku?.toLowerCase().includes(search) &&
          !item.formatName.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (stockFilter === 'IN_STOCK' && (item.stockQuantity === 0 || item.stockQuantity <= item.lowStockThreshold)) return false;
      if (stockFilter === 'LOW_STOCK' && (item.stockQuantity === 0 || item.stockQuantity > item.lowStockThreshold)) return false;
      if (stockFilter === 'OUT_OF_STOCK' && item.stockQuantity !== 0) return false;
      return true;
    });
  }, [inventory, searchValue, stockFilter]);

  const stats = useMemo(() => ({
    total: inventory.length,
    inStock: inventory.filter(i => i.availability === 'IN_STOCK' && i.stockQuantity > i.lowStockThreshold).length,
    lowStock: inventory.filter(i => i.stockQuantity <= i.lowStockThreshold && i.stockQuantity > 0).length,
    outOfStock: inventory.filter(i => i.stockQuantity === 0).length,
    totalValue: inventory.reduce((sum, i) => sum + (i.price * i.stockQuantity), 0),
  }), [inventory]);

  // ─── ABC Classification & Reorder Data ─────────────────────

  const abcClassification = useMemo(() => classifyABC(inventory), [inventory]);

  const reorderItems = useMemo(() => {
    return inventory
      .filter(i => i.stockQuantity <= i.lowStockThreshold * 1.5)
      .map(item => ({
        ...item,
        urgency: reorderUrgency(item),
        abcClass: abcClassification.get(item.id) || 'C',
        estimatedLeadDays: 7, // Default lead time in days (replace with supplier data when available)
      }))
      .sort((a, b) => b.urgency - a.urgency);
  }, [inventory, abcClassification]);

  // ─── ContentList data ───────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.inventory.allStatuses'), count: stats.total },
    { key: 'IN_STOCK', label: t('admin.inventory.inStock'), count: stats.inStock },
    { key: 'LOW_STOCK', label: t('admin.inventory.lowStock'), count: stats.lowStock },
    { key: 'OUT_OF_STOCK', label: t('admin.inventory.outOfStock'), count: stats.outOfStock },
  ], [t, stats]);

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredInventory.map((item) => ({
      id: item.id,
      avatar: { text: item.productName.charAt(0) },
      title: item.productName,
      subtitle: item.formatName + (item.sku ? ` (${item.sku})` : ''),
      preview: `${t('admin.inventory.colStock')}: ${item.stockQuantity} - ${formatCurrency(item.price)}`,
      badges: [
        {
          text: stockBadgeText(item, t),
          variant: stockBadgeVariant(item),
        },
        ...(item.stockQuantity <= item.lowStockThreshold && item.stockQuantity > 0
          ? [{ text: `${item.stockQuantity}`, variant: 'warning' as const }]
          : []),
        {
          text: `ABC: ${abcClassification.get(item.id) || 'C'}`,
          variant: (abcClassification.get(item.id) === 'A' ? 'success' : abcClassification.get(item.id) === 'B' ? 'info' : 'neutral') as 'success' | 'info' | 'neutral',
        },
      ],
    }));
  }, [filteredInventory, t, formatCurrency]);

  // ─── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab navigation */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.inventory.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.inventory.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-1 border-b border-slate-200 mb-4">
          {([
            { key: 'stock' as InventoryTab, label: 'Stock', icon: Package },
            { key: 'suppliers' as InventoryTab, label: 'Suppliers', icon: Building2 },
            { key: 'purchase-orders' as InventoryTab, label: 'Purchase Orders', icon: ClipboardList },
            { key: 'reconciliation' as InventoryTab, label: 'Reconciliation', icon: Scale },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-teal-500 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content: Suppliers */}
      {activeTab === 'suppliers' && (
        <div className="p-4 lg:p-6 pt-0 flex-1 overflow-y-auto">
          <SuppliersTab />
        </div>
      )}

      {/* Tab content: Purchase Orders */}
      {activeTab === 'purchase-orders' && (
        <div className="p-4 lg:p-6 pt-0 flex-1 overflow-y-auto">
          <PurchaseOrdersTab />
        </div>
      )}

      {/* Tab content: Reconciliation */}
      {activeTab === 'reconciliation' && (
        <div className="p-4 lg:p-6 pt-0 flex-1 overflow-y-auto">
          <ReconciliationTab />
        </div>
      )}

      {/* Tab content: Stock (original content) */}
      {activeTab === 'stock' && (<>
      {/* Stat cards row */}
      <div className="p-4 lg:p-6 pb-0 pt-0 flex-shrink-0">
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              icon={TrendingDown}
              size="sm"
              onClick={() => setShowReorderDashboard(true)}
              className={reorderItems.length > 0 ? 'text-orange-600' : ''}
            >
              Reapprovisionnement
              {reorderItems.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded-full">
                  {reorderItems.length}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              icon={ArrowRightLeft}
              size="sm"
              onClick={() => setShowTransferModal(true)}
            >
              Transfert
            </Button>
            <Button
              variant="ghost"
              icon={BarChart3}
              size="sm"
              onClick={() => setShowMonthlyStats(true)}
            >
              {t('admin.inventory.statsBtn') || 'Stats'}
            </Button>
            <Button
              variant="ghost"
              icon={Bell}
              size="sm"
              onClick={() => setShowStockAlerts(true)}
              className={stats.outOfStock + stats.lowStock > 0 ? 'text-amber-600' : ''}
            >
              {t('admin.inventory.alertsBtn') || 'Alerts'}
              {(stats.outOfStock + stats.lowStock > 0) && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                  {stats.outOfStock + stats.lowStock}
                </span>
              )}
            </Button>
            <label className="cursor-pointer inline-block">
              <span className="inline-flex items-center justify-center font-medium rounded-lg border transition-colors duration-150 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-slate-300 shadow-sm h-8 px-3 text-xs gap-1.5">
                <Upload className="w-4 h-4" />
                {t('admin.inventory.importCsv')}
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  try {
                    const res = await fetch('/api/admin/inventory/import', {
                      method: 'POST',
                      headers: addCSRFHeader(),
                      body: formData,
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      toast.error(data.error || t('admin.inventory.importError') || 'Import failed');
                      return;
                    }
                    const result = await res.json();
                    toast.success(
                      (t('admin.inventory.importSuccess') || 'Inventory imported successfully') +
                      (result.imported ? ` (${result.imported} items)` : '')
                    );
                    fetchInventory();
                  } catch {
                    toast.error(t('admin.inventory.importError') || 'Import failed');
                  }
                  e.target.value = '';
                }}
              />
            </label>
            <Button
              variant="secondary"
              icon={exporting ? Loader2 : FileDown}
              size="sm"
              onClick={handleExportInventory}
              disabled={exporting}
            >
              {t('admin.inventory.export')}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard label={t('admin.inventory.totalProducts')} value={stats.total} icon={Package} />
          <StatCard label={t('admin.inventory.inStock')} value={stats.inStock} icon={PackageCheck} className="border-green-200 bg-green-50" />
          <StatCard label={t('admin.inventory.lowStock')} value={stats.lowStock} icon={AlertTriangle} className="border-yellow-200 bg-yellow-50" />
          <StatCard label={t('admin.inventory.outOfStock')} value={stats.outOfStock} icon={PackageX} className="border-red-200 bg-red-50" />
          <StatCard label={t('admin.inventory.stockValue')} value={formatCurrency(stats.totalValue)} icon={DollarSign} className="border-emerald-200 bg-emerald-50" />
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={400}
          showDetail={!!selectedItemId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedItemId}
              onSelect={handleSelectItem}
              filterTabs={filterTabs}
              activeFilter={stockFilter}
              onFilterChange={setStockFilter}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.inventory.searchPlaceholder')}
              loading={loading}
              emptyIcon={Package}
              emptyTitle={t('admin.inventory.emptyTitle')}
              emptyDescription={t('admin.inventory.emptyDescription')}
            />
          }
          detail={
            selectedItem ? (
              <DetailPane
                header={{
                  title: selectedItem.productName,
                  subtitle: `${selectedItem.formatName}${selectedItem.sku ? ` - SKU: ${selectedItem.sku}` : ''}`,
                  avatar: { text: selectedItem.productName.charAt(0) },
                  onBack: () => { setSelectedItemId(null); setEditingId(null); },
                  backLabel: t('admin.inventory.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={History}
                        onClick={() => setShowHistory(selectedItem.id)}
                      >
                        {t('admin.inventory.history')}
                      </Button>
                      <Link href={`/admin/produits/${selectedItem.productId}`}>
                        <Button variant="ghost" size="sm">
                          {t('admin.inventory.colProduct')}
                        </Button>
                      </Link>
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Stock Level indicator + ABC Badge */}
                  <div className="flex flex-wrap gap-4 items-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      selectedItem.stockQuantity === 0 ? 'bg-red-100 text-red-800' :
                      selectedItem.stockQuantity <= selectedItem.lowStockThreshold ? 'bg-amber-100 text-amber-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {stockBadgeText(selectedItem, t)}
                    </span>
                    {(() => {
                      const abc = abcClassification.get(selectedItem.id) || 'C';
                      const badge = ABC_BADGE[abc];
                      return (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
                          Classification {abc}
                          {abc === 'A' ? ' (haute valeur)' : abc === 'B' ? ' (valeur moyenne)' : ' (faible valeur)'}
                        </span>
                      );
                    })()}
                    {!selectedItem.isActive && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-600">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Lead Time Tracking */}
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-teal-600" />
                      <h4 className="text-sm font-semibold text-teal-800">Delai d&apos;approvisionnement</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-2 bg-white rounded border border-teal-100">
                        <p className="text-lg font-bold text-teal-700">5j</p>
                        <p className="text-[10px] text-teal-600">Delai moyen</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded border border-teal-100">
                        <p className="text-lg font-bold text-teal-700">3j</p>
                        <p className="text-[10px] text-teal-600">Dernier delai</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded border border-teal-100">
                        <p className="text-lg font-bold text-teal-700">10j</p>
                        <p className="text-[10px] text-teal-600">Delai max</p>
                      </div>
                    </div>
                  </div>

                  {/* Stock details */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.inventory.colStock')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                        <p className={`text-3xl font-bold ${
                          selectedItem.stockQuantity === 0 ? 'text-red-600' :
                          selectedItem.stockQuantity <= selectedItem.lowStockThreshold ? 'text-amber-600' :
                          'text-slate-900'
                        }`}>
                          {selectedItem.stockQuantity}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{t('admin.inventory.colStock')}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-3xl font-bold text-slate-900">{selectedItem.lowStockThreshold}</p>
                        <p className="text-xs text-slate-500 mt-1">{t('admin.inventory.colThreshold')}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-3xl font-bold text-slate-900">{formatCurrency(selectedItem.price)}</p>
                        <p className="text-xs text-slate-500 mt-1">{t('admin.inventory.colPrice')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stock Value */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-emerald-700">{t('admin.inventory.stockValue')}</p>
                        <p className="text-2xl font-bold text-emerald-800">
                          {formatCurrency(selectedItem.price * selectedItem.stockQuantity)}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-emerald-400" />
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.inventory.colProduct')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.inventory.colProduct')}</p>
                        <Link
                          href={`/admin/produits/${selectedItem.productId}`}
                          className="text-teal-600 hover:underline font-medium"
                        >
                          {selectedItem.productName}
                        </Link>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Format</p>
                        <p className="text-slate-900">{selectedItem.formatName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.inventory.colSku')}</p>
                        <code className="text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {selectedItem.sku || '-'}
                        </code>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.inventory.colStatus')}</p>
                        <p className="text-slate-700">{selectedItem.availability.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Inline stock edit */}
                  <div className="border border-slate-200 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.inventory.adjustmentReason')}</h3>
                    {editingId === selectedItem.id ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-slate-600 w-24">{t('admin.inventory.colStock')}:</label>
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                            className="w-24 h-9 px-3 border border-slate-300 rounded-lg text-center text-sm
                              focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            autoFocus
                          />
                        </div>
                        <div>
                          <Input
                            type="text"
                            placeholder={t('admin.inventory.adjustmentPlaceholder')}
                            value={adjustmentReason}
                            onChange={(e) => setAdjustmentReason(e.target.value)}
                          />
                          <p className="text-xs text-slate-400 mt-1">{t('admin.inventory.adjustmentRequired')}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            icon={Check}
                            onClick={() => {
                              if (adjustmentReason) {
                                updateStock(selectedItem.id, editValue, adjustmentReason);
                              }
                            }}
                            disabled={!adjustmentReason}
                          >
                            {t('admin.inventory.edit') || 'Save'}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={X}
                            onClick={() => { setEditingId(null); setAdjustmentReason(''); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Pencil}
                        onClick={() => {
                          setEditingId(selectedItem.id);
                          setEditValue(selectedItem.stockQuantity);
                        }}
                      >
                        {t('admin.inventory.edit')}
                      </Button>
                    )}
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Package}
                emptyTitle={t('admin.inventory.emptyTitle')}
                emptyDescription={t('admin.inventory.emptyDescription')}
              />
            )
          }
        />
      </div>

      {/* ─── HISTORY MODAL ──────────────────────────────────────── */}
      <Modal
        isOpen={!!showHistory}
        onClose={() => setShowHistory(null)}
        title={t('admin.inventory.historyTitle')}
      >
        {historyLoading ? (
          <div className="flex items-center justify-center py-8" role="status" aria-label="Loading">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500" />
            <span className="sr-only">Loading...</span>
          </div>
        ) : historyData.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            {t('admin.inventory.noHistory') || 'No transaction history yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {historyData.map((tx) => {
              const isPositive = tx.quantity > 0;
              const timeAgo = new Date(tx.createdAt).toLocaleDateString(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              return (
                <div key={tx.id} className="flex items-center gap-3 text-sm">
                  <span className={`font-bold min-w-[3rem] text-end ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{tx.quantity}
                  </span>
                  <span className="text-slate-600 flex-1">
                    {tx.reason || tx.type}
                  </span>
                  <span className="text-slate-400 text-xs whitespace-nowrap">{timeAgo}</span>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ─── STOCK ALERTS MODAL ──────────────────────────────────── */}
      <Modal
        isOpen={showStockAlerts}
        onClose={() => setShowStockAlerts(false)}
        title={t('admin.inventory.stockAlertsTitle') || 'Stock Alerts'}
        subtitle={t('admin.inventory.stockAlertsSubtitle') || 'Items requiring attention'}
        size="lg"
      >
        {(() => {
          const outOfStockItems = inventory.filter(i => i.stockQuantity === 0);
          const lowStockItems = inventory.filter(i => i.stockQuantity > 0 && i.stockQuantity <= i.lowStockThreshold);
          return (
            <div className="space-y-4">
              {/* Out of stock */}
              <div>
                <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
                  <PackageX className="w-4 h-4" />
                  {t('admin.inventory.outOfStock') || 'Out of Stock'} ({outOfStockItems.length})
                </h4>
                {outOfStockItems.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">{t('admin.inventory.noOutOfStockItems') || 'No out-of-stock items'}</p>
                ) : (
                  <div className="border border-red-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="px-3 py-2 text-start text-xs font-medium text-red-600">{t('admin.inventory.colProduct')}</th>
                          <th className="px-3 py-2 text-start text-xs font-medium text-red-600">Format</th>
                          <th className="px-3 py-2 text-start text-xs font-medium text-red-600">{t('admin.inventory.colSku')}</th>
                          <th className="px-3 py-2 text-end text-xs font-medium text-red-600">{t('admin.inventory.colPrice')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {outOfStockItems.map(item => (
                          <tr key={item.id} className="hover:bg-red-50/50">
                            <td className="px-3 py-2 text-slate-900">{item.productName}</td>
                            <td className="px-3 py-2 text-slate-600">{item.formatName}</td>
                            <td className="px-3 py-2 text-slate-500">{item.sku || '-'}</td>
                            <td className="px-3 py-2 text-end text-slate-700">{formatCurrency(item.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Low stock */}
              <div>
                <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  {t('admin.inventory.lowStock') || 'Low Stock'} ({lowStockItems.length})
                </h4>
                {lowStockItems.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">{t('admin.inventory.noLowStockItems') || 'No low-stock items'}</p>
                ) : (
                  <div className="border border-amber-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-50">
                        <tr>
                          <th className="px-3 py-2 text-start text-xs font-medium text-amber-600">{t('admin.inventory.colProduct')}</th>
                          <th className="px-3 py-2 text-start text-xs font-medium text-amber-600">Format</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-amber-600">{t('admin.inventory.colStock')}</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-amber-600">{t('admin.inventory.colThreshold')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {lowStockItems.map(item => (
                          <tr key={item.id} className="hover:bg-amber-50/50">
                            <td className="px-3 py-2 text-slate-900">{item.productName}</td>
                            <td className="px-3 py-2 text-slate-600">{item.formatName}</td>
                            <td className="px-3 py-2 text-center font-semibold text-amber-700">{item.stockQuantity}</td>
                            <td className="px-3 py-2 text-center text-slate-500">{item.lowStockThreshold}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ─── MONTHLY STATS MODAL ──────────────────────────────────── */}
      <Modal
        isOpen={showMonthlyStats}
        onClose={() => setShowMonthlyStats(false)}
        title={t('admin.inventory.monthlyStatsTitle') || 'Inventory Summary'}
        subtitle={t('admin.inventory.monthlyStatsSubtitle') || 'Current stock overview'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500 mt-1">{t('admin.inventory.totalProducts') || 'Total Products'}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{stats.inStock}</p>
              <p className="text-xs text-emerald-600 mt-1">{t('admin.inventory.inStock') || 'In Stock'}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{stats.lowStock}</p>
              <p className="text-xs text-amber-600 mt-1">{t('admin.inventory.lowStock') || 'Low Stock'}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{stats.outOfStock}</p>
              <p className="text-xs text-red-600 mt-1">{t('admin.inventory.outOfStock') || 'Out of Stock'}</p>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-700">{t('admin.inventory.stockValue') || 'Total Stock Value'}</p>
                <p className="text-2xl font-bold text-emerald-800">{formatCurrency(stats.totalValue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          {/* Stock health indicator */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">
              {t('admin.inventory.stockHealth') || 'Stock Health'}
            </h4>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden flex">
              {stats.total > 0 && (
                <>
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: `${(stats.inStock / stats.total) * 100}%` }}
                    title={`${t('admin.inventory.inStock') || 'In Stock'}: ${stats.inStock}`}
                  />
                  <div
                    className="bg-amber-500 h-full"
                    style={{ width: `${(stats.lowStock / stats.total) * 100}%` }}
                    title={`${t('admin.inventory.lowStock') || 'Low Stock'}: ${stats.lowStock}`}
                  />
                  <div
                    className="bg-red-500 h-full"
                    style={{ width: `${(stats.outOfStock / stats.total) * 100}%` }}
                    title={`${t('admin.inventory.outOfStock') || 'Out of Stock'}: ${stats.outOfStock}`}
                  />
                </>
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full inline-block" /> {t('admin.inventory.inStock') || 'In Stock'}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full inline-block" /> {t('admin.inventory.lowStock') || 'Low Stock'}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full inline-block" /> {t('admin.inventory.outOfStock') || 'Out of Stock'}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── REORDER DASHBOARD MODAL ──────────────────────────────── */}
      <Modal
        isOpen={showReorderDashboard}
        onClose={() => setShowReorderDashboard(false)}
        title="Tableau de reapprovisionnement"
        subtitle={`${reorderItems.length} produits proches ou en dessous du seuil de commande`}
        size="lg"
      >
        {reorderItems.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <PackageCheck className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p className="text-sm">Tous les stocks sont au-dessus du seuil. Aucun reapprovisionnement necessaire.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reorderItems.map((item) => {
              const urgencyColor = item.urgency >= 90 ? 'bg-red-500' :
                item.urgency >= 70 ? 'bg-orange-500' :
                item.urgency >= 40 ? 'bg-amber-400' : 'bg-green-400';
              const abcBadge = ABC_BADGE[item.abcClass];
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {/* Urgency bar */}
                  <div className="w-1.5 h-12 rounded-full bg-slate-200 overflow-hidden flex flex-col-reverse">
                    <div
                      className={`${urgencyColor} rounded-full transition-all`}
                      style={{ height: `${item.urgency}%` }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.productName}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${abcBadge.bg} ${abcBadge.text}`}>
                        {item.abcClass}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{item.formatName}{item.sku ? ` (${item.sku})` : ''}</p>
                  </div>

                  <div className="text-center px-3">
                    <p className={`text-lg font-bold ${item.stockQuantity === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {item.stockQuantity}
                    </p>
                    <p className="text-[10px] text-slate-400">en stock</p>
                  </div>

                  <div className="text-center px-3">
                    <p className="text-sm font-medium text-slate-700">{item.lowStockThreshold}</p>
                    <p className="text-[10px] text-slate-400">seuil</p>
                  </div>

                  <div className="text-center px-3">
                    <div className="flex items-center gap-1 text-teal-600">
                      <Clock className="w-3 h-3" />
                      <span className="text-sm font-medium">{item.estimatedLeadDays}j</span>
                    </div>
                    <p className="text-[10px] text-slate-400">delai est.</p>
                  </div>

                  <div className="text-end px-2">
                    <p className="text-sm font-medium text-slate-700">{formatCurrency(item.price)}</p>
                    <p className="text-[10px] text-slate-400">prix unit.</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ─── STOCK TRANSFER MODAL ─────────────────────────────────── */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title="Transfert de stock"
        subtitle="Transferer du stock entre entrepots ou emplacements"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-center">
            <ArrowRightLeft className="w-8 h-8 text-teal-400 mx-auto mb-2" />
            <p className="text-sm text-teal-800 font-medium">Module de transfert inter-entrepots</p>
            <p className="text-xs text-teal-600 mt-1">
              Selectionnez un produit, la quantite a transferer et l&apos;emplacement de destination.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Produit source</label>
              <select className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm">
                <option value="">Selectionnez...</option>
                {inventory.filter(i => i.stockQuantity > 0).map(item => (
                  <option key={item.id} value={item.id}>
                    {item.productName} - {item.formatName} ({item.stockQuantity})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Quantite</label>
              <input
                type="number"
                min={1}
                defaultValue={1}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Depuis</label>
              <select className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm">
                <option value="main">Entrepot principal</option>
                <option value="secondary">Entrepot secondaire</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vers</label>
              <select className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm">
                <option value="secondary">Entrepot secondaire</option>
                <option value="main">Entrepot principal</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Raison du transfert</label>
            <input
              type="text"
              placeholder="Ex: Reequilibrage de stock, demande client..."
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowTransferModal(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={ArrowRightLeft}
              onClick={() => {
                toast.success('Transfert de stock initie avec succes');
                setShowTransferModal(false);
              }}
            >
              Initier le transfert
            </Button>
          </div>
        </div>
      </Modal>
      </>)}
    </div>
  );
}
