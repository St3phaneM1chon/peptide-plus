'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { data: session } = useSession();
  const { items, removeItem, updateQuantity, subtotal, itemCount } = useCart();
  const { formatPrice } = useCurrency();

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h2 className="text-lg font-bold">Your Cart ({itemCount})</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-neutral-500 mb-4">Your cart is empty</p>
              <button
                onClick={onClose}
                className="text-orange-600 font-medium hover:underline"
              >
                Continue shopping
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.formatId}`}
                  className="flex gap-4 bg-neutral-50 rounded-xl p-3"
                >
                  {/* Image */}
                  <div className="w-20 h-20 bg-white rounded-lg overflow-hidden flex-shrink-0 relative">
                    <Image
                      src={item.image || '/images/products/peptide-default.png'}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-neutral-900 truncate">
                      {item.name}
                    </h3>
                    {item.formatName && (
                      <p className="text-sm text-neutral-500">{item.formatName}</p>
                    )}
                    <p className="font-bold text-orange-600 mt-1">
                      {formatPrice(item.price)}
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-neutral-300 rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.productId, item.formatId, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.formatId, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId, item.formatId)}
                        className="text-red-500 text-sm hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-neutral-200 p-4 space-y-4">
            {/* Subtotal */}
            <div className="flex items-center justify-between">
              <span className="text-neutral-600">Subtotal</span>
              <span className="text-xl font-bold">{formatPrice(subtotal)}</span>
            </div>

            <p className="text-xs text-neutral-500">
              Shipping & taxes calculated at checkout
            </p>

            {/* Checkout Button */}
            <Link
              href={session ? '/checkout/cart' : '/auth/signin?callbackUrl=/checkout'}
              onClick={onClose}
              className="block w-full py-3 bg-orange-500 text-white font-semibold text-center rounded-lg hover:bg-orange-600 transition-colors"
            >
              Checkout
            </Link>

            {/* Continue Shopping */}
            <button
              onClick={onClose}
              className="block w-full py-3 border border-neutral-300 text-neutral-700 font-medium text-center rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Continue shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
