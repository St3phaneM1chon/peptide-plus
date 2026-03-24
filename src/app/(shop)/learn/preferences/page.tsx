'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Preferences {
  studyTime: 'morning' | 'afternoon' | 'evening';
  sessionDuration: 15 | 25 | 45 | 60;
  notifyEmail: boolean;
  notifyPush: boolean;
  notifySms: boolean;
  aureliaVoice: boolean;
  autoPlayNext: boolean;
  darkModeStudy: boolean;
  displayLanguage: string;
  consentProfiling: boolean;
  consentAnalytics: boolean;
  consentMarketing: boolean;
}

const defaultPrefs: Preferences = {
  studyTime: 'morning',
  sessionDuration: 25,
  notifyEmail: true,
  notifyPush: false,
  notifySms: false,
  aureliaVoice: true,
  autoPlayNext: true,
  darkModeStudy: false,
  displayLanguage: 'fr',
  consentProfiling: false,
  consentAnalytics: false,
  consentMarketing: false,
};

/* ------------------------------------------------------------------ */
/*  Toggle Component                                                    */
/* ------------------------------------------------------------------ */

function Toggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function StudyPreferencesPage() {
  const { t } = useTranslations();
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadingData, setDownloadingData] = useState(false);

  useEffect(() => {
    async function fetchPrefs() {
      try {
        const res = await fetch('/api/lms/preferences');
        if (res.ok) {
          const data = await res.json();
          setPrefs({ ...defaultPrefs, ...data });
        }
      } catch {
        // use defaults
      } finally {
        setLoading(false);
      }
    }
    fetchPrefs();
  }, []);

  const updatePref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/lms/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadData = async () => {
    setDownloadingData(true);
    try {
      const res = await fetch('/api/lms/data-export');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `learning-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch {
      // silent
    } finally {
      setDownloadingData(false);
    }
  };

  const handleDeleteData = async () => {
    setDeleting(true);
    try {
      await fetch('/api/lms/data-delete', { method: 'DELETE' });
      window.location.href = '/learn';
    } catch {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/learn/dashboard" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('learn.preferences.backToDashboard')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('learn.preferences.title')}</h1>
          <p className="text-gray-500 mt-1">{t('learn.preferences.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ---------------------------------------------------------- */}
        {/*  Study Schedule                                              */}
        {/* ---------------------------------------------------------- */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('learn.preferences.scheduleTitle')}</h2>
          <p className="text-sm text-gray-500 mb-5">{t('learn.preferences.scheduleDesc')}</p>

          {/* Preferred study time */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('learn.preferences.studyTimeLabel')}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['morning', 'afternoon', 'evening'] as const).map((time) => (
                <button
                  key={time}
                  onClick={() => updatePref('studyTime', time)}
                  className={`p-3 rounded-lg border text-center text-sm font-medium transition-colors ${
                    prefs.studyTime === time
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="block text-lg mb-1">
                    {time === 'morning' ? '\u2600\uFE0F' : time === 'afternoon' ? '\uD83C\uDF24\uFE0F' : '\uD83C\uDF19'}
                  </span>
                  {t(`lms.preferences.time_${time}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Session duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('learn.preferences.sessionDurationLabel')}
            </label>
            <div className="grid grid-cols-4 gap-3">
              {([15, 25, 45, 60] as const).map((mins) => (
                <button
                  key={mins}
                  onClick={() => updatePref('sessionDuration', mins)}
                  className={`p-3 rounded-lg border text-center text-sm font-medium transition-colors ${
                    prefs.sessionDuration === mins
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {mins} {t('learn.preferences.minutes')}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Notifications                                               */}
        {/* ---------------------------------------------------------- */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('learn.preferences.notificationsTitle')}</h2>
          <p className="text-sm text-gray-500 mb-5">{t('learn.preferences.notificationsDesc')}</p>

          <div className="space-y-4">
            {[
              { key: 'notifyEmail' as const, label: t('learn.preferences.notifyEmail'), desc: t('learn.preferences.notifyEmailDesc') },
              { key: 'notifyPush' as const, label: t('learn.preferences.notifyPush'), desc: t('learn.preferences.notifyPushDesc') },
              { key: 'notifySms' as const, label: t('learn.preferences.notifySms'), desc: t('learn.preferences.notifySmsDesc') },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <Toggle
                  enabled={prefs[item.key]}
                  onChange={(v) => updatePref(item.key, v)}
                  label={item.label}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Learning Experience                                         */}
        {/* ---------------------------------------------------------- */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('learn.preferences.experienceTitle')}</h2>
          <p className="text-sm text-gray-500 mb-5">{t('learn.preferences.experienceDesc')}</p>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('learn.preferences.aureliaVoice')}</p>
                <p className="text-xs text-gray-500">{t('learn.preferences.aureliaVoiceDesc')}</p>
              </div>
              <Toggle
                enabled={prefs.aureliaVoice}
                onChange={(v) => updatePref('aureliaVoice', v)}
                label={t('learn.preferences.aureliaVoice')}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('learn.preferences.autoPlay')}</p>
                <p className="text-xs text-gray-500">{t('learn.preferences.autoPlayDesc')}</p>
              </div>
              <Toggle
                enabled={prefs.autoPlayNext}
                onChange={(v) => updatePref('autoPlayNext', v)}
                label={t('learn.preferences.autoPlay')}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('learn.preferences.darkMode')}</p>
                <p className="text-xs text-gray-500">{t('learn.preferences.darkModeDesc')}</p>
              </div>
              <Toggle
                enabled={prefs.darkModeStudy}
                onChange={(v) => updatePref('darkModeStudy', v)}
                label={t('learn.preferences.darkMode')}
              />
            </div>
          </div>

          {/* Language */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('learn.preferences.languageLabel')}
            </label>
            <select
              value={prefs.displayLanguage}
              onChange={(e) => updatePref('displayLanguage', e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="fr">Francais</option>
              <option value="en">English</option>
              <option value="es">Espanol</option>
              <option value="de">Deutsch</option>
              <option value="pt">Portugues</option>
              <option value="ar">Arabic</option>
              <option value="zh">Chinese</option>
            </select>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Consent Management (Loi 25)                                 */}
        {/* ---------------------------------------------------------- */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('learn.preferences.consentTitle')}</h2>
          <p className="text-sm text-gray-500 mb-2">{t('learn.preferences.consentDesc')}</p>
          <p className="text-xs text-gray-400 mb-5">{t('learn.preferences.consentLegal')}</p>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('learn.preferences.consentProfiling')}</p>
                <p className="text-xs text-gray-500">{t('learn.preferences.consentProfilingDesc')}</p>
              </div>
              <Toggle
                enabled={prefs.consentProfiling}
                onChange={(v) => updatePref('consentProfiling', v)}
                label={t('learn.preferences.consentProfiling')}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('learn.preferences.consentAnalytics')}</p>
                <p className="text-xs text-gray-500">{t('learn.preferences.consentAnalyticsDesc')}</p>
              </div>
              <Toggle
                enabled={prefs.consentAnalytics}
                onChange={(v) => updatePref('consentAnalytics', v)}
                label={t('learn.preferences.consentAnalytics')}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('learn.preferences.consentMarketing')}</p>
                <p className="text-xs text-gray-500">{t('learn.preferences.consentMarketingDesc')}</p>
              </div>
              <Toggle
                enabled={prefs.consentMarketing}
                onChange={(v) => updatePref('consentMarketing', v)}
                label={t('learn.preferences.consentMarketing')}
              />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Data Rights (GDPR / Loi 25)                                 */}
        {/* ---------------------------------------------------------- */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('learn.preferences.dataRightsTitle')}</h2>
          <p className="text-sm text-gray-500 mb-5">{t('learn.preferences.dataRightsDesc')}</p>

          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={handleDownloadData}
              disabled={downloadingData}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {downloadingData ? t('learn.preferences.downloading') : t('learn.preferences.downloadData')}
            </button>
          </div>

          {/* Danger zone */}
          <div className="border-t border-red-100 pt-5">
            <h3 className="text-sm font-semibold text-red-600 mb-2">{t('learn.preferences.dangerZone')}</h3>
            <p className="text-xs text-gray-500 mb-3">{t('learn.preferences.dangerZoneDesc')}</p>

            {showDeleteConfirm ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 font-medium mb-3">{t('learn.preferences.deleteConfirmTitle')}</p>
                <p className="text-xs text-red-600 mb-4">{t('learn.preferences.deleteConfirmDesc')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteData}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? t('learn.preferences.deleting') : t('learn.preferences.confirmDelete')}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {t('learn.preferences.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t('learn.preferences.deleteMyData')}
              </button>
            )}
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Save Button                                                 */}
        {/* ---------------------------------------------------------- */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
          <div>
            {saved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {t('learn.preferences.saved')}
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? t('learn.preferences.saving') : t('learn.preferences.savePreferences')}
          </button>
        </div>
      </div>
    </div>
  );
}
