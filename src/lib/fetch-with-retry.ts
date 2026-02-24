/**
 * Fetch wrapper with automatic retry for transient server errors.
 * Only retries on 5xx errors and network failures.
 * Does NOT retry on 4xx (client errors).
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 2,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Don't retry client errors (4xx)
      if (res.ok || res.status < 500) return res;
      // Server error - retry if attempts remain
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, baseDelay * (attempt + 1)));
        continue;
      }
      return res; // Return the error response on last attempt
    } catch (err) {
      console.error('[FetchWithRetry] Fetch attempt failed:', url, err);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, baseDelay * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}
