'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

interface WishlistContextType {
  /** Set of product IDs currently in the user's wishlist */
  wishlistProductIds: Set<string>;
  /** Map from productId to wishlist item id (for deletion) */
  wishlistItemMap: Map<string, string>;
  /** Whether the wishlist is currently loading */
  isLoading: boolean;
  /** Toggle a product in/out of the wishlist. Returns true if added, false if removed. */
  toggleWishlist: (productId: string) => Promise<boolean>;
  /** Check if a product is in the wishlist */
  isInWishlist: (productId: string) => boolean;
  /** Total number of items in the wishlist */
  count: number;
  /** Refresh the wishlist from the server */
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType>({
  wishlistProductIds: new Set(),
  wishlistItemMap: new Map(),
  isLoading: false,
  toggleWishlist: async () => false,
  isInWishlist: () => false,
  count: 0,
  refresh: async () => {},
});

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [wishlistProductIds, setWishlistProductIds] = useState<Set<string>>(new Set());
  const [wishlistItemMap, setWishlistItemMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch wishlist when user session is available
  const fetchWishlist = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/account/wishlist');
      if (res.ok) {
        const data = await res.json();
        const ids = new Set<string>();
        const itemMap = new Map<string, string>();

        for (const item of data.items || []) {
          ids.add(item.productId);
          itemMap.set(item.productId, item.id);
        }

        setWishlistProductIds(ids);
        setWishlistItemMap(itemMap);
      }
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchWishlist();
    } else if (status === 'unauthenticated') {
      setWishlistProductIds(new Set());
      setWishlistItemMap(new Map());
    }
  }, [status, fetchWishlist]);

  const isInWishlist = useCallback(
    (productId: string) => wishlistProductIds.has(productId),
    [wishlistProductIds]
  );

  const toggleWishlist = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!session?.user?.id) return false;

      const isCurrentlyInWishlist = wishlistProductIds.has(productId);

      if (isCurrentlyInWishlist) {
        // Remove from wishlist
        const wishlistItemId = wishlistItemMap.get(productId);
        if (!wishlistItemId) return false;

        // Optimistic update
        setWishlistProductIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        setWishlistItemMap((prev) => {
          const next = new Map(prev);
          next.delete(productId);
          return next;
        });

        try {
          const res = await fetch(`/api/account/wishlist/${wishlistItemId}`, {
            method: 'DELETE',
          });

          if (!res.ok) {
            // Revert optimistic update
            setWishlistProductIds((prev) => new Set(prev).add(productId));
            setWishlistItemMap((prev) => new Map(prev).set(productId, wishlistItemId));
            toast.error('Failed to update wishlist');
            return true; // Still in wishlist
          }

          toast.info('Removed from wishlist');
          return false; // Removed
        } catch {
          // Revert optimistic update
          setWishlistProductIds((prev) => new Set(prev).add(productId));
          setWishlistItemMap((prev) => new Map(prev).set(productId, wishlistItemId));
          toast.error('Failed to update wishlist');
          return true;
        }
      } else {
        // Add to wishlist

        // Optimistic update
        setWishlistProductIds((prev) => new Set(prev).add(productId));

        try {
          const res = await fetch('/api/account/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
          });

          if (res.ok || res.status === 201) {
            const data = await res.json();
            setWishlistItemMap((prev) => new Map(prev).set(productId, data.id));
            toast.success('Added to wishlist');
            return true; // Added
          }

          // Revert optimistic update
          setWishlistProductIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
          toast.error('Failed to update wishlist');
          return false;
        } catch {
          // Revert optimistic update
          setWishlistProductIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
          toast.error('Failed to update wishlist');
          return false;
        }
      }
    },
    [session?.user?.id, wishlistProductIds, wishlistItemMap]
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlistProductIds,
        wishlistItemMap,
        isLoading,
        toggleWishlist,
        isInWishlist,
        count: wishlistProductIds.size,
        refresh: fetchWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
