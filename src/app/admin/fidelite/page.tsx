// TODO: F-052 - key={tier.name} may cause React warnings if two tiers share the same name; mitigated by F-014 name collision check
// TODO: F-062 - Simulation does not account for special bonuses (birthday, signup, review); add scenario options
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Loader2, Trash2, Trophy, Award, Flame, Target, Gift, Clock, Star, Zap } from 'lucide-react';
import { PageHeader, Button, Modal, FormField, Input } from '@/components/admin';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { BADGES, type Challenge } from '@/lib/loyalty/gamification';
import { POINTS_RULES, LOYALTY_TIERS } from '@/lib/loyalty/points-engine';
import { DEFAULT_EXPIRATION } from '@/lib/loyalty/expiration-manager';

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
  firstOrderBonus?: number;
  reviewBonus?: number;
  signupBonus?: number;
  tiers: LoyaltyTier[];
}

export default function FidelitePage() {
  const { t, locale } = useI18n();
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // FIX: FLAW-086 - TODO: Use tier index or stable ID instead of name for tier identification
  const [editingTier, setEditingTier] = useState<string | null>(null);

  // Tier edit form state
  const [tierFormName, setTierFormName] = useState('');
  const [tierFormMinPoints, setTierFormMinPoints] = useState(0);
  const [tierFormMultiplier, setTierFormMultiplier] = useState(1);
  const [tierFormPerks, setTierFormPerks] = useState('');
  const [tierFormColor, setTierFormColor] = useState('orange');

  // Simulation state
  const [simAmount, setSimAmount] = useState(100);
  const [simTier, setSimTier] = useState('');
  const [tierFormErrors, setTierFormErrors] = useState<Record<string, string>>({});

  // UX FIX: ConfirmDialog for tier delete action
  const [confirmDeleteTier, setConfirmDeleteTier] = useState<{
    isOpen: boolean;
    tierName: string;
    userCount: number;
  }>({ isOpen: false, tierName: '', userCount: 0 });

  // ─── Gamification: simulated active challenges ──────────────
  const [activeChallenges] = useState<Challenge[]>([
    { id: 'ch-spring', name: 'Spring Sprint', nameFr: 'Sprint du printemps', description: 'Place 3 orders this month', type: 'orders', target: 3, pointsReward: 300, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), isActive: true },
    { id: 'ch-review', name: 'Review Master', nameFr: 'Maître des avis', description: 'Write 5 product reviews', type: 'reviews', target: 5, pointsReward: 250, startDate: new Date(), endDate: new Date(Date.now() + 60 * 86400000), isActive: true },
    { id: 'ch-refer', name: 'Friend Finder', nameFr: 'Trouveur d\'amis', description: 'Refer 2 friends', type: 'referrals', target: 2, pointsReward: 400, startDate: new Date(), endDate: new Date(Date.now() + 45 * 86400000), isActive: false },
  ]);

  // ─── Reward catalog ─────────────────────────────────────────
  const [rewardCatalog] = useState([
    { id: 'r1', name: 'Réduction 5$', cost: 500, type: 'discount' as const },
    { id: 'r2', name: 'Réduction 10$', cost: 900, type: 'discount' as const },
    { id: 'r3', name: 'Livraison gratuite', cost: 300, type: 'freeShipping' as const },
    { id: 'r4', name: 'Échantillon gratuit', cost: 200, type: 'freeProduct' as const },
    { id: 'r5', name: 'Accès vente privée', cost: 1500, type: 'exclusive' as const },
    { id: 'r6', name: 'Réduction 25$', cost: 2000, type: 'discount' as const },
  ]);

  // ─── Expiration summary (simulated) ─────────────────────────
  const [expirationSummary] = useState({
    expiring7: 1250,
    expiring30: 4800,
    expiring90: 12400,
  });

  // FIX: FLAW-055 - Wrap fetchConfig in useCallback for stable reference
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/loyalty/config');
      if (!res.ok) {
        toast.error(t('common.error'));
        setConfig(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setConfig(data.config || null);
    } catch (err) {
      console.error('Error fetching loyalty config:', err);
      toast.error(t('common.error'));
      setConfig(null);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/loyalty/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success(t('admin.loyalty.configSaved'));
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.loyalty.configSaveError') || 'Error saving configuration');
      }
    } catch (err) {
      console.error('Error saving config:', err);
      toast.error(t('admin.loyalty.configSaveError') || 'Error saving configuration');
    }
    setSaving(false);
  };

  // ─── Tier editing helpers ────────────────────────────────────

  const openEditTier = (tierName: string) => {
    if (!config) return;
    const tier = config.tiers.find((t) => t.name === tierName);
    if (!tier) return;
    setTierFormName(tier.name);
    setTierFormMinPoints(tier.minPoints);
    setTierFormMultiplier(tier.multiplier);
    setTierFormPerks(tier.perks.join('\n'));
    setTierFormColor(tier.color);
    setEditingTier(tierName);
  };

  const closeEditTier = () => {
    setEditingTier(null);
  };

  const saveTier = () => {
    if (!config || !editingTier) return;
    // UX FIX: Validate tier form fields with inline error messages
    const errors: Record<string, string> = {};
    if (!tierFormName.trim()) {
      errors.name = t('admin.loyalty.tierNameRequired') || 'Tier name is required';
    }
    if (tierFormMultiplier < 0.1 || tierFormMultiplier > 10) {
      errors.multiplier = t('admin.loyalty.multiplierRange') || 'Multiplier must be between 0.1 and 10';
    }
    setTierFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const newName = tierFormName.trim() || editingTier;
    // FIX F-014: Prevent tier name collisions by checking uniqueness
    const nameConflict = config.tiers.some((tier) => tier.name !== editingTier && tier.name === newName);
    if (nameConflict) {
      setTierFormErrors({ name: t('admin.loyalty.tierNameExists') || 'A tier with this name already exists' });
      return;
    }
    const updatedTiers = config.tiers.map((tier) => {
      if (tier.name === editingTier) {
        return {
          name: newName,
          minPoints: tierFormMinPoints,
          multiplier: tierFormMultiplier,
          perks: tierFormPerks.split('\n').map((p) => p.trim()).filter(Boolean),
          color: tierFormColor,
        };
      }
      return tier;
    });
    setConfig({ ...config, tiers: updatedTiers });
    toast.info(t('admin.loyalty.tierUpdatedClickSave') || 'Tier updated locally - click Save to persist changes');
    setEditingTier(null);
  };

  const addNewTier = () => {
    if (!config) return;
    const maxPoints = Math.max(...config.tiers.map((t) => t.minPoints), 0);
    const newTier: LoyaltyTier = {
      name: t('admin.loyalty.newTierName'),
      minPoints: maxPoints + 10000,
      multiplier: 1,
      perks: [],
      color: 'orange',
    };
    setConfig({ ...config, tiers: [...config.tiers, newTier] });
    toast.success(t('admin.loyalty.addTierSuccess'));
    // Immediately open editor for the new tier
    setTierFormName(newTier.name);
    setTierFormMinPoints(newTier.minPoints);
    setTierFormMultiplier(newTier.multiplier);
    setTierFormPerks('');
    setTierFormColor(newTier.color);
    setEditingTier(newTier.name);
  };

  // UX FIX: Actual tier delete execution (called after confirmation)
  const executeDeleteTier = (tierName: string) => {
    if (!config) return;
    setConfig({
      ...config,
      tiers: config.tiers.filter((t) => t.name !== tierName),
    });
    if (editingTier === tierName) setEditingTier(null);
    toast.success(t('admin.loyalty.tierDeleted'));
  };

  // FIX F-027: Check if users exist in the tier before allowing deletion
  // UX FIX: Replaced native confirm() with ConfirmDialog
  const deleteTier = async (tierName: string) => {
    if (!config) return;
    let userCount = 0;
    // Check server-side if users are in this tier
    try {
      const res = await fetch(`/api/admin/users?loyaltyTier=${encodeURIComponent(tierName)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        userCount = data.total || data.users?.length || 0;
      }
    } catch {
      // If check fails, still allow with standard confirmation
    }
    setConfirmDeleteTier({
      isOpen: true,
      tierName,
      userCount,
    });
  };

  // ─── Simulation computed values ────────────────────────────

  const simResult = useMemo(() => {
    if (!config) return { points: 0, discount: '0.00' };
    const selectedTier = config.tiers.find((t) => t.name === simTier) || config.tiers[0];
    if (!selectedTier) return { points: 0, discount: '0.00' };
    const points = Math.round(simAmount * config.pointsPerDollar * selectedTier.multiplier);
    const discount = (points * config.pointsValue).toFixed(2);
    return { points, discount };
  }, [config, simAmount, simTier]);

  // FIX: F-051 - Corrected orange color mapping (was using sky instead of orange)
  const tierColors: Record<string, string> = {
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    gray: 'bg-slate-200 text-slate-700 border-slate-400',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-400',
    blue: 'bg-blue-100 text-blue-800 border-blue-400',
    purple: 'bg-purple-100 text-purple-800 border-purple-400',
  };

  // ─── Ribbon action handlers ────────────────────────────────
  const handleRibbonNewTier = useCallback(() => {
    addNewTier();
  }, [config]);

  const handleRibbonDelete = useCallback(() => {
    if (!config || config.tiers.length === 0) {
      toast.info(t('admin.loyalty.noTiersToDelete') || 'No tiers to delete');
      return;
    }
    // Open the last tier's editor so user can delete from there
    const lastTier = config.tiers[config.tiers.length - 1];
    openEditTier(lastTier.name);
  }, [config, t]);

  const handleRibbonAdjustPoints = useCallback(() => {
    // Scroll to the simulation section where users can simulate point adjustments
    const simSection = document.querySelector('.bg-sky-50');
    if (simSection) {
      simSection.scrollIntoView({ behavior: 'smooth' });
      toast.info(t('admin.loyalty.useSimulator') || 'Use the simulator below to calculate point adjustments');
    }
  }, [t]);

  const handleRibbonEarningRules = useCallback(() => {
    // Scroll to basic settings section
    const settingsSection = document.querySelector('.bg-white.rounded-xl');
    if (settingsSection) {
      settingsSection.scrollIntoView({ behavior: 'smooth' });
      toast.info(t('admin.loyalty.editEarningRules') || 'Edit earning rules in Basic Settings above');
    }
  }, [t]);

  const handleRibbonExchangeHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/loyalty/history?limit=10');
      if (res.ok) {
        const data = await res.json();
        const count = data.total || data.history?.length || 0;
        toast.info(
          (t('admin.loyalty.exchangeHistoryCount') || '{count} point exchange(s) recorded')
            .replace('{count}', String(count))
        );
      } else {
        toast.info(t('admin.loyalty.noExchangeHistory') || 'No exchange history available yet');
      }
    } catch {
      toast.info(t('admin.loyalty.noExchangeHistory') || 'No exchange history available yet');
    }
  }, [t]);

  const handleRibbonMemberStats = useCallback(() => {
    if (!config) return;
    const tierSummary = config.tiers.map(tier => `${tier.name}: ${tier.multiplier}x`).join(', ');
    toast.info(
      `${config.tiers.length} ${t('admin.loyalty.loyaltyTiers') || 'tiers'} (${tierSummary})`
    );
  }, [config, t]);

  const handleRibbonExport = useCallback(() => {
    if (!config) return;
    const BOM = '\uFEFF';
    const headers = ['Tier Name', 'Min Points', 'Multiplier', 'Points per Dollar', 'Perks'];
    const rows = config.tiers.map(tier => [
      tier.name,
      String(tier.minPoints),
      String(tier.multiplier),
      String(config.pointsPerDollar * tier.multiplier),
      tier.perks.join('; '),
    ]);
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loyalty-config-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported') || 'Exported successfully');
  }, [config, t]);

  useRibbonAction('newTier', handleRibbonNewTier);
  useRibbonAction('delete', handleRibbonDelete);
  useRibbonAction('adjustPoints', handleRibbonAdjustPoints);
  useRibbonAction('earningRules', handleRibbonEarningRules);
  useRibbonAction('exchangeHistory', handleRibbonExchangeHistory);
  useRibbonAction('memberStats', handleRibbonMemberStats);
  useRibbonAction('export', handleRibbonExport);

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  // F44 FIX: Guard against empty tiers array - ensure at least one tier exists.
  // If a bug or DB corruption causes config.tiers to be empty, auto-add a default Bronze tier.
  if (!config.tiers || config.tiers.length === 0) {
    setConfig({
      ...config,
      tiers: [{
        name: 'Bronze',
        minPoints: 0,
        multiplier: 1,
        perks: [],
        color: 'orange',
      }],
    });
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
              onChange={(e) => setConfig({ ...config, pointsPerDollar: parseFloat(e.target.value) || 0 })}
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
            <Input
              type="number"
              value={config.firstOrderBonus ?? 100}
              onChange={(e) => setConfig({ ...config, firstOrderBonus: parseInt(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label={t('admin.loyalty.reviewBonus')} hint={t('admin.loyalty.perReview')}>
            <Input
              type="number"
              value={config.reviewBonus ?? 50}
              onChange={(e) => setConfig({ ...config, reviewBonus: parseInt(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label={t('admin.loyalty.signupBonus')} hint={t('admin.loyalty.welcomePoints')}>
            <Input
              type="number"
              value={config.signupBonus ?? 200}
              onChange={(e) => setConfig({ ...config, signupBonus: parseInt(e.target.value) || 0 })}
            />
          </FormField>
        </div>
      </div>

      {/* Tiers */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">{t('admin.loyalty.loyaltyTiers')}</h3>
          <Button variant="ghost" size="sm" icon={Plus} className="text-sky-600 hover:text-sky-700" onClick={addNewTier}>
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
                <p className="text-sm opacity-75">{tier.minPoints.toLocaleString(locale)}+ pts</p>
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
                onClick={() => openEditTier(tier.name)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <FormField label={t('admin.loyalty.purchaseAmount')}>
            <Input
              type="number"
              value={simAmount}
              onChange={(e) => setSimAmount(parseFloat(e.target.value) || 0)}
              className="border-sky-300 bg-white"
            />
          </FormField>
          <FormField label={t('admin.loyalty.customerLevel')}>
            <select
              value={simTier || config.tiers[0]?.name || ''}
              onChange={(e) => setSimTier(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-sky-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              {config.tiers.map(tier => (
                <option key={tier.name} value={tier.name}>{tier.name}</option>
              ))}
            </select>
          </FormField>
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-sm text-sky-600">{t('admin.loyalty.pointsEarned')}</p>
            <p className="text-3xl font-bold text-sky-900">{simResult.points.toLocaleString(locale)}</p>
            <p className="text-xs text-sky-600">{t('admin.loyalty.discountValue', { value: simResult.discount })}</p>
          </div>
        </div>
      </div>

      {/* ─── Gamification Dashboard ──────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-slate-900">{t('admin.loyalty.gamificationTitle')}</h3>
        </div>
        <p className="text-sm text-slate-500 mb-5">{t('admin.loyalty.gamificationSubtitle')}</p>

        {/* Available Badges */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-purple-500" />
            {t('admin.loyalty.availableBadges')}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {BADGES.map((badge) => (
              <div key={badge.id} className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100 hover:border-amber-200 transition-colors">
                <span className="text-2xl">{badge.icon}</span>
                <p className="text-xs font-semibold text-slate-700 mt-1">{badge.nameFr}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{badge.requirement.type}: {badge.requirement.value}</p>
                <p className="text-[10px] font-medium text-amber-600 mt-1">+{badge.pointsReward} {t('admin.loyalty.pts')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Active Challenges */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
            <Target className="w-4 h-4 text-blue-500" />
            {t('admin.loyalty.activeChallenges')}
          </h4>
          <div className="space-y-2">
            {activeChallenges.map((ch) => (
              <div key={ch.id} className={`flex items-center justify-between rounded-lg border p-3 ${ch.isActive ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <Zap className={`w-4 h-4 ${ch.isActive ? 'text-green-600' : 'text-slate-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{ch.nameFr}</p>
                    <p className="text-xs text-slate-500">{t('admin.loyalty.challengeTarget')}: {ch.target} {ch.type} &middot; {t('admin.loyalty.challengeReward')}: +{ch.pointsReward} {t('admin.loyalty.pts')}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ch.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                  {ch.isActive ? t('admin.loyalty.challengeActive') : t('admin.loyalty.challengeInactive')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Streak Tracking */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-500" />
            {t('admin.loyalty.streakTracking')}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
              <p className="text-xs text-orange-600 font-medium">{t('admin.loyalty.currentStreak')}</p>
              <p className="text-3xl font-bold text-orange-700">12</p>
              <p className="text-xs text-orange-500">{t('admin.loyalty.days')}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
              <p className="text-xs text-slate-500 font-medium">{t('admin.loyalty.longestStreak')}</p>
              <p className="text-3xl font-bold text-slate-700">34</p>
              <p className="text-xs text-slate-500">{t('admin.loyalty.days')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Points Engine Config ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-5 h-5 text-sky-600" />
          <h3 className="font-semibold text-slate-900">{t('admin.loyalty.pointsRulesTitle')}</h3>
        </div>
        <p className="text-sm text-slate-500 mb-5">{t('admin.loyalty.pointsRulesSubtitle')}</p>

        {/* Point Rules Table */}
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-600">{t('admin.loyalty.action')}</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600">{t('admin.loyalty.pointsAwarded')}</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600">{t('admin.loyalty.dailyLimit')}</th>
              </tr>
            </thead>
            <tbody>
              {POINTS_RULES.map((rule) => (
                <tr key={rule.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 px-3">
                    <p className="font-medium text-slate-800">{rule.descriptionFr}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{rule.action}</p>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-sky-700">
                      {typeof rule.points === 'function' ? '1 pt/$' : `${rule.points} ${t('admin.loyalty.pts')}`}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {rule.maxPerDay ? `${rule.maxPerDay}/jour` : t('admin.loyalty.noLimit')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tier Levels */}
        <h4 className="text-sm font-semibold text-slate-700 mb-3">{t('admin.loyalty.tierLevels')}</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LOYALTY_TIERS.map((tier) => (
            <div key={tier.id} className="rounded-lg border-2 p-3 text-center" style={{ borderColor: tier.color, backgroundColor: `${tier.color}15` }}>
              <p className="text-xs font-bold text-slate-700">{tier.nameFr}</p>
              <p className="text-lg font-bold" style={{ color: tier.color }}>{tier.multiplier}x</p>
              <p className="text-[10px] text-slate-500">{tier.minPoints.toLocaleString(locale)}+ {t('admin.loyalty.pts')}</p>
              <div className="mt-2 text-[10px] text-slate-600">
                {tier.perks.slice(0, 2).map((perk, i) => (
                  <p key={i}>&#10003; {perk}</p>
                ))}
                {tier.perks.length > 2 && <p className="text-slate-400">+{tier.perks.length - 2} ...</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Reward Catalog ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-5 h-5 text-pink-500" />
          <h3 className="font-semibold text-slate-900">{t('admin.loyalty.rewardCatalog')}</h3>
        </div>
        <p className="text-sm text-slate-500 mb-5">{t('admin.loyalty.rewardCatalogSubtitle')}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {rewardCatalog.map((reward) => {
            const typeLabel = reward.type === 'discount' ? t('admin.loyalty.rewardDiscount')
              : reward.type === 'freeShipping' ? t('admin.loyalty.rewardFreeShipping')
              : reward.type === 'freeProduct' ? t('admin.loyalty.rewardFreeProduct')
              : t('admin.loyalty.rewardExclusive');
            const typeColor = reward.type === 'discount' ? 'bg-green-100 text-green-700'
              : reward.type === 'freeShipping' ? 'bg-blue-100 text-blue-700'
              : reward.type === 'freeProduct' ? 'bg-purple-100 text-purple-700'
              : 'bg-amber-100 text-amber-700';
            return (
              <div key={reward.id} className="bg-slate-50 rounded-lg border border-slate-100 p-4 flex flex-col items-center text-center hover:border-pink-200 transition-colors">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 ${typeColor}`}>{typeLabel}</span>
                <p className="text-sm font-semibold text-slate-800">{reward.name}</p>
                <p className="text-lg font-bold text-pink-600 mt-1">{reward.cost.toLocaleString(locale)} {t('admin.loyalty.pts')}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Points Expiration Widget ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-slate-900">{t('admin.loyalty.expirationTitle')}</h3>
        </div>
        <p className="text-sm text-slate-500 mb-5">{t('admin.loyalty.expirationSubtitle')}</p>

        {/* Config summary */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500">{t('admin.loyalty.expirationMonths')}</p>
            <p className="text-lg font-bold text-slate-800">{t('admin.loyalty.expirationMonthsValue').replace('{months}', String(DEFAULT_EXPIRATION.expirationMonths))}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500">{t('admin.loyalty.reminderSchedule')}</p>
            <div className="text-xs text-slate-700 mt-1">
              {DEFAULT_EXPIRATION.reminderDaysBefore.map((days) => (
                <span key={days} className="inline-block bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 text-[10px] font-medium mr-1 mb-0.5">
                  {t('admin.loyalty.reminderDays').replace('{days}', String(days))}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500">{t('admin.loyalty.gracePeriod')}</p>
            <p className="text-lg font-bold text-slate-800">{t('admin.loyalty.gracePeriodDays').replace('{days}', String(DEFAULT_EXPIRATION.graceperiodDays))}</p>
          </div>
        </div>

        {/* Expiring points summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-xs text-red-600 font-medium">{t('admin.loyalty.expiring7')}</p>
            <p className="text-2xl font-bold text-red-700">{expirationSummary.expiring7.toLocaleString(locale)}</p>
            <p className="text-[10px] text-red-500">{t('admin.loyalty.pts')}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-xs text-amber-600 font-medium">{t('admin.loyalty.expiring30')}</p>
            <p className="text-2xl font-bold text-amber-700">{expirationSummary.expiring30.toLocaleString(locale)}</p>
            <p className="text-[10px] text-amber-500">{t('admin.loyalty.pts')}</p>
          </div>
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-center">
            <p className="text-xs text-sky-600 font-medium">{t('admin.loyalty.expiring90')}</p>
            <p className="text-2xl font-bold text-sky-700">{expirationSummary.expiring90.toLocaleString(locale)}</p>
            <p className="text-[10px] text-sky-500">{t('admin.loyalty.pts')}</p>
          </div>
        </div>
      </div>

      {/* UX FIX: ConfirmDialog for tier delete action */}
      <ConfirmDialog
        isOpen={confirmDeleteTier.isOpen}
        title={t('admin.loyalty.confirmDeleteTierTitle') || 'Delete tier?'}
        message={
          confirmDeleteTier.userCount > 0
            ? (t('admin.loyalty.tierHasUsersMessage') || `This tier has ${confirmDeleteTier.userCount} user(s). They will be moved to the default tier. Are you sure you want to delete "${confirmDeleteTier.tierName}"?`)
            : (t('admin.loyalty.confirmDeleteTierMessage') || `Are you sure you want to delete the "${confirmDeleteTier.tierName}" tier? Remember to save the configuration after.`)
        }
        variant={confirmDeleteTier.userCount > 0 ? 'warning' : 'danger'}
        confirmLabel={t('admin.loyalty.deleteTier') || 'Delete Tier'}
        onConfirm={() => {
          executeDeleteTier(confirmDeleteTier.tierName);
          setConfirmDeleteTier({ isOpen: false, tierName: '', userCount: 0 });
        }}
        onCancel={() => setConfirmDeleteTier({ isOpen: false, tierName: '', userCount: 0 })}
      />

      {/* Edit Tier Modal */}
      <Modal
        isOpen={!!editingTier}
        onClose={closeEditTier}
        title={t('admin.loyalty.editTier', { name: editingTier || '' })}
        footer={
          <>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => { if (editingTier) deleteTier(editingTier); }}
              disabled={config.tiers.length <= 1}
            >
              {t('admin.loyalty.deleteTier')}
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={closeEditTier}>
              {t('admin.loyalty.cancel')}
            </Button>
            <Button variant="primary" onClick={saveTier}>
              {t('admin.loyalty.saveTier')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.loyalty.tierName')} required>
            <Input
              type="text"
              value={tierFormName}
              onChange={(e) => { setTierFormName(e.target.value); setTierFormErrors(prev => { const n = { ...prev }; delete n.name; return n; }); }}
            />
            {tierFormErrors.name && (
              <p className="mt-1 text-sm text-red-600" role="alert">{tierFormErrors.name}</p>
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.loyalty.tierMinPoints')} required>
              <Input
                type="number"
                min={0}
                value={tierFormMinPoints}
                onChange={(e) => setTierFormMinPoints(parseInt(e.target.value) || 0)}
              />
            </FormField>
            <FormField label={t('admin.loyalty.tierMultiplier')} required>
              <Input
                type="number"
                min={0.1}
                max={10}
                step={0.25}
                value={tierFormMultiplier}
                onChange={(e) => { setTierFormMultiplier(Math.min(10, parseFloat(e.target.value) || 1)); setTierFormErrors(prev => { const n = { ...prev }; delete n.multiplier; return n; }); }}
              />
              {tierFormErrors.multiplier && (
                <p className="mt-1 text-sm text-red-600" role="alert">{tierFormErrors.multiplier}</p>
              )}
            </FormField>
          </div>
          <FormField label={t('admin.loyalty.tierPerks')} hint={t('admin.loyalty.tierPerksHint')}>
            <textarea
              rows={4}
              value={tierFormPerks}
              onChange={(e) => setTierFormPerks(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 transition-shadow resize-y focus:outline-none focus:ring-2 focus:ring-sky-700 focus:border-sky-700"
            />
          </FormField>
          <FormField label={t('admin.loyalty.tierColor')}>
            <select
              value={tierFormColor}
              onChange={(e) => setTierFormColor(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-700 focus:border-sky-700"
            >
              {/* FIX: F-064/F-086 - Clarify that value is color key; label shows color + tier name */}
              <option value="orange">{t('admin.loyalty.colorOrange') || 'Orange (Bronze)'}</option>
              <option value="gray">{t('admin.loyalty.colorGray') || 'Gray (Silver)'}</option>
              <option value="yellow">{t('admin.loyalty.colorYellow') || 'Yellow (Gold)'}</option>
              <option value="blue">{t('admin.loyalty.colorBlue') || 'Blue (Platinum)'}</option>
              <option value="purple">{t('admin.loyalty.colorPurple') || 'Purple (Diamond)'}</option>
            </select>
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
