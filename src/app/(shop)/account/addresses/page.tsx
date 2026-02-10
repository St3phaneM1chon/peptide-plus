'use client';

/**
 * PAGE GESTION DES ADRESSES - BioCycle Peptides
 * Gérer les adresses de livraison et facturation
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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

const PROVINCES_CA = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'Colombie-Britannique' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'Nouveau-Brunswick' },
  { code: 'NL', name: 'Terre-Neuve-et-Labrador' },
  { code: 'NS', name: 'Nouvelle-Écosse' },
  { code: 'NT', name: 'Territoires du Nord-Ouest' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Île-du-Prince-Édouard' },
  { code: 'QC', name: 'Québec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

export default function AddressesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

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
    }
    
    resetForm();
  };

  // Reset form
  const resetForm = () => {
    setShowForm(false);
    setEditingAddress(null);
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
    setShowForm(true);
  };

  // Delete address
  const deleteAddress = (id: string) => {
    if (confirm('Supprimer cette adresse?')) {
      saveAddresses(addresses.filter(a => a.id !== id));
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-orange-600">Accueil</Link>
            <span className="mx-2">/</span>
            <Link href="/account" className="hover:text-orange-600">Mon compte</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Adresses</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📍 Mes Adresses</h1>
              <p className="text-gray-600 mt-1">Gérez vos adresses de livraison et facturation</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              ➕ Nouvelle adresse
            </button>
          </div>
        </div>

        {/* Address Sections */}
        <div className="space-y-8">
          {/* Shipping Addresses */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🚚</span> Adresses de livraison
            </h2>
            {shippingAddresses.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-4">Aucune adresse de livraison enregistrée</p>
                <button
                  onClick={() => {
                    setFormData({ ...formData, type: 'shipping' });
                    setShowForm(true);
                  }}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  Ajouter une adresse →
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
              <span>🧾</span> Adresses de facturation
            </h2>
            {billingAddresses.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-4">Aucune adresse de facturation enregistrée</p>
                <button
                  onClick={() => {
                    setFormData({ ...formData, type: 'billing' });
                    setShowForm(true);
                  }}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  Ajouter une adresse →
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingAddress ? 'Modifier l\'adresse' : 'Nouvelle adresse'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type d&apos;adresse</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="type"
                        value="shipping"
                        checked={formData.type === 'shipping'}
                        onChange={() => setFormData({ ...formData, type: 'shipping' })}
                        className="mr-2 text-orange-500 focus:ring-orange-500"
                      />
                      🚚 Livraison
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="type"
                        value="billing"
                        checked={formData.type === 'billing'}
                        onChange={() => setFormData({ ...formData, type: 'billing' })}
                        className="mr-2 text-orange-500 focus:ring-orange-500"
                      />
                      🧾 Facturation
                    </label>
                  </div>
                </div>

                {/* Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                </div>

                {/* Company */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise (optionnel)</label>
                  <input
                    type="text"
                    value={formData.company || ''}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse *</label>
                  <input
                    type="text"
                    value={formData.address1}
                    onChange={e => setFormData({ ...formData, address1: e.target.value })}
                    placeholder="Numéro et rue"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Complément (optionnel)</label>
                  <input
                    type="text"
                    value={formData.address2 || ''}
                    onChange={e => setFormData({ ...formData, address2: e.target.value })}
                    placeholder="Appartement, suite, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* City & Province */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ville *</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
                    <select
                      value={formData.province}
                      onChange={e => setFormData({ ...formData, province: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      required
                    >
                      {PROVINCES_CA.map(p => (
                        <option key={p.code} value={p.code}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Postal Code & Country */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code postal *</label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={e => setFormData({ ...formData, postalCode: e.target.value.toUpperCase() })}
                      placeholder="A1A 1A1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
                    <select
                      value={formData.country}
                      onChange={e => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="CA">🇨🇦 Canada</option>
                      <option value="US">🇺🇸 États-Unis</option>
                    </select>
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone (optionnel)</label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(514) 123-4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Default */}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="rounded text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Définir comme adresse par défaut</span>
                </label>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {editingAddress ? 'Enregistrer' : 'Ajouter'}
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
  const provinceName = PROVINCES_CA.find(p => p.code === address.province)?.name || address.province;

  return (
    <div className={`bg-white rounded-xl border p-4 ${address.isDefault ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-200'}`}>
      {address.isDefault && (
        <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded mb-2">
          ⭐ Par défaut
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
        {address.country === 'CA' ? '🇨🇦 Canada' : '🇺🇸 États-Unis'}
      </p>
      {address.phone && (
        <p className="text-sm text-gray-500 mt-1">📞 {address.phone}</p>
      )}

      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={onEdit}
          className="flex-1 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
        >
          Modifier
        </button>
        {!address.isDefault && (
          <button
            onClick={onSetDefault}
            className="flex-1 py-1.5 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors"
          >
            Par défaut
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
