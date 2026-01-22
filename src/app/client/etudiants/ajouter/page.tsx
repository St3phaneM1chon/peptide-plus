/**
 * CLIENT - AJOUTER UN ÉTUDIANT
 * Formulaire pour associer un étudiant à l'entreprise
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AddStudentPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pour étudiant existant
  const [email, setEmail] = useState('');

  // Pour nouvel étudiant
  const [newStudent, setNewStudent] = useState({
    name: '',
    email: '',
    sendInvite: true,
  });

  const handleAddExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/company/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'ajout');
        setLoading(false);
        return;
      }

      setSuccess('Étudiant ajouté avec succès!');
      setTimeout(() => router.push('/client/etudiants'), 1500);
    } catch {
      setError('Erreur de connexion');
      setLoading(false);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/company/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newStudent.email,
          name: newStudent.name,
          createNew: true,
          sendInvite: newStudent.sendInvite,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création');
        setLoading(false);
        return;
      }

      setSuccess('Étudiant créé et ajouté avec succès!');
      setTimeout(() => router.push('/client/etudiants'), 1500);
    } catch {
      setError('Erreur de connexion');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/dashboard/client" className="hover:text-gray-700">Dashboard</Link>
            {' / '}
            <Link href="/client/etudiants" className="hover:text-gray-700">Mes étudiants</Link>
            {' / '}
            <span className="text-gray-900">Ajouter</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">Ajouter un étudiant</h1>
          <p className="text-gray-600">Associez un étudiant à votre entreprise</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Mode selection */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="grid grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`p-6 text-center border-r border-gray-200 rounded-tl-xl rounded-bl-xl ${
                mode === 'existing' ? 'bg-blue-50 border-b-2 border-b-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              <span className="text-3xl block mb-2">🔍</span>
              <span className={`font-medium ${mode === 'existing' ? 'text-blue-600' : 'text-gray-700'}`}>
                Étudiant existant
              </span>
              <p className="text-sm text-gray-500 mt-1">
                Associer un compte déjà inscrit
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`p-6 text-center rounded-tr-xl rounded-br-xl ${
                mode === 'new' ? 'bg-blue-50 border-b-2 border-b-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              <span className="text-3xl block mb-2">✨</span>
              <span className={`font-medium ${mode === 'new' ? 'text-blue-600' : 'text-gray-700'}`}>
                Nouvel étudiant
              </span>
              <p className="text-sm text-gray-500 mt-1">
                Créer un nouveau compte
              </p>
            </button>
          </div>
        </div>

        {/* Formulaire: Étudiant existant */}
        {mode === 'existing' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Rechercher un étudiant existant
            </h2>
            <p className="text-gray-600 mb-6">
              Entrez l'adresse email d'un utilisateur déjà inscrit sur la plateforme 
              pour l'associer à votre entreprise.
            </p>
            <form onSubmit={handleAddExisting}>
              <div className="mb-6">
                <label className="form-label">Adresse email de l'étudiant *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="etudiant@exemple.com"
                />
              </div>
              <div className="flex justify-end space-x-4">
                <Link href="/client/etudiants" className="btn-outline">
                  Annuler
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Recherche...' : 'Ajouter cet étudiant'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Formulaire: Nouvel étudiant */}
        {mode === 'new' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Créer un nouvel étudiant
            </h2>
            <p className="text-gray-600 mb-6">
              Un compte sera créé pour cet étudiant et il sera automatiquement associé 
              à votre entreprise. Il recevra une invitation par email.
            </p>
            <form onSubmit={handleCreateNew}>
              <div className="mb-4">
                <label className="form-label">Nom complet</label>
                <input
                  type="text"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  className="form-input"
                  placeholder="Jean Dupont"
                />
              </div>
              <div className="mb-4">
                <label className="form-label">Adresse email *</label>
                <input
                  type="email"
                  required
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  className="form-input"
                  placeholder="jean.dupont@exemple.com"
                />
              </div>
              <div className="mb-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newStudent.sendInvite}
                    onChange={(e) => setNewStudent({ ...newStudent, sendInvite: e.target.checked })}
                    className="form-checkbox mr-3"
                  />
                  <span className="text-gray-700">
                    Envoyer une invitation par email
                  </span>
                </label>
                <p className="text-sm text-gray-500 mt-1 ml-6">
                  L'étudiant recevra un email avec un lien pour créer son mot de passe.
                </p>
              </div>
              <div className="flex justify-end space-x-4">
                <Link href="/client/etudiants" className="btn-outline">
                  Annuler
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Création...' : 'Créer et ajouter'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
