'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface FormatToCreate {
  id: string;
  formatType: string;
  name: string;
  sku: string;
  price: number;
  comparePrice: number | null;
  dosageMg: number | null;
  unitCount: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  availability: string;
  isDefault: boolean;
  isActive: boolean;
}

interface Props {
  categories: Category[];
}

const FORMAT_TYPES = [
  { value: 'VIAL_2ML', label: 'Vial 2ml', icon: '💉' },
  { value: 'VIAL_10ML', label: 'Vial 10ml', icon: '💉' },
  { value: 'CARTRIDGE_3ML', label: 'Cartouche 3ml', icon: '🔫' },
  { value: 'KIT_12', label: 'Kit de 12', icon: '📦' },
  { value: 'CAPSULE_60', label: 'Capsules (60)', icon: '💊' },
  { value: 'CAPSULE_120', label: 'Capsules (120)', icon: '💊' },
  { value: 'PACK_5', label: 'Pack de 5', icon: '📦' },
  { value: 'PACK_10', label: 'Pack de 10', icon: '📦' },
  { value: 'BUNDLE', label: 'Bundle', icon: '🎁' },
  { value: 'ACCESSORY', label: 'Accessoire', icon: '🔧' },
  { value: 'NASAL_SPRAY', label: 'Spray nasal', icon: '💨' },
  { value: 'CREAM', label: 'Crème', icon: '🧴' },
];

const PRODUCT_TYPES = [
  { value: 'PEPTIDE', label: 'Peptide' },
  { value: 'SUPPLEMENT', label: 'Supplément' },
  { value: 'ACCESSORY', label: 'Accessoire' },
  { value: 'BUNDLE', label: 'Bundle' },
  { value: 'CAPSULE', label: 'Capsule' },
];

const AVAILABILITY_OPTIONS = [
  { value: 'IN_STOCK', label: 'En stock' },
  { value: 'OUT_OF_STOCK', label: 'Rupture de stock' },
  { value: 'COMING_SOON', label: 'Bientôt disponible' },
  { value: 'PRE_ORDER', label: 'Pré-commande' },
];

