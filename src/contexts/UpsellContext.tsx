'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useCart } from '@/contexts/CartContext';
import UpsellInterstitialModal from '@/components/shop/UpsellInterstitialModal';

interface CartItemParams {
  productId: string;
  formatId?: string;
  name: string;
  formatName?: string;
  price: number;
  comparePrice?: number;
  quantity?: number;
  image?: string;
  sku?: string;
  maxQuantity?: number;
}

interface UpsellContextType {
  addItemWithUpsell: (item: CartItemParams) => void;
}

const UpsellContext = createContext<UpsellContextType | undefined>(undefined);

const UPSELL_SESSION_KEY = 'biocycle-upsell-shown';

function getShownProducts(): Record<string, boolean> {
  try {
    const stored = sessionStorage.getItem(UPSELL_SESSION_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function markProductShown(productId: string) {
  try {
    const shown = getShownProducts();
    shown[productId] = true;
    sessionStorage.setItem(UPSELL_SESSION_KEY, JSON.stringify(shown));
  } catch {
    // ignore
  }
}

function hasSessionBeenShown(): boolean {
  try {
    return sessionStorage.getItem(UPSELL_SESSION_KEY + '-session') === 'true';
  } catch {
    return false;
  }
}

function markSessionShown() {
  try {
    sessionStorage.setItem(UPSELL_SESSION_KEY + '-session', 'true');
  } catch {
    // ignore
  }
}

export function UpsellProvider({ children }: { children: ReactNode }) {
  const { addItem } = useCart();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<CartItemParams | null>(null);

  const addItemWithUpsell = useCallback((item: CartItemParams) => {
    setPendingItem(item);
    setIsModalOpen(true);
  }, []);

  const handleDecline = useCallback(
    (item: CartItemParams) => {
      addItem(item);
      setIsModalOpen(false);
      setPendingItem(null);
      // Mark for display rules
      markProductShown(item.productId);
      markSessionShown();
    },
    [addItem]
  );

  const handleAcceptQuantity = useCallback(
    (item: CartItemParams, quantity: number) => {
      addItem({ ...item, quantity });
      setIsModalOpen(false);
      setPendingItem(null);
      markProductShown(item.productId);
      markSessionShown();
    },
    [addItem]
  );

  const handleAcceptSubscription = useCallback(
    async (item: CartItemParams, frequency: string, discountPercent: number) => {
      try {
        // Create the subscription
        await fetch('/api/account/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: item.productId,
            formatId: item.formatId,
            quantity: item.quantity || 1,
            frequency,
          }),
        });
      } catch (error) {
        console.error('Error creating subscription:', error);
      }

      // Add to cart with discounted price
      const discountedPrice = item.price * (1 - discountPercent / 100);
      addItem({ ...item, price: discountedPrice });

      setIsModalOpen(false);
      setPendingItem(null);
      markProductShown(item.productId);
      markSessionShown();
    },
    [addItem]
  );

  // Check display rules before showing modal - this is called by the modal itself
  // The modal fetches config and auto-declines if disabled

  return (
    <UpsellContext.Provider value={{ addItemWithUpsell }}>
      {children}
      <UpsellInterstitialModal
        isOpen={isModalOpen}
        onClose={() => {
          if (pendingItem) handleDecline(pendingItem);
        }}
        item={pendingItem}
        onAcceptQuantity={handleAcceptQuantity}
        onAcceptSubscription={handleAcceptSubscription}
        onDecline={handleDecline}
      />
    </UpsellContext.Provider>
  );
}

export function useUpsell() {
  const context = useContext(UpsellContext);
  if (!context) {
    throw new Error('useUpsell must be used within an UpsellProvider');
  }
  return context;
}
