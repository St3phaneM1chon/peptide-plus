'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Settings, Download, AlertTriangle, Shield } from 'lucide-react';
import { PageHeader, Button, StatusBadge, SectionCard, FormField, Input } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

interface AccountingSettingsData {
  companyName: string;
  neq: string;
  tpsNumber: string;
  tvqNumber: string;
  fiscalYearStart: number;
  accountingMethod: string;
  defaultCurrency: string;
  taxFilingFrequency: string;
  autoCreateSaleEntries: boolean;
  autoReconcileStripe: boolean;
  quickMethodEnabled: boolean;
  quickMethodProvince: string;
  blockDeletionDuringRetention: boolean;
  [key: string]: unknown;
}

interface Currency {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  isDefault: boolean;
  active: boolean;
}

interface Integration {
  id: string;
  name: string;
  status: 'connected' | 'not_connected';
  lastSync: string | null;
  icon: string;
}

export default function ParametresComptablesPage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<'general' | 'fiscal' | 'currencies' | 'integrations'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [settings, setSettings] = useState<AccountingSettingsData>({
    companyName: '',
    neq: '',
    tpsNumber: '',
    tvqNumber: '',
    fiscalYearStart: 1,
    accountingMethod: 'ACCRUAL',
    defaultCurrency: 'CAD',
    taxFilingFrequency: 'MONTHLY',
    autoCreateSaleEntries: true,
    autoReconcileStripe: true,
    quickMethodEnabled: false,
    quickMethodProvince: 'QC',
    blockDeletionDuringRetention: true,
  });

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  // Fetch settings from API
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/accounting/settings');
      if (!res.ok) throw new Error(t('admin.accountingSettings.errorLoadSettings'));
      const data = await res.json();
      if (data.settings) {
        setSettings({
          companyName: data.settings.companyName || '',
          neq: data.settings.neq || '',
          tpsNumber: data.settings.tpsNumber || '',
          tvqNumber: data.settings.tvqNumber || '',
          fiscalYearStart: data.settings.fiscalYearStart || 1,
          accountingMethod: data.settings.accountingMethod || 'ACCRUAL',
          defaultCurrency: data.settings.defaultCurrency || 'CAD',
          taxFilingFrequency: data.settings.taxFilingFrequency || 'MONTHLY',
          autoCreateSaleEntries: data.settings.autoCreateSaleEntries ?? true,
          autoReconcileStripe: data.settings.autoReconcileStripe ?? true,
          quickMethodEnabled: data.settings.quickMethodEnabled ?? false,
          quickMethodProvince: data.settings.quickMethodProvince || 'QC',
          blockDeletionDuringRetention: data.settings.blockDeletionDuringRetention ?? true,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.accountingSettings.errorUnknown'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch currencies from API
  const fetchCurrencies = async () => {
    try {
      const res = await fetch('/api/accounting/currencies');
      if (!res.ok) return;
      const data = await res.json();
      if (data.currencies && Array.isArray(data.currencies)) {
        setCurrencies(
          data.currencies.map((c: { code: string; name: string; symbol: string; exchangeRate: number; isDefault: boolean; isActive: boolean }) => ({
            code: c.code,
            name: c.name,
            symbol: c.symbol,
            rate: c.exchangeRate,
            isDefault: c.isDefault,
            active: c.isActive,
          }))
        );
      }
    } catch {
      // Currencies fetch failure is non-blocking; the tab will simply show an empty table
    }
  };

  // Fetch bank accounts from API and derive integration statuses
  const fetchIntegrations = async () => {
    try {
      const res = await fetch('/api/accounting/bank-accounts');
      if (!res.ok) return;
      const data = await res.json();
      const bankAccounts: Array<{ type?: string; name?: string; institution?: string; lastSyncAt?: string | null }> =
        data.bankAccounts || data.accounts || [];

      const integrationMap: Record<string, Integration> = {
        stripe: { id: 'stripe', name: 'Stripe', status: 'not_connected', lastSync: null, icon: '\uD83D\uDCB3' },
        paypal: { id: 'paypal', name: 'PayPal', status: 'not_connected', lastSync: null, icon: '\uD83C\uDD7F\uFE0F' },
        quickbooks: { id: 'quickbooks', name: 'QuickBooks', status: 'not_connected', lastSync: null, icon: '\uD83D\uDCCA' },
        bank: { id: 'bank', name: 'Desjardins', status: 'not_connected', lastSync: null, icon: '\uD83C\uDFE6' },
      };

      for (const account of bankAccounts) {
        const typeLower = (account.type || '').toLowerCase();
        const nameLower = (account.name || '').toLowerCase();
        const institutionLower = (account.institution || '').toLowerCase();

        if (typeLower.includes('stripe') || nameLower.includes('stripe')) {
          integrationMap.stripe.status = 'connected';
          integrationMap.stripe.lastSync = account.lastSyncAt || null;
        } else if (typeLower.includes('paypal') || nameLower.includes('paypal')) {
          integrationMap.paypal.status = 'connected';
          integrationMap.paypal.lastSync = account.lastSyncAt || null;
        } else if (institutionLower.includes('desjardins') || nameLower.includes('desjardins')) {
          integrationMap.bank.status = 'connected';
          integrationMap.bank.name = account.institution || 'Desjardins';
          integrationMap.bank.lastSync = account.lastSyncAt || null;
        }
      }
      // QuickBooks remains as not_connected — it is an external integration, not a bank account

      setIntegrations(Object.values(integrationMap));
    } catch {
      // Integration fetch failure is non-blocking; the tab will simply show defaults
      setIntegrations([
        { id: 'stripe', name: 'Stripe', status: 'not_connected', lastSync: null, icon: '\uD83D\uDCB3' },
        { id: 'paypal', name: 'PayPal', status: 'not_connected', lastSync: null, icon: '\uD83C\uDD7F\uFE0F' },
        { id: 'quickbooks', name: 'QuickBooks', status: 'not_connected', lastSync: null, icon: '\uD83D\uDCCA' },
        { id: 'bank', name: 'Desjardins', status: 'not_connected', lastSync: null, icon: '\uD83C\uDFE6' },
      ]);
    }
  };

  // Save settings to API
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/accounting/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('admin.accountingSettings.errorSaving'));
      }
      setSaveMessage(t('admin.accountingSettings.saveSuccess'));
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.accountingSettings.errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    Promise.all([fetchSettings(), fetchCurrencies(), fetchIntegrations()]);
  }, []);

  // Map fiscal year start month to month-day format for display
  const fiscalYearEndMap: Record<number, string> = {
    1: '12-31',   // fiscal year starts Jan -> ends Dec 31
    4: '03-31',   // starts April -> ends March 31
    7: '06-30',   // starts July -> ends June 30
    10: '09-30',  // starts October -> ends September 30
  };
  const fiscalYearDisplay = fiscalYearEndMap[settings.fiscalYearStart] || '12-31';

  const handleFiscalYearChange = (endDate: string) => {
    const reverseMap: Record<string, number> = {
      '12-31': 1,
      '03-31': 4,
      '06-30': 7,
      '09-30': 10,
    };
    setSettings({ ...settings, fiscalYearStart: reverseMap[endDate] || 1 });
  };

  // Ribbon actions
  const handleRibbonSave = useCallback(() => { handleSave(); }, [handleSave]);
  const handleRibbonResetDefaults = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonImportConfig = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonExportConfig = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonTest = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);

  useRibbonAction('save', handleRibbonSave);
  useRibbonAction('resetDefaults', handleRibbonResetDefaults);
  useRibbonAction('importConfig', handleRibbonImportConfig);
  useRibbonAction('exportConfig', handleRibbonExportConfig);
  useRibbonAction('test', handleRibbonTest);

  const theme = sectionThemes.compliance;

  if (loading) return (
    <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
      </div>
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
    </div>
  );
  if (error) return <div className="p-8 text-center text-red-600">{t('admin.accountingSettings.errorPrefix')} {error}</div>;

  const tabs = [
    { id: 'general' as const, label: t('admin.accountingSettings.tabGeneral') },
    { id: 'fiscal' as const, label: t('admin.accountingSettings.tabFiscal') },
    { id: 'currencies' as const, label: t('admin.accountingSettings.tabCurrencies') },
    { id: 'integrations' as const, label: t('admin.accountingSettings.tabIntegrations') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.accountingSettings.title')}
        subtitle={t('admin.accountingSettings.subtitle')}
        theme={theme}
      />

      {/* Save success message */}
      {saveMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">
          {saveMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 border-b-2 font-medium text-sm ${
                activeTab === tab.id ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <SectionCard title={t('admin.accountingSettings.companyInfo')} theme={theme}>
            <div className="grid grid-cols-2 gap-6">
              <FormField label={t('admin.accountingSettings.companyName')}>
                <Input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                />
              </FormField>
              <FormField label={t('admin.accountingSettings.neq')}>
                <Input
                  type="text"
                  value={settings.neq}
                  onChange={(e) => setSettings({ ...settings, neq: e.target.value })}
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard title={t('admin.accountingSettings.accountingParams')} theme={theme}>
            <div className="grid grid-cols-2 gap-6">
              <FormField label={t('admin.accountingSettings.fiscalYearEnd')}>
                <select
                  value={fiscalYearDisplay}
                  onChange={(e) => handleFiscalYearChange(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="12-31">{t('admin.accountingSettings.december31')}</option>
                  <option value="03-31">{t('admin.accountingSettings.march31')}</option>
                  <option value="06-30">{t('admin.accountingSettings.june30')}</option>
                  <option value="09-30">{t('admin.accountingSettings.september30')}</option>
                </select>
              </FormField>
              <FormField label={t('admin.accountingSettings.accountingMethod')}>
                <select
                  value={settings.accountingMethod}
                  onChange={(e) => setSettings({ ...settings, accountingMethod: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="ACCRUAL">{t('admin.accountingSettings.accrualAccounting')}</option>
                  <option value="CASH">{t('admin.accountingSettings.cashAccounting')}</option>
                </select>
              </FormField>
              <FormField label={t('admin.accountingSettings.defaultCurrency')}>
                <select
                  value={settings.defaultCurrency}
                  onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="CAD">{t('admin.accountingSettings.cadLabel')}</option>
                  <option value="USD">{t('admin.accountingSettings.usdLabel')}</option>
                </select>
              </FormField>
            </div>
          </SectionCard>

          <SectionCard title={t('admin.accountingSettings.automations')} theme={theme}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{t('admin.accountingSettings.autoReconcileStripe')}</p>
                  <p className="text-sm text-slate-500">{t('admin.accountingSettings.autoReconcileStripeDesc')}</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, autoReconcileStripe: !settings.autoReconcileStripe })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.autoReconcileStripe ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.autoReconcileStripe ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{t('admin.accountingSettings.autoSaleEntries')}</p>
                  <p className="text-sm text-slate-500">{t('admin.accountingSettings.autoSaleEntriesDesc')}</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, autoCreateSaleEntries: !settings.autoCreateSaleEntries })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.autoCreateSaleEntries ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.autoCreateSaleEntries ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Fiscal Settings */}
      {activeTab === 'fiscal' && (
        <div className="space-y-6">
          <SectionCard title={t('admin.accountingSettings.taxNumbers')} theme={theme}>
            <div className="grid grid-cols-2 gap-6">
              <FormField label={t('admin.accountingSettings.tpsNumber')}>
                <Input
                  type="text"
                  value={settings.tpsNumber}
                  onChange={(e) => setSettings({ ...settings, tpsNumber: e.target.value })}
                  placeholder="123456789RT0001"
                />
              </FormField>
              <FormField label={t('admin.accountingSettings.tvqNumber')}>
                <Input
                  type="text"
                  value={settings.tvqNumber}
                  onChange={(e) => setSettings({ ...settings, tvqNumber: e.target.value })}
                  placeholder="1234567890TQ0001"
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard title={t('admin.accountingSettings.taxRates')} theme={theme} noPadding>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-2 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.taxCol')}</th>
                  <th scope="col" className="px-4 py-2 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.jurisdictionCol')}</th>
                  <th scope="col" className="px-4 py-2 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.rateCol')}</th>
                  <th scope="col" className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.activeCol')}</th>
                </tr>
              </thead>
              {/*
                Canadian tax rates are intentionally hardcoded here.
                These are standardized government-set rates (TPS/GST, TVQ/QST, TVH/HST, PST)
                that change very infrequently (typically only via federal/provincial budget announcements).
                For a settings display page, hardcoding is acceptable and avoids an unnecessary API call.
                If rates change, update them here directly.
              */}
              <tbody className="divide-y divide-slate-200">
                <tr><td className="px-4 py-3">{t('admin.accounting.tax.tps')}</td><td className="px-4 py-3 text-slate-600">{t('admin.accountingSettings.canadaFederal')}</td><td className="px-4 py-3 text-end">5%</td><td className="px-4 py-3 text-center text-green-600">&#10003;</td></tr>
                <tr><td className="px-4 py-3">{t('admin.accounting.tax.tvq')}</td><td className="px-4 py-3 text-slate-600">{t('admin.accountingSettings.quebec')}</td><td className="px-4 py-3 text-end">9.975%</td><td className="px-4 py-3 text-center text-green-600">&#10003;</td></tr>
                <tr><td className="px-4 py-3">{t('admin.accounting.tax.tvh')}</td><td className="px-4 py-3 text-slate-600">{t('admin.accountingSettings.ontario')}</td><td className="px-4 py-3 text-end">13%</td><td className="px-4 py-3 text-center text-green-600">&#10003;</td></tr>
                <tr><td className="px-4 py-3">{t('admin.accounting.tax.tvh')}</td><td className="px-4 py-3 text-slate-600">{t('admin.accountingSettings.novaScotia')}</td><td className="px-4 py-3 text-end">15%</td><td className="px-4 py-3 text-center text-green-600">&#10003;</td></tr>
                <tr><td className="px-4 py-3">{t('admin.accounting.tax.pst')}</td><td className="px-4 py-3 text-slate-600">{t('admin.accountingSettings.britishColumbia')}</td><td className="px-4 py-3 text-end">7%</td><td className="px-4 py-3 text-center text-green-600">&#10003;</td></tr>
              </tbody>
            </table>
            </div>
          </SectionCard>

          <SectionCard title={t('admin.accountingSettings.filingFrequency')} theme={theme}>
            <div className="grid grid-cols-2 gap-6">
              <FormField label={t('admin.accountingSettings.tpsTvq')}>
                <select
                  value={settings.taxFilingFrequency}
                  onChange={(e) => setSettings({ ...settings, taxFilingFrequency: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="MONTHLY">{t('admin.accountingSettings.monthly')}</option>
                  <option value="QUARTERLY">{t('admin.accountingSettings.quarterly')}</option>
                  <option value="ANNUAL">{t('admin.accountingSettings.annual')}</option>
                </select>
              </FormField>
            </div>
          </SectionCard>

          {/* Quick Method GST/HST */}
          <SectionCard title={t('admin.accountingSettings.quickMethodTitle')} theme={theme}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{t('admin.accountingSettings.quickMethodEnable')}</p>
                  <p className="text-sm text-slate-500">{t('admin.accountingSettings.quickMethodEnableDesc')}</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, quickMethodEnabled: !settings.quickMethodEnabled })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.quickMethodEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.quickMethodEnabled ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>

              {settings.quickMethodEnabled && (
                <div className="space-y-4">
                  <FormField label={t('admin.accountingSettings.quickMethodProvince')}>
                    <select
                      value={settings.quickMethodProvince}
                      onChange={(e) => setSettings({ ...settings, quickMethodProvince: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    >
                      <option value="QC">{t('admin.accountingSettings.quebec')} (QC)</option>
                      <option value="ON">{t('admin.accountingSettings.ontario')} (ON)</option>
                      <option value="AB">Alberta (AB)</option>
                      <option value="BC">{t('admin.accountingSettings.britishColumbia')} (BC)</option>
                      <option value="SK">Saskatchewan (SK)</option>
                      <option value="MB">Manitoba (MB)</option>
                      <option value="NB">{t('admin.accounting.provinces.newBrunswick')} (NB)</option>
                      <option value="NL">{t('admin.accounting.provinces.newfoundland')} (NL)</option>
                      <option value="NS">{t('admin.accountingSettings.novaScotia')} (NS)</option>
                      <option value="PE">{t('admin.accounting.provinces.princeEdwardIsland')} (PE)</option>
                      <option value="YT">Yukon (YT)</option>
                      <option value="NT">{t('admin.accounting.provinces.northwestTerritories')} (NT)</option>
                      <option value="NU">Nunavut (NU)</option>
                    </select>
                  </FormField>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-amber-900">{t('admin.accountingSettings.quickMethodEligibilityTitle')}</p>
                        <p className="text-sm text-amber-700 mt-1">{t('admin.accountingSettings.quickMethodEligibilityDesc')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Document Retention Policy */}
          <SectionCard title={t('admin.accountingSettings.retentionTitle')} theme={sectionThemes.compliance}>
            <div className="space-y-4">
              {/* Read-only retention rules table */}
              <p className="text-sm text-slate-600">{t('admin.accountingSettings.retentionDescription')}</p>
              <div className="overflow-hidden overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.retentionDocType')}</th>
                      <th scope="col" className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.retentionYears')}</th>
                      <th scope="col" className="px-4 py-2 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.retentionAuthority')}</th>
                      <th scope="col" className="px-4 py-2 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.retentionReference')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr><td className="px-4 py-2 text-sm">{t('admin.accountingSettings.retGeneralRecords')}</td><td className="px-4 py-2 text-center text-sm font-mono">6</td><td className="px-4 py-2 text-sm text-slate-600">CRA</td><td className="px-4 py-2 text-sm text-slate-500">s.230(4) ITA</td></tr>
                    <tr><td className="px-4 py-2 text-sm">{t('admin.accountingSettings.retT2Returns')}</td><td className="px-4 py-2 text-center text-sm font-mono">6</td><td className="px-4 py-2 text-sm text-slate-600">CRA</td><td className="px-4 py-2 text-sm text-slate-500">IT-Folio S4-F14-C1</td></tr>
                    <tr><td className="px-4 py-2 text-sm">{t('admin.accountingSettings.retGstQstRecords')}</td><td className="px-4 py-2 text-center text-sm font-mono">6</td><td className="px-4 py-2 text-sm text-slate-600">CRA/RQ</td><td className="px-4 py-2 text-sm text-slate-500">s.286 ETA</td></tr>
                    <tr><td className="px-4 py-2 text-sm">{t('admin.accountingSettings.retPayrollRecords')}</td><td className="px-4 py-2 text-center text-sm font-mono">6</td><td className="px-4 py-2 text-sm text-slate-600">CRA/RQ</td><td className="px-4 py-2 text-sm text-slate-500">s.230(4) ITA</td></tr>
                    <tr><td className="px-4 py-2 text-sm">{t('admin.accountingSettings.retT4Rl1')}</td><td className="px-4 py-2 text-center text-sm font-mono">6</td><td className="px-4 py-2 text-sm text-slate-600">CRA/RQ</td><td className="px-4 py-2 text-sm text-slate-500">s.230(4) ITA</td></tr>
                    <tr><td className="px-4 py-2 text-sm">{t('admin.accountingSettings.retRoe')}</td><td className="px-4 py-2 text-center text-sm font-mono">6</td><td className="px-4 py-2 text-sm text-slate-600">Service Canada</td><td className="px-4 py-2 text-sm text-slate-500">EI Act s.87</td></tr>
                    <tr><td className="px-4 py-2 text-sm">{t('admin.accountingSettings.retArticlesIncorp')}</td><td className="px-4 py-2 text-center text-sm font-mono">{t('admin.accountingSettings.retentionPermanent')}</td><td className="px-4 py-2 text-sm text-slate-600">{t('admin.accountingSettings.retCorporateLaw')}</td><td className="px-4 py-2 text-sm text-slate-500">CBCA/QBCA</td></tr>
                    <tr><td className="px-4 py-2 text-sm">{t('admin.accountingSettings.retBoardMinutes')}</td><td className="px-4 py-2 text-center text-sm font-mono">{t('admin.accountingSettings.retentionPermanent')}</td><td className="px-4 py-2 text-sm text-slate-600">{t('admin.accountingSettings.retCorporateLaw')}</td><td className="px-4 py-2 text-sm text-slate-500">CBCA s.20</td></tr>
                    <tr><td className="px-4 py-2 text-sm">{t('admin.accountingSettings.retShareRegister')}</td><td className="px-4 py-2 text-center text-sm font-mono">{t('admin.accountingSettings.retentionPermanent')}</td><td className="px-4 py-2 text-sm text-slate-600">{t('admin.accountingSettings.retCorporateLaw')}</td><td className="px-4 py-2 text-sm text-slate-500">CBCA s.50</td></tr>
                  </tbody>
                </table>
              </div>

              {/* Block deletion toggle */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-900">{t('admin.accountingSettings.retentionBlockDelete')}</p>
                    <p className="text-sm text-slate-500">{t('admin.accountingSettings.retentionBlockDeleteDesc')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, blockDeletionDuringRetention: !settings.blockDeletionDuringRetention })}
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                    settings.blockDeletionDuringRetention ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.blockDeletionDuringRetention ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Currencies */}
      {activeTab === 'currencies' && (
        <div className="space-y-6">
          <SectionCard
            title={t('admin.accountingSettings.configuredCurrencies')}
            theme={theme}
            headerAction={
              <Button variant="ghost" size="sm" icon={Plus} className="text-amber-700 hover:bg-amber-50">
                {t('admin.accountingSettings.addCurrency')}
              </Button>
            }
            noPadding
          >
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.currencyCol')}</th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.symbolCol')}</th>
                  <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.rateVsCAD')}</th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.defaultCol')}</th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.accountingSettings.activeCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currencies.map((currency) => (
                  <tr key={currency.code} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{currency.code}</p>
                      <p className="text-sm text-slate-500">{currency.name}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{currency.symbol}</td>
                    <td className="px-4 py-3 text-end font-mono">{currency.rate.toFixed(4)}</td>
                    <td className="px-4 py-3 text-center">
                      {currency.isDefault && <span className="text-emerald-600">&#10003;</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button className={`w-10 h-5 rounded-full transition-colors relative ${currency.active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${currency.active ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </SectionCard>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-blue-500">&#8505;&#65039;</span>
              <div>
                <p className="font-medium text-blue-900">{t('admin.accountingSettings.autoRateUpdate')}</p>
                <p className="text-sm text-blue-700">{t('admin.accountingSettings.autoRateUpdateDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Integrations */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {integrations.map((integration) => (
              <SectionCard key={integration.id} theme={theme}>
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{integration.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">{integration.name}</h3>
                      <StatusBadge
                        variant={integration.status === 'connected' ? 'success' : 'neutral'}
                        dot
                      >
                        {integration.status === 'connected' ? t('admin.accountingSettings.connectedStatus') : t('admin.accountingSettings.notConnectedStatus')}
                      </StatusBadge>
                    </div>
                    {integration.lastSync && (
                      <p className="text-sm text-slate-500 mt-1">
                        {t('admin.accountingSettings.lastSyncPrefix')} {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(integration.lastSync))}
                      </p>
                    )}
                    <div className="mt-3">
                      {integration.status === 'connected' ? (
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" icon={RefreshCw} className="text-blue-700 hover:bg-blue-50">
                            {t('admin.accountingSettings.syncBtn')}
                          </Button>
                          <Button variant="ghost" size="sm" icon={Settings}>
                            {t('admin.accountingSettings.configureBtn')}
                          </Button>
                        </div>
                      ) : (
                        <Button variant="primary" size="sm" className={`${theme.btnPrimary} border-transparent text-white`}>
                          {t('admin.accountingSettings.connectBtn')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            ))}
          </div>

          <SectionCard title={t('admin.accountingSettings.accountingExport')} theme={theme}>
            <p className="text-slate-600 mb-4">{t('admin.accountingSettings.accountingExportDesc')}</p>
            <div className="flex gap-3">
              <Button variant="secondary" icon={Download}>{t('admin.accountingSettings.exportQuickBooks')}</Button>
              <Button variant="secondary" icon={Download}>{t('admin.accountingSettings.exportSage')}</Button>
              <Button variant="secondary" icon={Download}>{t('admin.accountingSettings.exportExcel')}</Button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          className={`${theme.btnPrimary} border-transparent text-white`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('admin.accountingSettings.saving') : t('admin.accountingSettings.saveChanges')}
        </Button>
      </div>
    </div>
  );
}
