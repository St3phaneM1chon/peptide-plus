'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Truck,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Phone,
  Mail,
  Globe,
  Users,
  Link2,
  Star,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
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
import SupplierForm from './SupplierForm';
import type { SupplierFormData } from './SupplierForm';

// ── Types ─────────────────────────────────────────────────────

interface SupplierContact {
  id: string;
  department: string;
  name: string;
  email: string | null;
  phone: string | null;
  extension: string | null;
  title: string | null;
  isPrimary: boolean;
}

interface SupplierLink {
  id: string;
  label: string;
  url: string;
  type: string;
  sortOrder: number;
}

interface Supplier {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  isActive: boolean;
  contacts: SupplierContact[];
  links: SupplierLink[];
  _count: { contacts: number; links: number };
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

const LINK_TYPE_COLORS: Record<string, string> = {
  order_form: 'bg-blue-100 text-blue-700',
  chat: 'bg-green-100 text-green-700',
  portal: 'bg-purple-100 text-purple-700',
  catalog: 'bg-orange-100 text-orange-700',
  tracking: 'bg-cyan-100 text-cyan-700',
  other: 'bg-slate-100 text-slate-700',
};

function getDeptLabel(dept: string, t: (key: string) => string): string {
  const key = `admin.suppliers.departments.${dept}`;
  const val = t(key);
  return val !== key ? val : dept;
}

function getLinkTypeLabel(type: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    order_form: 'admin.suppliers.orderForm',
    chat: 'admin.suppliers.chat',
    portal: 'admin.suppliers.portal',
    catalog: 'admin.suppliers.catalog',
    tracking: 'admin.suppliers.tracking',
    other: 'admin.suppliers.other',
  };
  const key = map[type] || map.other;
  return t(key);
}

// ── Main Component ────────────────────────────────────────────

