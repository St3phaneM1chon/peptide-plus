'use client';

/**
 * PAGE MON PROFIL - BioCycle Peptides
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/hooks/useTranslations';
import { profileSchema, validateForm } from '@/lib/form-validation';
import { FormError } from '@/components/ui/FormError';
import { toast } from 'sonner';

interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  birthDate?: string;
  locale?: string;
  loyaltyTier?: string;
  loyaltyPoints?: number;
  referralCode?: string;
  createdAt?: string;
}

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { t } = useTranslations();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    birthDate: '',
    locale: 'fr',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/profile');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          birthDate: data.birthDate?.split('T')[0] || '',
          locale: data.locale || 'fr',
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const validation = validateForm(profileSchema, {
      name: formData.name,
      phone: formData.phone || undefined,
      locale: formData.locale || undefined,
    });

    if (!validation.success) {
      setFormErrors(validation.errors || {});
      return;
    }

    setFormErrors({});
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setEditMode(false);
        setMessage({ type: 'success', text: t('account.profileUpdated') });
        toast.success('Profile updated successfully');
        // Mettre à jour la session
        update({ name: formData.name });
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.message || t('account.updateError') });
        toast.error('Failed to update profile');
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('account.genericError') });
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const tierColors: Record<string, string> = {
    BRONZE: 'text-amber-700 bg-amber-100',
    SILVER: 'text-gray-700 bg-gray-200',
    GOLD: 'text-yellow-700 bg-yellow-100',
    PLATINUM: 'text-cyan-700 bg-cyan-100',
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-orange-600">{t('nav.home')}</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{t('account.myProfile')}</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">{t('account.myProfile')}</h1>
        </div>

        {/* Messages */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-orange-600">
                    {(profile?.name || session.user?.name || 'U')[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {profile?.name || session.user?.name || t('account.user')}
                  </h2>
                  <p className="text-gray-500">{profile?.email || session.user?.email}</p>
                </div>
              </div>
              {profile?.loyaltyTier && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${tierColors[profile.loyaltyTier] || 'bg-gray-100'}`}>
                  {profile.loyaltyTier}
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 divide-x divide-gray-200 bg-gray-50">
            <div className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{profile?.loyaltyPoints || 0}</p>
              <p className="text-sm text-gray-500">{t('account.loyaltyPoints')}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-sm font-mono text-gray-900">{profile?.referralCode || '-'}</p>
              <p className="text-sm text-gray-500">{t('account.referralCode')}</p>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">{t('account.personalInfo')}</h3>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="text-orange-600 hover:text-orange-700 font-medium text-sm"
              >
                {t('account.edit')}
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('account.fullName')}
              </label>
              {editMode ? (
                <>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clearFieldError('name'); }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${formErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  <FormError error={formErrors.name} />
                </>
              ) : (
                <p className="text-gray-900">{profile?.name || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('account.email')}
              </label>
              <p className="text-gray-900">{profile?.email}</p>
              <p className="text-xs text-gray-500 mt-1">{t('account.emailCannotBeChanged')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('account.phone')}
              </label>
              {editMode ? (
                <>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => { setFormData({ ...formData, phone: e.target.value }); clearFieldError('phone'); }}
                    placeholder="+1 (514) 123-4567"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${formErrors.phone ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  <FormError error={formErrors.phone} />
                </>
              ) : (
                <p className="text-gray-900">{profile?.phone || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('account.birthDate')}
              </label>
              {editMode ? (
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              ) : (
                <p className="text-gray-900">
                  {profile?.birthDate 
                    ? new Date(profile.birthDate).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '-'}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">{t('account.birthDateHint')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('account.preferredLanguage')}
              </label>
              {editMode ? (
                <>
                  <select
                    value={formData.locale}
                    onChange={(e) => { setFormData({ ...formData, locale: e.target.value }); clearFieldError('locale'); }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${formErrors.locale ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="fr">{t('account.languageFrench')}</option>
                    <option value="en">{t('account.languageEnglish')}</option>
                  </select>
                  <FormError error={formErrors.locale} />
                </>
              ) : (
                <p className="text-gray-900">{profile?.locale === 'en' ? t('account.languageEnglish') : t('account.languageFrench')}</p>
              )}
            </div>

            {editMode && (
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  {saving ? t('account.saving') : t('account.save')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    setFormErrors({});
                    setFormData({
                      name: profile?.name || '',
                      phone: profile?.phone || '',
                      birthDate: profile?.birthDate?.split('T')[0] || '',
                      locale: profile?.locale || 'fr',
                    });
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t('account.cancel')}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{t('account.security')}</h3>
          </div>
          <div className="p-6">
            <Link
              href="/change-password"
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🔒</span>
                <div>
                  <p className="font-medium text-gray-900">{t('account.changePassword')}</p>
                  <p className="text-sm text-gray-500">{t('account.changePasswordDescription')}</p>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
          </div>
        </div>

        {/* Member Since */}
        {profile?.createdAt && (
          <p className="text-center text-sm text-gray-500 mt-8">
            {t('account.memberSince')} {new Date(profile.createdAt).toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  );
}
