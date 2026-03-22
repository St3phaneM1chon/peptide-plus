'use client';

/**
 * useCartShare
 *
 * Handles generating a shareable cart link via POST /api/cart/share.
 * The link encodes cart items in a JWT token (7-day expiry, no DB needed).
 *
 * Usage:
 *   const { shareCart, sharing, shareUrl } = useCartShare();
 *   await shareCart(items);  // generates link and copies to clipboard
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface CartShareItem {
  productId: string;
  optionId?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface UseCartShareReturn {
  /** Trigger share link generation + clipboard copy */
  shareCart: (items: CartShareItem[]) => Promise<string | null>;
  /** Whether a share request is in progress */
  sharing: boolean;
  /** The most recently generated share URL (null if not yet generated) */
  shareUrl: string | null;
  /** Reset the stored shareUrl */
  clearShareUrl: () => void;
}

export function useCartShare(): UseCartShareReturn {
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const shareCart = useCallback(async (items: CartShareItem[]): Promise<string | null> => {
    if (items.length === 0) return null;

    setSharing(true);
    try {
      const response = await fetch('/api/cart/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            optionId: item.optionId ?? null,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image ?? null,
          })),
        }),
      });

      if (!response.ok) {
        toast.error('Failed to generate share link. Please try again.');
        return null;
      }

      const data = await response.json() as {
        success: boolean;
        token: string;
        shareUrl?: string;
      };

      if (!data.success || !data.token) {
        toast.error('Failed to generate share link. Please try again.');
        return null;
      }

      // Build the user-facing cart URL with ?share= param for the banner UX
      const baseUrl = window.location.origin;
      const cartUrl = `${baseUrl}/checkout?share=${encodeURIComponent(data.token)}`;

      setShareUrl(cartUrl);

      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(cartUrl);
        toast.success('Share link copied to clipboard!');
      } catch {
        // Clipboard API may not be available (non-secure context, etc.)
        toast.info(`Share link ready: ${cartUrl}`);
      }

      return cartUrl;
    } catch {
      toast.error('Failed to generate share link. Please try again.');
      return null;
    } finally {
      setSharing(false);
    }
  }, []);

  const clearShareUrl = useCallback(() => {
    setShareUrl(null);
  }, []);

  return { shareCart, sharing, shareUrl, clearShareUrl };
}
