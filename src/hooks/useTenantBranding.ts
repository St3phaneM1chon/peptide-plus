/**
 * Hook: useTenantBranding
 * Fetches the tenant branding (logo, colors, name) from the /api/tenant endpoint.
 * Used on the sign-in page and any page that needs tenant-specific branding.
 */

'use client';

import { useState, useEffect } from 'react';

interface TenantBranding {
  id: string;
  slug: string;
  name: string;
  branding: {
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    font: string;
  };
  plan: string;
  locale: string;
}

const DEFAULT_BRANDING: TenantBranding = {
  id: '',
  slug: 'biocycle',
  name: 'Attitudes VIP',
  branding: {
    logoUrl: '/images/suite-koraline.png',
    primaryColor: '#16a34a',
    secondaryColor: '#15803d',
    font: 'Inter',
  },
  plan: 'pro',
  locale: 'fr',
};

export function useTenantBranding() {
  const [tenant, setTenant] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBranding() {
      try {
        const response = await fetch('/api/tenant');
        if (response.ok) {
          const data = await response.json();
          setTenant(data);
        }
      } catch {
        // Use default branding on error
      } finally {
        setLoading(false);
      }
    }

    fetchBranding();
  }, []);

  return { tenant, loading };
}
