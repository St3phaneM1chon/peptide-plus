'use client';

import { useState } from 'react';

export default function ParametresPage() {
  const [settings, setSettings] = useState({
    // General
    siteName: 'BioCycle Peptides',
    siteEmail: 'info@biocycle.ca',
    supportEmail: 'support@biocycle.ca',
    phone: '+1 (888) 555-0123',
    timezone: 'America/Toronto',
    
    // Store
    currency: 'CAD',
    weightUnit: 'g',
    dimensionUnit: 'cm',
    freeShippingThreshold: 150,
    
    // Orders
    orderPrefix: 'BC',
    minOrderAmount: 0,
    maxOrderAmount: 10000,
    guestCheckout: true,
    
    // Notifications
    orderNotifications: true,
    lowStockNotifications: true,
    reviewNotifications: true,
    
    // Security
    requireEmailVerification: false,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
  });

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('general');

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    alert('Paramètres sauvegardés!');
    setSaving(false);
  };

  const sections = [
    { id: 'general', label: 'Général', icon: '⚙️' },
    { id: 'store', label: 'Boutique', icon: '🛒' },
    { id: 'orders', label: 'Commandes', icon: '📦' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'security', label: 'Sécurité', icon: '🔒' },
    { id: 'integrations', label: 'Intégrations', icon: '🔗' },
  ];

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-4">
          <h2 className="font-semibold text-gray-900 mb-4">Paramètres</h2>
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-amber-100 text-amber-900'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{section.icon}</span>
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6">
        {activeSection === 'general' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Paramètres généraux</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du site</label>
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email principal</label>
                <input
                  type="email"
                  value={settings.siteEmail}
                  onChange={(e) => setSettings({ ...settings, siteEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email support</label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fuseau horaire</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="America/Toronto">Toronto (EST)</option>
                  <option value="America/Montreal">Montréal (EST)</option>
                  <option value="America/Vancouver">Vancouver (PST)</option>
                  <option value="America/Edmonton">Edmonton (MST)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'store' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Paramètres boutique</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Devise par défaut</label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="CAD">Dollar canadien (CAD)</option>
                  <option value="USD">Dollar américain (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seuil livraison gratuite ($)</label>
                <input
                  type="number"
                  value={settings.freeShippingThreshold}
                  onChange={(e) => setSettings({ ...settings, freeShippingThreshold: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unité de poids</label>
                <select
                  value={settings.weightUnit}
                  onChange={(e) => setSettings({ ...settings, weightUnit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="g">Grammes (g)</option>
                  <option value="kg">Kilogrammes (kg)</option>
                  <option value="oz">Onces (oz)</option>
                  <option value="lb">Livres (lb)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unité de dimension</label>
                <select
                  value={settings.dimensionUnit}
                  onChange={(e) => setSettings({ ...settings, dimensionUnit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="cm">Centimètres (cm)</option>
                  <option value="in">Pouces (in)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'orders' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Paramètres commandes</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Préfixe commande</label>
                <input
                  type="text"
                  value={settings.orderPrefix}
                  onChange={(e) => setSettings({ ...settings, orderPrefix: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Ex: BC-2026-00001</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commande minimum ($)</label>
                <input
                  type="number"
                  value={settings.minOrderAmount}
                  onChange={(e) => setSettings({ ...settings, minOrderAmount: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commande maximum ($)</label>
                <input
                  type="number"
                  value={settings.maxOrderAmount}
                  onChange={(e) => setSettings({ ...settings, maxOrderAmount: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.guestCheckout}
                    onChange={(e) => setSettings({ ...settings, guestCheckout: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-amber-500"
                  />
                  <span className="text-gray-700">Autoriser le checkout invité</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Notifications</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700">Nouvelles commandes</p>
                  <p className="text-sm text-gray-500">Recevoir un email pour chaque nouvelle commande</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, orderNotifications: !settings.orderNotifications })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.orderNotifications ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.orderNotifications ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </label>
              
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700">Alertes stock bas</p>
                  <p className="text-sm text-gray-500">Notification quand un produit atteint le seuil minimum</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, lowStockNotifications: !settings.lowStockNotifications })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.lowStockNotifications ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.lowStockNotifications ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </label>
              
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700">Nouveaux avis</p>
                  <p className="text-sm text-gray-500">Notification pour chaque nouvel avis client</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, reviewNotifications: !settings.reviewNotifications })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.reviewNotifications ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.reviewNotifications ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </label>
            </div>
          </div>
        )}

        {activeSection === 'security' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Sécurité</h3>
            <div className="space-y-6">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700">Vérification email obligatoire</p>
                  <p className="text-sm text-gray-500">Les utilisateurs doivent vérifier leur email</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, requireEmailVerification: !settings.requireEmailVerification })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.requireEmailVerification ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.requireEmailVerification ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </label>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timeout session (min)</label>
                  <input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max tentatives connexion</label>
                  <input
                    type="number"
                    value={settings.maxLoginAttempts}
                    onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'integrations' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Intégrations</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold">S</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Stripe</p>
                    <p className="text-sm text-gray-500">Paiements par carte</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">Connecté</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-800 font-bold">P</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">PayPal</p>
                    <p className="text-sm text-gray-500">Paiements PayPal</p>
                  </div>
                </div>
                <button className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm">Configurer</button>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <span className="text-red-600 font-bold">G</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Google Analytics</p>
                    <p className="text-sm text-gray-500">Statistiques de trafic</p>
                  </div>
                </div>
                <button className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm">Configurer</button>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-bold">R</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Resend</p>
                    <p className="text-sm text-gray-500">Envoi d'emails</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">Connecté</span>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
          </button>
        </div>
      </div>
    </div>
  );
}