export default function NewProductClient({ categories }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'formats'>('info');
  
  const [formData, setFormData] = useState({
    name: '',
    subtitle: '',
    slug: '',
    shortDescription: '',
    description: '',
    productType: 'PEPTIDE',
    price: 0,
    compareAtPrice: '',
    purity: '',
    molecularWeight: '',
    casNumber: '',
    molecularFormula: '',
    storageConditions: '',
    imageUrl: '/images/products/peptide-default.png',
    categoryId: categories[0]?.id || '',
    isFeatured: false,
    isNew: true,
    isBestseller: false,
    isActive: true,
  });

  const [formats, setFormats] = useState<FormatToCreate[]>([]);
  const [showAddFormat, setShowAddFormat] = useState(false);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setFormData({ ...formData, name, slug });
  };

  const handleAddFormat = (format: Omit<FormatToCreate, 'id'>) => {
    const newFormat: FormatToCreate = {
      ...format,
      id: `temp-${Date.now()}`,
    };
    setFormats([...formats, newFormat]);
    setShowAddFormat(false);
  };

  const handleRemoveFormat = (id: string) => {
    setFormats(formats.filter(f => f.id !== id));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug || !formData.price || !formData.categoryId) {
      alert('Veuillez remplir tous les champs requis (nom, slug, prix, catégorie)');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          formats: formats.map(({ id, ...f }) => f),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/admin/produits/${data.product.id}`);
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/produits"
              className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Nouveau produit</h1>
              <p className="text-sm text-neutral-500">Créez un nouveau produit avec ses formats</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Création...' : 'Créer le produit'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-neutral-200 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'info'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Informations
          </button>
          <button
            onClick={() => setActiveTab('formats')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'formats'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Formats / Packaging ({formats.length})
          </button>
        </div>

        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nom */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nom du produit *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: BPC-157"
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Sous-titre</label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="Ex: Body Protection Compound-157"
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Slug *</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="bpc-157"
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Type de produit *</label>
                <select
                  value={formData.productType}
                  onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {PRODUCT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Catégorie */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Catégorie *</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Prix */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Prix de base *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Pureté */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Pureté (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.purity}
                  onChange={(e) => setFormData({ ...formData, purity: e.target.value })}
                  placeholder="99.50"
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* CAS Number */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">CAS Number</label>
                <input
                  type="text"
                  value={formData.casNumber}
                  onChange={(e) => setFormData({ ...formData, casNumber: e.target.value })}
                  placeholder="137525-51-0"
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Storage */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Stockage</label>
                <input
                  type="text"
                  value={formData.storageConditions}
                  onChange={(e) => setFormData({ ...formData, storageConditions: e.target.value })}
                  placeholder="2-8°C"
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Description courte */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Description courte</label>
                <textarea
                  rows={2}
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  placeholder="Description courte pour les listes de produits..."
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Description complète</label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description détaillée du produit..."
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Image URL */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">URL de l'image</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Options */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-3">Options</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-orange-500 border-neutral-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-neutral-700">Actif (visible sur le site)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="w-4 h-4 text-orange-500 border-neutral-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-neutral-700">En vedette</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isNew}
                      onChange={(e) => setFormData({ ...formData, isNew: e.target.checked })}
                      className="w-4 h-4 text-orange-500 border-neutral-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-neutral-700">Nouveau</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isBestseller}
                      onChange={(e) => setFormData({ ...formData, isBestseller: e.target.checked })}
                      className="w-4 h-4 text-orange-500 border-neutral-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-neutral-700">Bestseller</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Formats Tab */}
        {activeTab === 'formats' && (
          <div className="space-y-4">
            {/* Add Format Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddFormat(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un format
              </button>
            </div>

            {/* Formats List */}
            {formats.map((format) => (
              <div
                key={format.id}
                className="bg-white rounded-xl border border-neutral-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center text-2xl">
                      {FORMAT_TYPES.find(t => t.value === format.formatType)?.icon || '📦'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-neutral-900">{format.name}</p>
                        {format.isDefault && (
                          <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">Par défaut</span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-500">
                        {format.sku && <span className="mr-3">SKU: {format.sku}</span>}
                        {format.dosageMg && <span>{format.dosageMg}mg</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-neutral-900">${format.price.toFixed(2)}</p>
                      <p className="text-sm text-neutral-500">{format.stockQuantity} en stock</p>
                    </div>
                    <button
                      onClick={() => handleRemoveFormat(format.id)}
                      className="p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {formats.length === 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                <p className="text-neutral-500 mb-4">Aucun format défini pour ce produit.</p>
                <button
                  onClick={() => setShowAddFormat(true)}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  Ajouter un premier format
                </button>
              </div>
            )}

            {/* Add Format Modal */}
            {showAddFormat && (
              <AddFormatModal
                onAdd={handleAddFormat}
                onClose={() => setShowAddFormat(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Add Format Modal
function AddFormatModal({
  onAdd,
  onClose,
}: {
  onAdd: (format: Omit<FormatToCreate, 'id'>) => void;
  onClose: () => void;
}) {
  const [newFormat, setNewFormat] = useState({
    formatType: 'VIAL_2ML',
    name: '',
    sku: '',
    price: 0,
    comparePrice: null as number | null,
    dosageMg: null as number | null,
    unitCount: null as number | null,
    stockQuantity: 100,
    lowStockThreshold: 10,
    availability: 'IN_STOCK',
    isDefault: false,
    isActive: true,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-neutral-900 mb-4">Ajouter un format</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Type *</label>
            <select
              value={newFormat.formatType}
              onChange={(e) => setNewFormat({ ...newFormat, formatType: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {FORMAT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nom du format *</label>
            <input
              type="text"
              value={newFormat.name}
              onChange={(e) => setNewFormat({ ...newFormat, name: e.target.value })}
              placeholder="Ex: 5mg Vial"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Prix *</label>
            <input
              type="number"
              step="0.01"
              value={newFormat.price}
              onChange={(e) => setNewFormat({ ...newFormat, price: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">SKU</label>
            <input
              type="text"
              value={newFormat.sku}
              onChange={(e) => setNewFormat({ ...newFormat, sku: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Quantité en stock</label>
            <input
              type="number"
              value={newFormat.stockQuantity}
              onChange={(e) => setNewFormat({ ...newFormat, stockQuantity: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Disponibilité</label>
            <select
              value={newFormat.availability}
              onChange={(e) => setNewFormat({ ...newFormat, availability: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {AVAILABILITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Dosage (mg)</label>
            <input
              type="number"
              step="0.01"
              value={newFormat.dosageMg || ''}
              onChange={(e) => setNewFormat({ ...newFormat, dosageMg: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nb d'unités</label>
            <input
              type="number"
              value={newFormat.unitCount || ''}
              onChange={(e) => setNewFormat({ ...newFormat, unitCount: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newFormat.isActive}
              onChange={(e) => setNewFormat({ ...newFormat, isActive: e.target.checked })}
              className="w-4 h-4 text-orange-500 border-neutral-300 rounded focus:ring-orange-500"
            />
            <span className="text-sm text-neutral-700">Actif</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newFormat.isDefault}
              onChange={(e) => setNewFormat({ ...newFormat, isDefault: e.target.checked })}
              className="w-4 h-4 text-orange-500 border-neutral-300 rounded focus:ring-orange-500"
            />
            <span className="text-sm text-neutral-700">Format par défaut</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => onAdd(newFormat)}
            disabled={!newFormat.name || !newFormat.price}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
