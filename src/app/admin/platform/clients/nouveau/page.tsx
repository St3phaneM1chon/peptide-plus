'use client';

/**
 * New Client Form — Super-admin only
 * URL: /admin/platform/clients/nouveau
 *
 * Multi-section form to create a complete Koraline tenant.
 * Dark Glass Premium styling.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, User, Phone, MapPin, CreditCard, Palette,
  Globe, Receipt, ChevronDown, ChevronRight, Loader2, Check,
  ArrowLeft, Plus, AlertCircle,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { addCSRFHeader } from '@/lib/csrf';
import { KORALINE_PLANS, KORALINE_MODULES, type KoralinePlan, type KoralineModule } from '@/lib/stripe-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  // A. Entreprise
  companyName: string;
  legalName: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  industry: string;
  logoUrl: string;

  // B. Contact Principal
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerTitle: string;

  // C. Contacts Departements
  contactFinanceName: string;
  contactFinanceEmail: string;
  contactFinancePhone: string;
  contactSupportName: string;
  contactSupportEmail: string;
  contactSupportPhone: string;
  contactTechName: string;
  contactTechEmail: string;
  contactTechPhone: string;
  contactMarketingName: string;
  contactMarketingEmail: string;
  contactMarketingPhone: string;

  // D. Adresse
  address: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;

  // E. Plan & Modules
  plan: KoralinePlan;
  modulesEnabled: string[];

  // F. Branding
  primaryColor: string;
  secondaryColor: string;
  font: string;

  // G. Domaine
  domainCustom: string;

  // H. Fiscalite
  taxProvince: string;
  taxGstNumber: string;
  taxQstNumber: string;
  taxHstNumber: string;
  taxPstNumber: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDUSTRIES = [
  { value: '', label: 'Choisir...' },
  { value: 'education', label: 'Education' },
  { value: 'health', label: 'Sante' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'services', label: 'Services' },
  { value: 'beauty', label: 'Beaute' },
  { value: 'fashion', label: 'Mode' },
  { value: 'food', label: 'Alimentation' },
  { value: 'tech', label: 'Technologie' },
  { value: 'custom', label: 'Autre' },
];

const FONTS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Space Grotesk', label: 'Space Grotesk' },
];

const PROVINCES = [
  { value: 'QC', label: 'Quebec' },
  { value: 'ON', label: 'Ontario' },
  { value: 'BC', label: 'Colombie-Britannique' },
  { value: 'AB', label: 'Alberta' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'Nouveau-Brunswick' },
  { value: 'NS', label: 'Nouvelle-Ecosse' },
  { value: 'PE', label: 'Ile-du-Prince-Edouard' },
  { value: 'NL', label: 'Terre-Neuve-et-Labrador' },
  { value: 'YT', label: 'Yukon' },
  { value: 'NT', label: 'Territoires du Nord-Ouest' },
  { value: 'NU', label: 'Nunavut' },
];

const DEFAULT_FORM: FormData = {
  companyName: '', legalName: '', slug: '', shortDescription: '', longDescription: '',
  industry: '', logoUrl: '',
  ownerName: '', ownerEmail: '', ownerPhone: '', ownerTitle: '',
  contactFinanceName: '', contactFinanceEmail: '', contactFinancePhone: '',
  contactSupportName: '', contactSupportEmail: '', contactSupportPhone: '',
  contactTechName: '', contactTechEmail: '', contactTechPhone: '',
  contactMarketingName: '', contactMarketingEmail: '', contactMarketingPhone: '',
  address: '', city: '', province: 'QC', postalCode: '', country: 'CA',
  plan: 'essential', modulesEnabled: [],
  primaryColor: '#0066CC', secondaryColor: '#003366', font: 'Inter',
  domainCustom: '',
  taxProvince: 'QC', taxGstNumber: '', taxQstNumber: '', taxHstNumber: '', taxPstNumber: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

function Section({
  icon: Icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] backdrop-blur-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[var(--k-glass-regular)] transition-colors text-left"
      >
        <Icon className="w-5 h-5 text-[var(--k-accent-indigo)]" />
        <span className="text-sm font-semibold text-[var(--k-text-primary)] flex-1">{title}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-[var(--k-text-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--k-text-muted)]" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-[var(--k-border-subtle)]">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field components
// ---------------------------------------------------------------------------

function Field({
  label, required, hint, error, children,
}: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[var(--k-text-secondary)]">
        {label}
        {required && <span className="text-[var(--k-accent-rose)] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-[var(--k-accent-rose)]">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--k-text-muted)]">{hint}</p>}
    </div>
  );
}

const inputClasses = `w-full h-9 px-3 rounded-lg bg-[var(--k-bg-raised)] border border-[var(--k-border-subtle)]
  text-sm text-[var(--k-text-primary)] placeholder:text-[var(--k-text-muted)]
  focus:outline-none focus:ring-2 focus:ring-[var(--k-border-focus)] focus:border-[var(--k-border-focus)]
  transition-shadow`;

const selectClasses = `${inputClasses} appearance-none cursor-pointer`;

const textareaClasses = `w-full px-3 py-2 rounded-lg bg-[var(--k-bg-raised)] border border-[var(--k-border-subtle)]
  text-sm text-[var(--k-text-primary)] placeholder:text-[var(--k-text-muted)] resize-y
  focus:outline-none focus:ring-2 focus:ring-[var(--k-border-focus)] focus:border-[var(--k-border-focus)]
  transition-shadow`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewClientPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [slugManual, setSlugManual] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-generate slug from company name
  useEffect(() => {
    if (!slugManual && form.companyName) {
      setForm(prev => ({ ...prev, slug: slugify(prev.companyName) }));
    }
  }, [form.companyName, slugManual]);

  // Check slug availability (debounced)
  useEffect(() => {
    if (!form.slug || form.slug.length < 2) {
      setSlugAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/platform/tenants`);
        if (res.ok) {
          const data = await res.json();
          const exists = (data.tenants || []).some((t: { slug: string }) => t.slug === form.slug);
          setSlugAvailable(!exists);
        }
      } catch {
        setSlugAvailable(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.slug]);

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleModule = useCallback((moduleKey: string) => {
    setForm(prev => ({
      ...prev,
      modulesEnabled: prev.modulesEnabled.includes(moduleKey)
        ? prev.modulesEnabled.filter(m => m !== moduleKey)
        : [...prev.modulesEnabled, moduleKey],
    }));
  }, []);

  // Compute MRR
  const planInfo = KORALINE_PLANS[form.plan];
  const planPrice = planInfo?.monthlyPrice || 0;
  const modulePrice = form.modulesEnabled.reduce((sum, key) => {
    return sum + (KORALINE_MODULES[key as KoralineModule]?.monthlyPrice || 0);
  }, 0);
  const totalMRR = planPrice + modulePrice;

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/platform/clients', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
        setError(data.error || `Erreur ${res.status}`);
        return;
      }

      const data = await res.json();
      router.push(`/admin/platform/clients/${data.tenant.id}`);
    } catch {
      setError('Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/platform/clients')}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--k-text-secondary)] hover:text-[var(--k-text-primary)] mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('admin.platformClients.backToList') || 'Retour aux clients'}
        </button>
        <h1 className="text-2xl font-semibold text-[var(--k-text-primary)]">
          {t('admin.platformClients.createTitle') || 'Nouveau client Koraline'}
        </h1>
        <p className="text-sm text-[var(--k-text-secondary)] mt-1">
          {t('admin.platformClients.createSubtitle') || 'Remplissez les informations pour creer un nouveau tenant.'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-[var(--k-accent-rose-10)] border border-[var(--k-accent-rose)] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--k-accent-rose)] mt-0.5 shrink-0" />
          <p className="text-sm text-[var(--k-accent-rose)]">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* A. Entreprise */}
        <Section icon={Building2} title={t('admin.platformClients.sectionCompany') || 'Entreprise'} defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.platformClients.companyName') || 'Nom de l\'entreprise'} required>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                placeholder="Mon Entreprise Inc."
                className={inputClasses}
                required
              />
            </Field>
            <Field label={t('admin.platformClients.legalName') || 'Raison sociale'}>
              <input
                type="text"
                value={form.legalName}
                onChange={(e) => updateField('legalName', e.target.value)}
                placeholder="Mon Entreprise Inc."
                className={inputClasses}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field
              label={t('admin.platformClients.slug') || 'Slug (identifiant unique)'}
              required
              hint={slugAvailable === true ? `${form.slug}.koraline.app est disponible` : slugAvailable === false ? 'Ce slug est deja utilise' : `${form.slug || 'slug'}.koraline.app`}
              error={slugAvailable === false ? 'Slug deja utilise' : undefined}
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    updateField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  }}
                  placeholder="mon-entreprise"
                  className={inputClasses}
                  required
                />
                {slugAvailable === true && (
                  <Check className="w-5 h-5 text-[var(--k-accent-emerald)] shrink-0" />
                )}
              </div>
            </Field>
          </div>

          <div className="mt-4">
            <Field label={t('admin.platformClients.shortDescription') || 'Description courte'} hint="200 caracteres max">
              <input
                type="text"
                value={form.shortDescription}
                onChange={(e) => updateField('shortDescription', e.target.value.slice(0, 200))}
                placeholder="Boutique en ligne de..."
                className={inputClasses}
                maxLength={200}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label={t('admin.platformClients.longDescription') || 'Description longue'} hint="2000 caracteres max">
              <textarea
                value={form.longDescription}
                onChange={(e) => updateField('longDescription', e.target.value.slice(0, 2000))}
                placeholder="Description detaillee de l'entreprise..."
                className={textareaClasses}
                rows={3}
                maxLength={2000}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <Field label={t('admin.platformClients.industry') || 'Industrie'}>
              <div className="relative">
                <select
                  value={form.industry}
                  onChange={(e) => updateField('industry', e.target.value)}
                  className={selectClasses}
                >
                  {INDUSTRIES.map(i => (
                    <option key={i.value} value={i.value}>{i.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)] pointer-events-none" />
              </div>
            </Field>
            <Field label={t('admin.platformClients.logoUrl') || 'URL du logo'}>
              <input
                type="url"
                value={form.logoUrl}
                onChange={(e) => updateField('logoUrl', e.target.value)}
                placeholder="https://..."
                className={inputClasses}
              />
            </Field>
          </div>
        </Section>

        {/* B. Contact Principal */}
        <Section icon={User} title={t('admin.platformClients.sectionOwner') || 'Contact principal (Proprietaire)'} defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.platformClients.ownerName') || 'Nom complet'} required>
              <input
                type="text"
                value={form.ownerName}
                onChange={(e) => updateField('ownerName', e.target.value)}
                placeholder="Jean Dupont"
                className={inputClasses}
                required
              />
            </Field>
            <Field label={t('admin.platformClients.ownerEmail') || 'Email'} required>
              <input
                type="email"
                value={form.ownerEmail}
                onChange={(e) => updateField('ownerEmail', e.target.value)}
                placeholder="jean@entreprise.com"
                className={inputClasses}
                required
              />
            </Field>
            <Field label={t('admin.platformClients.ownerPhone') || 'Telephone'}>
              <input
                type="tel"
                value={form.ownerPhone}
                onChange={(e) => updateField('ownerPhone', e.target.value)}
                placeholder="+1 514 123 4567"
                className={inputClasses}
              />
            </Field>
            <Field label={t('admin.platformClients.ownerTitle') || 'Titre'}>
              <input
                type="text"
                value={form.ownerTitle}
                onChange={(e) => updateField('ownerTitle', e.target.value)}
                placeholder="Directeur general"
                className={inputClasses}
              />
            </Field>
          </div>
        </Section>

        {/* C. Contacts Departements */}
        <Section icon={Phone} title={t('admin.platformClients.sectionContacts') || 'Contacts departements'}>
          {(['Finance', 'Support', 'Tech', 'Marketing'] as const).map((dept) => {
            const prefix = `contact${dept}` as const;
            const nameKey = `${prefix}Name` as keyof FormData;
            const emailKey = `${prefix}Email` as keyof FormData;
            const phoneKey = `${prefix}Phone` as keyof FormData;

            return (
              <div key={dept} className="mb-4 last:mb-0">
                <p className="text-xs font-semibold text-[var(--k-text-secondary)] mb-2 uppercase tracking-wider">{dept}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    value={form[nameKey]}
                    onChange={(e) => updateField(nameKey, e.target.value)}
                    placeholder="Nom"
                    className={inputClasses}
                  />
                  <input
                    type="email"
                    value={form[emailKey]}
                    onChange={(e) => updateField(emailKey, e.target.value)}
                    placeholder="Email"
                    className={inputClasses}
                  />
                  <input
                    type="tel"
                    value={form[phoneKey]}
                    onChange={(e) => updateField(phoneKey, e.target.value)}
                    placeholder="Telephone"
                    className={inputClasses}
                  />
                </div>
              </div>
            );
          })}
        </Section>

        {/* D. Adresse */}
        <Section icon={MapPin} title={t('admin.platformClients.sectionAddress') || 'Adresse'}>
          <div className="space-y-4">
            <Field label={t('admin.platformClients.address') || 'Adresse'}>
              <input
                type="text"
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="123 rue Example"
                className={inputClasses}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('admin.platformClients.city') || 'Ville'}>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="Montreal"
                  className={inputClasses}
                />
              </Field>
              <Field label={t('admin.platformClients.province') || 'Province'}>
                <div className="relative">
                  <select
                    value={form.province}
                    onChange={(e) => updateField('province', e.target.value)}
                    className={selectClasses}
                  >
                    {PROVINCES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)] pointer-events-none" />
                </div>
              </Field>
              <Field label={t('admin.platformClients.postalCode') || 'Code postal'}>
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={(e) => updateField('postalCode', e.target.value.toUpperCase())}
                  placeholder="H2X 1Y4"
                  className={inputClasses}
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* E. Plan & Modules */}
        <Section icon={CreditCard} title={t('admin.platformClients.sectionPlan') || 'Plan et modules'} defaultOpen>
          {/* Plan radio cards */}
          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            {(Object.entries(KORALINE_PLANS) as [KoralinePlan, typeof KORALINE_PLANS[KoralinePlan]][]).map(([key, plan]) => (
              <button
                key={key}
                type="button"
                onClick={() => updateField('plan', key)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  form.plan === key
                    ? 'border-[var(--k-accent-indigo)] bg-[var(--k-accent-indigo-10)] ring-1 ring-[var(--k-accent-indigo)]'
                    : 'border-[var(--k-border-subtle)] bg-[var(--k-glass-ultra-thin)] hover:bg-[var(--k-glass-thin)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[var(--k-text-primary)]">{plan.name.replace('Koraline ', '')}</span>
                  {form.plan === key && <Check className="w-4 h-4 text-[var(--k-accent-indigo)]" />}
                </div>
                <p className="text-lg font-bold text-[var(--k-text-primary)]">{formatPrice(plan.monthlyPrice)}<span className="text-xs font-normal text-[var(--k-text-muted)]">/mo</span></p>
                <p className="text-xs text-[var(--k-text-tertiary)] mt-1">{plan.description}</p>
              </button>
            ))}
          </div>

          {/* Modules checkboxes */}
          <p className="text-xs font-semibold text-[var(--k-text-secondary)] mb-3 uppercase tracking-wider">
            {t('admin.platformClients.additionalModules') || 'Modules additionnels'}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.entries(KORALINE_MODULES) as [KoralineModule, typeof KORALINE_MODULES[KoralineModule]][]).map(([key, mod]) => (
              <label
                key={key}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                  form.modulesEnabled.includes(key)
                    ? 'border-[var(--k-accent-cyan)] bg-[var(--k-accent-cyan-10)]'
                    : 'border-[var(--k-border-subtle)] bg-[var(--k-glass-ultra-thin)] hover:bg-[var(--k-glass-thin)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.modulesEnabled.includes(key)}
                  onChange={() => toggleModule(key)}
                  className="mt-0.5 accent-[var(--k-accent-cyan)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--k-text-primary)]">{mod.name}</span>
                    <span className="text-xs font-medium text-[var(--k-accent-emerald)] ml-2">{formatPrice(mod.monthlyPrice)}/mo</span>
                  </div>
                  <p className="text-xs text-[var(--k-text-tertiary)] mt-0.5">{mod.description}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Total MRR */}
          <div className="mt-4 p-4 rounded-xl bg-[var(--k-glass-regular)] border border-[var(--k-border-default)] flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--k-text-secondary)]">
              {t('admin.platformClients.totalMRR') || 'MRR total'}
            </span>
            <span className="text-xl font-bold text-[var(--k-accent-emerald)]">{formatPrice(totalMRR)}<span className="text-xs font-normal text-[var(--k-text-muted)]">/mo</span></span>
          </div>
        </Section>

        {/* F. Branding */}
        <Section icon={Palette} title={t('admin.platformClients.sectionBranding') || 'Branding'}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('admin.platformClients.primaryColor') || 'Couleur primaire'}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => updateField('primaryColor', e.target.value)}
                  className="w-9 h-9 rounded-lg border border-[var(--k-border-subtle)] cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={form.primaryColor}
                  onChange={(e) => updateField('primaryColor', e.target.value)}
                  className={inputClasses}
                />
              </div>
            </Field>
            <Field label={t('admin.platformClients.secondaryColor') || 'Couleur secondaire'}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => updateField('secondaryColor', e.target.value)}
                  className="w-9 h-9 rounded-lg border border-[var(--k-border-subtle)] cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={form.secondaryColor}
                  onChange={(e) => updateField('secondaryColor', e.target.value)}
                  className={inputClasses}
                />
              </div>
            </Field>
            <Field label={t('admin.platformClients.font') || 'Police'}>
              <div className="relative">
                <select
                  value={form.font}
                  onChange={(e) => updateField('font', e.target.value)}
                  className={selectClasses}
                >
                  {FONTS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)] pointer-events-none" />
              </div>
            </Field>
          </div>
        </Section>

        {/* G. Domaine */}
        <Section icon={Globe} title={t('admin.platformClients.sectionDomain') || 'Domaine'}>
          <Field label={t('admin.platformClients.customDomain') || 'Domaine personnalise'} hint={`Par defaut: ${form.slug || 'slug'}.koraline.app`}>
            <input
              type="text"
              value={form.domainCustom}
              onChange={(e) => updateField('domainCustom', e.target.value)}
              placeholder="monsite.com"
              className={inputClasses}
            />
          </Field>
        </Section>

        {/* H. Fiscalite */}
        <Section icon={Receipt} title={t('admin.platformClients.sectionFiscal') || 'Fiscalite'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.platformClients.taxProvince') || 'Province fiscale'}>
              <div className="relative">
                <select
                  value={form.taxProvince}
                  onChange={(e) => updateField('taxProvince', e.target.value)}
                  className={selectClasses}
                >
                  {PROVINCES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)] pointer-events-none" />
              </div>
            </Field>
            <Field label={t('admin.platformClients.taxGst') || 'Numero TPS'}>
              <input
                type="text"
                value={form.taxGstNumber}
                onChange={(e) => updateField('taxGstNumber', e.target.value)}
                placeholder="123456789RT0001"
                className={inputClasses}
              />
            </Field>
            <Field label={t('admin.platformClients.taxQst') || 'Numero TVQ'}>
              <input
                type="text"
                value={form.taxQstNumber}
                onChange={(e) => updateField('taxQstNumber', e.target.value)}
                placeholder="1234567890TQ0001"
                className={inputClasses}
              />
            </Field>
            <Field label={t('admin.platformClients.taxHst') || 'Numero TVH'}>
              <input
                type="text"
                value={form.taxHstNumber}
                onChange={(e) => updateField('taxHstNumber', e.target.value)}
                className={inputClasses}
              />
            </Field>
            <Field label={t('admin.platformClients.taxPst') || 'Numero PST'}>
              <input
                type="text"
                value={form.taxPstNumber}
                onChange={(e) => updateField('taxPstNumber', e.target.value)}
                className={inputClasses}
              />
            </Field>
          </div>
        </Section>

        {/* Submit */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={() => router.push('/admin/platform/clients')}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-[var(--k-text-secondary)]
              border border-[var(--k-border-subtle)] hover:bg-[var(--k-glass-thin)] transition-colors"
          >
            {t('common.cancel') || 'Annuler'}
          </button>
          <button
            type="submit"
            disabled={submitting || !form.companyName || !form.slug || !form.ownerName || !form.ownerEmail}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white
              bg-gradient-to-r from-[#6366f1] to-[#818cf8] hover:from-[#5558e6] hover:to-[#7580f2]
              disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {submitting
              ? (t('admin.platformClients.creating') || 'Creation...')
              : (t('admin.platformClients.createButton') || 'Creer le client')
            }
          </button>
        </div>
      </form>
    </div>
  );
}
