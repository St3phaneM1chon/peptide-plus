'use client';

import { useState } from 'react';
import {
  Settings, ShoppingCart, Package, Bell, Lock, Link2,
  Save,
} from 'lucide-react';
import { PageHeader, Button, FormField, Input } from '@/components/admin';

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
    alert('Parametres sauvegardes!');
    setSaving(false);
  };

  const sections = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'store', label: 'Boutique', icon: ShoppingCart },
    { id: 'orders', label: 'Commandes', icon: Package },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Securite', icon: Lock },
    { id: 'integrations', label: 'Integrations', icon: Link2 },
  ];

  const toggleClasses = (active: boolean) =>
    `w-12 h-6 rounded-full transition-colors relative ${active ? 'bg-green-500' : 'bg-slate-300'}`;

  const toggleDot = (active: boolean) =>
    `absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${active ? 'right-1' : 'left-1'}`;

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-4">
          <h2 className="font-semibold text-slate-900 mb-4">Parametres</h2>
          <nav className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-sky-100 text-sky-900'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6">
        {activeSection === 'general' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Parametres generaux</h3>
            <div className="grid grid-cols-2 gap-6">
              <FormField label="Nom du site">
                <Input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                />
              </FormField>
              <FormField label="Email principal">
                <Input
                  type="email"
                  value={settings.siteEmail}
                  onChange={(e) => setSettings({ ...settings, siteEmail: e.target.value })}
                />
              </FormField>
              <FormField label="Email support">
                <Input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                />
              </FormField>
              <FormField label="Telephone">
                <Input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                />
              </FormField>
              <FormField label="Fuseau horaire">
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="America/Toronto">Toronto (EST)</option>
                  <option value="America/Montreal">Montreal (EST)</option>
                  <option value="America/Vancouver">Vancouver (PST)</option>
                  <option value="America/Edmonton">Edmonton (MST)</option>
                </select>
              </FormField>
            </div>
          </div>
        )}

        {activeSection === 'store' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Parametres boutique</h3>
            <div className="grid grid-cols-2 gap-6">
              <FormField label="Devise par defaut">
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="CAD">Dollar canadien (CAD)</option>
                  <option value="USD">Dollar americain (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </FormField>
              <FormField label="Seuil livraison gratuite ($)">
                <Input
                  type="number"
                  value={settings.freeShippingThreshold}
                  onChange={(e) => setSettings({ ...settings, freeShippingThreshold: parseInt(e.target.value) || 0 })}
                />
              </FormField>
              <FormField label="Unite de poids">
                <select
                  value={settings.weightUnit}
                  onChange={(e) => setSettings({ ...settings, weightUnit: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="g">Grammes (g)</option>
                  <option value="kg">Kilogrammes (kg)</option>
                  <option value="oz">Onces (oz)</option>
                  <option value="lb">Livres (lb)</option>
                </select>
              </FormField>
              <FormField label="Unite de dimension">
                <select
                  value={settings.dimensionUnit}
                  onChange={(e) => setSettings({ ...settings, dimensionUnit: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="cm">Centimetres (cm)</option>
                  <option value="in">Pouces (in)</option>
                </select>
              </FormField>
            </div>
          </div>
        )}

        {activeSection === 'orders' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Parametres commandes</h3>
            <div className="grid grid-cols-2 gap-6">
              <FormField label="Prefixe commande" hint="Ex: BC-2026-00001">
                <Input
                  type="text"
                  value={settings.orderPrefix}
                  onChange={(e) => setSettings({ ...settings, orderPrefix: e.target.value })}
                />
              </FormField>
              <FormField label="Commande minimum ($)">
                <Input
                  type="number"
                  value={settings.minOrderAmount}
                  onChange={(e) => setSettings({ ...settings, minOrderAmount: parseInt(e.target.value) || 0 })}
                />
              </FormField>
              <FormField label="Commande maximum ($)">
                <Input
                  type="number"
                  value={settings.maxOrderAmount}
                  onChange={(e) => setSettings({ ...settings, maxOrderAmount: parseInt(e.target.value) || 0 })}
                />
              </FormField>
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.guestCheckout}
                    onChange={(e) => setSettings({ ...settings, guestCheckout: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-sky-500"
                  />
                  <span className="text-slate-700">Autoriser le checkout invite</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Notifications</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-700">Nouvelles commandes</p>
                  <p className="text-sm text-slate-500">Recevoir un email pour chaque nouvelle commande</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, orderNotifications: !settings.orderNotifications })}
                  className={toggleClasses(settings.orderNotifications)}
                >
                  <span className={toggleDot(settings.orderNotifications)} />
                </button>
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-700">Alertes stock bas</p>
                  <p className="text-sm text-slate-500">Notification quand un produit atteint le seuil minimum</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, lowStockNotifications: !settings.lowStockNotifications })}
                  className={toggleClasses(settings.lowStockNotifications)}
                >
                  <span className={toggleDot(settings.lowStockNotifications)} />
                </button>
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-700">Nouveaux avis</p>
                  <p className="text-sm text-slate-500">Notification pour chaque nouvel avis client</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, reviewNotifications: !settings.reviewNotifications })}
                  className={toggleClasses(settings.reviewNotifications)}
                >
                  <span className={toggleDot(settings.reviewNotifications)} />
                </button>
              </label>
            </div>
          </div>
        )}

        {activeSection === 'security' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Securite</h3>
            <div className="space-y-6">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-700">Verification email obligatoire</p>
                  <p className="text-sm text-slate-500">Les utilisateurs doivent verifier leur email</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, requireEmailVerification: !settings.requireEmailVerification })}
                  className={toggleClasses(settings.requireEmailVerification)}
                >
                  <span className={toggleDot(settings.requireEmailVerification)} />
                </button>
              </label>

              <div className="grid grid-cols-2 gap-6">
                <FormField label="Timeout session (min)">
                  <Input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 30 })}
                  />
                </FormField>
                <FormField label="Max tentatives connexion">
                  <Input
                    type="number"
                    value={settings.maxLoginAttempts}
                    onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) || 5 })}
                  />
                </FormField>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'integrations' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Integrations</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold">S</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Stripe</p>
                    <p className="text-sm text-slate-500">Paiements par carte</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">Connecte</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-800 font-bold">P</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">PayPal</p>
                    <p className="text-sm text-slate-500">Paiements PayPal</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-sky-600 hover:text-sky-700 bg-sky-100 hover:bg-sky-200">
                  Configurer
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <span className="text-red-600 font-bold">G</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Google Analytics</p>
                    <p className="text-sm text-slate-500">Statistiques de trafic</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-sky-600 hover:text-sky-700 bg-sky-100 hover:bg-sky-200">
                  Configurer
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-bold">R</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Resend</p>
                    <p className="text-sm text-slate-500">Envoi d'emails</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">Connecte</span>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            variant="primary"
            icon={Save}
            loading={saving}
            onClick={handleSave}
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder les parametres'}
          </Button>
        </div>
      </div>
    </div>
  );
}
