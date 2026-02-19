/**
 * CART DRAWER COMPONENT
 * Panier style Shopify - Slide-in drawer
 * Uses the single CartContext from contexts/CartContext.tsx
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useI18n } from '@/i18n/client';
import { useCart } from '@/contexts/CartContext';

// Re-export CartProvider and useCart from the canonical source
export { CartProvider, useCart } from '@/contexts/CartContext';

// =====================================================
// CART ICON (pour le header)
// =====================================================

export function CartIcon() {
  const { itemCount, toggleCart } = useCart();
  const { t } = useI18n();

  return (
    <button
      onClick={toggleCart}
      className="header__icon cart-icon"
      aria-label={t('cart.openCart')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
        />
      </svg>
      {itemCount > 0 && <span className="cart-icon__count">{itemCount}</span>}
    </button>
  );
}

// =====================================================
// CART DRAWER
// =====================================================

export default function CartDrawer() {
  const { items, isOpen, subtotal, closeCart, updateQuantity, removeItem } = useCart();
  const { t, formatCurrency } = useI18n();

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeCart]);

  // Bloquer le scroll du body quand ouvert
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`cart-drawer__overlay ${isOpen ? 'open' : ''}`}
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className={`cart-drawer ${isOpen ? 'open' : ''}`} role="dialog" aria-modal="true">
        {/* Header */}
        <div className="cart-drawer__header">
          <h2 className="cart-drawer__title">{t('cart.titleWithCount', { count: items.length })}</h2>
          <button
            className="cart-drawer__close"
            onClick={closeCart}
            aria-label={t('cart.closeCart')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              width="20"
              height="20"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="cart-drawer__body">
          {items.length === 0 ? (
            <div className="cart-drawer__empty">
              <svg
                className="cart-drawer__empty-icon"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                />
              </svg>
              <p className="cart-drawer__empty-text">{t('cart.emptyTitle')}</p>
              <button className="btn btn-primary" onClick={closeCart}>
                {t('cart.continueShopping')}
              </button>
            </div>
          ) : (
            <div className="cart-items">
              {items.map((item) => (
                <CartItemRow
                  key={`${item.productId}-${item.formatId || 'default'}`}
                  item={item}
                  onUpdateQuantity={(qty) => updateQuantity(item.productId, item.formatId, qty)}
                  onRemove={() => removeItem(item.productId, item.formatId)}
                  t={t}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="cart-drawer__footer">
            <div className="cart-drawer__subtotal">
              <span className="cart-drawer__subtotal-label">{t('cart.subtotal')}</span>
              <span className="cart-drawer__subtotal-value">
                {formatCurrency(subtotal)}
              </span>
            </div>
            <p className="cart-drawer__note">
              {t('cart.taxesNote')}
            </p>
            <Link
              href="/checkout"
              className="cart-drawer__checkout"
              onClick={closeCart}
            >
              {t('cart.proceedToCheckout')}
            </Link>
            <button className="cart-drawer__continue" onClick={closeCart}>
              {t('cart.continueShopping')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// =====================================================
// CART ITEM ROW
// =====================================================

interface CartItemRowProps {
  item: {
    productId: string;
    formatId?: string;
    name: string;
    formatName?: string;
    price: number;
    quantity: number;
    image?: string;
  };
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatCurrency: (amount: number) => string;
}

function CartItemRow({ item, onUpdateQuantity, onRemove, t, formatCurrency }: CartItemRowProps) {
  return (
    <div className="cart-item">
      {/* Image */}
      <div className="cart-item__image">
        {item.image ? (
          <Image src={item.image} alt={item.name} width={80} height={80} className="object-cover" />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #E0E0E0 0%, #BDBDBD 100%)',
            }}
          />
        )}
      </div>

      {/* Details */}
      <div className="cart-item__details">
        <h4 className="cart-item__title">{item.name}</h4>
        {item.formatName && <p className="cart-item__variant">{item.formatName}</p>}
        <div className="cart-item__price-line">
          <span className="cart-item__price">{formatCurrency(item.price)}</span>
          <span className="cart-item__line-total">{formatCurrency(item.price * item.quantity)}</span>
        </div>

        <div className="cart-item__actions">
          {/* Quantity */}
          <div className="cart-item__quantity">
            <button
              onClick={() => onUpdateQuantity(item.quantity - 1)}
              aria-label={t('cart.decreaseQuantity')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                width="14"
                height="14"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            </button>
            <span>{item.quantity}</span>
            <button
              onClick={() => onUpdateQuantity(item.quantity + 1)}
              aria-label={t('cart.increaseQuantity')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                width="14"
                height="14"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </button>
          </div>

          {/* Remove */}
          <button className="cart-item__remove" onClick={onRemove}>
            {t('cart.remove')}
          </button>
        </div>
      </div>
    </div>
  );
}