export default function FournisseursPage() {
  const { t } = useI18n();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // ─── Data fetching ────────────────────────────────────────

  const fetchSuppliers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchValue) params.set('search', searchValue);
      if (showInactive) params.set('active', 'false');
      params.set('limit', '100');

      const res = await fetchWithRetry(`/api/admin/suppliers?${params.toString()}`);
      const data = await res.json();
      setSuppliers(data.suppliers || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      toast.error(t('common.error'));
      setSuppliers([]);
    }
    setLoading(false);
  }, [searchValue, showInactive, t]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleSelectItem = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // ─── Actions ──────────────────────────────────────────────

  const handleCreate = async (data: SupplierFormData) => {
    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('common.error'));
        return;
      }
      toast.success(t('admin.suppliers.saved'));
      setShowForm(false);
      await fetchSuppliers();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (data: SupplierFormData) => {
    if (!editingSupplier) return;
    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${editingSupplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('common.error'));
        return;
      }
      toast.success(t('admin.suppliers.saved'));
      setEditingSupplier(null);
      setShowForm(false);
      await fetchSuppliers();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/suppliers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error(t('common.error'));
        return;
      }
      toast.success(t('admin.suppliers.deleted'));
      if (selectedId === id) setSelectedId(null);
      setShowDeleteConfirm(null);
      await fetchSuppliers();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowForm(true);
  };

  const openCreate = () => {
    setEditingSupplier(null);
    setShowForm(true);
  };

  // ─── Selected supplier (must be before ribbon actions that reference it) ──
  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedId) || null;
  }, [suppliers, selectedId]);

  // ─── Ribbon Actions ─────────────────────────────────────────

  const ribbonAddSupplier = useCallback(() => {
    openCreate();
  }, []);

  const ribbonOpenWebsite = useCallback(() => {
    if (selectedSupplier?.website) {
      window.open(selectedSupplier.website, '_blank', 'noopener,noreferrer');
    } else {
      toast.info(t('common.comingSoon'));
    }
  }, [selectedSupplier, t]);

  const ribbonEdit = useCallback(() => {
    if (selectedSupplier) {
      openEdit(selectedSupplier);
    }
  }, [selectedSupplier]);

  const ribbonDelete = useCallback(() => {
    if (selectedSupplier) {
      setShowDeleteConfirm(selectedSupplier.id);
    }
  }, [selectedSupplier]);

  const ribbonExport = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  useRibbonAction('addSupplier', ribbonAddSupplier);
  useRibbonAction('openWebsite', ribbonOpenWebsite);
  useRibbonAction('edit', ribbonEdit);
  useRibbonAction('delete', ribbonDelete);
  useRibbonAction('export', ribbonExport);

  // ─── ContentList data ─────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'active', label: t('admin.suppliers.active'), count: suppliers.filter(s => s.isActive).length },
    { key: 'all', label: `${t('admin.suppliers.active')} + ${t('admin.suppliers.inactive')}`, count: total },
  ], [t, suppliers, total]);

  const listItems: ContentListItem[] = useMemo(() => {
    return suppliers.map((s) => {
      const primaryContact = s.contacts.find(c => c.isPrimary);
      return {
        id: s.id,
        avatar: { text: s.name.charAt(0) },
        title: s.name,
        subtitle: [s.code, s.city].filter(Boolean).join(' - ') || undefined,
        preview: primaryContact
          ? `${primaryContact.name} (${getDeptLabel(primaryContact.department, t)})`
          : `${s._count.contacts} ${t('admin.suppliers.contacts').toLowerCase()}`,
        badges: [
          ...(s.isActive
            ? [{ text: t('admin.suppliers.active'), variant: 'success' as const }]
            : [{ text: t('admin.suppliers.inactive'), variant: 'neutral' as const }]),
          ...(s._count.contacts > 0
            ? [{ text: `${s._count.contacts}`, variant: 'info' as const }]
            : []),
        ],
      };
    });
  }, [suppliers, t]);

  // ─── Auto-select first item ────────────────────────────────

  useEffect(() => {
    if (!loading && suppliers.length > 0) {
      const currentStillVisible = selectedId &&
        suppliers.some(s => s.id === selectedId);
      if (!currentStillVisible) {
        handleSelectItem(suppliers[0].id);
      }
    }
  }, [suppliers, loading, selectedId, handleSelectItem]);

  // ─── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.suppliers.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.suppliers.subtitle')}</p>
          </div>
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            {t('admin.suppliers.addSupplier')}
          </Button>
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={400}
          showDetail={!!selectedId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedId}
              onSelect={handleSelectItem}
              filterTabs={filterTabs}
              activeFilter={showInactive ? 'all' : 'active'}
              onFilterChange={(key) => setShowInactive(key === 'all')}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.suppliers.searchPlaceholder')}
              loading={loading}
              emptyIcon={Truck}
              emptyTitle={t('admin.suppliers.noSuppliers')}
              emptyDescription={t('admin.suppliers.noSuppliers')}
            />
          }
          detail={
            selectedSupplier ? (
              <DetailPane
                header={{
                  title: selectedSupplier.name,
                  subtitle: [selectedSupplier.code, selectedSupplier.city, selectedSupplier.province].filter(Boolean).join(' - '),
                  avatar: { text: selectedSupplier.name.charAt(0) },
                  onBack: () => setSelectedId(null),
                  backLabel: t('admin.suppliers.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(selectedSupplier)}>
                        {t('admin.suppliers.editSupplier')}
                      </Button>
                      <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setShowDeleteConfirm(selectedSupplier.id)}>
                        {t('admin.suppliers.deleteSupplier')}
                      </Button>
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Status badge */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      selectedSupplier.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {selectedSupplier.isActive ? t('admin.suppliers.active') : t('admin.suppliers.inactive')}
                    </span>
                  </div>

                  {/* General Info */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.suppliers.generalInfo')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {selectedSupplier.code && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">{t('admin.suppliers.code')}</p>
                          <code className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{selectedSupplier.code}</code>
                        </div>
                      )}
                      {selectedSupplier.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500 mb-0.5">{t('admin.suppliers.email')}</p>
                            <a href={`mailto:${selectedSupplier.email}`} className="text-sky-600 hover:underline">
                              {selectedSupplier.email}
                            </a>
                          </div>
                        </div>
                      )}
                      {selectedSupplier.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500 mb-0.5">{t('admin.suppliers.phone')}</p>
                            <a href={`tel:${selectedSupplier.phone}`} className="text-sky-600 hover:underline">
                              {selectedSupplier.phone}
                            </a>
                          </div>
                        </div>
                      )}
                      {selectedSupplier.website && (
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500 mb-0.5">{t('admin.suppliers.website')}</p>
                            <a href={selectedSupplier.website} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                              {selectedSupplier.website}
                            </a>
                          </div>
                        </div>
                      )}
                      {(selectedSupplier.address || selectedSupplier.city) && (
                        <div className="md:col-span-2">
                          <p className="text-xs text-slate-500 mb-1">{t('admin.suppliers.address')}</p>
                          <p className="text-slate-900">
                            {[
                              selectedSupplier.address,
                              [selectedSupplier.city, selectedSupplier.province].filter(Boolean).join(', '),
                              selectedSupplier.postalCode,
                              selectedSupplier.country,
                            ].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedSupplier.notes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h3 className="font-semibold text-amber-900 mb-2">{t('admin.suppliers.notes')}</h3>
                      <p className="text-sm text-amber-800 whitespace-pre-wrap">{selectedSupplier.notes}</p>
                    </div>
                  )}

                  {/* Contacts */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-900">
                        {t('admin.suppliers.contacts')} ({selectedSupplier.contacts.length})
                      </h3>
                    </div>
                    {selectedSupplier.contacts.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">{t('admin.suppliers.noSuppliers')}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                              <th className="pb-2 pr-3">{t('admin.suppliers.department')}</th>
                              <th className="pb-2 pr-3">{t('admin.suppliers.contactName')}</th>
                              <th className="pb-2 pr-3">{t('admin.suppliers.email')}</th>
                              <th className="pb-2 pr-3">{t('admin.suppliers.phone')}</th>
                              <th className="pb-2 pr-3">{t('admin.suppliers.extension')}</th>
                              <th className="pb-2">{t('admin.suppliers.jobTitle')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSupplier.contacts.map((c) => (
                              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                                <td className="py-2 pr-3">
                                  <span className="inline-flex items-center gap-1">
                                    {getDeptLabel(c.department, t)}
                                    {c.isPrimary && <Star className="w-3 h-3 text-amber-500" fill="currentColor" />}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 font-medium text-slate-900">{c.name}</td>
                                <td className="py-2 pr-3">
                                  {c.email ? (
                                    <a href={`mailto:${c.email}`} className="text-sky-600 hover:underline">{c.email}</a>
                                  ) : '-'}
                                </td>
                                <td className="py-2 pr-3">{c.phone || '-'}</td>
                                <td className="py-2 pr-3">{c.extension || '-'}</td>
                                <td className="py-2">{c.title || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Links */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Link2 className="w-4 h-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-900">
                        {t('admin.suppliers.links')} ({selectedSupplier.links.length})
                      </h3>
                    </div>
                    {selectedSupplier.links.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">{t('admin.suppliers.noSuppliers')}</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedSupplier.links.map((link) => (
                          <div key={link.id} className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 p-3">
                            <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-sky-600 hover:underline truncate block"
                              >
                                {link.label}
                              </a>
                              <p className="text-xs text-slate-400 truncate">{link.url}</p>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${LINK_TYPE_COLORS[link.type] || LINK_TYPE_COLORS.other}`}>
                              {getLinkTypeLabel(link.type, t)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Truck}
                emptyTitle={t('admin.suppliers.noSuppliers')}
                emptyDescription={t('admin.suppliers.searchPlaceholder')}
              />
            )
          }
        />
      </div>

      {/* ─── CREATE/EDIT MODAL ────────────────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingSupplier(null); }}
        title={editingSupplier ? t('admin.suppliers.editSupplier') : t('admin.suppliers.addSupplier')}
        size="xl"
      >
        <SupplierForm
          initialData={editingSupplier ? {
            name: editingSupplier.name,
            code: editingSupplier.code || '',
            email: editingSupplier.email || '',
            phone: editingSupplier.phone || '',
            website: editingSupplier.website || '',
            address: editingSupplier.address || '',
            city: editingSupplier.city || '',
            province: editingSupplier.province || '',
            postalCode: editingSupplier.postalCode || '',
            country: editingSupplier.country || 'CA',
            notes: editingSupplier.notes || '',
            isActive: editingSupplier.isActive,
            contacts: editingSupplier.contacts.map(c => ({
              department: c.department,
              name: c.name,
              email: c.email || '',
              phone: c.phone || '',
              extension: c.extension || '',
              title: c.title || '',
              isPrimary: c.isPrimary,
            })),
            links: editingSupplier.links.map(l => ({
              label: l.label,
              url: l.url,
              type: l.type,
            })),
          } : undefined}
          onSubmit={editingSupplier ? handleUpdate : handleCreate}
          onCancel={() => { setShowForm(false); setEditingSupplier(null); }}
          loading={formLoading}
        />
      </Modal>

      {/* ─── DELETE CONFIRMATION MODAL ────────────────────────── */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title={t('admin.suppliers.deleteSupplier')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>
              {t('admin.suppliers.cancel')}
            </Button>
            <Button variant="danger" onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}>
              {t('admin.suppliers.deleteSupplier')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{t('admin.suppliers.deleteConfirm')}</p>
        <p className="text-sm text-slate-400 mt-1">{t('admin.suppliers.confirmDelete')}</p>
      </Modal>
    </div>
  );
}
