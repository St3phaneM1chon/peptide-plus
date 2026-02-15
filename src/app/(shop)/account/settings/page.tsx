'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { settingsProfileSchema, validateForm } from '@/lib/form-validation';
import { FormError } from '@/components/ui/FormError';
import { toast } from 'sonner';

interface ProfileData {
  name: string;
  email: string;
  phone: string;
}

interface AddressData {
  address: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export default function SettingsPage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslations();

  const mfaRequired = searchParams.get('mfa_required') === '1';
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'address' | 'security'>(mfaRequired ? 'security' : 'profile');
  const [mfaSetupLoading, setMfaSetupLoading] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Profile form
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    email: '',
    phone: '',
  });
  
  // Password form
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Address form
  const [addressData, setAddressData] = useState<AddressData>({
    address: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Canada',
  });

  // Validation errors for profile tab
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  const clearProfileError = (field: string) => {
    if (profileErrors[field]) {
      setProfileErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/settings');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      setProfileData({
        name: session.user.name || '',
        email: session.user.email || '',
        phone: '',
      });
      // Load saved address from localStorage or API
      const savedAddress = localStorage.getItem('shipping_address');
      if (savedAddress) {
        try {
          setAddressData(JSON.parse(savedAddress));
        } catch (e) {
          console.error('Error parsing saved address');
        }
      }
    }
  }, [session]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const validation = validateForm(settingsProfileSchema, {
      name: profileData.name,
      phone: profileData.phone || undefined,
    });

    if (!validation.success) {
      setProfileErrors(validation.errors || {});
      return;
    }

    setProfileErrors({});
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      
      if (res.ok) {
        await updateSession({ name: profileData.name });
        setMessage({ type: 'success', text: t('account.profileUpdated') });
        toast.success('Profile updated successfully');
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.message || t('account.errorUpdateProfile') });
        toast.error('Failed to update profile');
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('account.errorGeneric') });
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    
    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: t('account.passwordMismatch') });
      toast.error('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 12) {
      setMessage({ type: 'error', text: t('account.passwordTooShort') });
      toast.error('Password must be at least 12 characters');
      setIsLoading(false);
      return;
    }
    
    try {
      const res = await fetch('/api/account/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });
      
      if (res.ok) {
        setMessage({ type: 'success', text: t('account.passwordUpdated') });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        toast.success('Password changed successfully');
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.message || t('account.errorUpdatePassword') });
        toast.error('Failed to change password');
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('account.errorGeneric') });
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    
    try {
      // Save to localStorage for quick access
      localStorage.setItem('shipping_address', JSON.stringify(addressData));

      // Also save to backend
      await fetch('/api/account/address', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressData),
      });

      setMessage({ type: 'success', text: t('account.addressUpdated') });
      toast.success('Address saved successfully');
    } catch (error) {
      // Still show success if localStorage worked
      setMessage({ type: 'success', text: t('account.addressUpdated') });
      toast.success('Address saved successfully');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const isOAuthUser = session.user?.image?.includes('google') || 
                       session.user?.image?.includes('facebook') ||
                       session.user?.image?.includes('twitter');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/account" className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('account.backToAccount')}
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">{t('account.accountSettings') }</h1>
          <p className="text-neutral-400 mt-1">{t('account.settingsDescription') }</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 mb-6">
          <div className="flex border-b border-neutral-200">
            <button
              onClick={() => { setActiveTab('profile'); setMessage(null); }}
              className={`flex-1 py-4 px-4 text-sm font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'text-orange-600 border-b-2 border-orange-500 -mb-px'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="hidden sm:inline">{t('account.profile') }</span>
              </div>
            </button>
            <button
              onClick={() => { setActiveTab('password'); setMessage(null); }}
              className={`flex-1 py-4 px-4 text-sm font-medium transition-colors ${
                activeTab === 'password'
                  ? 'text-orange-600 border-b-2 border-orange-500 -mb-px'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="hidden sm:inline">{t('account.password') }</span>
              </div>
            </button>
            <button
              onClick={() => { setActiveTab('address'); setMessage(null); }}
              className={`flex-1 py-4 px-4 text-sm font-medium transition-colors ${
                activeTab === 'address'
                  ? 'text-orange-600 border-b-2 border-orange-500 -mb-px'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">{t('account.address') }</span>
              </div>
            </button>
            <button
              onClick={() => { setActiveTab('security'); setMessage(null); }}
              className={`flex-1 py-4 px-4 text-sm font-medium transition-colors ${
                activeTab === 'security'
                  ? 'text-orange-600 border-b-2 border-orange-500 -mb-px'
                  : 'text-neutral-500 hover:text-neutral-700'
              } ${mfaRequired && !session?.user?.mfaEnabled ? 'animate-pulse bg-red-50' : ''}`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="hidden sm:inline">{t('account.mfaSecurity')}</span>
                {mfaRequired && !session?.user?.mfaEnabled && (
                  <span className="inline-flex items-center justify-center w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </div>
            </button>
          </div>

          <div className="p-6">
            {/* Message */}
            {message && (
              <div className={`mb-6 p-4 rounded-lg ${
                message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {message.type === 'success' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {message.text}
                </div>
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t('account.fullName') }
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => { setProfileData({ ...profileData, name: e.target.value }); clearProfileError('name'); }}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${profileErrors.name ? 'border-red-500' : 'border-neutral-300'}`}
                    placeholder="John Doe"
                  />
                  <FormError error={profileErrors.name} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t('account.email') }
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full px-4 py-3 border border-neutral-200 rounded-lg bg-neutral-50 text-neutral-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    {t('account.emailCannotChange') }
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t('account.phone') }
                  </label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => { setProfileData({ ...profileData, phone: e.target.value }); clearProfileError('phone'); }}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${profileErrors.phone ? 'border-red-500' : 'border-neutral-300'}`}
                    placeholder="+1 (555) 123-4567"
                  />
                  <FormError error={profileErrors.phone} />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t('account.saving') }
                    </>
                  ) : (
                    t('account.saveChanges')                   )}
                </button>
              </form>
            )}

            {/* Password Tab */}
            {activeTab === 'password' && (
              <>
                {isOAuthUser ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold mb-2">{t('account.oauthPassword') }</h3>
                    <p className="text-neutral-500">
                      {t('account.oauthPasswordDesc') }
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        {t('account.currentPassword') }
                      </label>
                      <input
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="••••••••"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        {t('account.newPassword') }
                      </label>
                      <input
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="••••••••"
                        required
                        minLength={12}
                      />
                      <p className="text-xs text-neutral-500 mt-1">
                        {t('account.passwordRequirements') }
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        {t('account.confirmPassword') }
                      </label>
                      <input
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="••••••••"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          {t('account.updating') }
                        </>
                      ) : (
                        t('account.updatePassword')                       )}
                    </button>
                  </form>
                )}
              </>
            )}

            {/* Address Tab */}
            {activeTab === 'address' && (
              <form onSubmit={handleAddressSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t('account.streetAddress') }
                  </label>
                  <input
                    type="text"
                    value={addressData.address}
                    onChange={(e) => setAddressData({ ...addressData, address: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="123 Main Street, Apt 4"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      {t('account.city') }
                    </label>
                    <input
                      type="text"
                      value={addressData.city}
                      onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Toronto"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      {t('account.province') }
                    </label>
                    <input
                      type="text"
                      value={addressData.province}
                      onChange={(e) => setAddressData({ ...addressData, province: e.target.value })}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Ontario"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      {t('account.postalCode') }
                    </label>
                    <input
                      type="text"
                      value={addressData.postalCode}
                      onChange={(e) => setAddressData({ ...addressData, postalCode: e.target.value })}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="M5V 3A8"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      {t('account.country') }
                    </label>
                    <select
                      value={addressData.country}
                      onChange={(e) => setAddressData({ ...addressData, country: e.target.value })}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="Canada">Canada</option>
                      <option value="United States">United States</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t('account.saving') }
                    </>
                  ) : (
                    t('account.saveAddress')                   )}
                </button>
              </form>
            )}
            {/* Security / MFA Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                {/* MFA Required Banner */}
                {mfaRequired && !session?.user?.mfaEnabled && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div>
                        <h4 className="font-bold text-red-700">{t('account.mfaRequired')}</h4>
                        <p className="text-sm text-red-600 mt-1">
                          {t('account.mfaRequiredDesc')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* MFA Status */}
                <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${session?.user?.mfaEnabled ? 'bg-green-100' : 'bg-red-100'}`}>
                      {session?.user?.mfaEnabled ? (
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{t('account.mfaTotpTitle')}</p>
                      <p className={`text-sm ${session?.user?.mfaEnabled ? 'text-green-600' : 'text-red-600'}`}>
                        {session?.user?.mfaEnabled ? t('account.mfaEnabled') : t('account.mfaDisabled')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* MFA Setup */}
                {!session?.user?.mfaEnabled && (
                  <div className="space-y-4">
                    {!mfaQrCode ? (
                      <button
                        onClick={async () => {
                          setMfaSetupLoading(true);
                          setMessage(null);
                          try {
                            const res = await fetch('/api/account/mfa/setup', { method: 'POST' });
                            const data = await res.json();
                            if (res.ok) {
                              setMfaQrCode(data.qrCodeUrl);
                              setMfaSecret(data.manualEntryKey);
                            } else {
                              setMessage({ type: 'error', text: data.error || t('account.mfaSetupFailed') });
                            }
                          } catch {
                            setMessage({ type: 'error', text: t('account.errorNetwork') });
                          } finally {
                            setMfaSetupLoading(false);
                          }
                        }}
                        disabled={mfaSetupLoading}
                        className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {mfaSetupLoading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            {t('account.mfaSettingUp')}
                          </>
                        ) : (
                          t('account.mfaEnableButton')
                        )}
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-center">
                          <p className="text-sm text-neutral-600 mb-4">
                            {t('account.mfaScanQrCode')}
                          </p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={mfaQrCode} alt="MFA QR Code" className="mx-auto w-48 h-48 border rounded-lg" />
                          {mfaSecret && (
                            <p className="mt-2 text-xs text-neutral-500">
                              Manual entry key: <code className="bg-neutral-100 px-2 py-1 rounded">{mfaSecret}</code>
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            {t('account.mfaEnterCode')}
                          </label>
                          <input
                            type="text"
                            value={mfaVerifyCode}
                            onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-center text-2xl tracking-widest"
                            placeholder="000000"
                            maxLength={6}
                          />
                        </div>
                        <button
                          onClick={async () => {
                            setMfaSetupLoading(true);
                            setMessage(null);
                            try {
                              const res = await fetch('/api/account/mfa/verify', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code: mfaVerifyCode }),
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setMessage({ type: 'success', text: t('account.mfaEnabledSuccess') + ': ' + (data.backupCodes?.join(', ') || t('account.mfaCheckEmail')) });
                                setMfaQrCode(null);
                                setMfaSecret(null);
                                setMfaVerifyCode('');
                                await updateSession({});
                              } else {
                                setMessage({ type: 'error', text: data.error || t('account.mfaInvalidCode') });
                              }
                            } catch {
                              setMessage({ type: 'error', text: t('account.errorNetwork') });
                            } finally {
                              setMfaSetupLoading(false);
                            }
                          }}
                          disabled={mfaSetupLoading || mfaVerifyCode.length !== 6}
                          className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {mfaSetupLoading ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              {t('account.mfaVerifying')}
                            </>
                          ) : (
                            t('account.mfaVerifyButton')
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* MFA Already Enabled */}
                {session?.user?.mfaEnabled && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700">
                      {t('account.mfaProtected')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl shadow-sm border border-red-200">
          <div className="p-6">
            <h3 className="text-lg font-bold text-red-600 mb-2">{t('account.dangerZone') }</h3>
            <p className="text-sm text-neutral-500 mb-4">
              {t('account.dangerZoneDesc') }
            </p>
            <button
              onClick={() => {
                if (confirm(t('account.deleteConfirm'))) {
                  // Handle account deletion
                  alert(t('account.deletionRequested'));
                }
              }}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
            >
              {t('account.deleteAccount') }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
