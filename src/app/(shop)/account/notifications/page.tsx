'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface NotificationPreferences {
  orderUpdates: boolean;
  promotions: boolean;
  newsletter: boolean;
  weeklyDigest: boolean;
  priceDrops: boolean;
  stockAlerts: boolean;
  productReviews: boolean;
  birthdayOffers: boolean;
  loyaltyUpdates: boolean;
}

export default function NotificationPreferencesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    orderUpdates: true,
    promotions: true,
    newsletter: true,
    weeklyDigest: false,
    priceDrops: false,
    stockAlerts: true,
    productReviews: false,
    birthdayOffers: true,
    loyaltyUpdates: true,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/notifications');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchPreferences();
    }
  }, [session]);

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/account/notifications');
      if (res.ok) {
        const data = await res.json();
        setPreferences({
          orderUpdates: data.orderUpdates,
          promotions: data.promotions,
          newsletter: data.newsletter,
          weeklyDigest: data.weeklyDigest,
          priceDrops: data.priceDrops,
          stockAlerts: data.stockAlerts,
          productReviews: data.productReviews,
          birthdayOffers: data.birthdayOffers,
          loyaltyUpdates: data.loyaltyUpdates,
        });
      }
    } catch (error: unknown) {
      console.error('Error fetching preferences:', error);
      toast.error(t('toast.notifications.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (field: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/account/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (res.ok) {
        toast.success(t('toast.notifications.saved'));
      } else {
        toast.error(t('toast.notifications.saveFailed'));
      }
    } catch (error: unknown) {
      console.error('Error saving preferences:', error);
      toast.error(t('toast.error.generic'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnsubscribeAll = async () => {
    const newPreferences = {
      ...preferences,
      promotions: false,
      newsletter: false,
      weeklyDigest: false,
      priceDrops: false,
      productReviews: false,
    };
    setPreferences(newPreferences);

    setIsSaving(true);
    try {
      const res = await fetch('/api/account/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPreferences),
      });

      if (res.ok) {
        toast.success(t('toast.notifications.unsubscribed'));
      } else {
        toast.error(t('toast.notifications.unsubscribeFailed'));
      }
    } catch (error: unknown) {
      console.error('Error unsubscribing:', error);
      toast.error(t('toast.error.generic'));
    } finally {
      setIsSaving(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/account" className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Account
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t('account.notificationsPage.title')}</h1>
              <p className="text-neutral-400 mt-1">{t('account.notificationsPage.subtitle')}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          {/* Orders Section */}
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-bold mb-4">{t('account.notificationsPage.orderNotifications')}</h2>
            <NotificationToggle
              enabled={preferences.orderUpdates}
              onToggle={() => handleToggle('orderUpdates')}
              title={t('account.notificationLabels.orderUpdates')}
              description={t('account.notificationsPage.orderUpdatesDesc')}
            />
          </div>

          {/* Marketing Section */}
          <div className="p-6 border-b border-neutral-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{t('account.notificationsPage.marketingCommunications')}</h2>
              <button
                onClick={handleUnsubscribeAll}
                disabled={isSaving}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                {t('account.notificationsPage.unsubscribeAll')}
              </button>
            </div>
            <div className="space-y-4">
              <NotificationToggle
                enabled={preferences.promotions}
                onToggle={() => handleToggle('promotions')}
                title={t('account.notificationLabels.promotions')}
                description={t('account.notificationsPage.promotionsDesc')}
              />
              <NotificationToggle
                enabled={preferences.newsletter}
                onToggle={() => handleToggle('newsletter')}
                title={t('account.notificationLabels.newsletter')}
                description={t('account.notificationsPage.newsletterDesc')}
              />
              <NotificationToggle
                enabled={preferences.weeklyDigest}
                onToggle={() => handleToggle('weeklyDigest')}
                title={t('account.notificationLabels.weeklyDigest')}
                description={t('account.notificationsPage.weeklyDigestDesc')}
              />
            </div>
          </div>

          {/* Product Alerts Section */}
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-bold mb-4">{t('account.notificationsPage.productAlerts')}</h2>
            <div className="space-y-4">
              <NotificationToggle
                enabled={preferences.priceDrops}
                onToggle={() => handleToggle('priceDrops')}
                title={t('account.notificationLabels.priceDropAlerts')}
                description={t('account.notificationsPage.priceDropDesc')}
              />
              <NotificationToggle
                enabled={preferences.stockAlerts}
                onToggle={() => handleToggle('stockAlerts')}
                title={t('account.notificationLabels.backInStockAlerts')}
                description={t('account.notificationsPage.stockAlertDesc')}
              />
              <NotificationToggle
                enabled={preferences.productReviews}
                onToggle={() => handleToggle('productReviews')}
                title={t('account.notificationLabels.reviewReminders')}
                description={t('account.notificationsPage.reviewRemindersDesc')}
              />
            </div>
          </div>

          {/* Rewards Section */}
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4">{t('account.notificationsPage.rewardsAndLoyalty')}</h2>
            <div className="space-y-4">
              <NotificationToggle
                enabled={preferences.birthdayOffers}
                onToggle={() => handleToggle('birthdayOffers')}
                title={t('account.notificationLabels.birthdayOffers')}
                description={t('account.notificationsPage.birthdayDesc')}
              />
              <NotificationToggle
                enabled={preferences.loyaltyUpdates}
                onToggle={() => handleToggle('loyaltyUpdates')}
                title={t('account.notificationLabels.loyaltyUpdates')}
                description={t('account.notificationsPage.loyaltyDesc')}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {t('common.saving')}
              </>
            ) : (
              t('account.notificationsPage.savePreferences')
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-blue-900 font-medium">{t('account.notificationsPage.aboutPreferences')}</p>
              <p className="text-sm text-blue-700 mt-1">
                {t('account.notificationsPage.aboutPreferencesDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Toggle Switch Component
function NotificationToggle({
  enabled,
  onToggle,
  title,
  description,
}: {
  enabled: boolean;
  onToggle: () => void;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <h3 className="font-medium text-neutral-900">{title}</h3>
        <p className="text-sm text-neutral-500 mt-1">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
          enabled ? 'bg-orange-500' : 'bg-neutral-200'
        }`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
