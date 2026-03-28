'use client';

/**
 * TrialBanner — Shows trial status banner in admin panel for tenants on free trial.
 *
 * Color logic:
 *   - Green: > 3 days remaining
 *   - Yellow/amber: 1-3 days remaining
 *   - Red: last day or expired
 *   - Hidden: not trialing or has subscription
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TrialInfo {
  isTrialing: boolean;
  trialEndsAt: string | null;
  daysRemaining: number;
  expired: boolean;
}

export default function TrialBanner() {
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function fetchTrialStatus() {
      try {
        const res = await fetch('/api/platform/trial-status');
        if (res.ok) {
          const data = await res.json();
          setTrial(data);
        }
      } catch {
        // Silently ignore — banner just won't show
      }
    }
    fetchTrialStatus();
  }, []);

  // Don't render if not trialing, data not loaded, or dismissed (for green banners only)
  if (!trial || !trial.isTrialing) return null;

  const { daysRemaining, expired } = trial;

  // Determine urgency level
  let bgColor: string;
  let textColor: string;
  let borderColor: string;
  let icon: string;
  let message: string;

  if (expired) {
    bgColor = 'bg-red-50';
    textColor = 'text-red-800';
    borderColor = 'border-red-200';
    icon = '\u26A0'; // warning sign
    message = 'Votre essai gratuit est termine. Mettez a niveau pour continuer a utiliser toutes les fonctionnalites.';
  } else if (daysRemaining <= 1) {
    bgColor = 'bg-red-50';
    textColor = 'text-red-800';
    borderColor = 'border-red-200';
    icon = '\u26A0';
    message = `Dernier jour de votre essai gratuit! Mettez a niveau maintenant pour ne rien perdre.`;
  } else if (daysRemaining <= 3) {
    bgColor = 'bg-amber-50';
    textColor = 'text-amber-800';
    borderColor = 'border-amber-200';
    icon = '\u23F3'; // hourglass
    message = `${daysRemaining} jours restants dans votre essai gratuit.`;
  } else {
    // Can be dismissed when > 3 days
    if (dismissed) return null;
    bgColor = 'bg-green-50';
    textColor = 'text-green-800';
    borderColor = 'border-green-200';
    icon = '\u2713';
    message = `${daysRemaining} jours restants dans votre essai gratuit.`;
  }

  // Cannot dismiss when urgent (3 days or less, or expired)
  const canDismiss = !expired && daysRemaining > 3;

  return (
    <div
      className={`${bgColor} ${borderColor} border rounded-lg px-4 py-2.5 mb-4 flex items-center justify-between gap-3`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base flex-shrink-0" aria-hidden="true">{icon}</span>
        <p className={`text-sm font-medium ${textColor} truncate`}>
          {message}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/admin/abonnement"
          className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
            expired || daysRemaining <= 1
              ? 'bg-red-600 text-white hover:bg-red-700'
              : daysRemaining <= 3
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          Mettre a niveau
        </Link>
        {canDismiss && (
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600 p-0.5"
            aria-label="Fermer la banniere"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
