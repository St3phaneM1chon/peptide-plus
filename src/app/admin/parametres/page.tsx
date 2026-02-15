'use client';

import { useState } from 'react';
import {
  Settings, ShoppingCart, Package, Bell, Lock, Link2,
  Save,
} from 'lucide-react';
import { Button, FormField, Input } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

export default function ParametresPage() {
  const { t } = useI18n();
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
    toast.success(t('admin.settingsPage.settingsSaved'));
    setSaving(false);
  };

  const sections = [
    { id: 'general', label: t('admin.settingsPage.general'), icon: Settings },
    { id: 'store', label: t('admin.settingsPage.store'), icon: ShoppingCart },
    { id: 'orders', label: t('admin.settingsPage.orders'), icon: Package },
    { id: 'notifications', label: t('admin.settingsPage.notifications'), icon: Bell },
    { id: 'security', label: t('admin.settingsPage.security'), icon: Lock },
    { id: 'integrations', label: t('admin.settingsPage.integrations'), icon: Link2 },
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
          <h2 className="font-semibold text-slate-900 mb-4">{t('admin.settingsPage.sidebarTitle')}</h2>
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
            <h3 className="text-lg font-semibold text-slate-900 mb-6">{t('admin.settingsPage.generalTitle')}</h3>
            <div className="grid grid-cols-2 gap-6">
              <FormField label={t('admin.settingsPage.siteName')}>
                <Input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                />
              </FormField>
              <FormField label={t('admin.settingsPage.mainEmail')}>
                <Input
                  type="email"
                  value={settings.siteEmail}
                  onChange={(e) => setSettings({ ...settings, siteEmail: e.target.value })}
                />
              </FormField>
              <FormField label={t('admin.settingsPage.supportEmail')}>
                <Input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                />
              </FormField>
              <FormField label={t('admin.settingsPage.phone')}>
                <Input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                />
              </FormField>
              <FormField label={t('admin.settingsPage.timezone')}>
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
            <h3 className="text-lg font-semibold text-slate-900 mb-6">{t('admin.settingsPage.storeTitle')}</h3>
            <div className="grid grid-cols-2 gap-6">
              <FormField label={t('admin.settingsPage.defaultCurrency')}>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="CAD">{t('admin.settingsPage.cadOption')}</option>
                  <option value="USD">{t('admin.settingsPage.usdOption')}</option>
                  <option value="EUR">{t('admin.settingsPage.eurOption')}</option>
                </select>
              </FormField>
              <FormField label={t('admin.settingsPage.freeShippingThreshold')}>
                <Input
                  type="number"
                  value={settings.freeShippingThreshold}
                  onChange={(e) => setSettings({ ...settings, freeShippingThreshold: parseInt(e.target.value) || 0 })}
                />
              </FormField>
              <FormField label={t('admin.settingsPage.weightUnit')}>
                <select
                  value={settings.weightUnit}
                  onChange={(e) => setSettings({ ...settings, weightUnit: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="g">{t('admin.settingsPage.gramsOption')}</option>
                  <option value="kg">{t('admin.settingsPage.kilogramsOption')}</option>
                  <option value="oz">{t('admin.settingsPage.ouncesOption')}</option>
                  <option value="lb">{t('admin.settingsPage.poundsOption')}</option>
                </select>
              </FormField>
              <FormField label={t('admin.settingsPage.dimensionUnit')}>
                <select
                  value={settings.dimensionUnit}
                  onChange={(e) => setSettings({ ...settings, dimensionUnit: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="cm">{t('admin.settingsPage.centimetersOption')}</option>
                  <option value="in">{t('admin.settingsPage.inchesOption')}</option>
                </select>
              </FormField>
            </div>
          </div>
        )}

        {activeSection === 'orders' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">{t('admin.settingsPage.ordersTitle')}</h3>
            <div className="grid grid-cols-2 gap-6">
              <FormField label={t('admin.settingsPage.orderPrefix')} hint={t('admin.settingsPage.orderPrefixHint')}>
                <Input
                  type="text"
                  value={settings.orderPrefix}
                  onChange={(e) => setSettings({ ...settings, orderPrefix: e.target.value })}
                />
              </FormField>
              <FormField label={t('admin.settingsPage.minOrder')}>
                <Input
                  type="number"
                  value={settings.minOrderAmount}
                  onChange={(e) => setSettings({ ...settings, minOrderAmount: parseInt(e.target.value) || 0 })}
                />
              </FormField>
              <FormField label={t('admin.settingsPage.maxOrder')}>
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
                  <span className="text-slate-700">{t('admin.settingsPage.guestCheckout')}</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">{t('admin.settingsPage.notificationsTitle')}</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-700">{t('admin.settingsPage.newOrders')}</p>
                  <p className="text-sm text-slate-500">{t('admin.settingsPage.newOrdersDesc')}</p>
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
                  <p className="font-medium text-slate-700">{t('admin.settingsPage.lowStockAlerts')}</p>
                  <p className="text-sm text-slate-500">{t('admin.settingsPage.lowStockAlertsDesc')}</p>
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
                  <p className="font-medium text-slate-700">{t('admin.settingsPage.newReviews')}</p>
                  <p className="text-sm text-slate-500">{t('admin.settingsPage.newReviewsDesc')}</p>
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
            <h3 className="text-lg font-semibold text-slate-900 mb-6">{t('admin.settingsPage.securityTitle')}</h3>
            <div className="space-y-6">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-700">{t('admin.settingsPage.emailVerification')}</p>
                  <p className="text-sm text-slate-500">{t('admin.settingsPage.emailVerificationDesc')}</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, requireEmailVerification: !settings.requireEmailVerification })}
                  className={toggleClasses(settings.requireEmailVerification)}
                >
                  <span className={toggleDot(settings.requireEmailVerification)} />
                </button>
              </label>

              <div className="grid grid-cols-2 gap-6">
                <FormField label={t('admin.settingsPage.sessionTimeout')}>
                  <Input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 30 })}
                  />
                </FormField>
                <FormField label={t('admin.settingsPage.maxLoginAttempts')}>
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
            <h3 className="text-lg font-semibold text-slate-900 mb-6">{t('admin.settingsPage.integrationsTitle')}</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold">S</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Stripe</p>
                    <p className="text-sm text-slate-500">{t('admin.settingsPage.cardPayments')}</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">{t('admin.settingsPage.connected')}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-800 font-bold">P</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">PayPal</p>
                    <p className="text-sm text-slate-500">{t('admin.settingsPage.paypalPayments')}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-sky-600 hover:text-sky-700 bg-sky-100 hover:bg-sky-200">
                  {t('admin.settingsPage.configure')}
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <span className="text-red-600 font-bold">G</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Google Analytics</p>
                    <p className="text-sm text-slate-500">{t('admin.settingsPage.trafficStats')}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-sky-600 hover:text-sky-700 bg-sky-100 hover:bg-sky-200">
                  {t('admin.settingsPage.configure')}
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-bold">R</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Resend</p>
                    <p className="text-sm text-slate-500">{t('admin.settingsPage.emailSending')}</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">{t('admin.settingsPage.connected')}</span>
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
            {saving ? t('admin.settingsPage.saving') : t('admin.settingsPage.saveSettings')}
          </Button>
        </div>
      </div>
    </div>
  );
}
