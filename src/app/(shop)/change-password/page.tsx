'use client';

/**
 * PAGE CHANGER MOT DE PASSE - BioCycle Peptides
 */

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/hooks/useTranslations';

export default function ChangePasswordPage() {
  const { status } = useSession();
  const router = useRouter();
  const { t } = useTranslations();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) errors.push(t('auth.passwordMinChars'));
    if (!/[A-Z]/.test(password)) errors.push(t('auth.passwordOneUppercase'));
    if (!/[a-z]/.test(password)) errors.push(t('auth.passwordOneLowercase'));
    if (!/[0-9]/.test(password)) errors.push(t('auth.passwordOneDigit'));
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push(t('auth.passwordSpecialChar'));
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    // Validation
    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: t('auth.passwordsNoMatch') });
      return;
    }

    const passwordErrors = validatePassword(formData.newPassword);
    if (passwordErrors.length > 0) {
      setMessage({ type: 'error', text: passwordErrors.join(', ') });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: t('auth.passwordChanged') });
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => router.push('/account/profile'), 2000);
      } else {
        setMessage({ type: 'error', text: data.error || t('auth.passwordChangeError') });
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('auth.errorOccurred') });
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (password: string): { level: number; label: string; color: string } => {
    const errors = validatePassword(password);
    const strength = 5 - errors.length;
    if (strength <= 1) return { level: 1, label: t('auth.passwordVeryWeak'), color: 'bg-red-500' };
    if (strength === 2) return { level: 2, label: t('auth.passwordWeak'), color: 'bg-orange-500' };
    if (strength === 3) return { level: 3, label: t('auth.passwordMedium'), color: 'bg-yellow-500' };
    if (strength === 4) return { level: 4, label: t('auth.passwordStrong'), color: 'bg-lime-500' };
    return { level: 5, label: t('auth.passwordVeryStrong'), color: 'bg-green-500' };
  };

  const strength = formData.newPassword ? passwordStrength(formData.newPassword) : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-md mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-orange-600">{t('auth.home')}</Link>
            <span className="mx-2">/</span>
            <Link href="/account/profile" className="hover:text-orange-600">{t('auth.myProfile')}</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{t('auth.changePassword')}</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">{t('auth.changePassword')}</h1>
        </div>

        {/* Messages */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('auth.accountSecurity')}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('auth.useStrongPassword')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('account.currentPassword')}
              </label>
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.current ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('account.newPassword')}
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.new ? '🙈' : '👁️'}
                </button>
              </div>
              
              {/* Password Strength */}
              {strength && (
                <div className="mt-3">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full ${
                          level <= strength.level ? strength.color : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    strength.level >= 4 ? 'text-green-600' : strength.level >= 3 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {t('auth.passwordStrengthLabel')}: {strength.label}
                  </p>
                </div>
              )}
              
              {/* Requirements */}
              <ul className="mt-3 text-xs text-gray-500 space-y-1">
                <li className={formData.newPassword.length >= 8 ? 'text-green-600' : ''}>
                  ✓ {t('auth.passwordMinChars')}
                </li>
                <li className={/[A-Z]/.test(formData.newPassword) ? 'text-green-600' : ''}>
                  ✓ {t('auth.passwordOneUppercase')}
                </li>
                <li className={/[a-z]/.test(formData.newPassword) ? 'text-green-600' : ''}>
                  ✓ {t('auth.passwordOneLowercase')}
                </li>
                <li className={/[0-9]/.test(formData.newPassword) ? 'text-green-600' : ''}>
                  ✓ {t('auth.passwordOneDigit')}
                </li>
                <li className={/[!@#$%^&*(),.?":{}|<>]/.test(formData.newPassword) ? 'text-green-600' : ''}>
                  ✓ {t('auth.passwordSpecialChar')}
                </li>
              </ul>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('account.confirmPassword')}
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 pr-12 ${
                    formData.confirmPassword && formData.confirmPassword !== formData.newPassword
                      ? 'border-red-300 bg-red-50'
                      : formData.confirmPassword && formData.confirmPassword === formData.newPassword
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.confirm ? '🙈' : '👁️'}
                </button>
              </div>
              {formData.confirmPassword && formData.confirmPassword !== formData.newPassword && (
                <p className="text-red-600 text-sm mt-1">{t('auth.passwordsNoMatch')}</p>
              )}
            </div>

            {/* Submit */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !formData.currentPassword || !formData.newPassword || formData.newPassword !== formData.confirmPassword}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
              >
                {loading ? t('auth.changingPassword') : t('auth.changePasswordBtn')}
              </button>
            </div>
          </form>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link href="/account/profile" className="text-orange-600 hover:text-orange-700 font-medium">
            ← {t('auth.backToProfile')}
          </Link>
        </div>
      </div>
    </div>
  );
}
