/**
 * PROFILE FORM
 * Formulaire de modification du profil avec préférences de langue
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n, locales, localeNames, localeFlags, type Locale } from '@/i18n/client';

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  locale: string;
  timezone: string;
  mfaEnabled: boolean;
  createdAt: Date;
}

interface ProfileFormProps {
  user: User;
}

const TIMEZONES = [
  { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
  { value: 'America/Montreal', label: 'Montréal (EST/EDT)' },
  { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)' },
  { value: 'America/Edmonton', label: 'Edmonton (MST/MDT)' },
  { value: 'America/Winnipeg', label: 'Winnipeg (CST/CDT)' },
  { value: 'America/Halifax', label: 'Halifax (AST/ADT)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

export function ProfileForm({ user }: ProfileFormProps) {
  const { t, setLocale, locale: currentLocale } = useI18n();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: user.name || '',
    locale: user.locale || 'fr',
    timezone: user.timezone || 'America/Toronto',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Mettre à jour la locale si changée
      if (formData.locale !== currentLocale) {
        setLocale(formData.locale as Locale);
      }

      setMessage({ type: 'success', text: t('common.save') + ' ✓' });
      router.refresh();
    } catch (error) {
      setMessage({ type: 'error', text: t('common.error') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 600,
          color: 'var(--gray-500)',
          marginBottom: '8px',
        }}
      >
        {t('profile.title')}
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '32px' }}>
        {t('profile.personalInfo')}
      </p>

      {/* Message de feedback */}
      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '24px',
            backgroundColor: message.type === 'success' ? '#E8F5E9' : '#FFEBEE',
            color: message.type === 'success' ? '#2E7D32' : '#C62828',
            fontSize: '14px',
          }}
        >
          {message.text}
        </div>
      )}

      {/* Informations personnelles */}
      <section
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid var(--gray-200)',
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--gray-500)',
            marginBottom: '20px',
          }}
        >
          {t('profile.personalInfo')}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Nom */}
          <div>
            <label className="form-label">{t('profile.fullName')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
              placeholder="Jean Dupont"
            />
          </div>

          {/* Email (lecture seule) */}
          <div>
            <label className="form-label">{t('profile.email')}</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="form-input"
              style={{ backgroundColor: 'var(--gray-100)', cursor: 'not-allowed' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Courriel non modifiable
            </p>
          </div>
        </div>
      </section>

      {/* Préférences de langue */}
      <section
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid var(--gray-200)',
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--gray-500)',
            marginBottom: '8px',
          }}
        >
          {t('profile.language')}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginBottom: '20px' }}>
          Choisissez la langue d'affichage du site
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          {locales.map((loc) => (
            <label
              key={loc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                border: `2px solid ${formData.locale === loc ? 'var(--gray-500)' : 'var(--gray-200)'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease',
                backgroundColor: formData.locale === loc ? 'var(--gray-50)' : 'white',
              }}
            >
              <input
                type="radio"
                name="locale"
                value={loc}
                checked={formData.locale === loc}
                onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
                style={{ display: 'none' }}
              />
              <span style={{ fontSize: '24px' }}>{localeFlags[loc]}</span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: formData.locale === loc ? 600 : 400,
                  color: 'var(--gray-500)',
                }}
              >
                {localeNames[loc]}
              </span>
              {formData.locale === loc && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="#4CAF50"
                  width="18"
                  height="18"
                  style={{ marginLeft: 'auto' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </label>
          ))}
        </div>
      </section>

      {/* Fuseau horaire */}
      <section
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid var(--gray-200)',
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--gray-500)',
            marginBottom: '8px',
          }}
        >
          {t('profile.timezone')}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginBottom: '20px' }}>
          Utilisé pour l'affichage des dates et heures
        </p>

        <select
          value={formData.timezone}
          onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
          className="form-input form-select"
          style={{ maxWidth: '400px' }}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </section>

      {/* Sécurité */}
      <section
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid var(--gray-200)',
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--gray-500)',
            marginBottom: '20px',
          }}
        >
          {t('profile.security')}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 2FA Status */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              backgroundColor: 'var(--gray-100)',
              borderRadius: '8px',
            }}
          >
            <div>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--gray-500)' }}>
                {t('profile.twoFactor')}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                {user.mfaEnabled
                  ? 'Activée - Votre compte est sécurisé'
                  : 'Désactivée - Recommandé pour plus de sécurité'}
              </p>
            </div>
            <span
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: user.mfaEnabled ? '#E8F5E9' : '#FFF3E0',
                color: user.mfaEnabled ? '#2E7D32' : '#E65100',
              }}
            >
              {user.mfaEnabled ? 'Activée' : 'Désactivée'}
            </span>
          </div>

          {/* Change password */}
          <a
            href="/dashboard/customer/profile/password"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              backgroundColor: 'var(--gray-100)',
              borderRadius: '8px',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--gray-500)' }}>
                {t('profile.changePassword')}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                Modifier votre mot de passe
              </p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              width="20"
              height="20"
              style={{ color: 'var(--gray-400)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </a>
        </div>
      </section>

      {/* Bouton de sauvegarde */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-secondary"
          style={{ padding: '12px 24px' }}
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary"
          style={{ padding: '12px 32px', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </form>
  );
}

export default ProfileForm;
