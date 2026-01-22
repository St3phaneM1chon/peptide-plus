/**
 * FORMULAIRE PRODUIT COMPLET (Création / Édition)
 * Supporte tous les types: Formation, Produit physique, Hybride
 * Avec: titre, sous-titre, descriptions, fiche technique, certificats, formats, photos
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductImage {
  id?: string;
  url: string;
  alt: string;
  caption: string;
  sortOrder: number;
  isPrimary: boolean;
}

interface ProductFormat {
  id?: string;
  name: string;
  description: string;
  price: number | null;
  sku: string;
  downloadUrl: string;
  fileSize: string;
  inStock: boolean;
  stockQuantity: number | null;
  isDefault: boolean;
}

interface ProductData {
  id?: string;
  // Base
  name: string;
  subtitle: string;
  slug: string;
  shortDescription: string;
  description: string;
  fullDetails: string;
  specifications: string;
  productType: 'DIGITAL' | 'PHYSICAL' | 'HYBRID';
  // Prix
  price: number;
  compareAtPrice: number | null;
  // Médias
  imageUrl: string;
  videoUrl: string;
  // Documents
  certificateUrl: string;
  certificateName: string;
  dataSheetUrl: string;
  dataSheetName: string;
  // Catégorie
  categoryId: string;
  // Formation
  duration: number | null;
  level: string;
  language: string;
  instructor: string;
  prerequisites: string;
  objectives: string;
  targetAudience: string;
  // Physique
  weight: number | null;
  dimensions: string;
  requiresShipping: boolean;
  sku: string;
  barcode: string;
  manufacturer: string;
  origin: string;
  // SEO
  metaTitle: string;
  metaDescription: string;
  // Status
  isActive: boolean;
  isFeatured: boolean;
  // Relations
  images?: ProductImage[];
  formats?: ProductFormat[];
}

interface Props {
  categories: Category[];
  initialData?: ProductData;
  mode: 'create' | 'edit';
}

const defaultData: ProductData = {
  name: '',
  subtitle: '',
  slug: '',
  shortDescription: '',
  description: '',
  fullDetails: '',
  specifications: '',
  productType: 'DIGITAL',
  price: 0,
  compareAtPrice: null,
  imageUrl: '',
  videoUrl: '',
  certificateUrl: '',
  certificateName: '',
  dataSheetUrl: '',
  dataSheetName: '',
  categoryId: '',
  duration: null,
  level: 'Débutant',
  language: 'fr',
  instructor: '',
  prerequisites: '',
  objectives: '',
  targetAudience: '',
  weight: null,
  dimensions: '',
  requiresShipping: false,
  sku: '',
  barcode: '',
  manufacturer: '',
  origin: '',
  metaTitle: '',
  metaDescription: '',
  isActive: true,
  isFeatured: false,
  images: [],
  formats: [],
};

type TabId = 'general' | 'content' | 'specs' | 'media' | 'formats' | 'pricing' | 'seo';

export default function ProductForm({ categories, initialData, mode }: Props) {
  const router = useRouter();
  const [data, setData] = useState<ProductData>({ ...defaultData, ...initialData });
  const [images, setImages] = useState<ProductImage[]>(initialData?.images || []);
  const [formats, setFormats] = useState<ProductFormat[]>(initialData?.formats || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Générer slug automatiquement
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setData({
      ...data,
      name,
      slug: mode === 'create' ? generateSlug(name) : data.slug,
    });
  };

  // Gestion des images
  const addImage = () => {
    setImages([...images, { url: '', alt: '', caption: '', sortOrder: images.length, isPrimary: images.length === 0 }]);
  };

  const updateImage = (index: number, field: keyof ProductImage, value: any) => {
    const newImages = [...images];
    newImages[index] = { ...newImages[index], [field]: value };
    if (field === 'isPrimary' && value) {
      newImages.forEach((img, i) => { if (i !== index) img.isPrimary = false; });
    }
    setImages(newImages);
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // Gestion des formats
  const addFormat = () => {
    setFormats([...formats, {
      name: '',
      description: '',
      price: null,
      sku: '',
      downloadUrl: '',
      fileSize: '',
      inStock: true,
      stockQuantity: null,
      isDefault: formats.length === 0,
    }]);
  };

  const updateFormat = (index: number, field: keyof ProductFormat, value: any) => {
    const newFormats = [...formats];
    newFormats[index] = { ...newFormats[index], [field]: value };
    if (field === 'isDefault' && value) {
      newFormats.forEach((f, i) => { if (i !== index) f.isDefault = false; });
    }
    setFormats(newFormats);
  };

  const removeFormat = (index: number) => {
    setFormats(formats.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const url = mode === 'create' ? '/api/products' : `/api/products/${initialData?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const payload = {
        ...data,
        price: parseFloat(String(data.price)) || 0,
        compareAtPrice: data.compareAtPrice ? parseFloat(String(data.compareAtPrice)) : null,
        duration: data.duration ? parseInt(String(data.duration)) : null,
        weight: data.weight ? parseFloat(String(data.weight)) : null,
        images: images.filter(img => img.url),
        formats: formats.filter(f => f.name),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Une erreur est survenue');
        setSaving(false);
        return;
      }

      router.push('/admin/produits');
      router.refresh();
    } catch (err) {
      setError('Erreur de connexion');
      setSaving(false);
    }
  };

  const isPhysical = data.productType === 'PHYSICAL' || data.productType === 'HYBRID';
  const isDigital = data.productType === 'DIGITAL' || data.productType === 'HYBRID';

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'general', label: 'Général', icon: '📝' },
    { id: 'content', label: 'Contenu', icon: '📄' },
    { id: 'specs', label: 'Fiche technique', icon: '📋' },
    { id: 'media', label: 'Médias', icon: '🖼️' },
    { id: 'formats', label: 'Formats', icon: '📦' },
    { id: 'pricing', label: 'Prix & Stock', icon: '💰' },
    { id: 'seo', label: 'SEO', icon: '🔍' },
  ];

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{ padding: '16px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--gray-200)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px',
              backgroundColor: activeTab === tab.id ? 'var(--gray-500)' : 'var(--gray-100)',
              color: activeTab === tab.id ? 'white' : 'var(--gray-500)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: GÉNÉRAL ===== */}
      {activeTab === 'general' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '1px solid var(--gray-200)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: 'var(--gray-500)' }}>
            Informations générales
          </h2>

          {/* Type de produit */}
          <div style={{ marginBottom: '24px' }}>
            <label className="form-label">Type de produit *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { value: 'DIGITAL', label: '🎓 Formation', desc: 'Cours en ligne, ebook' },
                { value: 'PHYSICAL', label: '📦 Physique', desc: 'Manuel, kit, matériel' },
                { value: 'HYBRID', label: '🔄 Hybride', desc: 'Formation + matériel' },
              ].map((type) => (
                <label
                  key={type.value}
                  style={{
                    padding: '16px',
                    border: `2px solid ${data.productType === type.value ? 'var(--gray-500)' : 'var(--gray-200)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: data.productType === type.value ? 'var(--gray-50)' : 'white',
                  }}
                >
                  <input
                    type="radio"
                    name="productType"
                    value={type.value}
                    checked={data.productType === type.value}
                    onChange={(e) => setData({ ...data, productType: e.target.value as any, requiresShipping: e.target.value !== 'DIGITAL' })}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: 600, display: 'block' }}>{type.label}</span>
                  <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{type.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Titre & Sous-titre */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label className="form-label">Titre du produit *</label>
              <input
                type="text"
                required
                value={data.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="form-input"
                placeholder="Ex: Formation Vente Avancée"
              />
            </div>
            <div>
              <label className="form-label">Sous-titre</label>
              <input
                type="text"
                value={data.subtitle}
                onChange={(e) => setData({ ...data, subtitle: e.target.value })}
                className="form-input"
                placeholder="Ex: Techniques de closing"
              />
            </div>
          </div>

          {/* Slug & Catégorie */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label className="form-label">Slug (URL) *</label>
              <input
                type="text"
                required
                value={data.slug}
                onChange={(e) => setData({ ...data, slug: e.target.value })}
                className="form-input"
                placeholder="formation-vente-avancee"
              />
            </div>
            <div>
              <label className="form-label">Catégorie *</label>
              <select
                required
                value={data.categoryId}
                onChange={(e) => setData({ ...data, categoryId: e.target.value })}
                className="form-input form-select"
              >
                <option value="">Sélectionner...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description courte */}
          <div>
            <label className="form-label">Description courte (résumé)</label>
            <textarea
              rows={2}
              maxLength={300}
              value={data.shortDescription}
              onChange={(e) => setData({ ...data, shortDescription: e.target.value })}
              className="form-input"
              placeholder="Résumé en 1-2 phrases pour les listes..."
              style={{ resize: 'vertical' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
              {(data.shortDescription || '').length}/300 caractères
            </p>
          </div>
        </div>
      )}

      {/* ===== TAB: CONTENU ===== */}
      {activeTab === 'content' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '1px solid var(--gray-200)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: 'var(--gray-500)' }}>
            Contenu détaillé
          </h2>

          <div style={{ marginBottom: '24px' }}>
            <label className="form-label">Description longue (marketing)</label>
            <textarea
              rows={6}
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
              className="form-input"
              placeholder="Description complète pour la page produit..."
              style={{ resize: 'vertical' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Texte pour convaincre l'acheteur. Peut contenir du HTML basique.
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label className="form-label">Détails complets (page complète)</label>
            <textarea
              rows={12}
              value={data.fullDetails}
              onChange={(e) => setData({ ...data, fullDetails: e.target.value })}
              className="form-input"
              placeholder="Contenu détaillé complet, programme de formation, table des matières..."
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Peut contenir du Markdown ou HTML. Utilisé pour la page "En savoir plus".
            </p>
          </div>

          {isDigital && (
            <>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: 'var(--gray-400)', borderTop: '1px solid var(--gray-100)', paddingTop: '24px' }}>
                🎓 Informations de formation
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label className="form-label">Durée (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={data.duration || ''}
                    onChange={(e) => setData({ ...data, duration: parseInt(e.target.value) || null })}
                    className="form-input"
                    placeholder="120"
                  />
                </div>
                <div>
                  <label className="form-label">Niveau</label>
                  <select value={data.level} onChange={(e) => setData({ ...data, level: e.target.value })} className="form-input form-select">
                    <option value="Débutant">Débutant</option>
                    <option value="Intermédiaire">Intermédiaire</option>
                    <option value="Avancé">Avancé</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Langue</label>
                  <select value={data.language} onChange={(e) => setData({ ...data, language: e.target.value })} className="form-input form-select">
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Formateur</label>
                  <input
                    type="text"
                    value={data.instructor}
                    onChange={(e) => setData({ ...data, instructor: e.target.value })}
                    className="form-input"
                    placeholder="Nom du formateur"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label">Public cible</label>
                <input
                  type="text"
                  value={data.targetAudience}
                  onChange={(e) => setData({ ...data, targetAudience: e.target.value })}
                  className="form-input"
                  placeholder="Ex: Commerciaux, managers, entrepreneurs..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label className="form-label">Prérequis</label>
                  <textarea
                    rows={3}
                    value={data.prerequisites}
                    onChange={(e) => setData({ ...data, prerequisites: e.target.value })}
                    className="form-input"
                    placeholder="Liste des prérequis..."
                  />
                </div>
                <div>
                  <label className="form-label">Objectifs d'apprentissage</label>
                  <textarea
                    rows={3}
                    value={data.objectives}
                    onChange={(e) => setData({ ...data, objectives: e.target.value })}
                    className="form-input"
                    placeholder="Ce que l'apprenant saura faire..."
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== TAB: FICHE TECHNIQUE ===== */}
      {activeTab === 'specs' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '1px solid var(--gray-200)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: 'var(--gray-500)' }}>
            Fiche technique & Certifications
          </h2>

          <div style={{ marginBottom: '24px' }}>
            <label className="form-label">Spécifications techniques</label>
            <textarea
              rows={10}
              value={data.specifications}
              onChange={(e) => setData({ ...data, specifications: e.target.value })}
              className="form-input"
              placeholder="Caractéristiques techniques détaillées...
Exemple:
- Nombre de pages: 250
- Format: 21 x 29.7 cm
- Reliure: Spirale
- Papier: 80g/m²"
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
            />
          </div>

          {isPhysical && (
            <>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: 'var(--gray-400)' }}>
                📦 Caractéristiques physiques
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className="form-label">Poids (kg)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={data.weight || ''}
                    onChange={(e) => setData({ ...data, weight: parseFloat(e.target.value) || null })}
                    className="form-input"
                    placeholder="0.500"
                  />
                </div>
                <div>
                  <label className="form-label">Dimensions (L×l×H cm)</label>
                  <input
                    type="text"
                    value={data.dimensions}
                    onChange={(e) => setData({ ...data, dimensions: e.target.value })}
                    className="form-input"
                    placeholder="30 × 21 × 5"
                  />
                </div>
                <div>
                  <label className="form-label">Pays d'origine</label>
                  <input
                    type="text"
                    value={data.origin}
                    onChange={(e) => setData({ ...data, origin: e.target.value })}
                    className="form-input"
                    placeholder="Canada"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className="form-label">SKU (code interne)</label>
                  <input
                    type="text"
                    value={data.sku}
                    onChange={(e) => setData({ ...data, sku: e.target.value })}
                    className="form-input"
                    placeholder="PQAP-2026-001"
                  />
                </div>
                <div>
                  <label className="form-label">Code-barres (EAN/UPC)</label>
                  <input
                    type="text"
                    value={data.barcode}
                    onChange={(e) => setData({ ...data, barcode: e.target.value })}
                    className="form-input"
                    placeholder="1234567890123"
                  />
                </div>
                <div>
                  <label className="form-label">Fabricant</label>
                  <input
                    type="text"
                    value={data.manufacturer}
                    onChange={(e) => setData({ ...data, manufacturer: e.target.value })}
                    className="form-input"
                    placeholder="Nom du fabricant"
                  />
                </div>
              </div>
            </>
          )}

          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: 'var(--gray-400)', borderTop: '1px solid var(--gray-100)', paddingTop: '24px' }}>
            📜 Documents & Certificats
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label className="form-label">Certificat d'analyse (PDF)</label>
              <input
                type="url"
                value={data.certificateUrl}
                onChange={(e) => setData({ ...data, certificateUrl: e.target.value })}
                className="form-input"
                placeholder="https://... (URL du PDF)"
              />
              <input
                type="text"
                value={data.certificateName}
                onChange={(e) => setData({ ...data, certificateName: e.target.value })}
                className="form-input"
                placeholder="Nom du certificat"
                style={{ marginTop: '8px' }}
              />
            </div>
            <div>
              <label className="form-label">Fiche technique (PDF)</label>
              <input
                type="url"
                value={data.dataSheetUrl}
                onChange={(e) => setData({ ...data, dataSheetUrl: e.target.value })}
                className="form-input"
                placeholder="https://... (URL du PDF)"
              />
              <input
                type="text"
                value={data.dataSheetName}
                onChange={(e) => setData({ ...data, dataSheetName: e.target.value })}
                className="form-input"
                placeholder="Nom de la fiche"
                style={{ marginTop: '8px' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: MÉDIAS ===== */}
      {activeTab === 'media' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '1px solid var(--gray-200)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: 'var(--gray-500)' }}>
            Photos et vidéos
          </h2>

          {/* Image principale */}
          <div style={{ marginBottom: '24px' }}>
            <label className="form-label">Image principale (thumbnail)</label>
            <input
              type="url"
              value={data.imageUrl}
              onChange={(e) => setData({ ...data, imageUrl: e.target.value })}
              className="form-input"
              placeholder="https://..."
            />
            {data.imageUrl && (
              <div style={{ marginTop: '12px' }}>
                <img src={data.imageUrl} alt="Aperçu" style={{ maxWidth: '200px', borderRadius: '8px', border: '1px solid var(--gray-200)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>

          {/* Vidéo */}
          {isDigital && (
            <div style={{ marginBottom: '32px' }}>
              <label className="form-label">Vidéo de présentation</label>
              <input
                type="url"
                value={data.videoUrl}
                onChange={(e) => setData({ ...data, videoUrl: e.target.value })}
                className="form-input"
                placeholder="https://youtube.com/... ou https://vimeo.com/..."
              />
            </div>
          )}

          {/* Galerie d'images */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Galerie d'images</label>
              <button type="button" onClick={addImage} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                + Ajouter une image
              </button>
            </div>

            {images.length === 0 ? (
              <p style={{ color: 'var(--gray-400)', fontSize: '14px', padding: '24px', backgroundColor: 'var(--gray-50)', borderRadius: '8px', textAlign: 'center' }}>
                Aucune image dans la galerie. Ajoutez des photos du produit.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {images.map((img, index) => (
                  <div key={index} style={{ display: 'flex', gap: '12px', padding: '16px', backgroundColor: 'var(--gray-50)', borderRadius: '8px', alignItems: 'flex-start' }}>
                    {img.url && (
                      <img src={img.url} alt="" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px' }} onError={(e) => { (e.target as HTMLImageElement).src = ''; }} />
                    )}
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px' }}>
                      <input type="url" value={img.url} onChange={(e) => updateImage(index, 'url', e.target.value)} className="form-input" placeholder="URL de l'image" style={{ fontSize: '13px' }} />
                      <input type="text" value={img.alt} onChange={(e) => updateImage(index, 'alt', e.target.value)} className="form-input" placeholder="Texte alt" style={{ fontSize: '13px' }} />
                      <input type="text" value={img.caption} onChange={(e) => updateImage(index, 'caption', e.target.value)} className="form-input" placeholder="Légende" style={{ fontSize: '13px' }} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={img.isPrimary} onChange={(e) => updateImage(index, 'isPrimary', e.target.checked)} />
                      Principale
                    </label>
                    <button type="button" onClick={() => removeImage(index)} style={{ padding: '6px 10px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: FORMATS ===== */}
      {activeTab === 'formats' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '1px solid var(--gray-200)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>
            Formats disponibles
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '24px' }}>
            Proposez votre produit en plusieurs formats (PDF, livre relié, en ligne, etc.)
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button type="button" onClick={addFormat} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
              + Ajouter un format
            </button>
          </div>

          {formats.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: '14px', padding: '32px', backgroundColor: 'var(--gray-50)', borderRadius: '8px', textAlign: 'center' }}>
              Aucun format défini. Le produit sera vendu au prix principal uniquement.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {formats.map((format, index) => (
                <div key={index} style={{ padding: '20px', backgroundColor: 'var(--gray-50)', borderRadius: '8px', border: format.isDefault ? '2px solid var(--gray-500)' : '1px solid var(--gray-200)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-500)' }}>Format #{index + 1}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                        <input type="checkbox" checked={format.isDefault} onChange={(e) => updateFormat(index, 'isDefault', e.target.checked)} />
                        Par défaut
                      </label>
                      <button type="button" onClick={() => removeFormat(index)} style={{ padding: '4px 8px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Nom *</label>
                      <input type="text" value={format.name} onChange={(e) => updateFormat(index, 'name', e.target.value)} className="form-input" placeholder="PDF, Relié..." style={{ fontSize: '13px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Description</label>
                      <input type="text" value={format.description} onChange={(e) => updateFormat(index, 'description', e.target.value)} className="form-input" placeholder="Description courte" style={{ fontSize: '13px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Prix ($)</label>
                      <input type="number" min="0" step="0.01" value={format.price || ''} onChange={(e) => updateFormat(index, 'price', parseFloat(e.target.value) || null)} className="form-input" placeholder="Si différent" style={{ fontSize: '13px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--gray-400)' }}>SKU</label>
                      <input type="text" value={format.sku} onChange={(e) => updateFormat(index, 'sku', e.target.value)} className="form-input" placeholder="Code" style={{ fontSize: '13px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--gray-400)' }}>URL téléchargement</label>
                      <input type="url" value={format.downloadUrl} onChange={(e) => updateFormat(index, 'downloadUrl', e.target.value)} className="form-input" placeholder="Pour formats digitaux" style={{ fontSize: '13px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Taille fichier</label>
                      <input type="text" value={format.fileSize} onChange={(e) => updateFormat(index, 'fileSize', e.target.value)} className="form-input" placeholder="15 MB" style={{ fontSize: '13px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Stock</label>
                      <input type="number" min="0" value={format.stockQuantity || ''} onChange={(e) => updateFormat(index, 'stockQuantity', parseInt(e.target.value) || null)} className="form-input" placeholder="∞" style={{ fontSize: '13px' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: PRIX & STOCK ===== */}
      {activeTab === 'pricing' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '1px solid var(--gray-200)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: 'var(--gray-500)' }}>
            Tarification et disponibilité
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div>
              <label className="form-label">Prix de vente (CAD) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={data.price || ''}
                onChange={(e) => setData({ ...data, price: parseFloat(e.target.value) || 0 })}
                className="form-input"
                placeholder="99.00"
                style={{ fontSize: '18px', fontWeight: 600 }}
              />
            </div>
            <div>
              <label className="form-label">Prix comparatif (barré)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={data.compareAtPrice || ''}
                onChange={(e) => setData({ ...data, compareAtPrice: parseFloat(e.target.value) || null })}
                className="form-input"
                placeholder="149.00"
              />
              <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
                Affiche un prix barré pour montrer la réduction
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', backgroundColor: 'var(--gray-50)', borderRadius: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={data.isActive}
                onChange={(e) => setData({ ...data, isActive: e.target.checked })}
                style={{ width: '20px', height: '20px' }}
              />
              <div>
                <span style={{ fontWeight: 600, color: 'var(--gray-500)' }}>Produit actif</span>
                <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Visible sur le site et disponible à l'achat</p>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={data.isFeatured}
                onChange={(e) => setData({ ...data, isFeatured: e.target.checked })}
                style={{ width: '20px', height: '20px' }}
              />
              <div>
                <span style={{ fontWeight: 600, color: 'var(--gray-500)' }}>Mettre en vedette</span>
                <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Afficher sur la page d'accueil et en priorité</p>
              </div>
            </label>
            {isPhysical && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={data.requiresShipping}
                  onChange={(e) => setData({ ...data, requiresShipping: e.target.checked })}
                  style={{ width: '20px', height: '20px' }}
                />
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--gray-500)' }}>Nécessite une livraison</span>
                  <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Le client devra entrer une adresse de livraison</p>
                </div>
              </label>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: SEO ===== */}
      {activeTab === 'seo' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '1px solid var(--gray-200)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: 'var(--gray-500)' }}>
            Optimisation pour les moteurs de recherche (SEO)
          </h2>

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label">Titre SEO (meta title)</label>
            <input
              type="text"
              maxLength={60}
              value={data.metaTitle}
              onChange={(e) => setData({ ...data, metaTitle: e.target.value })}
              className="form-input"
              placeholder="Titre optimisé pour Google (60 car. max)"
            />
            <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
              {(data.metaTitle || '').length}/60 caractères
            </p>
          </div>

          <div>
            <label className="form-label">Description SEO (meta description)</label>
            <textarea
              rows={3}
              maxLength={160}
              value={data.metaDescription}
              onChange={(e) => setData({ ...data, metaDescription: e.target.value })}
              className="form-input"
              placeholder="Description pour les résultats de recherche (160 car. max)"
            />
            <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
              {(data.metaDescription || '').length}/160 caractères
            </p>
          </div>

          {/* Aperçu Google */}
          <div style={{ marginTop: '32px', padding: '20px', backgroundColor: 'var(--gray-50)', borderRadius: '8px' }}>
            <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginBottom: '12px' }}>Aperçu Google :</p>
            <div style={{ fontFamily: 'Arial, sans-serif' }}>
              <p style={{ fontSize: '18px', color: '#1a0dab', marginBottom: '4px' }}>
                {data.metaTitle || data.name || 'Titre du produit'}
              </p>
              <p style={{ fontSize: '14px', color: '#006621', marginBottom: '4px' }}>
                www.example.com › catalogue › {data.slug || 'slug-produit'}
              </p>
              <p style={{ fontSize: '13px', color: '#545454' }}>
                {data.metaDescription || data.shortDescription || 'Description du produit...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '32px', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/admin/produits" style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
          ← Retour à la liste
        </Link>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link href="/admin/produits" className="btn btn-secondary" style={{ padding: '12px 24px' }}>
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ padding: '12px 32px', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Enregistrement...' : mode === 'create' ? 'Créer le produit' : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>
    </form>
  );
}
