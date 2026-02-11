'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ProductFormat {
  id: string;
  formatType: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  dosageMg: number | null;
  volumeMl: number | null;
  unitCount: number | null;
  price: number;
  comparePrice: number | null;
  sku: string | null;
  barcode: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  inStock: boolean;
  availability: string;
  availableDate: string | null;
  discontinuedAt: string | null;
  weightGrams: number | null;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
}

interface Product {
  id: string;
  name: string;
  subtitle: string | null;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  productType: string;
  price: number;
  compareAtPrice: number | null;
  purity: number | null;
  molecularWeight: number | null;
  casNumber: string | null;
  molecularFormula: string | null;
  storageConditions: string | null;
  imageUrl: string | null;
  categoryId: string;
  isFeatured: boolean;
  isNew: boolean;
  isBestseller: boolean;
  isActive: boolean;
  formats: ProductFormat[];
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  product: Product;
  categories: Category[];
  isOwner: boolean;
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

const AVAILABILITY_OPTIONS = [
  { value: 'IN_STOCK', label: 'En stock', color: 'green' },
  { value: 'OUT_OF_STOCK', label: 'Rupture de stock', color: 'red' },
  { value: 'DISCONTINUED', label: 'Produit arrêté', color: 'gray' },
  { value: 'COMING_SOON', label: 'Bientôt disponible', color: 'blue' },
  { value: 'PRE_ORDER', label: 'Pré-commande', color: 'purple' },
  { value: 'LIMITED', label: 'Stock limité', color: 'orange' },
];

export default function ProductEditClient({ product, categories, isOwner }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'formats'>('info');
  
  // Product state
  const [formData, setFormData] = useState({
    name: product.name,
    subtitle: product.subtitle || '',
    slug: product.slug,
    shortDescription: product.shortDescription || '',
    description: product.description || '',
    productType: product.productType,
    price: product.price,
    compareAtPrice: product.compareAtPrice || '',
    purity: product.purity || '',
    molecularWeight: product.molecularWeight || '',
    casNumber: product.casNumber || '',
    molecularFormula: product.molecularFormula || '',
    storageConditions: product.storageConditions || '',
    imageUrl: product.imageUrl || '',
    categoryId: product.categoryId,
    isFeatured: product.isFeatured,
    isNew: product.isNew,
    isBestseller: product.isBestseller,
    isActive: product.isActive,
  });

  // Formats state
  const [formats, setFormats] = useState<ProductFormat[]>(product.formats);
  const [editingFormat, setEditingFormat] = useState<ProductFormat | null>(null);
  const [showAddFormat, setShowAddFormat] = useState(false);

  const handleSaveProduct = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        alert('Produit mis à jour avec succès!');
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFormat = async (format: ProductFormat) => {
    try {
      const res = await fetch(`/api/products/${product.id}/formats/${format.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(format),
      });

      if (res.ok) {
        const updatedFormat = await res.json();
        setFormats(formats.map(f => f.id === format.id ? updatedFormat : f));
        setEditingFormat(null);
      } else {
        alert('Erreur lors de la mise à jour du format');
      }
    } catch (error) {
      console.error('Format save error:', error);
      alert('Erreur lors de la mise à jour');
    }
  };

  const handleAddFormat = async (newFormat: Partial<ProductFormat>) => {
    try {
      const res = await fetch(`/api/products/${product.id}/formats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFormat),
      });

      if (res.ok) {
        const createdFormat = await res.json();
        setFormats([...formats, createdFormat]);
        setShowAddFormat(false);
      } else {
        alert('Erreur lors de la création du format');
      }
    } catch (error) {
      console.error('Add format error:', error);
      alert('Erreur lors de la création');
    }
  };

  const handleDeleteFormat = async (formatId: string) => {
    if (!confirm('Supprimer ce format?')) return;

    try {
      const res = await fetch(`/api/products/${product.id}/formats/${formatId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setFormats(formats.filter(f => f.id !== formatId));
      } else {
        alert('Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Delete format error:', error);
      alert('Erreur lors de la suppression');
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
              <h1 className="text-2xl font-bold text-neutral-900">{product.name}</h1>
              <p className="text-sm text-neutral-500">ID: {product.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/product/${product.slug}`}
              target="_blank"
              className="px-4 py-2 text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Voir le produit ↗
            </Link>
            <button
              onClick={handleSaveProduct}
              disabled={saving}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
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
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
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
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
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
                className={`bg-white rounded-xl border ${
                  format.availability === 'OUT_OF_STOCK' ? 'border-red-200' :
                  format.availability === 'DISCONTINUED' ? 'border-gray-300' :
                  format.stockQuantity <= format.lowStockThreshold ? 'border-yellow-200' :
                  'border-neutral-200'
                } p-4`}
              >
                {editingFormat?.id === format.id ? (
                  <FormatEditForm
                    format={editingFormat}
                    onSave={handleSaveFormat}
                    onCancel={() => setEditingFormat(null)}
                    onChange={setEditingFormat}
                  />
                ) : (
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
                          {!format.isActive && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">Inactif</span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-500">
                          {format.sku && <span className="mr-3">SKU: {format.sku}</span>}
                          {format.dosageMg && <span className="mr-3">{format.dosageMg}mg</span>}
                          {format.unitCount && <span className="mr-3">{format.unitCount} unités</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-neutral-900">${Number(format.price).toFixed(2)}</p>
                        {format.comparePrice && (
                          <p className="text-sm text-neutral-400 line-through">${Number(format.comparePrice).toFixed(2)}</p>
                        )}
                      </div>
                      <div className="text-center px-4">
                        <p className={`text-sm font-medium ${
                          format.availability === 'OUT_OF_STOCK' || format.availability === 'DISCONTINUED' 
                            ? 'text-red-600' 
                            : format.stockQuantity <= format.lowStockThreshold 
                              ? 'text-yellow-600' 
                              : 'text-green-600'
                        }`}>
                          {format.stockQuantity} en stock
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          format.availability === 'IN_STOCK' ? 'bg-green-100 text-green-700' :
                          format.availability === 'OUT_OF_STOCK' ? 'bg-red-100 text-red-700' :
                          format.availability === 'DISCONTINUED' ? 'bg-gray-100 text-gray-700' :
                          format.availability === 'COMING_SOON' ? 'bg-blue-100 text-blue-700' :
                          format.availability === 'PRE_ORDER' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {AVAILABILITY_OPTIONS.find(o => o.value === format.availability)?.label || format.availability}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingFormat({ ...format })}
                          className="p-2 text-neutral-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteFormat(format.id)}
                            className="p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {formats.length === 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                <p className="text-neutral-500">Aucun format défini pour ce produit.</p>
                <button
                  onClick={() => setShowAddFormat(true)}
                  className="mt-4 text-orange-600 hover:text-orange-700 font-medium"
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

// Format Edit Form Component
function FormatEditForm({
  format,
  onSave,
  onCancel,
  onChange,
}: {
  format: ProductFormat;
  onSave: (format: ProductFormat) => void;
  onCancel: () => void;
  onChange: (format: ProductFormat) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Nom du format *</label>
          <input
            type="text"
            value={format.name}
            onChange={(e) => onChange({ ...format, name: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
          <select
            value={format.formatType}
            onChange={(e) => onChange({ ...format, formatType: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {FORMAT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">SKU</label>
          <input
            type="text"
            value={format.sku || ''}
            onChange={(e) => onChange({ ...format, sku: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-neutral-700 mb-1">Image URL du format</label>
          <input
            type="url"
            value={format.imageUrl || ''}
            onChange={(e) => onChange({ ...format, imageUrl: e.target.value || null })}
            placeholder="https://exemple.com/image.png"
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {format.imageUrl && (
            <div className="mt-2 flex items-center gap-3">
              <img src={format.imageUrl} alt="Aperçu" className="w-16 h-16 object-cover rounded-lg border border-neutral-200" />
              <button
                type="button"
                onClick={() => onChange({ ...format, imageUrl: null })}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Supprimer l'image
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Prix *</label>
          <input
            type="number"
            step="0.01"
            value={format.price}
            onChange={(e) => onChange({ ...format, price: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Prix barré</label>
          <input
            type="number"
            step="0.01"
            value={format.comparePrice || ''}
            onChange={(e) => onChange({ ...format, comparePrice: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Dosage (mg)</label>
          <input
            type="number"
            step="0.01"
            value={format.dosageMg || ''}
            onChange={(e) => onChange({ ...format, dosageMg: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Quantité en stock *</label>
          <input
            type="number"
            value={format.stockQuantity}
            onChange={(e) => onChange({ ...format, stockQuantity: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Seuil stock faible</label>
          <input
            type="number"
            value={format.lowStockThreshold}
            onChange={(e) => onChange({ ...format, lowStockThreshold: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Disponibilité</label>
          <select
            value={format.availability}
            onChange={(e) => onChange({ ...format, availability: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {AVAILABILITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={format.isActive}
            onChange={(e) => onChange({ ...format, isActive: e.target.checked })}
            className="w-4 h-4 text-orange-500 border-neutral-300 rounded focus:ring-orange-500"
          />
          <span className="text-sm text-neutral-700">Actif</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={format.isDefault}
            onChange={(e) => onChange({ ...format, isDefault: e.target.checked })}
            className="w-4 h-4 text-orange-500 border-neutral-300 rounded focus:ring-orange-500"
          />
          <span className="text-sm text-neutral-700">Format par défaut</span>
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={() => onSave(format)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// Add Format Modal
function AddFormatModal({
  onAdd,
  onClose,
}: {
  onAdd: (format: Partial<ProductFormat>) => void;
  onClose: () => void;
}) {
  const [newFormat, setNewFormat] = useState({
    formatType: 'VIAL_2ML',
    name: '',
    sku: '',
    imageUrl: '',
    price: 0,
    comparePrice: null as number | null,
    dosageMg: null as number | null,
    unitCount: null as number | null,
    stockQuantity: 0,
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
              onChange={(e) => setNewFormat({ ...newFormat, price: parseFloat(e.target.value) })}
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
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Image URL du format</label>
            <input
              type="url"
              value={newFormat.imageUrl}
              onChange={(e) => setNewFormat({ ...newFormat, imageUrl: e.target.value })}
              placeholder="https://exemple.com/image.png"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {newFormat.imageUrl && (
              <div className="mt-2">
                <img src={newFormat.imageUrl} alt="Aperçu" className="w-16 h-16 object-cover rounded-lg border border-neutral-200" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Quantité en stock</label>
            <input
              type="number"
              value={newFormat.stockQuantity}
              onChange={(e) => setNewFormat({ ...newFormat, stockQuantity: parseInt(e.target.value) })}
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
