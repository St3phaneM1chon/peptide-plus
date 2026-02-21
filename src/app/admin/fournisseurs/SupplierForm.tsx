'use client';

import { useState } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { FormField, Input, Textarea } from '@/components/admin/FormField';
import { useI18n } from '@/i18n/client';

// ── Types ─────────────────────────────────────────────────────

interface ContactRow {
  department: string;
  name: string;
  email: string;
  phone: string;
  extension: string;
  title: string;
  isPrimary: boolean;
}

interface LinkRow {
  label: string;
  url: string;
  type: string;
}

export interface SupplierFormData {
  name: string;
  code: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  notes: string;
  isActive: boolean;
  contacts: ContactRow[];
  links: LinkRow[];
}

interface SupplierFormProps {
  initialData?: Partial<SupplierFormData>;
  onSubmit: (data: SupplierFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

// ── Constants ────────────────────────────────────────────────

const DEPARTMENT_OPTIONS = [
  'sales',
  'accounting',
  'shipping',
  'support',
  'management',
  'purchasing',
  'technical',
] as const;

const LINK_TYPES = [
  'order_form',
  'chat',
  'portal',
  'catalog',
  'tracking',
  'other',
] as const;

const LINK_TYPE_LABELS: Record<string, string> = {
  order_form: 'orderForm',
  chat: 'chat',
  portal: 'portal',
  catalog: 'catalog',
  tracking: 'tracking',
  other: 'other',
};

function emptyContact(): ContactRow {
  return { department: 'sales', name: '', email: '', phone: '', extension: '', title: '', isPrimary: false };
}

function emptyLink(): LinkRow {
  return { label: '', url: '', type: 'other' };
}

// ── Component ────────────────────────────────────────────────

export default function SupplierForm({ initialData, onSubmit, onCancel, loading }: SupplierFormProps) {
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'general' | 'contacts' | 'links'>('general');

  // General fields
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [website, setWebsite] = useState(initialData?.website || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [city, setCity] = useState(initialData?.city || '');
  const [province, setProvince] = useState(initialData?.province || '');
  const [postalCode, setPostalCode] = useState(initialData?.postalCode || '');
  const [country, setCountry] = useState(initialData?.country || 'CA');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isActive, setIsActive] = useState(initialData?.isActive !== false);

  // Contacts
  const [contacts, setContacts] = useState<ContactRow[]>(
    initialData?.contacts?.length ? initialData.contacts : []
  );

  // Links
  const [links, setLinks] = useState<LinkRow[]>(
    initialData?.links?.length ? initialData.links : []
  );

  const [nameError, setNameError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(t('admin.suppliers.name') + ' required');
      setActiveTab('general');
      return;
    }
    setNameError('');
    onSubmit({
      name,
      code,
      email,
      phone,
      website,
      address,
      city,
      province,
      postalCode,
      country,
      notes,
      isActive,
      contacts: contacts.filter(c => c.name.trim()),
      links: links.filter(l => l.label.trim() && l.url.trim()),
    });
  };

  // ── Contact helpers ──────────────────────────────────────────

  const addContact = () => setContacts([...contacts, emptyContact()]);

  const removeContact = (idx: number) => {
    setContacts(contacts.filter((_, i) => i !== idx));
  };

  const updateContact = (idx: number, field: keyof ContactRow, value: string | boolean) => {
    setContacts(contacts.map((c, i) => {
      if (i !== idx) return c;
      if (field === 'isPrimary' && value === true) {
        // Unset primary on all others
        return { ...c, isPrimary: true };
      }
      return { ...c, [field]: value };
    }));
    // If setting primary, unset others
    if (field === 'isPrimary' && value === true) {
      setContacts(prev => prev.map((c, i) => ({ ...c, isPrimary: i === idx })));
    }
  };

  // ── Link helpers ─────────────────────────────────────────────

  const addLink = () => setLinks([...links, emptyLink()]);

  const removeLink = (idx: number) => {
    setLinks(links.filter((_, i) => i !== idx));
  };

  const updateLink = (idx: number, field: keyof LinkRow, value: string) => {
    setLinks(links.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  // ── Tab classes ──────────────────────────────────────────────

  const tabClass = (tab: string) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-sky-600 text-sky-700 bg-sky-50'
        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button type="button" className={tabClass('general')} onClick={() => setActiveTab('general')}>
          {t('admin.suppliers.generalInfo')}
        </button>
        <button type="button" className={tabClass('contacts')} onClick={() => setActiveTab('contacts')}>
          {t('admin.suppliers.contacts')} ({contacts.length})
        </button>
        <button type="button" className={tabClass('links')} onClick={() => setActiveTab('links')}>
          {t('admin.suppliers.links')} ({links.length})
        </button>
      </div>

      {/* ── General Info Tab ────────────────────────────────── */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('admin.suppliers.name')} htmlFor="supplier-name" required error={nameError}>
              <Input
                id="supplier-name"
                value={name}
                onChange={e => { setName(e.target.value); setNameError(''); }}
                error={!!nameError}
                placeholder={t('admin.suppliers.name')}
              />
            </FormField>
            <FormField label={t('admin.suppliers.code')} htmlFor="supplier-code">
              <Input id="supplier-code" value={code} onChange={e => setCode(e.target.value)} placeholder="SUP-001" />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('admin.suppliers.email')} htmlFor="supplier-email">
              <Input id="supplier-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@supplier.com" />
            </FormField>
            <FormField label={t('admin.suppliers.phone')} htmlFor="supplier-phone">
              <Input id="supplier-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 514 555 1234" />
            </FormField>
          </div>

          <FormField label={t('admin.suppliers.website')} htmlFor="supplier-website">
            <Input id="supplier-website" type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://supplier.com" />
          </FormField>

          <FormField label={t('admin.suppliers.address')} htmlFor="supplier-address">
            <Input id="supplier-address" value={address} onChange={e => setAddress(e.target.value)} />
          </FormField>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField label={t('admin.suppliers.city')} htmlFor="supplier-city">
              <Input id="supplier-city" value={city} onChange={e => setCity(e.target.value)} />
            </FormField>
            <FormField label={t('admin.suppliers.province')} htmlFor="supplier-province">
              <Input id="supplier-province" value={province} onChange={e => setProvince(e.target.value)} placeholder="QC" />
            </FormField>
            <FormField label={t('admin.suppliers.postalCode')} htmlFor="supplier-postal">
              <Input id="supplier-postal" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="H2X 1Y4" />
            </FormField>
            <FormField label={t('admin.suppliers.country')} htmlFor="supplier-country">
              <Input id="supplier-country" value={country} onChange={e => setCountry(e.target.value)} placeholder="CA" />
            </FormField>
          </div>

          <FormField label={t('admin.suppliers.notes')} htmlFor="supplier-notes">
            <Textarea id="supplier-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </FormField>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            {t('admin.suppliers.active')}
          </label>
        </div>
      )}

