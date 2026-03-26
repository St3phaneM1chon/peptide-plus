'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, Button, SectionCard, FormField, Input, Textarea } from '@/components/admin';
import { useRouter } from 'next/navigation';

interface CategoryOption {
  id: string;
  name: string;
}

interface InstructorOption {
  id: string;
  userId: string;
  title: string | null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function NewCoursePage() {
  const { t } = useTranslations();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('BEGINNER');
  const [categoryId, setCategoryId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [passingScore, setPassingScore] = useState('70');

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManual) {
      setSlug(slugify(title));
    }
  }, [title, slugManual]);

  // Load categories and instructors
  const loadOptions = useCallback(async () => {
    try {
      const [catRes] = await Promise.all([
        fetch('/api/admin/lms/categories'),
        fetch('/api/admin/lms/courses?limit=0'), // We need instructors endpoint
      ]);
      if (catRes.ok) {
        const catData = await catRes.json();
        const cats = catData.data ?? catData;
        setCategories(Array.isArray(cats) ? cats : []);
      }
    } catch {
      // Silently fail - dropdowns will be empty
    }

    try {
      const instrRes = await fetch('/api/admin/lms/instructors');
      if (instrRes.ok) {
        const instrData = await instrRes.json();
        const instrs = instrData.data ?? instrData;
        setInstructors(Array.isArray(instrs) ? instrs : []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => { loadOptions(); }, [loadOptions]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        level,
        isFree,
        passingScore: parseInt(passingScore, 10) || 70,
      };

      if (categoryId) body.categoryId = categoryId;
      if (instructorId) body.instructorId = instructorId;
      if (!isFree && price) body.price = parseFloat(price);
      if (thumbnailUrl.trim()) body.thumbnailUrl = thumbnailUrl.trim();

      const res = await fetch('/api/admin/lms/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || t('admin.lms.courseCreateError'));
      }

      const data = await res.json();
      const courseId = data.data?.id ?? data.id;
      router.push(`/admin/formation/cours/${courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.lms.courseCreateError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.newCourse')}
        subtitle={t('admin.lms.manageCoursesDesc')}
        backHref="/admin/formation/cours"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <SectionCard title={t('admin.lms.courseTitle')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('admin.lms.courseTitle')} htmlFor="title" required>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('admin.lms.courseTitle')}
                required
              />
            </FormField>

            <FormField label={t('admin.lms.courseSlug')} htmlFor="slug" required hint={t('admin.lms.slugHint')}>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugManual(true);
                }}
                placeholder="mon-cours"
                required
                pattern="^[a-z0-9-]+$"
              />
            </FormField>
          </div>

          <div className="mt-4">
            <FormField label={t('admin.lms.courseDescription')} htmlFor="description">
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('admin.lms.courseDescription')}
                rows={4}
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label={t('admin.lms.courseLevel')} htmlFor="level">
              <select
                id="level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-[var(--k-text-primary)] bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-indigo-700"
              >
                <option value="BEGINNER">{t('admin.lms.level.beginner')}</option>
                <option value="INTERMEDIATE">{t('admin.lms.level.intermediate')}</option>
                <option value="ADVANCED">{t('admin.lms.level.advanced')}</option>
                <option value="EXPERT">{t('admin.lms.level.expert')}</option>
              </select>
            </FormField>

            <FormField label={t('admin.lms.courseCategory')} htmlFor="categoryId">
              <select
                id="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-[var(--k-text-primary)] bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-indigo-700"
              >
                <option value="">{t('admin.lms.selectCategory')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label={t('admin.lms.courseInstructor')} htmlFor="instructorId">
              <select
                id="instructorId"
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-[var(--k-text-primary)] bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-indigo-700"
              >
                <option value="">{t('admin.lms.selectInstructor')}</option>
                {instructors.map((inst) => (
                  <option key={inst.id} value={inst.id}>{inst.title || inst.userId}</option>
                ))}
              </select>
            </FormField>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label={t('admin.lms.courseFree')} htmlFor="isFree">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  id="isFree"
                  type="checkbox"
                  checked={isFree}
                  onChange={(e) => setIsFree(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-700"
                />
                <span className="text-sm text-slate-700">{t('admin.lms.courseFree')}</span>
              </label>
            </FormField>

            {!isFree && (
              <FormField label={t('admin.lms.coursePrice')} htmlFor="price">
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
            )}

            <FormField label={t('admin.lms.coursePassingScore')} htmlFor="passingScore">
              <Input
                id="passingScore"
                type="number"
                min="0"
                max="100"
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
                placeholder="70"
              />
            </FormField>
          </div>

          <div className="mt-4">
            <FormField label={t('admin.lms.courseThumbnail')} htmlFor="thumbnailUrl">
              <Input
                id="thumbnailUrl"
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://..."
              />
            </FormField>
          </div>
        </SectionCard>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            onClick={() => router.push('/admin/formation/cours')}
          >
            {t('admin.lms.backToCourses')}
          </Button>
          <Button type="submit" disabled={submitting || !title.trim()}>
            {submitting ? t('admin.lms.creating') : t('admin.lms.createCourse')}
          </Button>
        </div>
      </form>
    </div>
  );
}
