'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { toast } from 'sonner';

interface CartItem {
  productId: string;
  formatId?: string;
  name: string;
  formatName?: string;
  price: number;
  comparePrice?: number;
  quantity: number;
  image?: string;
  sku?: string;
  maxQuantity?: number;
  productType?: string;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  isOpen: boolean;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string, formatId?: string) => void;
  updateQuantity: (productId: string, formatId: string | undefined, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string, formatId?: string) => boolean;
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
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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
            toast.info('Your cart has expired after 24 hours of inactivity. Prices may have changed.');
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

  const subtotal = useMemo(() => items.reduce((total, item) => total + item.price * item.quantity, 0), [items]);

  const addItem = useCallback((newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (item) => item.productId === newItem.productId && item.formatId === newItem.formatId
      );

      if (existingIndex >= 0) {
        const updated = [...prevItems];
        const maxQty = newItem.maxQuantity || 99;
        updated[existingIndex].quantity = Math.min(
          updated[existingIndex].quantity + (newItem.quantity || 1),
          maxQty
        );
        return updated;
      }

      return [...prevItems, { ...newItem, quantity: newItem.quantity || 1 }];
    });
    toast.success(`${newItem.name} added to cart`);
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((productId: string, formatId?: string) => {
    setItems((prevItems) =>
      prevItems.filter(
        (item) => !(item.productId === productId && item.formatId === formatId)
      )
    );
    toast.info('Removed from cart');
  }, []);

  const updateQuantity = useCallback((productId: string, formatId: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, formatId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.productId === productId && item.formatId === formatId
          ? { ...item, quantity: Math.min(quantity, item.maxQuantity || 99) }
          : item
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback((productId: string, formatId?: string) => {
    return items.some(
      (item) => item.productId === productId && item.formatId === formatId
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
