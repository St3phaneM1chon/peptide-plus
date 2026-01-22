/**
 * ADMIN - GESTION DES CATÉGORIES
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '', imageUrl: '', sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch categories
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories?includeInactive=true');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
    setLoading(false);
  };

  // Generate slug
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const url = editingId ? `/api/categories/${editingId}` : '/api/categories';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur');
        setSaving(false);
        return;
      }

      await fetchCategories();
      resetForm();
    } catch (err) {
      setError('Erreur de connexion');
    }
    setSaving(false);
  };

  const resetForm = () => {
    setFormData({ name: '', slug: '', description: '', imageUrl: '', sortOrder: 0 });
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const startEdit = (cat: Category) => {
    setFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      imageUrl: cat.imageUrl || '',
      sortOrder: cat.sortOrder,
    });
    setEditingId(cat.id);
    setShowForm(true);
  };

  const toggleActive = async (catId: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/categories/${catId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      await fetchCategories();
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '64px', textAlign: 'center' }}>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '8px' }}>
            Catégories
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
            Organisez vos produits par catégories
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
        >
          <span style={{ fontSize: '18px' }}>+</span>
          Nouvelle catégorie
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => resetForm()}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              width: '100%',
              maxWidth: '500px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', color: 'var(--gray-500)' }}>
              {editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </h2>

            {error && (
              <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Nom *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({
                    ...formData,
                    name: e.target.value,
                    slug: !editingId ? generateSlug(e.target.value) : formData.slug,
                  })}
                  className="form-input"
                  placeholder="Ex: Vente et négociation"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Slug (URL) *</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="form-input"
                  placeholder="vente-negociation"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-input"
                  placeholder="Description de la catégorie..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className="form-label">URL de l'image</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="form-input"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="form-label">Ordre d'affichage</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
        {categories.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)' }}>
            Aucune catégorie. Créez votre première catégorie.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--gray-50)' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase' }}>
                  Catégorie
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', width: '100px' }}>
                  Produits
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', width: '80px' }}>
                  Ordre
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', width: '80px' }}>
                  Actif
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', width: '100px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} style={{ borderTop: '1px solid var(--gray-100)' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--gray-100)',
                          backgroundImage: cat.imageUrl ? `url(${cat.imageUrl})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {!cat.imageUrl && '📁'}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--gray-500)' }}>{cat.name}</p>
                        <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>/{cat.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--gray-500)' }}>{cat._count.products}</span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--gray-400)' }}>
                    {cat.sortOrder}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => toggleActive(cat.id, cat.isActive)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: cat.isActive ? '#22c55e' : 'var(--gray-200)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      {cat.isActive ? '✓' : ''}
                    </button>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => startEdit(cat)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: 'var(--gray-100)',
                        borderRadius: '6px',
                        color: 'var(--gray-500)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Back link */}
      <div style={{ marginTop: '24px' }}>
        <Link href="/admin/produits" style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
          ← Retour aux produits
        </Link>
      </div>
    </div>
  );
}
