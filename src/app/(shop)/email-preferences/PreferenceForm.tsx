'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailPreferences {
  marketing: boolean;
  newsletter: boolean;
  weeklyDigest: boolean;
  priceDrops: boolean;
  stockAlerts: boolean;
  productReviews: boolean;
  birthdayOffers: boolean;
  loyaltyUpdates: boolean;
}

interface PreferenceFormProps {
  token: string;
  email: string;
  initialPreferences: EmailPreferences;
  hasAccount: boolean;
}

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function ToggleSwitch({
  enabled,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
        disabled
          ? 'bg-green-400 cursor-not-allowed opacity-75'
          : enabled
            ? 'bg-orange-500'
            : 'bg-neutral-200'
      }`}
      role="switch"
      aria-checked={disabled ? true : enabled}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          disabled || enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Preference Row
// ---------------------------------------------------------------------------

function PreferenceRow({
  title,
  description,
  enabled,
  onToggle,
  alwaysOn,
  alwaysOnNote,
  statusLabel,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  alwaysOn?: boolean;
  alwaysOnNote?: string;
  statusLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-neutral-900">{title}</h3>
          {alwaysOn && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {statusLabel}
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-500 mt-1">{description}</p>
        {alwaysOn && alwaysOnNote && (
          <p className="text-xs text-neutral-400 mt-1 italic">{alwaysOnNote}</p>
        )}
      </div>
      <div className="flex-shrink-0 pt-0.5">
        <ToggleSwitch enabled={enabled} onToggle={onToggle} disabled={alwaysOn} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Form
// ---------------------------------------------------------------------------

export default function PreferenceForm({
  token,
  email,
  initialPreferences,
  hasAccount,
}: PreferenceFormProps) {
  const { t } = useTranslations();
  const [preferences, setPreferences] = useState<EmailPreferences>(initialPreferences);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [showUnsubConfirm, setShowUnsubConfirm] = useState(false);

  const handleToggle = useCallback((field: keyof EmailPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
    setFeedback(null);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/email-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, preferences }),
      });

      if (res.ok) {
        setFeedback({ type: 'success', message: t('emailPreferences.saved') });
      } else {
        const data = await res.json().catch(() => ({}));
        setFeedback({
          type: 'error',
          message: data.error || t('emailPreferences.saveFailed'),
        });
      }
    } catch {
      setFeedback({ type: 'error', message: t('emailPreferences.saveFailed') });
    } finally {
      setIsSaving(false);
    }
  }, [token, preferences, t]);

  const handleUnsubscribeAll = useCallback(async () => {
    const allOff: EmailPreferences = {
      marketing: false,
      newsletter: false,
      weeklyDigest: false,
      priceDrops: false,
      stockAlerts: false,
      productReviews: false,
      birthdayOffers: false,
      loyaltyUpdates: false,
    };
    setPreferences(allOff);
    setShowUnsubConfirm(false);
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/email-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, preferences: allOff }),
      });

      if (res.ok) {
        setFeedback({ type: 'success', message: t('emailPreferences.unsubscribeAllDone') });
      } else {
        setFeedback({ type: 'error', message: t('emailPreferences.saveFailed') });
      }
    } catch {
      setFeedback({ type: 'error', message: t('emailPreferences.saveFailed') });
    } finally {
      setIsSaving(false);
    }
  }, [token, t]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {t('emailPreferences.title')}
              </h1>
              <p className="text-neutral-400 mt-1">
                {t('emailPreferences.subtitle')}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-neutral-400">
            {t('emailPreferences.managingFor')}{' '}
            <span className="text-orange-400 font-medium">{email}</span>
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Feedback */}
        {feedback && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              feedback.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <svg
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                feedback.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {feedback.type === 'success' ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              )}
            </svg>
            <p
              className={`text-sm ${
                feedback.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {feedback.message}
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          {/* Marketing Emails */}
          <div className="p-6 border-b border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-neutral-900">
                {t('emailPreferences.marketing')}
              </h2>
              <button
                type="button"
                onClick={() => setShowUnsubConfirm(true)}
                disabled={isSaving}
                className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
              >
                {t('emailPreferences.unsubscribeAll')}
              </button>
            </div>
            <div className="divide-y divide-neutral-100">
              <PreferenceRow
                title={t('emailPreferences.marketing')}
                description={t('emailPreferences.marketingDesc')}
                enabled={preferences.marketing}
                onToggle={() => handleToggle('marketing')}
                statusLabel={
                  preferences.marketing
                    ? t('emailPreferences.enabled')
                    : t('emailPreferences.disabled')
                }
              />
              <PreferenceRow
                title={t('emailPreferences.weeklyDigest')}
                description={t('emailPreferences.weeklyDigestDesc')}
                enabled={preferences.weeklyDigest}
                onToggle={() => handleToggle('weeklyDigest')}
                statusLabel={
                  preferences.weeklyDigest
                    ? t('emailPreferences.enabled')
                    : t('emailPreferences.disabled')
                }
              />
            </div>
          </div>

          {/* Newsletter */}
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900 mb-2">
              {t('emailPreferences.newsletter')}
            </h2>
            <div className="divide-y divide-neutral-100">
              <PreferenceRow
                title={t('emailPreferences.newsletter')}
                description={t('emailPreferences.newsletterDesc')}
                enabled={preferences.newsletter}
                onToggle={() => handleToggle('newsletter')}
                statusLabel={
                  preferences.newsletter
                    ? t('emailPreferences.enabled')
                    : t('emailPreferences.disabled')
                }
              />
            </div>
          </div>

          {/* Product Alerts */}
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900 mb-2">
              {t('emailPreferences.productAlerts')}
            </h2>
            <div className="divide-y divide-neutral-100">
              <PreferenceRow
                title={t('emailPreferences.priceDrops')}
                description={t('emailPreferences.priceDropsDesc')}
                enabled={preferences.priceDrops}
                onToggle={() => handleToggle('priceDrops')}
                statusLabel={
                  preferences.priceDrops
                    ? t('emailPreferences.enabled')
                    : t('emailPreferences.disabled')
                }
              />
              <PreferenceRow
                title={t('emailPreferences.stockAlerts')}
                description={t('emailPreferences.stockAlertsDesc')}
                enabled={preferences.stockAlerts}
                onToggle={() => handleToggle('stockAlerts')}
                statusLabel={
                  preferences.stockAlerts
                    ? t('emailPreferences.enabled')
                    : t('emailPreferences.disabled')
                }
              />
              <PreferenceRow
                title={t('emailPreferences.reviewReminders')}
                description={t('emailPreferences.reviewRemindersDesc')}
                enabled={preferences.productReviews}
                onToggle={() => handleToggle('productReviews')}
                statusLabel={
                  preferences.productReviews
                    ? t('emailPreferences.enabled')
                    : t('emailPreferences.disabled')
                }
              />
            </div>
          </div>

          {/* Rewards & Loyalty */}
          {hasAccount && (
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-900 mb-2">
                {t('emailPreferences.loyaltyUpdates')}
              </h2>
              <div className="divide-y divide-neutral-100">
                <PreferenceRow
                  title={t('emailPreferences.birthdayOffers')}
                  description={t('emailPreferences.birthdayOffersDesc')}
                  enabled={preferences.birthdayOffers}
                  onToggle={() => handleToggle('birthdayOffers')}
                  statusLabel={
                    preferences.birthdayOffers
                      ? t('emailPreferences.enabled')
                      : t('emailPreferences.disabled')
                  }
                />
                <PreferenceRow
                  title={t('emailPreferences.loyaltyUpdates')}
                  description={t('emailPreferences.loyaltyUpdatesDesc')}
                  enabled={preferences.loyaltyUpdates}
                  onToggle={() => handleToggle('loyaltyUpdates')}
                  statusLabel={
                    preferences.loyaltyUpdates
                      ? t('emailPreferences.enabled')
                      : t('emailPreferences.disabled')
                  }
                />
              </div>
            </div>
          )}

          {/* Order Updates - Always On */}
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900 mb-2">
              {t('emailPreferences.orderUpdates')}
            </h2>
            <div className="divide-y divide-neutral-100">
              <PreferenceRow
                title={t('emailPreferences.orderUpdates')}
                description={t('emailPreferences.orderUpdatesDesc')}
                enabled={true}
                onToggle={() => {}}
                alwaysOn
                alwaysOnNote={t('emailPreferences.orderUpdatesAlwaysOn')}
                statusLabel={t('emailPreferences.alwaysOn')}
              />
            </div>
          </div>

          {/* Account Security - Always On */}
          <div className="p-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-2">
              {t('emailPreferences.accountSecurity')}
            </h2>
            <div className="divide-y divide-neutral-100">
              <PreferenceRow
                title={t('emailPreferences.accountSecurity')}
                description={t('emailPreferences.accountSecurityDesc')}
                enabled={true}
                onToggle={() => {}}
                alwaysOn
                alwaysOnNote={t('emailPreferences.accountSecurityAlwaysOn')}
                statusLabel={t('emailPreferences.alwaysOn')}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('emailPreferences.saving')}
              </>
            ) : (
              t('emailPreferences.savePreferences')
            )}
          </button>
        </div>

        {/* Resubscribe note */}
        <p className="mt-4 text-center text-sm text-neutral-500">
          {t('emailPreferences.resubscribe')}
        </p>

        {/* Privacy Notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm text-blue-900">{t('emailPreferences.privacyNotice')}</p>
              <p className="text-xs text-blue-700 mt-2">{t('emailPreferences.caslNotice')}</p>
            </div>
          </div>
        </div>

        {/* Back to site link */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            {t('emailPreferences.backToSite')}
          </Link>
          <p className="mt-2 text-xs text-neutral-400">{t('emailPreferences.poweredBy')}</p>
        </div>
      </div>

      {/* Unsubscribe All Confirmation Modal */}
      {showUnsubConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-neutral-900">
                {t('emailPreferences.unsubscribeAll')}
              </h3>
            </div>
            <p className="text-sm text-neutral-600 mb-6">
              {t('emailPreferences.unsubscribeAllConfirm')}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowUnsubConfirm(false)}
                className="flex-1 py-2.5 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleUnsubscribeAll}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {t('emailPreferences.unsubscribeAll')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
