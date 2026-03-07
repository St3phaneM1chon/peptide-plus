'use client';

/**
 * ParametresClient - Global telephony configuration.
 */

import { useState, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { Settings, Save, Play, Clock, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { E911ValidationResult } from '@/lib/voip/e911';

const CODECS = ['opus', 'G.711', 'G.722', 'G.729'] as const;
const RECORDING_POLICIES = ['all', 'inbound', 'outbound', 'none'] as const;
const RINGTONE_PRESETS = ['default', 'classic', 'modern', 'soft', 'urgent'] as const;
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const TIMEZONES = [
  'America/Toronto',
  'America/Montreal',
  'America/Vancouver',
  'America/Winnipeg',
  'America/Edmonton',
  'America/Halifax',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/Paris',
  'Europe/London',
  'UTC',
] as const;

function parseJson<T>(val: string | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export default function ParametresClient({ settings: initial }: { settings: Record<string, string> }) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [validatingE911, setValidatingE911] = useState(false);

  // Derived state
  const codecs = parseJson<string[]>(settings['voip:codecs'], ['opus', 'G.711']);
  const recordingPolicy = settings['voip:recording_policy'] || 'all';
  const holdMusicUrl = settings['voip:hold_music_url'] || '';
  const ringtone = settings['voip:ringtone'] || 'default';
  const e911Enabled = settings['voip:e911_enabled'] === 'true';
  const e911Address = settings['voip:e911_address'] || '';
  const e911City = settings['voip:e911_city'] || '';
  const e911Province = settings['voip:e911_province'] || '';
  const e911PostalCode = settings['voip:e911_postal_code'] || '';
  const timezone = settings['voip:timezone'] || 'America/Toronto';
  const businessHours = parseJson<Record<string, { start: string; end: string }>>(
    settings['voip:business_hours'],
    Object.fromEntries(DAYS.map((d) => [d, { start: '09:00', end: '17:00' }]))
  );

  const updateSetting = useCallback((key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const saveSetting = async (key: string, value: string) => {
    setSaving(key);
    try {
      const res = await fetch('/api/admin/voip/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, module: 'voip' }),
      });
      if (!res.ok) {
        toast.error(t('common.error'));
        return;
      }
      toast.success(t('voip.admin.settings.saved'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(null);
    }
  };

  const saveSection = async (entries: { key: string; value: string }[]) => {
    setSaving('section');
    try {
      for (const entry of entries) {
        const res = await fetch('/api/admin/voip/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: entry.key, value: entry.value, module: 'voip' }),
        });
        if (!res.ok) {
          toast.error(t('common.error'));
          return;
        }
      }
      toast.success(t('voip.admin.settings.saved'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(null);
    }
  };

  const toggleCodec = (codec: string) => {
    const updated = codecs.includes(codec)
      ? codecs.filter((c) => c !== codec)
      : [...codecs, codec];
    updateSetting('voip:codecs', JSON.stringify(updated));
  };

  const updateBusinessHour = (day: string, field: 'start' | 'end', value: string) => {
    const updated = { ...businessHours, [day]: { ...businessHours[day], [field]: value } };
    updateSetting('voip:business_hours', JSON.stringify(updated));
  };

  /**
   * Validate the E911 address via the /api/admin/voip/e911 endpoint
   * which delegates to @/lib/voip/e911.validateE911Address().
   */
  const validateE911Address = async () => {
    if (!e911Address.trim()) {
      toast.error('E911 address is required');
      return;
    }
    setValidatingE911(true);
    try {
      const res = await fetch('/api/admin/voip/e911', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate',
          address: {
            firstName: 'BioCycle',
            lastName: 'Peptides',
            streetAddress: e911Address,
            city: e911City,
            stateProvince: e911Province,
            postalCode: e911PostalCode,
            countryCode: 'CA',
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Validation failed');
        return;
      }

      const { data } = (await res.json()) as { data: E911ValidationResult };

      if (data.valid) {
        toast.success('E911 address validated successfully');
        // Apply corrected address if provided by Telnyx
        if (data.correctedAddress) {
          updateSetting('voip:e911_address', data.correctedAddress.streetAddress);
          updateSetting('voip:e911_city', data.correctedAddress.city);
          updateSetting('voip:e911_province', data.correctedAddress.stateProvince);
          updateSetting('voip:e911_postal_code', data.correctedAddress.postalCode);
        }
      } else {
        toast.error(`E911 validation failed: ${data.errors.join(', ')}`);
      }
    } catch {
      toast.error('Failed to validate E911 address');
    } finally {
      setValidatingE911(false);
    }
  };

  const SectionCard = ({
    title,
    children,
    onSave,
  }: {
    title: string;
    children: React.ReactNode;
    onSave: () => void;
  }) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        <button
          onClick={onSave}
          disabled={saving !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-teal-600" />
          {t('voip.admin.settings.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('voip.admin.settings.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audio Codecs */}
        <SectionCard
          title={t('voip.admin.settings.codecs')}
          onSave={() => saveSetting('voip:codecs', JSON.stringify(codecs))}
        >
          <div className="space-y-3">
            {CODECS.map((codec) => (
              <label key={codec} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={codecs.includes(codec)}
                  onChange={() => toggleCodec(codec)}
                  className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">{codec}</span>
              </label>
            ))}
          </div>
        </SectionCard>

        {/* Recording Policy */}
        <SectionCard
          title={t('voip.admin.settings.recordingPolicy')}
          onSave={() => saveSetting('voip:recording_policy', recordingPolicy)}
        >
          <div className="space-y-3">
            {RECORDING_POLICIES.map((policy) => {
              const labels: Record<string, string> = {
                all: t('voip.admin.settings.recordAll'),
                inbound: t('voip.admin.settings.recordInbound'),
                outbound: t('voip.admin.settings.recordOutbound'),
                none: t('voip.admin.settings.recordNone'),
              };
              return (
                <label key={policy} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="recording_policy"
                    checked={recordingPolicy === policy}
                    onChange={() => updateSetting('voip:recording_policy', policy)}
                    className="w-4 h-4 border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{labels[policy]}</span>
                </label>
              );
            })}
          </div>
        </SectionCard>

        {/* Hold Music */}
        <SectionCard
          title={t('voip.admin.settings.holdMusic')}
          onSave={() => saveSetting('voip:hold_music_url', holdMusicUrl)}
        >
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('voip.admin.settings.holdMusicUrl')}
            </label>
            <div className="flex gap-2">
              <input
                value={holdMusicUrl}
                onChange={(e) => updateSetting('voip:hold_music_url', e.target.value)}
                placeholder="https://example.com/hold-music.mp3"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {holdMusicUrl && (
                <button
                  onClick={() => {
                    const audio = new Audio(holdMusicUrl);
                    audio.play().catch(() => toast.error('Cannot play audio'));
                    setTimeout(() => audio.pause(), 5000);
                  }}
                  className="flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Ringtone */}
        <SectionCard
          title={t('voip.admin.settings.ringtone')}
          onSave={() => saveSetting('voip:ringtone', ringtone)}
        >
          <select
            value={ringtone}
            onChange={(e) => updateSetting('voip:ringtone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {RINGTONE_PRESETS.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </SectionCard>

        {/* E911 */}
        <SectionCard
          title={t('voip.admin.settings.e911')}
          onSave={() =>
            saveSection([
              { key: 'voip:e911_enabled', value: String(e911Enabled) },
              { key: 'voip:e911_address', value: e911Address },
              { key: 'voip:e911_city', value: e911City },
              { key: 'voip:e911_province', value: e911Province },
              { key: 'voip:e911_postal_code', value: e911PostalCode },
            ])
          }
        >
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={e911Enabled}
                onChange={() => updateSetting('voip:e911_enabled', String(!e911Enabled))}
                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('voip.admin.settings.e911Enabled')}
              </span>
            </label>
            {e911Enabled && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <input
                  value={e911Address}
                  onChange={(e) => updateSetting('voip:e911_address', e.target.value)}
                  placeholder={t('voip.admin.settings.e911Address')}
                  className="col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  value={e911City}
                  onChange={(e) => updateSetting('voip:e911_city', e.target.value)}
                  placeholder="City"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  value={e911Province}
                  onChange={(e) => updateSetting('voip:e911_province', e.target.value)}
                  placeholder="Province"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  value={e911PostalCode}
                  onChange={(e) => updateSetting('voip:e911_postal_code', e.target.value)}
                  placeholder="Postal Code"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={validateE911Address}
                  disabled={validatingE911 || !e911Address.trim()}
                  className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {validatingE911 ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  {validatingE911 ? t('common.loading') : 'Validate E911 Address'}
                </button>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Timezone */}
        <SectionCard
          title={t('voip.admin.settings.timezone')}
          onSave={() => saveSetting('voip:timezone', timezone)}
        >
          <select
            value={timezone}
            onChange={(e) => updateSetting('voip:timezone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </SectionCard>
      </div>

      {/* Business Hours - Full width */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-600" />
            {t('voip.admin.settings.businessHours')}
          </h3>
          <button
            onClick={() => saveSetting('voip:business_hours', JSON.stringify(businessHours))}
            disabled={saving !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
        <div className="space-y-3">
          {DAYS.map((day) => (
            <div key={day} className="flex items-center gap-4">
              <span className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                {day}
              </span>
              <input
                type="time"
                value={businessHours[day]?.start || '09:00'}
                onChange={(e) => updateBusinessHour(day, 'start', e.target.value)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-gray-400">-</span>
              <input
                type="time"
                value={businessHours[day]?.end || '17:00'}
                onChange={(e) => updateBusinessHour(day, 'end', e.target.value)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
