/**
 * CHECKOUT FORM COMPONENT
 * Formulaire de paiement multi-providers
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// Lazy initialization: only load Stripe SDK when first needed, not at module parse time
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
}

interface CheckoutFormProps {
  product: {
    id: string;
    name: string;
    price: number;
    slug: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
  };
  savedCards: {
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
  }[];
}

type PaymentMethodType = 'card' | 'saved-card' | 'apple-pay' | 'google-pay' | 'paypal';

export function CheckoutForm({ product, user: _user, savedCards }: CheckoutFormProps) {
  const { t } = useI18n();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(
    savedCards.length > 0 ? 'saved-card' : 'card'
  );
  const [selectedCardId, setSelectedCardId] = useState<string>(
    savedCards.find((c) => c.isDefault)?.id || savedCards[0]?.id || ''
  );
  const [clientSecret, setClientSecret] = useState<string>('');
  const [saveCard, setSaveCard] = useState(false);

  const createPaymentIntent = useCallback(async () => {
    try {
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          saveCard,
        }),
      });
      const data = await response.json();
      setClientSecret(data.clientSecret);
    } catch (error) {
      console.error('Error creating payment intent:', error);
    }
  }, [product.id, saveCard]);

  // Créer le PaymentIntent au chargement
  useEffect(() => {
    if (paymentMethod === 'card') {
      createPaymentIntent();
    }
  }, [paymentMethod, createPaymentIntent]);

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">
        {t('checkout.paymentMethod')}
      </h2>

      {/* Sélection du mode de paiement */}
      <div className="space-y-3 mb-6">
        {/* Express Checkout */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod('apple-pay')}
            className={`p-4 rounded-lg border-2 transition-all ${
              paymentMethod === 'apple-pay'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-center">
              <svg className="h-6" viewBox="0 0 50 20" fill="currentColor">
                <path d="M9.6 5.3c-.6.7-1.5 1.2-2.4 1.1-.1-.9.3-1.9.8-2.5.6-.7 1.5-1.1 2.3-1.2.1 1 -.3 1.9-.7 2.6zm.7 1.3c-1.3-.1-2.5.8-3.1.8s-1.6-.7-2.7-.7c-1.4 0-2.6.8-3.3 2-.1.2-.2.3-.2.5C0 12.8 2.3 19 4.7 19c.6 0 1.3-.4 2.2-.4.9 0 1.4.4 2.1.4 1.3 0 2.4-1.8 3.1-3.1.3-.6.5-1 .7-1.4-1.3-.6-2.2-1.9-2.2-3.4 0-1.6.9-3 2.4-3.6-.9-1.3-2.3-1.9-2.7-1.9z"/>
                <path d="M20.5 2.5h-4.2v16.2h2.7V13h1.5c2.9 0 5-2 5-5.3 0-3.2-2-5.2-5-5.2zm-1.5 8.2V4.9h1.5c1.7 0 2.7 1 2.7 2.9 0 1.9-1 2.9-2.7 2.9h-1.5zm11.2 8.1c1.7 0 3.2-.9 3.9-2.3h.1v2.2h2.5V9.9c0-2.5-2-4.1-5-4.1-2.8 0-4.9 1.6-5 3.9h2.4c.2-1.1 1.2-1.8 2.5-1.8 1.6 0 2.5.8 2.5 2.2v1l-3.3.2c-3.1.2-4.7 1.5-4.7 3.7 0 2.3 1.8 3.8 4.1 3.8zm.7-2c-1.4 0-2.3-.7-2.3-1.8 0-1.1.8-1.8 2.4-1.9l2.9-.2v1c0 1.7-1.4 2.9-3 2.9zm8.7 6.5c2.6 0 3.8-1 4.9-4L49 6h-2.7l-2.8 9.5h-.1L40.6 6h-2.8l4.4 12.2-.2.7c-.4 1.3-1.1 1.8-2.2 1.8-.2 0-.6 0-.8-.1v2c.2.1.7.1 1.1.1z"/>
              </svg>
            </div>
            <p className="text-xs text-center mt-1 text-gray-500">Apple Pay</p>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod('google-pay')}
            className={`p-4 rounded-lg border-2 transition-all ${
              paymentMethod === 'google-pay'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-center">
              <svg className="h-6" viewBox="0 0 41 17" fill="none">
                <path d="M19.1 8.3v5h-1.6V1.5h4.3c1 0 1.9.3 2.6 1 .7.7 1.1 1.5 1.1 2.5s-.4 1.8-1.1 2.5c-.7.7-1.6 1-2.6 1h-2.7V8.3zm0-5.2v3.6h2.8c.6 0 1.1-.2 1.5-.6.4-.4.6-.9.6-1.5 0-.5-.2-1-.6-1.4-.4-.4-.9-.6-1.5-.6h-2.8v.5z" fill="#5F6368"/>
                <path d="M30.2 5.4c1.2 0 2.2.3 2.9 1 .7.7 1.1 1.6 1.1 2.8v5.6h-1.5v-1.3h-.1c-.7 1.1-1.6 1.6-2.7 1.6-1 0-1.8-.3-2.5-.9-.6-.6-1-1.4-1-2.3 0-1 .4-1.8 1.1-2.3.7-.6 1.7-.8 2.9-.8.9 0 1.7.2 2.3.5v-.4c0-.6-.2-1.1-.7-1.5s-1-.6-1.6-.6c-.9 0-1.6.4-2.1 1.2l-1.4-.9c.8-1.1 1.9-1.7 3.3-1.7zm-2 6.7c0 .5.2.8.6 1.1.4.3.8.4 1.3.4.7 0 1.4-.3 1.9-.8s.8-1.1.8-1.8c-.5-.4-1.1-.6-2-.6-.6 0-1.2.2-1.6.5-.7.3-1 .7-1 1.2z" fill="#5F6368"/>
                <path d="M41 5.7l-5.3 12.1h-1.6l2-4.3-3.5-7.8h1.7l2.6 6.1h0l2.5-6.1H41z" fill="#5F6368"/>
                <path d="M13.3 7.4c0-.5 0-.9-.1-1.4H6.8v2.6h3.7c-.2.9-.7 1.7-1.4 2.2v1.8h2.3c1.3-1.2 2.1-3 2.1-5.2h-.2z" fill="#4285F4"/>
                <path d="M6.8 14.5c1.9 0 3.5-.6 4.6-1.7l-2.2-1.7c-.6.4-1.4.7-2.4.7-1.8 0-3.4-1.2-3.9-2.9H.5v1.8c1.2 2.3 3.5 3.8 6.3 3.8z" fill="#34A853"/>
                <path d="M2.9 8.9c-.3-.8-.3-1.7 0-2.5V4.6H.5c-1 1.9-1 4.2 0 6.1l2.4-1.8z" fill="#FBBC04"/>
                <path d="M6.8 3.5c1 0 2 .4 2.7 1.1l2-2c-1.3-1.2-2.9-1.9-4.7-1.9-2.8 0-5.1 1.5-6.3 3.8l2.4 1.8c.5-1.6 2.1-2.8 3.9-2.8z" fill="#EA4335"/>
              </svg>
            </div>
            <p className="text-xs text-center mt-1 text-gray-500">Google Pay</p>
          </button>
        </div>

        {/* PayPal */}
        <button
          type="button"
          onClick={() => setPaymentMethod('paypal')}
          className={`w-full p-4 rounded-lg border-2 transition-all ${
            paymentMethod === 'paypal'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-center">
            <svg className="h-5" viewBox="0 0 101 32" fill="none">
              <path d="M12.2 4.5h8.4c4.9 0 7.4 2.5 7.1 6.4-.4 5.4-4.5 8.4-9.2 8.4h-2.4c-.7 0-1.2.5-1.3 1.2l-1 6.5c0 .3-.3.6-.7.6H8.3c-.5 0-.8-.4-.7-.9l3.7-21.4c.1-.5.5-.8.9-.8z" fill="#003087"/>
              <path d="M38.8 4.3h5.6c3.1 0 5.3 1.2 5 4.3-.4 4.2-3.4 6.5-6.8 6.5h-2.8c-.5 0-.9.4-1 .9l-.8 5c0 .3-.3.5-.5.5h-3.3c-.4 0-.6-.3-.5-.7l2.9-15.8c.1-.4.4-.7.8-.7h1.4z" fill="#009CDE"/>
              <path d="M75.7 10.7c-.3 2-.6 3.4-.6 3.4-.3 1.6-1.3 2.5-2.9 2.5h-1.5c-.4 0-.7.3-.7.7l-.6 3.8c0 .2.1.4.4.4h2.7c.4 0 .7-.3.8-.6l.5-3c0-.2.3-.4.5-.4h.8c3.1 0 5.5-1.5 6.1-5 .5-2.5-.8-4-3.5-4h-5c-.4 0-.8.3-.8.7l-.6 3.6c0 .2.2.4.4.4h1.7c1.3 0 2.4.6 2.3 1.5z" fill="#003087"/>
              <path d="M85.5 7.2h5.6c3.1 0 5.3 1.2 5 4.3-.4 4.2-3.4 6.5-6.8 6.5h-2.8c-.5 0-.9.4-1 .9l-.8 5c0 .3-.3.5-.5.5h-3.3c-.4 0-.6-.3-.5-.7l2.9-15.8c.1-.4.4-.7.8-.7h1.4z" fill="#009CDE"/>
              <path d="M55.6 11h3.4c.3 0 .5.3.5.6l-.1.8c-.1.4-.4.7-.8.7h-3.4c-.8 0-1.5.6-1.6 1.4l-.3 2c-.1.4.2.8.6.8h3c.3 0 .5.3.5.6l-.1.8c-.1.4-.4.7-.8.7h-3.1c-.8 0-1.5.6-1.6 1.4l-.4 2.2c-.1.4.2.7.6.7h3.8c.3 0 .5.3.5.6l-.1.8c-.1.4-.4.7-.8.7h-6.6c-.4 0-.6-.3-.5-.7l2.2-12.3c.1-.4.4-.7.8-.7h4.3z" fill="#003087"/>
              <path d="M64.5 25.6h-3.3c-.3 0-.5-.3-.4-.6l2.6-14.7c.1-.3.3-.5.6-.5h3.3c.3 0 .5.3.4.6l-2.6 14.7c0 .3-.3.5-.6.5z" fill="#003087"/>
            </svg>
          </div>
        </button>

        {/* Cartes sauvegardées */}
        {savedCards.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setPaymentMethod('saved-card')}
              className={`w-full p-4 rounded-lg border-2 transition-all text-start ${
                paymentMethod === 'saved-card'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-gray-900">{t('checkout.savedCard')}</p>
              {paymentMethod === 'saved-card' && (
                <div className="mt-3 space-y-2">
                  {savedCards.map((card) => (
                    <label
                      key={card.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer ${
                        selectedCardId === card.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="savedCard"
                        value={card.id}
                        checked={selectedCardId === card.id}
                        onChange={() => setSelectedCardId(card.id)}
                        className="me-3"
                      />
                      <div className="flex-1">
                        <span className="capitalize">{card.brand}</span>
                        <span className="text-gray-500"> •••• {card.last4}</span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {card.expMonth}/{card.expYear}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </button>
          </div>
        )}

        {/* Nouvelle carte */}
        <button
          type="button"
          onClick={() => setPaymentMethod('card')}
          className={`w-full p-4 rounded-lg border-2 transition-all text-start ${
            paymentMethod === 'card'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center">
            <svg className="w-8 h-8 text-gray-400 me-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="font-medium text-gray-900">{t('checkout.newCard')}</span>
          </div>
        </button>
      </div>

      {/* Formulaire Stripe pour nouvelle carte */}
      {paymentMethod === 'card' && clientSecret && (
        <Elements
          stripe={getStripe()}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#2563eb',
              },
            },
          }}
        >
          <StripeCheckoutForm
            productId={product.id}
            saveCard={saveCard}
            setSaveCard={setSaveCard}
          />
        </Elements>
      )}

      {/* PayPal */}
      {paymentMethod === 'paypal' && (
        <PayPalCheckout productId={product.id} price={product.price} />
      )}

      {/* Apple Pay / Google Pay */}
      {(paymentMethod === 'apple-pay' || paymentMethod === 'google-pay') && (
        <ExpressCheckout
          type={paymentMethod}
          productId={product.id}
          price={product.price}
        />
      )}

      {/* Paiement avec carte sauvegardée */}
      {paymentMethod === 'saved-card' && selectedCardId && (
        <SavedCardCheckout
          cardId={selectedCardId}
          productId={product.id}
          price={product.price}
        />
      )}
    </div>
  );
}

// Composant Stripe Checkout
function StripeCheckoutForm({
  productId,
  saveCard,
  setSaveCard,
}: {
  productId: string;
  saveCard: boolean;
  setSaveCard: (v: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?product=${productId}`,
      },
      redirect: 'if_required',
    });

    // Si succès sans redirection, aller vers le suivi
    if (!result.error && result.paymentIntent?.status === 'succeeded') {
      router.push(`/checkout/success?product=${productId}&order=${result.paymentIntent.id}`);
      return;
    }

    if (result.error) {
      setError(result.error.message || t('common.errorOccurred'));
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement className="mb-4" />

      <label className="flex items-center mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={saveCard}
          onChange={(e) => setSaveCard(e.target.checked)}
          className="me-2"
        />
        <span className="text-sm text-gray-600">
          {t('checkout.saveCardForFuture')}
        </span>
      </label>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isLoading}
        className="w-full btn-primary py-3 disabled:opacity-50"
      >
        {isLoading ? t('checkout.processing') : t('checkout.payNow')}
      </button>
    </form>
  );
}

// Composant PayPal
function PayPalCheckout({ productId, price: _price }: { productId: string; price: number }) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);

  const handlePayPal = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/payments/paypal/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const { approvalUrl } = await response.json();
      window.location.href = approvalUrl;
    } catch (error) {
      console.error('PayPal error:', error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayPal}
      disabled={isLoading}
      className="w-full py-3 bg-[#FFC439] hover:bg-[#f0b429] text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
    >
      {isLoading ? t('checkout.redirecting') : t('checkout.payWithPayPal')}
    </button>
  );
}

// Composant Express Checkout (Apple Pay / Google Pay)
function ExpressCheckout({
  type,
  productId,
  price: _price,
}: {
  type: 'apple-pay' | 'google-pay';
  productId: string;
  price: number;
}) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);

  const handleExpressCheckout = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/payments/express', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, type }),
      });
      const { clientSecret: _clientSecret } = await response.json();
      // TODO: Utiliser Payment Request API avec clientSecret
      // ...
    } catch (error) {
      console.error('Express checkout error:', error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleExpressCheckout}
      disabled={isLoading}
      className={`w-full py-3 font-semibold rounded-lg transition-colors disabled:opacity-50 ${
        type === 'apple-pay'
          ? 'bg-black text-white hover:bg-gray-800'
          : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
      }`}
    >
      {isLoading
        ? t('common.loading')
        : type === 'apple-pay'
        ? t('checkout.payWithApplePay')
        : t('checkout.payWithGooglePay')}
    </button>
  );
}

// Composant Carte Sauvegardée
function SavedCardCheckout({
  cardId,
  productId,
  price: _price,
}: {
  cardId: string;
  productId: string;
  price: number;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/charge-saved-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, productId }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/checkout/success?product=${productId}`);
      } else {
        setError(data.error || t('common.errorOccurred'));
      }
    } catch (err) {
      setError(t('common.errorOccurred'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      <button
        onClick={handlePayment}
        disabled={isLoading}
        className="w-full btn-primary py-3 disabled:opacity-50"
      >
        {isLoading ? t('checkout.processing') : t('checkout.payNow')}
      </button>
    </div>
  );
}
