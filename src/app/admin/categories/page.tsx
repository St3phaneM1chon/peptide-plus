/**
 * ADMIN - GESTION DES CATEGORIES
 */

'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  FolderOpen,
  Check,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  DataTable,
  FormField,
  Input,
  Textarea,
  type Column,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';

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
  const { t, locale } = useI18n();
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
        setError(data.error || t('admin.categories.error'));
        setSaving(false);
        return;
      }

      await fetchCategories();
      resetForm();
    } catch (err) {
      setError(t('admin.categories.connectionError'));
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

  // Table columns
  const columns: Column<Category>[] = useMemo(() => [
    {
      key: 'name',
      header: t('admin.categories.colCategory'),
      render: (cat) => (
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center bg-cover bg-center flex-shrink-0"
            style={cat.imageUrl ? { backgroundImage: `url(${cat.imageUrl})` } : undefined}
          >
            {!cat.imageUrl && <FolderOpen className="w-5 h-5 text-slate-400" />}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{cat.name}</p>
            <p className="text-xs text-slate-500">/{cat.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'products',
      header: t('admin.categories.colProducts'),
      align: 'center',
      width: '100px',
      render: (cat) => (
        <span className="font-semibold text-slate-700">{cat._count.products}</span>
      ),
    },
    {
      key: 'sortOrder',
      header: t('admin.categories.colOrder'),
      align: 'center',
      width: '80px',
      render: (cat) => (
        <span className="text-slate-500">{cat.sortOrder}</span>
      ),
    },
    {
      key: 'isActive',
      header: t('admin.categories.colActive'),
      align: 'center',
      width: '80px',
      render: (cat) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleActive(cat.id, cat.isActive); }}
          className={`
            w-7 h-7 rounded-md flex items-center justify-center transition-colors
            ${cat.isActive
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-slate-200 text-slate-400 hover:bg-slate-300'}
          `}
        >
          {cat.isActive && <Check className="w-4 h-4" />}
        </button>
      ),
    },
    {
      key: 'actions',
      header: t('admin.categories.colActions'),
      align: 'center',
      width: '100px',
      render: (cat) => (
        <Button
          variant="ghost"
          size="sm"
          icon={Pencil}
          onClick={(e) => { e.stopPropagation(); startEdit(cat); }}
        >
          {t('admin.categories.edit')}
        </Button>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [locale]);

  return (
    <>
      <PageHeader
        title={t('admin.categories.title')}
        subtitle={t('admin.categories.subtitle')}
        backHref="/admin/produits"
        backLabel={t('admin.categories.backToProducts')}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => { resetForm(); setShowForm(true); }}
          >
            {t('admin.categories.newCategory')}
          </Button>
        }
      />

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={resetForm}
        title={editingId ? t('admin.categories.editCategory') : t('admin.categories.newCategory')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={resetForm}>
              {t('admin.categories.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={() => {
                const form = document.getElementById('category-form') as HTMLFormElement;
                form?.requestSubmit();
              }}
            >
              {saving ? t('admin.categories.saving') : editingId ? t('admin.categories.save') : t('admin.categories.create')}
            </Button>
          </>
        }
      >
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg mb-4 text-sm border border-red-200">
            {error}
          </div>
        )}

        <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
          <FormField label={t('admin.categories.fieldName')} required>
            <Input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({
                ...formData,
                name: e.target.value,
                slug: !editingId ? generateSlug(e.target.value) : formData.slug,
              })}
              placeholder={t('admin.categories.fieldNamePlaceholder')}
            />
          </FormField>

          <FormField label={t('admin.categories.fieldSlug')} required>
            <Input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder={t('admin.categories.fieldSlugPlaceholder')}
            />
          </FormField>

          <FormField label={t('admin.categories.fieldDescription')}>
            <Textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('admin.categories.fieldDescriptionPlaceholder')}
            />
          </FormField>

          <div className="grid grid-cols-[2fr_1fr] gap-4">
            <FormField label={t('admin.categories.fieldImageUrl')}>
              <Input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://..."
              />
            </FormField>
            <FormField label={t('admin.categories.fieldSortOrder')}>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* Categories Table */}
      <DataTable<Category>
        columns={columns}
        data={categories}
        keyExtractor={(cat) => cat.id}
        loading={loading}
        emptyTitle={t('admin.categories.emptyTitle')}
        emptyDescription={t('admin.categories.emptyDescription')}
        emptyAction={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => { resetForm(); setShowForm(true); }}
          >
            {t('admin.categories.newCategory')}
          </Button>
        }
      />
    </>
  );
}
