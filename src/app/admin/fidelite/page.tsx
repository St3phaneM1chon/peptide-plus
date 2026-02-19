'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { PageHeader, Button, Modal, FormField, Input } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface LoyaltyTier {
  name: string;
  minPoints: number;
  multiplier: number;
  perks: string[];
  color: string;
}

interface LoyaltyConfig {
  pointsPerDollar: number;
  pointsValue: number;
  minRedemption: number;
  referralBonus: number;
  birthdayBonus: number;
  tiers: LoyaltyTier[];
}

export default function FidelitePage() {
  const { t } = useI18n();
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTier, setEditingTier] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/loyalty/config');
      const data = await res.json();
      setConfig(data.config || null);
    } catch (err) {
      console.error('Error fetching loyalty config:', err);
      setConfig(null);
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/loyalty/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      toast.success(t('admin.loyalty.configSaved'));
    } catch (err) {
      console.error('Error saving config:', err);
      toast.error(t('admin.loyalty.configSaveError') || 'Error saving configuration');
    }
    setSaving(false);
  };

  const tierColors: Record<string, string> = {
    orange: 'bg-sky-100 text-sky-800 border-sky-300',
    gray: 'bg-slate-200 text-slate-700 border-slate-400',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-400',
    blue: 'bg-blue-100 text-blue-800 border-blue-400',
    purple: 'bg-purple-100 text-purple-800 border-purple-400',
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.loyalty.title')}
        subtitle={t('admin.loyalty.subtitle')}
        actions={
          <Button variant="primary" loading={saving} onClick={saveConfig}>
            {saving ? t('admin.loyalty.saving') : t('admin.loyalty.save')}
          </Button>
        }
      />

      {/* Basic Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">{t('admin.loyalty.basicSettings')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <FormField label={t('admin.loyalty.pointsPerDollar')} hint={t('admin.loyalty.bronzeLevel')}>
            <Input
              type="number"
              value={config.pointsPerDollar}
              onChange={(e) => setConfig({ ...config, pointsPerDollar: parseInt(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label={t('admin.loyalty.pointValue')} hint={t('admin.loyalty.pointValueHint', { value: String(config.pointsValue) })}>
            <Input
              type="number"
              step="0.001"
              value={config.pointsValue}
              onChange={(e) => setConfig({ ...config, pointsValue: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label={t('admin.loyalty.minRedemption')} hint={t('admin.loyalty.minRedemptionHint', { value: (config.minRedemption * config.pointsValue).toFixed(2) })}>
            <Input
              type="number"
              value={config.minRedemption}
              onChange={(e) => setConfig({ ...config, minRedemption: parseInt(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label={t('admin.loyalty.referralBonus')} hint={t('admin.loyalty.referralBonusHint')}>
            <Input
              type="number"
              value={config.referralBonus}
              onChange={(e) => setConfig({ ...config, referralBonus: parseInt(e.target.value) || 0 })}
            />
          </FormField>
        </div>
      </div>

      {/* Special Bonuses */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">{t('admin.loyalty.specialBonuses')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <FormField label={t('admin.loyalty.birthdayBonus')} hint={t('admin.loyalty.pointsOffered')}>
            <Input
              type="number"
              value={config.birthdayBonus}
              onChange={(e) => setConfig({ ...config, birthdayBonus: parseInt(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label={t('admin.loyalty.firstOrderBonus')} hint={t('admin.loyalty.pointsOffered')}>
            <Input type="number" defaultValue={100} />
          </FormField>
          <FormField label={t('admin.loyalty.reviewBonus')} hint={t('admin.loyalty.perReview')}>
            <Input type="number" defaultValue={50} />
          </FormField>
          <FormField label={t('admin.loyalty.signupBonus')} hint={t('admin.loyalty.welcomePoints')}>
            <Input type="number" defaultValue={200} />
          </FormField>
        </div>
      </div>

      {/* Tiers */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">{t('admin.loyalty.loyaltyTiers')}</h3>
          <Button variant="ghost" size="sm" icon={Plus} className="text-sky-600 hover:text-sky-700">
            {t('admin.loyalty.addTier')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {config.tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl border-2 p-4 ${tierColors[tier.color]}`}
            >
              <div className="text-center mb-3">
                <h4 className="font-bold text-lg">{tier.name}</h4>
                <p className="text-sm opacity-75">{tier.minPoints.toLocaleString()}+ pts</p>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span>{t('admin.loyalty.multiplier')}:</span>
                  <span className="font-bold">{tier.multiplier}x</span>
                </div>
                <div className="text-sm">
                  <span>{config.pointsPerDollar * tier.multiplier} pts/$</span>
                </div>
              </div>

              <div className="pt-3 border-t border-current/20">
                <p className="text-xs font-semibold mb-1">{t('admin.loyalty.perks')}:</p>
                <ul className="text-xs space-y-1">
                  {tier.perks.map((perk, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span>&#10003;</span>
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => setEditingTier(tier.name)}
                className="w-full mt-3 text-xs py-1 bg-white/50 rounded hover:bg-white/70"
              >
                {t('admin.loyalty.edit')}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Simulation */}
      <div className="bg-sky-50 rounded-xl border border-sky-200 p-6">
        <h3 className="font-semibold text-sky-900 mb-4">{t('admin.loyalty.simulation')}</h3>
        <div className="grid grid-cols-3 gap-6">
          <FormField label={t('admin.loyalty.purchaseAmount')}>
            <Input
              type="number"
              defaultValue={100}
              className="border-sky-300 bg-white"
            />
          </FormField>
          <FormField label={t('admin.loyalty.customerLevel')}>
            <select className="w-full h-9 px-3 rounded-lg border border-sky-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
              {config.tiers.map(tier => (
                <option key={tier.name} value={tier.name}>{tier.name}</option>
              ))}
            </select>
          </FormField>
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-sm text-sky-600">{t('admin.loyalty.pointsEarned')}</p>
            <p className="text-3xl font-bold text-sky-900">1,000</p>
            <p className="text-xs text-sky-600">{t('admin.loyalty.discountValue', { value: '10.00' })}</p>
          </div>
        </div>
      </div>

      {/* Edit Tier Modal */}
      <Modal
        isOpen={!!editingTier}
        onClose={() => setEditingTier(null)}
        title={t('admin.loyalty.editTier', { name: editingTier || '' })}
        footer={
          <Button variant="secondary" onClick={() => setEditingTier(null)}>
            {t('admin.loyalty.close')}
          </Button>
        }
      >
        <p className="text-slate-500">{t('admin.loyalty.featureInDevelopment')}</p>
      </Modal>
    </div>
  );
}
