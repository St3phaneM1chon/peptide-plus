'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string, formatId?: string) => void;
  updateQuantity: (productId: string, formatId: string | undefined, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string, formatId?: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'biocycle-cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch {
        console.error('Failed to parse cart from localStorage');
      }
    }
    setIsLoaded(true);
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, isLoaded]);

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);

  const addItem = (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (item) => item.productId === newItem.productId && item.formatId === newItem.formatId
      );

      if (existingIndex >= 0) {
        // Update quantity if item exists
        const updated = [...prevItems];
        const maxQty = newItem.maxQuantity || 99;
        updated[existingIndex].quantity = Math.min(
          updated[existingIndex].quantity + (newItem.quantity || 1),
          maxQty
        );
        return updated;
      }

      // Add new item
      return [...prevItems, { ...newItem, quantity: newItem.quantity || 1 }];
    });
    toast.success(`${newItem.name} added to cart`);
  };

  const removeItem = (productId: string, formatId?: string) => {
    setItems((prevItems) =>
      prevItems.filter(
        (item) => !(item.productId === productId && item.formatId === formatId)
      )
    );
    toast.info('Removed from cart');
  };

  const updateQuantity = (productId: string, formatId: string | undefined, quantity: number) => {
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
    toast.info('Quantity updated');
  };

  const clearCart = () => {
    setItems([]);
    toast.info('Cart cleared');
  };

  const isInCart = (productId: string, formatId?: string) => {
    return items.some(
      (item) => item.productId === productId && item.formatId === formatId
    );
  };

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isInCart,
      }}
    >
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
