'use client';

import { useState, useEffect } from 'react';

export function useCsrf() {
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    fetch('/api/csrf')
      .then(res => res.json())
      .then(data => setToken(data.token))
      .catch(console.error);
  }, []);

  // Helper to add CSRF header to fetch calls
  const csrfHeaders = () => ({
    'X-CSRF-Token': token,
  });

  return { token, csrfHeaders };
}