      {/* ── Contacts Tab ────────────────────────────────────── */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          {contacts.map((contact, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  {t('admin.suppliers.contacts')} #{idx + 1}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateContact(idx, 'isPrimary', true)}
                    className={`p-1 rounded ${contact.isPrimary ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                    title={t('admin.suppliers.primaryContact')}
                  >
                    <Star className="w-4 h-4" fill={contact.isPrimary ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeContact(idx)}
                    className="p-1 rounded text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label={t('admin.suppliers.department')} htmlFor={`contact-dept-${idx}`}>
                  <select
                    id={`contact-dept-${idx}`}
                    value={contact.department}
                    onChange={e => updateContact(idx, 'department', e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-700 focus:border-sky-700"
                  >
                    {DEPARTMENT_OPTIONS.map(d => (
                      <option key={d} value={d}>{t(`admin.suppliers.departments.${d}`)}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label={t('admin.suppliers.contactName')} htmlFor={`contact-name-${idx}`}>
                  <Input
                    id={`contact-name-${idx}`}
                    value={contact.name}
                    onChange={e => updateContact(idx, 'name', e.target.value)}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label={t('admin.suppliers.email')} htmlFor={`contact-email-${idx}`}>
                  <Input
                    id={`contact-email-${idx}`}
                    type="email"
                    value={contact.email}
                    onChange={e => updateContact(idx, 'email', e.target.value)}
                  />
                </FormField>
                <FormField label={t('admin.suppliers.phone')} htmlFor={`contact-phone-${idx}`}>
                  <Input
                    id={`contact-phone-${idx}`}
                    type="tel"
                    value={contact.phone}
                    onChange={e => updateContact(idx, 'phone', e.target.value)}
                  />
                </FormField>
                <FormField label={t('admin.suppliers.extension')} htmlFor={`contact-ext-${idx}`}>
                  <Input
                    id={`contact-ext-${idx}`}
                    value={contact.extension}
                    onChange={e => updateContact(idx, 'extension', e.target.value)}
                    placeholder="123"
                  />
                </FormField>
              </div>

              <FormField label={t('admin.suppliers.jobTitle')} htmlFor={`contact-title-${idx}`}>
                <Input
                  id={`contact-title-${idx}`}
                  value={contact.title}
                  onChange={e => updateContact(idx, 'title', e.target.value)}
                />
              </FormField>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" icon={Plus} onClick={addContact}>
            {t('admin.suppliers.addContact')}
          </Button>
        </div>
      )}

      {/* ── Links Tab ───────────────────────────────────────── */}
      {activeTab === 'links' && (
        <div className="space-y-4">
          {links.map((link, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  {t('admin.suppliers.links')} #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeLink(idx)}
                  className="p-1 rounded text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label={t('admin.suppliers.linkLabel')} htmlFor={`link-label-${idx}`}>
                  <Input
                    id={`link-label-${idx}`}
                    value={link.label}
                    onChange={e => updateLink(idx, 'label', e.target.value)}
                  />
                </FormField>
                <FormField label={t('admin.suppliers.linkUrl')} htmlFor={`link-url-${idx}`}>
                  <Input
                    id={`link-url-${idx}`}
                    type="url"
                    value={link.url}
                    onChange={e => updateLink(idx, 'url', e.target.value)}
                    placeholder="https://..."
                  />
                </FormField>
                <FormField label={t('admin.suppliers.linkType')} htmlFor={`link-type-${idx}`}>
                  <select
                    id={`link-type-${idx}`}
                    value={link.type}
                    onChange={e => updateLink(idx, 'type', e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-700 focus:border-sky-700"
                  >
                    {LINK_TYPES.map(lt => (
                      <option key={lt} value={lt}>
                        {t(`admin.suppliers.${LINK_TYPE_LABELS[lt]}`)}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" icon={Plus} onClick={addLink}>
            {t('admin.suppliers.addLink')}
          </Button>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          {t('admin.suppliers.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {t('admin.suppliers.save')}
        </Button>
      </div>
    </form>
  );
}
