'use client';

/**
 * PAGE GESTION DES ADRESSES - BioCycle Peptides
 * Gérer les adresses de livraison et facturation
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { addressSchema, validateForm } from '@/lib/form-validation';
import { FormError } from '@/components/ui/FormError';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';

interface Address {
  id: string;
  type: 'shipping' | 'billing';
  isDefault: boolean;
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone?: string;
}

const PROVINCE_CODES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'] as const;

const PROVINCE_KEYS: Record<string, string> = {
  AB: 'customerAddresses.provinceAlberta',
  BC: 'customerAddresses.provinceBritishColumbia',
  MB: 'customerAddresses.provinceManitoba',
  NB: 'customerAddresses.provinceNewBrunswick',
  NL: 'customerAddresses.provinceNewfoundland',
  NS: 'customerAddresses.provinceNovaScotia',
  NT: 'customerAddresses.provinceNorthwestTerritories',
  NU: 'customerAddresses.provinceNunavut',
  ON: 'customerAddresses.provinceOntario',
  PE: 'customerAddresses.provincePrinceEdwardIsland',
  QC: 'customerAddresses.provinceQuebec',
  SK: 'customerAddresses.provinceSaskatchewan',
  YT: 'customerAddresses.provinceYukon',
};

export default function AddressesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useI18n();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState<Partial<Address>>({
    type: 'shipping',
    isDefault: false,
    firstName: '',
    lastName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    province: 'QC',
    postalCode: '',
    country: 'CA',
    phone: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Clear a specific field error when user modifies that field
  const clearFieldError = (field: string) => {
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/addresses');
    }
  }, [status, router]);

  // Load addresses from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && session) {
      const saved = localStorage.getItem('user_addresses');
      if (saved) {
        setAddresses(JSON.parse(saved));
      }
      setLoading(false);
    }
  }, [session]);

  // Save addresses
  const saveAddresses = (newAddresses: Address[]) => {
    setAddresses(newAddresses);
    localStorage.setItem('user_addresses', JSON.stringify(newAddresses));
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const validation = validateForm(addressSchema, {
      firstName: formData.firstName,
      lastName: formData.lastName,
      address1: formData.address1,
      city: formData.city,
      province: formData.province,
      postalCode: formData.postalCode,
      country: formData.country,
      phone: formData.phone || undefined,
    });

    if (!validation.success) {
      setFormErrors(validation.errors || {});
      return;
    }

    setFormErrors({});

    if (editingAddress) {
      // Update existing
      const updated = addresses.map(a =>
        a.id === editingAddress.id ? { ...formData, id: a.id } as Address : a
      );

      // Handle default toggle
      if (formData.isDefault) {
        updated.forEach(a => {
          if (a.id !== editingAddress.id && a.type === formData.type) {
            a.isDefault = false;
          }
        });
      }

      saveAddresses(updated);
      toast.success(t('toast.address.updated'));
    } else {
      // Create new
      const newAddress: Address = {
        ...formData,
        id: `addr_${Date.now()}`,
      } as Address;

      // If first address of this type, make it default
      const sameTypeAddresses = addresses.filter(a => a.type === formData.type);
      if (sameTypeAddresses.length === 0) {
        newAddress.isDefault = true;
      }

      // Handle default toggle
      let updated = [...addresses];
      if (newAddress.isDefault) {
        updated = updated.map(a => ({
          ...a,
          isDefault: a.type === formData.type ? false : a.isDefault,
        }));
      }

      saveAddresses([...updated, newAddress]);
      toast.success(t('toast.address.added'));
    }

    resetForm();
  };

  // Reset form
  const resetForm = () => {
    setShowForm(false);
    setEditingAddress(null);
    setFormErrors({});
    setFormData({
      type: 'shipping',
      isDefault: false,
      firstName: '',
      lastName: '',
      company: '',
      address1: '',
      address2: '',
      city: '',
      province: 'QC',
      postalCode: '',
      country: 'CA',
      phone: '',
    });
  };

  // Edit address
  const editAddress = (address: Address) => {
    setEditingAddress(address);
    setFormData(address);
    setFormErrors({});
    setShowForm(true);
  };

  // Delete address
  const deleteAddress = (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDeleteAddress = () => {
    if (confirmDeleteId) {
      saveAddresses(addresses.filter(a => a.id !== confirmDeleteId));
      toast.success(t('toast.address.deleted'));
      setConfirmDeleteId(null);
    }
  };

  // Set as default
  const setAsDefault = (id: string) => {
    const address = addresses.find(a => a.id === id);
    if (!address) return;

    const updated = addresses.map(a => ({
      ...a,
      isDefault: a.id === id ? true : (a.type === address.type ? false : a.isDefault),
    }));
    saveAddresses(updated);
    toast.success(t('toast.address.defaultUpdated'));
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) return null;

  const shippingAddresses = addresses.filter(a => a.type === 'shipping');
  const billingAddresses = addresses.filter(a => a.type === 'billing');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        title={t('customerAddresses.deleteTitle') || 'Delete Address'}
        message={t('customerAddresses.confirmDelete')}
        confirmLabel={t('common.confirm') || 'Delete'}
        onConfirm={confirmDeleteAddress}
        onCancel={() => setConfirmDeleteId(null)}
        variant="danger"
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-orange-600">{t('nav.home')}</Link>
            <span className="mx-2">/</span>
            <Link href="/account" className="hover:text-orange-600">{t('nav.myAccount')}</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{t('customerAddresses.addresses')}</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('customerAddresses.myAddresses')}</h1>
              <p className="text-gray-600 mt-1">{t('customerAddresses.manageAddresses')}</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              {t('customerAddresses.newAddress')}
            </button>
          </div>
        </div>

        {/* Address Sections */}
        <div className="space-y-8">
          {/* Shipping Addresses */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🚚</span> {t('customerAddresses.shippingAddresses')}
            </h2>
            {shippingAddresses.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-4">{t('customerAddresses.noShippingAddress')}</p>
                <button
                  onClick={() => {
                    setFormData({ ...formData, type: 'shipping' });
                    setShowForm(true);
                  }}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  {t('customerAddresses.addAddress')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shippingAddresses.map(address => (
                  <AddressCard
                    key={address.id}
                    address={address}
                    onEdit={() => editAddress(address)}
                    onDelete={() => deleteAddress(address.id)}
                    onSetDefault={() => setAsDefault(address.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Billing Addresses */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🧾</span> {t('customerAddresses.billingAddresses')}
            </h2>
            {billingAddresses.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-4">{t('customerAddresses.noBillingAddress')}</p>
                <button
                  onClick={() => {
                    setFormData({ ...formData, type: 'billing' });
                    setShowForm(true);
                  }}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  {t('customerAddresses.addAddress')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {billingAddresses.map(address => (
                  <AddressCard
                    key={address.id}
                    address={address}
                    onEdit={() => editAddress(address)}
                    onDelete={() => deleteAddress(address.id)}
                    onSetDefault={() => setAsDefault(address.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="address-form-modal-title">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 id="address-form-modal-title" className="text-xl font-bold text-gray-900">
                  {editingAddress ? t('customerAddresses.editAddress') : t('customerAddresses.newAddress')}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('customerAddresses.addressType')}</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="type"
                        value="shipping"
                        checked={formData.type === 'shipping'}
                        onChange={() => setFormData({ ...formData, type: 'shipping' })}
                        className="me-2 text-orange-500 focus:ring-orange-500"
                      />
                      {t('customerAddresses.shipping')}
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="type"
                        value="billing"
                        checked={formData.type === 'billing'}
                        onChange={() => setFormData({ ...formData, type: 'billing' })}
                        className="me-2 text-orange-500 focus:ring-orange-500"
                      />
                      {t('customerAddresses.billing')}
                    </label>
                  </div>
                </div>

                {/* Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('customerAddresses.firstName')}</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={e => { setFormData({ ...formData, firstName: e.target.value }); clearFieldError('firstName'); }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${formErrors.firstName ? 'border-red-500' : 'border-gray-300'}`}
                      required
                    />
                    <FormError error={formErrors.firstName} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('customerAddresses.lastName')}</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={e => { setFormData({ ...formData, lastName: e.target.value }); clearFieldError('lastName'); }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${formErrors.lastName ? 'border-red-500' : 'border-gray-300'}`}
                      required
                    />
                    <FormError error={formErrors.lastName} />
                  </div>
                </div>

                {/* Company */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('customerAddresses.company')}</label>
                  <input
                    type="text"
                    value={formData.company || ''}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('customerAddresses.address')}</label>
                  <AddressAutocomplete
                    value={formData.address1 || ''}
                    onChange={(addressComponents) => {
                      setFormData({
                        ...formData,
                        address1: addressComponents.street,
                        city: addressComponents.city,
                        province: addressComponents.province || formData.province || 'QC',
                        postalCode: addressComponents.postalCode,
                        country: addressComponents.country || formData.country || 'CA',
                      });
                      clearFieldError('address1');
                      clearFieldError('city');
                      clearFieldError('province');
                      clearFieldError('postalCode');
                    }}
                    onInputChange={(value) => {
                      setFormData({ ...formData, address1: value });
                      clearFieldError('address1');
                    }}
                    placeholder={t('customerAddresses.addressPlaceholder')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${formErrors.address1 ? 'border-red-500' : 'border-gray-300'}`}
                    required
                    aria-invalid={!!formErrors.address1}
                  />
                  <FormError error={formErrors.address1} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('customerAddresses.address2')}</label>
                  <input
                    type="text"
                    value={formData.address2 || ''}
                    onChange={e => setFormData({ ...formData, address2: e.target.value })}
                    placeholder={t('customerAddresses.address2Placeholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* City & Province */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('customerAddresses.city')}</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => { setFormData({ ...formData, city: e.target.value }); clearFieldError('city'); }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${formErrors.city ? 'border-red-500' : 'border-gray-300'}`}
                      required
                    />
                    <FormError error={formErrors.city} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('customerAddresses.province')}</label>
                    <select
                      value={formData.province}
                      onChange={e => { setFormData({ ...formData, province: e.target.value }); clearFieldError('province'); }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${formErrors.province ? 'border-red-500' : 'border-gray-300'}`}
                      required
                    >
                      {PROVINCE_CODES.map(code => (
                        <option key={code} value={code}>{t(PROVINCE_KEYS[code])}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Postal Code & Country */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('customerAddresses.postalCode')}</label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={e => { setFormData({ ...formData, postalCode: e.target.value.toUpperCase() }); clearFieldError('postalCode'); }}
                      placeholder={formData.country === 'US' ? '12345' : 'A1A 1A1'}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${formErrors.postalCode ? 'border-red-500' : 'border-gray-300'}`}
                      required
                    />
                    <FormError error={formErrors.postalCode} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('customerAddresses.country')}</label>
                    <select
                      value={formData.country}
                      onChange={e => { setFormData({ ...formData, country: e.target.value, postalCode: '' }); clearFieldError('country'); clearFieldError('postalCode'); }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${formErrors.country ? 'border-red-500' : 'border-gray-300'}`}
                    >
                      <option value="CA">{t('customerAddresses.countryCanada')}</option>
                      <option value="US">{t('customerAddresses.countryUSA')}</option>
                    </select>
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('customerAddresses.phone')}</label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={e => { setFormData({ ...formData, phone: e.target.value }); clearFieldError('phone'); }}
                    placeholder="(514) 123-4567"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${formErrors.phone ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  <FormError error={formErrors.phone} />
                </div>

                {/* Default */}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="rounded text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">{t('customerAddresses.setAsDefault')}</span>
                </label>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {t('customerAddresses.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {editingAddress ? t('customerAddresses.save') : t('customerAddresses.add')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const { t } = useI18n();
  const provinceName = PROVINCE_KEYS[address.province] ? t(PROVINCE_KEYS[address.province]) : address.province;

  return (
    <div className={`bg-white rounded-xl border p-4 ${address.isDefault ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-200'}`}>
      {address.isDefault && (
        <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded mb-2">
          {t('customerAddresses.default')}
        </span>
      )}
      
      <p className="font-semibold text-gray-900">
        {address.firstName} {address.lastName}
      </p>
      {address.company && (
        <p className="text-sm text-gray-600">{address.company}</p>
      )}
      <p className="text-sm text-gray-600 mt-1">{address.address1}</p>
      {address.address2 && (
        <p className="text-sm text-gray-600">{address.address2}</p>
      )}
      <p className="text-sm text-gray-600">
        {address.city}, {provinceName} {address.postalCode}
      </p>
      <p className="text-sm text-gray-600">
        {address.country === 'CA' ? t('customerAddresses.countryCanada') : t('customerAddresses.countryUSA')}
      </p>
      {address.phone && (
        <p className="text-sm text-gray-500 mt-1">📞 {address.phone}</p>
      )}

      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={onEdit}
          className="flex-1 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
        >
          {t('customerAddresses.edit')}
        </button>
        {!address.isDefault && (
          <button
            onClick={onSetDefault}
            className="flex-1 py-1.5 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors"
          >
            {t('customerAddresses.makeDefault')}
          </button>
        )}
        <button
          onClick={onDelete}
          className="py-1.5 px-3 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
