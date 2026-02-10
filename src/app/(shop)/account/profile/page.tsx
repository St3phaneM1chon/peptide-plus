'use client';

/**
 * PAGE MON PROFIL - BioCycle Peptides
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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
        setMessage({ type: 'success', text: 'Profil mis à jour avec succès!' });
        // Mettre à jour la session
        update({ name: formData.name });
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.message || 'Erreur lors de la mise à jour' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Une erreur est survenue' });
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
            <Link href="/" className="hover:text-orange-600">Accueil</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Mon profil</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">Mon profil</h1>
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
                    {profile?.name || session.user?.name || 'Utilisateur'}
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
              <p className="text-sm text-gray-500">Points fidélité</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-sm font-mono text-gray-900">{profile?.referralCode || '-'}</p>
              <p className="text-sm text-gray-500">Code parrainage</p>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Informations personnelles</h3>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="text-orange-600 hover:text-orange-700 font-medium text-sm"
              >
                Modifier
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom complet
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              ) : (
                <p className="text-gray-900">{profile?.name || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <p className="text-gray-900">{profile?.email}</p>
              <p className="text-xs text-gray-500 mt-1">L&apos;email ne peut pas être modifié</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone
              </label>
              {editMode ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (514) 123-4567"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              ) : (
                <p className="text-gray-900">{profile?.phone || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de naissance
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
              <p className="text-xs text-gray-500 mt-1">Pour recevoir un cadeau d&apos;anniversaire 🎂</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Langue préférée
              </label>
              {editMode ? (
                <select
                  value={formData.locale}
                  onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              ) : (
                <p className="text-gray-900">{profile?.locale === 'en' ? 'English' : 'Français'}</p>
              )}
            </div>

            {editMode && (
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    setFormData({
                      name: profile?.name || '',
                      phone: profile?.phone || '',
                      birthDate: profile?.birthDate?.split('T')[0] || '',
                      locale: profile?.locale || 'fr',
                    });
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Sécurité</h3>
          </div>
          <div className="p-6">
            <Link
              href="/change-password"
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🔒</span>
                <div>
                  <p className="font-medium text-gray-900">Modifier mon mot de passe</p>
                  <p className="text-sm text-gray-500">Changer votre mot de passe de connexion</p>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
          </div>
        </div>

        {/* Member Since */}
        {profile?.createdAt && (
          <p className="text-center text-sm text-gray-500 mt-8">
            Membre depuis {new Date(profile.createdAt).toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  );
}
