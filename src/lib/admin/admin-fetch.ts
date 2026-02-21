/**
 * CENTRALIZED ADMIN FETCH WRAPPER
 * Automatically shows toast notifications for mutations (POST/PUT/PATCH/DELETE)
 * and handles error responses consistently across all admin pages.
 *
 * Usage:
 *   import { adminFetch } from '@/lib/admin/admin-fetch';
 *
 *   // GET (no toast by default)
 *   const { data } = await adminFetch<{ users: User[] }>('/api/admin/users');
 *
 *   // POST/PUT/DELETE (auto toast on error, optional success toast)
 *   const { data, ok } = await adminFetch('/api/admin/users/123', {
 *     method: 'DELETE',
 *     successMessage: 'User deleted',
 *   });
 */

import { toast } from 'sonner';

interface AdminFetchOptions extends RequestInit {
  /** Message to show on success (only shown for mutations if showSuccessToast is true) */
  successMessage?: string;
  /** Message to show on error (overrides server error message) */
  errorMessage?: string;
  /** Whether to show a toast on success. Defaults to true for non-GET mutations when successMessage is provided. */
  showSuccessToast?: boolean;
  /** Whether to show a toast on error. Defaults to true. */
  showErrorToast?: boolean;
}

interface AdminFetchResult<T> {
  data: T | null;
  error: string | null;
  ok: boolean;
}

export async function adminFetch<T = unknown>(
  url: string,
  options: AdminFetchOptions = {}
): Promise<AdminFetchResult<T>> {
  const {
    successMessage,
    errorMessage,
    showSuccessToast = !!(options.method && options.method !== 'GET' && successMessage),
    showErrorToast = true,
    ...fetchOptions
  } = options;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      ...fetchOptions,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg =
        errorMessage ||
        (errorData as Record<string, string>).error ||
        `Error ${response.status}`;
      if (showErrorToast) toast.error(msg);
      return { data: null, error: msg, ok: false };
    }

    const data = (await response.json()) as T;
    if (showSuccessToast && successMessage) toast.success(successMessage);
    return { data, error: null, ok: true };
  } catch (err) {
    const msg = errorMessage || 'Network error';
    if (showErrorToast) toast.error(msg);
    console.error(`[adminFetch] ${url}:`, err);
    return { data: null, error: msg, ok: false };
  }
}
