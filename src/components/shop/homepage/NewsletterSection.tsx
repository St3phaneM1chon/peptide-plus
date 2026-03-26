'use client';

import { useState, useCallback } from 'react';
import { MotionDiv } from '@/components/koraline';
import { GlassCard } from '@/components/koraline';
import type { NewsletterSection as NewsletterConfig } from '@/lib/homepage-sections';

interface Props {
  config: NewsletterConfig;
}

export default function NewsletterSection({ config }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'loading') return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/mailing-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        const data = await res.json().catch(() => null);
        setErrorMessage(data?.error || 'Something went wrong');
        setStatus('error');
      }
    } catch {
      setErrorMessage('Network error. Please try again.');
      setStatus('error');
    }
  }, [email, status]);

  return (
    <section className="py-16 md:py-24 bg-[var(--k-bg-base)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <MotionDiv animation="slideUp">
          <GlassCard hoverable={false}>
            <div className="p-8 md:p-12 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-[var(--k-text-primary)] mb-3">
                {config.title}
              </h2>
              {config.subtitle && (
                <p className="text-[var(--k-text-secondary)] mb-8 max-w-lg mx-auto">
                  {config.subtitle}
                </p>
              )}

              {status === 'success' ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <svg className="w-6 h-6 text-[var(--k-accent-emerald)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-[var(--k-accent-emerald)] font-medium">
                    Thank you for subscribing!
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <label htmlFor="newsletter-email" className="sr-only">Email address</label>
                  <input
                    id="newsletter-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="flex-1 px-4 py-3 rounded-xl text-sm text-[var(--k-text-primary)] placeholder:text-[var(--k-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--k-border-focus)] transition-colors"
                    style={{
                      background: 'var(--k-glass-regular)',
                      border: '1px solid var(--k-border-default)',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="px-6 py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'var(--k-gradient-primary)',
                      boxShadow: 'var(--k-glow-primary)',
                    }}
                  >
                    {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
                  </button>
                </form>
              )}

              {status === 'error' && errorMessage && (
                <p className="mt-3 text-sm text-[var(--k-accent-rose)]">{errorMessage}</p>
              )}
            </div>
          </GlassCard>
        </MotionDiv>
      </div>
    </section>
  );
}
