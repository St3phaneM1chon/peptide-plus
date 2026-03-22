'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/client';

interface CartItem {
  productId: string;
  optionId?: string;
  name: string;
  optionName?: string;
  price: number;
  comparePrice?: number;
  quantity: number;
  image?: string;
  sku?: string;
  maxQuantity?: number;
  productType?: string;
  /** Weight of one unit in grams (from ProductOption.weightGrams). Used for weight-based shipping. */
  weightGrams?: number;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  isOpen: boolean;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string, optionId?: string) => void;
  updateQuantity: (productId: string, optionId: string | undefined, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string, optionId?: string) => boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'biocycle-cart';
const CART_TTL_MS = 86400000; // 24 hours in milliseconds

interface StoredCart {
  items: CartItem[];
  updatedAt: number;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const { t } = useI18n();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // G1: Sync cart to DB for authenticated users (debounced)
  useEffect(() => {
    if (!isLoaded || !session?.user?.id || items.length === 0) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).catch(() => { /* Cart sync is best-effort */ });
    }, 2000);
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [items, isLoaded, session?.user?.id]);

  // G1: Load cart from DB on login (merge with localStorage)
  useEffect(() => {
    if (!session?.user?.id || !isLoaded) return;
    fetch('/api/cart/sync')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
          setItems(prev => {
            // Merge: DB items that aren't already in local cart
            const localIds = new Set(prev.map(i => `${i.productId}:${i.optionId || ''}`));
            const newItems = data.items.filter(
              (i: CartItem) => !localIds.has(`${i.productId}:${i.optionId || ''}`)
            );
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }
      })
      .catch(() => { /* DB cart load is best-effort */ });
  }, [session?.user?.id, isLoaded]);

  // Load cart from localStorage with TTL check
  useEffect(() => {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);

        // Handle legacy format (plain array without timestamp)
        if (Array.isArray(parsed)) {
          // Migrate legacy cart: treat as fresh
          setItems(parsed);
        } else {
          const { items: storedItems, updatedAt } = parsed as StoredCart;
          const age = Date.now() - updatedAt;

          if (age > CART_TTL_MS) {
            // Cart expired - clear it and notify user
            localStorage.removeItem(CART_STORAGE_KEY);
            toast.info(t('cart.expiredMessage'));
          } else if (Array.isArray(storedItems)) {
            setItems(storedItems);
          }
        }
      } catch {
        console.error('Failed to parse cart from localStorage');
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save cart to localStorage with timestamp
  useEffect(() => {
    if (isLoaded) {
      const storedCart: StoredCart = {
        items,
        updatedAt: Date.now(),
      };
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(storedCart));
    }
  }, [items, isLoaded]);

  // Cross-tab sync (handles new { items, updatedAt } format)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            // Legacy format
            setItems(parsed);
          } else if (parsed && Array.isArray(parsed.items)) {
            setItems(parsed.items);
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const itemCount = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);

  const subtotal = useMemo(() => Math.round(items.reduce((total, item) => total + item.price * item.quantity, 0) * 100) / 100, [items]);

  // I-CART-7: Cart quantity limits
  const MAX_ITEM_QUANTITY = 10;
  const MAX_CART_ITEMS = 50;

  const addItem = useCallback((newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    let blocked = false;

    setItems((prevItems) => {
      // I-CART-7: Enforce max total items in cart
      const currentTotal = prevItems.reduce((sum, item) => sum + item.quantity, 0);
      const existingIndex = prevItems.findIndex(
        (item) => item.productId === newItem.productId && item.optionId === newItem.optionId
      );

      if (existingIndex >= 0) {
        const updated = [...prevItems];
        const maxQty = Math.min(newItem.maxQuantity || MAX_ITEM_QUANTITY, MAX_ITEM_QUANTITY);
        const desiredQty = updated[existingIndex].quantity + (newItem.quantity || 1);
        const cappedQty = Math.min(desiredQty, maxQty);

        // Check total cart limit
        const delta = cappedQty - updated[existingIndex].quantity;
        if (currentTotal + delta > MAX_CART_ITEMS) {
          blocked = true;
          return prevItems;
        }

        if (desiredQty > maxQty) {
          blocked = true; // will show max-per-item warning
        }

        updated[existingIndex] = { ...updated[existingIndex], quantity: cappedQty };
        return updated;
      }

      // I-CART-7: Enforce max distinct items in cart
      if (prevItems.length >= MAX_CART_ITEMS) {
        blocked = true;
        return prevItems;
      }

      const addQty = Math.min(newItem.quantity || 1, MAX_ITEM_QUANTITY);
      if (currentTotal + addQty > MAX_CART_ITEMS) {
        blocked = true;
        return prevItems;
      }

      return [...prevItems, { ...newItem, quantity: addQty }];
    });

    if (blocked) {
      toast.warning('Cart limit reached (max 10 per item, 50 total)');
    } else {
      toast.success(`${newItem.name} added to cart`);
    }
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((productId: string, optionId?: string) => {
    setItems((prevItems) =>
      prevItems.filter(
        (item) => !(item.productId === productId && item.optionId === optionId)
      )
    );
    toast.info('Removed from cart');
  }, []);

  const updateQuantity = useCallback((productId: string, optionId: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, optionId);
      return;
    }

    // I-CART-7: Enforce per-item max quantity
    const clampedQuantity = Math.min(quantity, MAX_ITEM_QUANTITY);

    setItems((prevItems) => {
      // I-CART-7: Enforce total cart limit
      const otherItemsTotal = prevItems
        .filter((item) => !(item.productId === productId && item.optionId === optionId))
        .reduce((sum, item) => sum + item.quantity, 0);

      const allowedQuantity = Math.min(clampedQuantity, MAX_CART_ITEMS - otherItemsTotal);
      if (allowedQuantity <= 0) {
        return prevItems; // Cannot increase — cart total limit reached
      }

      return prevItems.map((item) =>
        item.productId === productId && item.optionId === optionId
          ? { ...item, quantity: Math.min(allowedQuantity, item.maxQuantity || MAX_ITEM_QUANTITY) }
          : item
      );
    });

    if (clampedQuantity < quantity) {
      toast.warning(`Maximum ${MAX_ITEM_QUANTITY} per item`);
    }
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback((productId: string, optionId?: string) => {
    return items.some(
      (item) => item.productId === productId && item.optionId === optionId
    );
  }, [items]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((prev) => !prev), []);

  const value = useMemo(() => ({
    items,
    itemCount,
    subtotal,
    isOpen,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    isInCart,
    openCart,
    closeCart,
    toggleCart,
  }), [items, itemCount, subtotal, isOpen, addItem, removeItem, updateQuantity, clearCart, isInCart, openCart, closeCart, toggleCart]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
