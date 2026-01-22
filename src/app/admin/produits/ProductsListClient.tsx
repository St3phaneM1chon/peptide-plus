/**
 * CLIENT - LISTE DES PRODUITS ADMIN
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/client';

interface Product {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  productType: 'DIGITAL' | 'PHYSICAL' | 'HYBRID';
  isActive: boolean;
  isFeatured: boolean;
  purchaseCount: number;
  createdAt: string;
  category: { id: string; name: string; slug: string } | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  initialProducts: Product[];
  categories: Category[];
  stats: {
    total: number;
    active: number;
    digital: number;
    physical: number;
    hybrid: number;
    featured: number;
  };
  isOwner: boolean;
}

export default function ProductsListClient({ initialProducts, categories, stats, isOwner }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  // Filtrage
  const filteredProducts = products.filter(product => {
    const matchesSearch = !search || 
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.slug.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !filterCategory || product.category?.id === filterCategory;
    const matchesType = !filterType || product.productType === filterType;
    const matchesStatus = !filterStatus || 
      (filterStatus === 'active' && product.isActive) ||
      (filterStatus === 'inactive' && !product.isActive) ||
      (filterStatus === 'featured' && product.isFeatured);
    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  // Suppression
  const handleDelete = async (productId: string) => {
    if (!isOwner) {
      alert('Seul le propriétaire peut supprimer des produits.');
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit? Cette action est irréversible.')) {
      return;
    }

    setDeleting(productId);
    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts(products.filter(p => p.id !== productId));
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      alert('Erreur de connexion');
    }
    setDeleting(null);
  };

  // Toggle status
  const toggleStatus = async (productId: string, field: 'isActive' | 'isFeatured') => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: !product[field] }),
      });
      
      if (res.ok) {
        setProducts(products.map(p => 
          p.id === productId ? { ...p, [field]: !p[field] } : p
        ));
      }
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const productTypeLabel = (type: string) => {
    switch (type) {
      case 'DIGITAL': return '🎓 Formation';
      case 'PHYSICAL': return '📦 Physique';
      case 'HYBRID': return '🔄 Hybride';
      default: return type;
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '8px' }}>
            Gestion des produits
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
            Créez, modifiez et gérez vos formations et produits
          </p>
        </div>
        <Link
          href="/admin/produits/nouveau"
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
        >
          <span style={{ fontSize: '18px' }}>+</span>
          Nouveau produit
        </Link>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {[
          { label: 'Total', value: stats.total, color: 'var(--gray-500)' },
          { label: 'Actifs', value: stats.active, color: '#22c55e' },
          { label: 'Formations', value: stats.digital, color: '#3b82f6' },
          { label: 'Physiques', value: stats.physical, color: '#f59e0b' },
          { label: 'Hybrides', value: stats.hybrid, color: '#8b5cf6' },
          { label: 'En vedette', value: stats.featured, color: '#ec4899' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid var(--gray-200)',
            }}
          >
            <p style={{ fontSize: '28px', fontWeight: 700, color: stat.color }}>{stat.value}</p>
            <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid var(--gray-200)',
        }}
      >
        <input
          type="search"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input"
          style={{ flex: '1', minWidth: '200px' }}
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="form-input form-select"
          style={{ width: '180px' }}
        >
          <option value="">Toutes catégories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="form-input form-select"
          style={{ width: '160px' }}
        >
          <option value="">Tous types</option>
          <option value="DIGITAL">🎓 Formation</option>
          <option value="PHYSICAL">📦 Physique</option>
          <option value="HYBRID">🔄 Hybride</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="form-input form-select"
          style={{ width: '140px' }}
        >
          <option value="">Tous status</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
          <option value="featured">En vedette</option>
        </select>
      </div>

      {/* Results count */}
      <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '16px' }}>
        {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} trouvé{filteredProducts.length > 1 ? 's' : ''}
      </p>

      {/* Products Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--gray-50)' }}>
              <th style={{ ...thStyle, width: '50px' }}></th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Produit</th>
              <th style={{ ...thStyle, width: '120px' }}>Type</th>
              <th style={{ ...thStyle, width: '120px' }}>Prix</th>
              <th style={{ ...thStyle, width: '100px' }}>Ventes</th>
              <th style={{ ...thStyle, width: '80px' }}>Actif</th>
              <th style={{ ...thStyle, width: '80px' }}>Vedette</th>
              <th style={{ ...thStyle, width: '140px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)' }}>
                  Aucun produit trouvé
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  style={{ borderTop: '1px solid var(--gray-100)' }}
                >
                  <td style={tdStyle}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--gray-100)',
                        backgroundImage: product.imageUrl ? `url(${product.imageUrl})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {!product.imageUrl && '📦'}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--gray-500)', marginBottom: '2px' }}>
                        {product.name}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                        {product.category?.name || 'Sans catégorie'} • /{product.slug}
                      </p>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ fontSize: '13px' }}>{productTypeLabel(product.productType)}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--gray-500)' }}>
                      ${Number(product.price).toFixed(2)}
                    </span>
                    {product.compareAtPrice && (
                      <span style={{ fontSize: '11px', color: 'var(--gray-400)', textDecoration: 'line-through', display: 'block' }}>
                        ${Number(product.compareAtPrice).toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>{product.purchaseCount}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      onClick={() => toggleStatus(product.id, 'isActive')}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: product.isActive ? '#22c55e' : 'var(--gray-200)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      {product.isActive ? '✓' : ''}
                    </button>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      onClick={() => toggleStatus(product.id, 'isFeatured')}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: product.isFeatured ? '#f59e0b' : 'var(--gray-200)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      {product.isFeatured ? '★' : ''}
                    </button>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <Link
                        href={`/admin/produits/${product.id}`}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: 'var(--gray-100)',
                          borderRadius: '6px',
                          color: 'var(--gray-500)',
                          textDecoration: 'none',
                        }}
                      >
                        Modifier
                      </Link>
                      {isOwner && (
                        <button
                          onClick={() => handleDelete(product.id)}
                          disabled={deleting === product.id}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: '#fee2e2',
                            borderRadius: '6px',
                            color: '#dc2626',
                            border: 'none',
                            cursor: deleting === product.id ? 'wait' : 'pointer',
                            opacity: deleting === product.id ? 0.5 : 1,
                          }}
                        >
                          {deleting === product.id ? '...' : 'Suppr.'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--gray-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'center',
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '14px',
};
