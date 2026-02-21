'use client';

import { useState } from 'react';
import { Mail, Check, AlertCircle } from 'lucide-react';
import { useI18n } from '@/i18n/client';

export default function MailingListSignup() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [consent, setConsent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) return;

    setStatus('loading');
    try {
      const res = await fetch('/api/mailing-list/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, consentMethod: 'website_form' }),
      });
      const data = await res.json();
      setStatus(data.success || data.message ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
        <p className="text-green-800 font-medium">{t('mailingList.confirmationSent')}</p>
        <p className="text-green-600 text-sm mt-1">{t('mailingList.checkInbox')}</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-5 h-5 text-sky-600" />
        <h3 className="font-semibold text-slate-900">{t('mailingList.title')}</h3>
      </div>
      <p className="text-sm text-slate-600 mb-4">{t('mailingList.description')}</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('mailingList.namePlaceholder')}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('mailingList.emailPlaceholder')}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
        />

        {/* CASL explicit consent checkbox */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            required
          />
          <span className="text-xs text-slate-600 leading-tight">
            {t('mailingList.consentText')}
          </span>
        </label>

        {status === 'error' && (
          <div className="flex items-center gap-1 text-red-600 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>{t('common.error')}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!consent || status === 'loading'}
          className="w-full py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'loading' ? t('common.loading') : t('mailingList.subscribe')}
        </button>
      </form>

      <p className="text-[10px] text-slate-400 mt-3 leading-tight">
        {t('mailingList.caslNotice')}
      </p>
    </div>
  );
}
