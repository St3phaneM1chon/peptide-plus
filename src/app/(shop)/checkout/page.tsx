'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signIn, getProviders } from 'next-auth/react';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { useCart } from '@/contexts/CartContext';
import { useI18n } from '@/i18n/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { toast } from 'sonner';
import { checkoutShippingSchema, validateForm } from '@/lib/form-validation';
import { isValidEmail } from '@/lib/validation';
import { FormError } from '@/components/ui/FormError';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { useDiscountCode } from '@/hooks/useDiscountCode';
import DOMPurify from 'isomorphic-dompurify';
// TODO: Consider lazy-loading the tax calculation module (e.g. dynamic import)
// to reduce the initial bundle size of the checkout page, since tax calculations
// are only needed after the user enters their shipping address.
import {
  calculateTaxes,
  calculateShipping,
  getProvincesList,
  getCountriesList,
  getAddressFormat,
  type TaxBreakdown
} from '@/lib/canadianTaxes';

type Step = 'auth' | 'info' | 'shipping' | 'payment';
type PaymentMethod = 'credit_card' | 'interac' | 'paypal' | 'apple_pay' | 'google_pay';

export default function CheckoutPage() {
  const { data: session } = useSession();
  const { items, subtotal } = useCart();
  const { t, locale } = useI18n();
  const { formatPrice, currency } = useCurrency();
  
  // Determine initial step based on auth status
  const [currentStep, setCurrentStep] = useState<Step>('auth');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('credit_card');
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [researchConsent, setResearchConsent] = useState(false);
  const [researchConsentError, setResearchConsentError] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<Record<string, unknown>>({});

  // Billing address
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingInfo, setBillingInfo] = useState({
    firstName: '',
    lastName: '',
    address: '',
    apartment: '',
    city: '',
    province: 'QC',
    postalCode: '',
    country: 'CA',
  });
  
  // Form states
  const [contactInfo, setContactInfo] = useState({
    email: '',
    phone: '',
    newsletter: false,
  });
  
  const [shippingInfo, setShippingInfo] = useState({
    firstName: '',
    lastName: '',
    address: '',
    apartment: '',
    city: '',
    province: 'QC',
    postalCode: '',
    country: 'CA',
  });
  
  // Shipping validation errors
  const [shippingErrors, setShippingErrors] = useState<Record<string, string>>({});

  // Billing validation errors (inline on blur)
  const [billingErrors, setBillingErrors] = useState<Record<string, string>>({});

  // Validate a single billing field on blur
  const validateBillingField = (field: string, value: string) => {
    let error = '';
    const requiredFields: Record<string, string> = {
      firstName: t('checkout.firstName'),
      lastName: t('checkout.lastName'),
      address: t('checkout.address'),
      city: t('checkout.city'),
      postalCode: t('checkout.postalCode'),
    };

    if (field in requiredFields && !value.trim()) {
      error = `${requiredFields[field]} ${t('common.error') || 'is required'}`;
    }

    if (field === 'postalCode' && value.trim()) {
      const postalRegex = billingInfo.country === 'CA'
        ? /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/
        : billingInfo.country === 'US'
          ? /^\d{5}(-\d{4})?$/
          : null;
      if (postalRegex && !postalRegex.test(value.trim())) {
        error = t('checkout.invalidPostalCode') || 'Invalid postal code format';
      }
    }

    setBillingErrors(prev => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Clear a billing field error on change
  const clearBillingError = (field: string) => {
    if (billingErrors[field]) {
      setBillingErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Clear a specific shipping field error when user modifies that field
  const clearShippingError = (field: string) => {
    if (shippingErrors[field]) {
      setShippingErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Validate a single shipping field on blur
  const validateShippingField = (field: string, value: string) => {
    let error = '';
    const requiredFields: Record<string, string> = {
      firstName: t('checkout.firstName'),
      lastName: t('checkout.lastName'),
      address: t('checkout.address'),
      city: t('checkout.city'),
      postalCode: t('checkout.postalCode'),
    };

    if (field in requiredFields && !value.trim()) {
      error = `${requiredFields[field]} ${t('common.error') || 'is required'}`;
    }

    if (field === 'postalCode' && value.trim()) {
      const postalRegex = shippingInfo.country === 'CA'
        ? /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/
        : shippingInfo.country === 'US'
          ? /^\d{5}(-\d{4})?$/
          : null;
      if (postalRegex && !postalRegex.test(value.trim())) {
        error = t('checkout.invalidPostalCode') || 'Invalid postal code format';
      }
    }

    setShippingErrors(prev => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Promo code (uses shared useDiscountCode hook)
  const validatePromo = useCallback(async (code: string) => {
    const res = await fetch('/api/promo/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal }),
    });
    const data = await res.json();
    return { valid: !!data.valid, discount: data.discount || 0, code: data.code, error: data.error };
  }, [subtotal]);

  const [promo, promoActions] = useDiscountCode({
    validateFn: validatePromo,
    onSuccess: () => toast.success(t('toast.checkout.promoApplied')),
    onError: () => toast.error(t('toast.checkout.promoInvalid')),
    onFail: () => toast.error(t('toast.checkout.promoFailed')),
    defaultErrorMessage: t('checkout.invalidPromoCode'),
    failureErrorMessage: t('checkout.validationError'),
  });

  // Gift card (uses shared useDiscountCode hook)
  const validateGiftCard = useCallback(async (code: string) => {
    const res = await fetch(`/api/gift-cards/balance?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (res.ok && data.balance > 0) {
      const remainingTotal = subtotal - promo.discount;
      const discountAmount = Math.min(data.balance, remainingTotal);
      return { valid: true, discount: discountAmount, code };
    }
    return { valid: false, discount: 0, error: data.error || 'Invalid or expired gift card' };
  }, [subtotal, promo.discount]);

  const [giftCard, giftCardActions] = useDiscountCode({
    validateFn: validateGiftCard,
    onSuccess: (_code, amount) => toast.success(t('toast.checkout.giftCardApplied', { amount: formatPrice(amount) })),
    onError: () => toast.error(t('toast.checkout.giftCardInvalid')),
    onFail: () => toast.error(t('toast.checkout.giftCardFailed')),
    defaultErrorMessage: 'Invalid or expired gift card',
    failureErrorMessage: 'Failed to validate gift card',
  });

  // Backward-compatible aliases for existing template references
  const promoCode = promo.code;
  const promoDiscount = promo.discount;
  const promoApplied = promo.appliedCode;
  const promoError = promo.error;
  const promoLoading = promo.loading;
  const giftCardCode = giftCard.code;
  const giftCardDiscount = giftCard.discount;
  const giftCardApplied = giftCard.appliedCode;
  const giftCardError = giftCard.error;
  const giftCardLoading = giftCard.loading;

  // Apply/remove shortcuts using the hook actions
  const applyPromoCode = promoActions.apply;
  const removePromoCode = promoActions.remove;
  const applyGiftCard = giftCardActions.apply;
  const removeGiftCard = giftCardActions.remove;

  // Re-validate promo when cart subtotal changes
  useEffect(() => {
    if (promoApplied && subtotal > 0) {
      fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoApplied, subtotal }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.valid) {
            removePromoCode();
          }
        })
        .catch(() => {
          // Keep existing discount on network error
        });
    }
  }, [subtotal, promoApplied, removePromoCode]);

  // Auto-fill from session when user is logged in
  useEffect(() => {
    if (session?.user) {
      setContactInfo(prev => ({
        ...prev,
        email: session.user.email || prev.email,
      }));
      
      // If user has a name, split into first/last
      if (session.user.name) {
        const nameParts = session.user.name.split(' ');
        setShippingInfo(prev => ({
          ...prev,
          firstName: nameParts[0] || prev.firstName,
          lastName: nameParts.slice(1).join(' ') || prev.lastName,
        }));
      }
      
      // Skip auth step if logged in
      if (currentStep === 'auth') {
        setCurrentStep('shipping');
      }
    }
  }, [session, currentStep]);

  // Load available OAuth providers
  useEffect(() => {
    getProviders().then(providers => {
      if (providers) setAvailableProviders(providers);
    });
  }, []);

  // Calculate taxes based on shipping province/state and country
  const taxBreakdown: TaxBreakdown = useMemo(() => {
    return calculateTaxes(subtotal, shippingInfo.province, shippingInfo.country);
  }, [subtotal, shippingInfo.province, shippingInfo.country]);

  // Calculate shipping based on country and product types in cart
  const cartProductTypes = useMemo(() => items.map(i => i.productType).filter(Boolean) as string[], [items]);
  const shippingCalc = useMemo(() => {
    return calculateShipping(subtotal, shippingInfo.country, cartProductTypes);
  }, [subtotal, shippingInfo.country, cartProductTypes]);

  // Get countries and provinces/states lists
  const countries = useMemo(() => getCountriesList(locale?.startsWith('fr') ? 'fr' : 'en'), [locale]);

  // Total calculation (including promo discount and gift card)
  const subtotalAfterDiscount = subtotal - promoDiscount - giftCardDiscount;
  const taxBreakdownAfterDiscount = useMemo(() => {
    return calculateTaxes(subtotalAfterDiscount, shippingInfo.province, shippingInfo.country);
  }, [subtotalAfterDiscount, shippingInfo.province, shippingInfo.country]);

  const totalCAD = taxBreakdownAfterDiscount.grandTotal + shippingCalc.shippingCAD;

  // Get provinces/states list based on selected country
  const provinces = useMemo(() => {
    const countryForProvinces: 'CA' | 'US' | 'ALL' = 
      shippingInfo.country === 'US' ? 'US' : 
      shippingInfo.country === 'CA' ? 'CA' : 'ALL';
    return getProvincesList(locale?.startsWith('fr') ? 'fr' : 'en', countryForProvinces);
  }, [locale, shippingInfo.country]);

  // Get address format based on selected country
  const addressFormat = useMemo(() => {
    return getAddressFormat(shippingInfo.country, locale?.startsWith('fr') ? 'fr' : 'en');
  }, [shippingInfo.country, locale]);

  // Update province/state when country changes
  const handleCountryChange = (newCountry: string) => {
    let defaultProvince = 'QC';
    if (newCountry === 'US') defaultProvince = 'NY';
    else if (newCountry === 'MX') defaultProvince = 'CDMX';
    else if (newCountry === 'AU') defaultProvince = 'NSW';
    else if (newCountry !== 'CA') defaultProvince = '';
    
    setShippingInfo({ ...shippingInfo, country: newCountry, province: defaultProvince, postalCode: '' });
  };

  // Check if country has a region/province/state list
  const needsProvinceSelection = addressFormat.hasRegionList || shippingInfo.country === 'CA' || shippingInfo.country === 'US';
  
  // Get the regions list for the current country (from addressFormat or provinces)
  const regionsList = useMemo(() => {
    if (shippingInfo.country === 'CA' || shippingInfo.country === 'US') {
      return provinces;
    }
    return addressFormat.regions?.map(r => ({ ...r, taxRate: '0%', country: shippingInfo.country as 'CA' | 'US' })) || [];
  }, [shippingInfo.country, provinces, addressFormat.regions]);
  const isInternational = shippingInfo.country !== 'CA';

  // Handle OAuth sign in
  const handleOAuthSignIn = async (provider: string) => {
    setIsProcessing(true);
    try {
      await signIn(provider, { 
        callbackUrl: '/checkout',
        redirect: true 
      });
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Continue as guest
  const handleGuestCheckout = () => {
    setGuestCheckout(true);
    setCurrentStep('info');
  };

  // Redirect if cart is empty
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">{t('checkout.emptyCart')}</h1>
          <p className="text-gray-500 mb-8">{t('checkout.emptyCartMessage')}</p>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600"
          >
            {t('cart.continueShopping')}
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmitOrder = async () => {
    // Validate research consent before proceeding
    if (!researchConsent) {
      setResearchConsentError(true);
      toast.error(t('checkout.researchConsentRequired'));
      return;
    }

    setIsProcessing(true);

    try {
      const effectiveBilling = billingSameAsShipping ? shippingInfo : billingInfo;
      const researchConsentTimestamp = new Date().toISOString();
      const orderData = {
        items: items.map(item => ({
          productId: item.productId,
          formatId: item.formatId,
          name: item.name,
          format: item.formatName,
          price: item.price,
          quantity: item.quantity,
          sku: item.sku,
        })),
        shippingInfo: {
          ...shippingInfo,
          email: contactInfo.email || session?.user?.email,
          phone: contactInfo.phone,
        },
        billingInfo: effectiveBilling,
        billingSameAsShipping,
        paymentMethod: selectedPaymentMethod,
        subtotal: subtotal,
        promoCode: promoApplied || undefined,
        promoDiscount: promoDiscount || undefined,
        giftCardCode: giftCardApplied || undefined,
        giftCardDiscount: giftCardDiscount || undefined,
        shipping: shippingCalc.shippingCAD,
        taxes: taxBreakdown.totalTax,
        total: totalCAD,
        currency: currency.code,
        researchConsentAccepted: true,
        researchConsentTimestamp: researchConsentTimestamp,
      };

      // Route selon la méthode de paiement
      if (selectedPaymentMethod === 'paypal') {
        // Créer commande PayPal
        const response = await fetch('/api/payments/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });
        
        const data = await response.json();
        
        if (data.approvalUrl) {
          // Rediriger vers PayPal
          window.location.href = data.approvalUrl;
          return;
        } else {
          throw new Error(data.error || t('checkout.paymentError'));
        }
      } else {
        // Stripe (credit_card, interac, apple_pay, google_pay)
        const response = await fetch('/api/payments/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });
        
        const data = await response.json();
        
        if (data.url) {
          // Rediriger vers Stripe Checkout
          window.location.href = data.url;
          return;
        } else {
          throw new Error(data.error || t('checkout.paymentError'));
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(t('toast.checkout.orderFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: t('nav.home') || 'Home', href: '/' },
          { label: t('cart.title') || 'Cart' },
          { label: t('checkout.checkout') || 'Checkout' },
        ]}
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P+</span>
            </div>
            <span className="font-bold text-xl">Peptide Plus+</span>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="text-orange-600 hover:underline"
          >
            {t('cart.continueShopping')}
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8" role="navigation" aria-label={t('checkout.aria.checkoutProgress')}>
          <div className="flex items-center">
            {!session && !guestCheckout && (
              <>
                <StepIndicator 
                  number={1} 
                  label={t('checkout.account')}
                  active={currentStep === 'auth'} 
                  completed={currentStep !== 'auth'} 
                />
                <div className={`w-12 h-0.5 ${currentStep !== 'auth' ? 'bg-orange-500' : 'bg-gray-300'}`} />
              </>
            )}
            {guestCheckout && (
              <>
                <StepIndicator 
                  number={1} 
                  label={t('checkout.information')} 
                  active={currentStep === 'info'} 
                  completed={currentStep !== 'info' && currentStep !== 'auth'} 
                />
                <div className={`w-12 h-0.5 ${currentStep !== 'info' && currentStep !== 'auth' ? 'bg-orange-500' : 'bg-gray-300'}`} />
              </>
            )}
            <StepIndicator 
              number={guestCheckout ? 2 : (session ? 1 : 2)} 
              label={t('checkout.shipping')} 
              active={currentStep === 'shipping'} 
              completed={currentStep === 'payment'} 
            />
            <div className={`w-12 h-0.5 ${currentStep === 'payment' ? 'bg-orange-500' : 'bg-gray-300'}`} />
            <StepIndicator 
              number={guestCheckout ? 3 : (session ? 2 : 3)} 
              label={t('checkout.payment')} 
              active={currentStep === 'payment'} 
              completed={false} 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6">
              
              {/* Step 0: Authentication / Account */}
              {currentStep === 'auth' && !session && (
                <div>
                  <h2 className="text-xl font-bold mb-2">{t('checkout.welcomeBack')}</h2>
                  <p className="text-gray-600 mb-6">
                    {t('checkout.signInBenefits')}
                  </p>
                  
                  {/* Express Checkout Options */}
                  <div className="mb-8">
                    <p className="text-sm font-medium text-gray-700 mb-4">
                      {t('checkout.expressCheckout')}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {/* PayPal */}
                      <button
                        onClick={() => {
                          setSelectedPaymentMethod('paypal');
                          setCurrentStep('shipping');
                        }}
                        disabled={isProcessing}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-[#003087] text-white rounded-lg hover:bg-[#002369] transition-colors disabled:opacity-50"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/>
                        </svg>
                        PayPal
                      </button>

                      {/* Apple Pay */}
                      <button
                        onClick={() => {
                          setSelectedPaymentMethod('apple_pay');
                          setCurrentStep('shipping');
                        }}
                        disabled={isProcessing}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                        </svg>
                        Apple Pay
                      </button>

                      {/* Google Pay */}
                      <button
                        onClick={() => {
                          setSelectedPaymentMethod('google_pay');
                          setCurrentStep('shipping');
                        }}
                        disabled={isProcessing}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Google Pay
                      </button>
                    </div>
                  </div>
                  
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500">
                        {t('checkout.orSignInWith')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Social Login Buttons - only show configured providers */}
                  <div className="space-y-3 mb-8">
                    {/* Google */}
                    {'google' in availableProviders && (
                    <button
                      onClick={() => handleOAuthSignIn('google')}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="font-medium">{t('checkout.continueWithGoogle')}</span>
                    </button>
                    )}

                    {/* Apple */}
                    {'apple' in availableProviders && (
                    <button
                      onClick={() => handleOAuthSignIn('apple')}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      <span className="font-medium">{t('checkout.continueWithApple')}</span>
                    </button>
                    )}

                    {/* X (Twitter) */}
                    {'twitter' in availableProviders && (
                    <button
                      onClick={() => handleOAuthSignIn('twitter')}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      <span className="font-medium">{t('checkout.continueWithX')}</span>
                    </button>
                    )}
                  </div>
                  
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500">
                        {t('checkout.or')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Guest Checkout */}
                  <button
                    onClick={handleGuestCheckout}
                    className="w-full px-6 py-3 border-2 border-orange-500 text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    {t('checkout.continueAsGuest')}
                  </button>
                  
                  {/* Benefits of signing in */}
                  <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      {t('checkout.whyCreateAccount')}
                    </h3>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('checkout.benefit1')}
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('checkout.benefit2')}
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('checkout.benefit3')}
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('checkout.benefit4')}
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Step 1: Contact Information (Guest only) */}
              {currentStep === 'info' && guestCheckout && (
                <div>
                  <h2 className="text-xl font-bold mb-6">{t('checkout.contactInfo')}</h2>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="checkout-email" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.email')} *
                      </label>
                      <div className="relative">
                        <input
                          id="checkout-email"
                          type="email"
                          autoComplete="email"
                          value={contactInfo.email}
                          onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                          className={`w-full px-4 py-3 pe-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                            contactInfo.email && !isValidEmail(contactInfo.email) ? 'border-red-300' : contactInfo.email && isValidEmail(contactInfo.email) ? 'border-green-400' : 'border-gray-200'
                          }`}
                          placeholder={t('auth.emailPlaceholder')}
                          required
                          aria-required="true"
                        />
                        {contactInfo.email && (
                          <span className="absolute end-3 top-1/2 -translate-y-1/2">
                            {isValidEmail(contactInfo.email) ? (
                              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </span>
                        )}
                      </div>
                      {contactInfo.email && !isValidEmail(contactInfo.email) && (
                        <p className="text-red-500 text-xs mt-1">{t('auth.invalidEmail') || 'Please enter a valid email address'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.phone')}
                      </label>
                      <input
                        type="tel"
                        autoComplete="tel"
                        value={contactInfo.phone}
                        onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="(514) 555-0123"
                      />
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={contactInfo.newsletter}
                        onChange={(e) => setContactInfo({ ...contactInfo, newsletter: e.target.checked })}
                        className="w-4 h-4 text-orange-500 rounded"
                      />
                      <span className="text-sm text-gray-600">{t('checkout.newsletter')}</span>
                    </label>
                  </div>
                  
                  <div className="mt-8 flex justify-between">
                    <button
                      onClick={() => setCurrentStep('auth')}
                      className="text-orange-600 hover:underline"
                    >
                      {t('checkout.backToSignIn')}
                    </button>
                    <button
                      onClick={() => setCurrentStep('shipping')}
                      disabled={!contactInfo.email || !isValidEmail(contactInfo.email)}
                      className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('checkout.continueToShipping')}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Shipping */}
              {currentStep === 'shipping' && (
                <div>
                  {/* Logged in user info */}
                  {session?.user && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        {session.user.image ? (
                          <Image src={session.user.image} alt={session.user.name || 'Profile'} width={40} height={40} className="w-10 h-10 rounded-full" unoptimized />
                        ) : (
                          <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
                            <span className="text-green-700 font-semibold">
                              {session.user.name?.charAt(0) || session.user.email?.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-green-900">{session.user.name || session.user.email}</p>
                          <p className="text-sm text-green-700">{session.user.email}</p>
                        </div>
                        <span className="ms-auto px-2 py-1 bg-green-200 text-green-800 text-xs font-medium rounded">
                          {t('checkout.loggedIn')}
                        </span>
                      </div>
                    </div>
                  )}

                  <h2 className="text-xl font-bold mb-6">{t('checkout.shippingAddress')}</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="shipping-firstName" className="block text-sm font-medium text-gray-700 mb-1">
                          {t('checkout.firstName')} *
                        </label>
                        <input
                          id="shipping-firstName"
                          type="text"
                          autoComplete="shipping given-name"
                          value={shippingInfo.firstName}
                          onChange={(e) => { setShippingInfo({ ...shippingInfo, firstName: e.target.value }); clearShippingError('firstName'); }}
                          onBlur={(e) => validateShippingField('firstName', e.target.value)}
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${shippingErrors.firstName ? 'border-red-500' : 'border-gray-200'}`}
                          required
                          aria-required="true"
                          aria-invalid={!!shippingErrors.firstName}
                          aria-describedby={shippingErrors.firstName ? 'error-firstName' : undefined}
                        />
                        <FormError error={shippingErrors.firstName} id="error-firstName" />
                      </div>
                      <div>
                        <label htmlFor="shipping-lastName" className="block text-sm font-medium text-gray-700 mb-1">
                          {t('checkout.lastName')} *
                        </label>
                        <input
                          id="shipping-lastName"
                          type="text"
                          autoComplete="shipping family-name"
                          value={shippingInfo.lastName}
                          onChange={(e) => { setShippingInfo({ ...shippingInfo, lastName: e.target.value }); clearShippingError('lastName'); }}
                          onBlur={(e) => validateShippingField('lastName', e.target.value)}
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${shippingErrors.lastName ? 'border-red-500' : 'border-gray-200'}`}
                          required
                          aria-required="true"
                          aria-invalid={!!shippingErrors.lastName}
                          aria-describedby={shippingErrors.lastName ? 'error-lastName' : undefined}
                        />
                        <FormError error={shippingErrors.lastName} id="error-lastName" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="shipping-address" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.address')} *
                      </label>
                      <AddressAutocomplete
                        id="shipping-address"
                        value={shippingInfo.address}
                        onChange={(addressComponents) => {
                          setShippingInfo({
                            ...shippingInfo,
                            address: addressComponents.street,
                            city: addressComponents.city,
                            province: addressComponents.province || shippingInfo.province,
                            postalCode: addressComponents.postalCode,
                            country: addressComponents.country || shippingInfo.country,
                          });
                          clearShippingError('address');
                          clearShippingError('city');
                          clearShippingError('province');
                          clearShippingError('postalCode');
                        }}
                        onInputChange={(value) => {
                          setShippingInfo({ ...shippingInfo, address: value });
                          clearShippingError('address');
                        }}
                        placeholder={t('checkout.address')}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${shippingErrors.address ? 'border-red-500' : 'border-gray-200'}`}
                        required
                        aria-invalid={!!shippingErrors.address}
                        aria-describedby={shippingErrors.address ? 'error-address' : undefined}
                      />
                      <FormError error={shippingErrors.address} id="error-address" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.apartment')}
                      </label>
                      <input
                        type="text"
                        autoComplete="shipping address-line2"
                        value={shippingInfo.apartment}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, apartment: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder={t('checkout.apartment')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="shipping-city" className="block text-sm font-medium text-gray-700 mb-1">
                          {t('checkout.city')} *
                        </label>
                        <input
                          id="shipping-city"
                          type="text"
                          autoComplete="shipping address-level2"
                          value={shippingInfo.city}
                          onChange={(e) => { setShippingInfo({ ...shippingInfo, city: e.target.value }); clearShippingError('city'); }}
                          onBlur={(e) => validateShippingField('city', e.target.value)}
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${shippingErrors.city ? 'border-red-500' : 'border-gray-200'}`}
                          required
                          aria-required="true"
                          aria-invalid={!!shippingErrors.city}
                          aria-describedby={shippingErrors.city ? 'error-city' : undefined}
                        />
                        <FormError error={shippingErrors.city} id="error-city" />
                      </div>
                    </div>
                    
                    {/* Country Selection */}
                    <div>
                      <label htmlFor="shipping-country" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.country')} *
                      </label>
                      <select
                        id="shipping-country"
                        value={shippingInfo.country}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        aria-required="true"
                      >
                        {Object.entries(
                          countries.reduce((acc, c) => {
                            if (!acc[c.group]) acc[c.group] = [];
                            acc[c.group].push(c);
                            return acc;
                          }, {} as Record<string, typeof countries>)
                        ).map(([group, groupCountries]) => (
                          <optgroup key={group} label={group}>
                            {groupCountries.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.name} {c.hasFTA ? '✓' : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {countries.find(c => c.code === shippingInfo.country)?.hasFTA && (
                        <p className="text-xs text-green-600 mt-1">✓ {t('checkout.ftaCountry')}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Postal Code - Only show if country uses postal codes */}
                      {addressFormat.postalCodeRequired || addressFormat.postalCodePlaceholder ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {addressFormat.postalCodeLabel} {addressFormat.postalCodeRequired ? '*' : ''}
                          </label>
                          <input
                            type="text"
                            autoComplete="shipping postal-code"
                            value={shippingInfo.postalCode}
                            onChange={(e) => { setShippingInfo({ ...shippingInfo, postalCode: e.target.value.toUpperCase() }); clearShippingError('postalCode'); }}
                            onBlur={(e) => validateShippingField('postalCode', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${shippingErrors.postalCode ? 'border-red-500' : 'border-gray-200'}`}
                            placeholder={addressFormat.postalCodePlaceholder || ''}
                            required={addressFormat.postalCodeRequired}
                          />
                          <FormError error={shippingErrors.postalCode} />
                          {addressFormat.postalCodeExample && addressFormat.postalCodeExample !== 'Not required' && addressFormat.postalCodeExample !== 'Not used' && (
                            <p className="text-xs text-gray-500 mt-1">
                              {t('checkout.exampleAbbrev')} {addressFormat.postalCodeExample}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                            {t('checkout.noPostalCode')}
                          </p>
                        </div>
                      )}
                      
                      {/* Region/Province/State */}
                      {needsProvinceSelection ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {addressFormat.regionLabel} {addressFormat.regionRequired ? '*' : ''}
                          </label>
                          <select
                            value={shippingInfo.province}
                            onChange={(e) => { setShippingInfo({ ...shippingInfo, province: e.target.value }); clearShippingError('province'); }}
                            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${shippingErrors.province ? 'border-red-500' : 'border-gray-200'}`}
                            required={addressFormat.regionRequired}
                          >
                            <option value="">{t('checkout.selectRegion')}</option>
                            {regionsList.map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <FormError error={shippingErrors.province} />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {addressFormat.regionLabel} {addressFormat.regionRequired ? '*' : ''}
                          </label>
                          <input
                            type="text"
                            value={shippingInfo.province}
                            onChange={(e) => setShippingInfo({ ...shippingInfo, province: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder={addressFormat.regionLabel}
                            required={addressFormat.regionRequired}
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Address Notes for this country */}
                    {addressFormat.notes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                        <span className="font-medium">Note:</span> {addressFormat.notes}
                      </div>
                    )}
                    
                    {/* Additional fields for specific countries */}
                    {addressFormat.additionalFields?.colonia && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('checkout.coloniaLabel')} *
                        </label>
                        <input
                          type="text"
                          value={shippingInfo.apartment}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, apartment: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder={t('checkout.coloniaPlaceholder')}
                          required
                        />
                        <p className="text-xs text-amber-600 mt-1">
                          {t('checkout.coloniaRequired')}
                        </p>
                      </div>
                    )}
                    
                    {addressFormat.additionalFields?.district && shippingInfo.country !== 'HK' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('checkout.districtLabel')} *
                        </label>
                        <input
                          type="text"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder={t('checkout.districtPlaceholder')}
                          required
                        />
                      </div>
                    )}

                    {/* International Export Notice */}
                    {isInternational && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-sm text-blue-700">
                            <p className="font-medium">{t('checkout.exportNotice')}</p>
                            <p className="mt-1 text-blue-600">{t('checkout.exportNoticeDetail')}</p>
                            {shippingCalc.requiresCERS && (
                              <p className="mt-2 text-xs text-blue-500">
                                {t('checkout.cersNotice')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Save address for logged in users */}
                    {session && (
                      <label className="flex items-center gap-2 mt-4">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-orange-500 rounded"
                          defaultChecked
                        />
                        <span className="text-sm text-gray-600">
                          {t('checkout.saveAddress')}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Billing Address Section */}
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <h2 className="text-xl font-bold mb-4">{t('checkout.billingAddress')}</h2>
                    <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer mb-4">
                      <input
                        type="checkbox"
                        checked={billingSameAsShipping}
                        onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                        className="w-5 h-5 text-orange-500 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {t('checkout.billingAddressSameAsShipping')}
                      </span>
                    </label>

                    {!billingSameAsShipping && (
                      <div className="space-y-4 animate-fade-in">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('checkout.firstName')} *
                            </label>
                            <input
                              type="text"
                              autoComplete="billing given-name"
                              value={billingInfo.firstName}
                              onChange={(e) => { setBillingInfo({ ...billingInfo, firstName: e.target.value }); clearBillingError('firstName'); }}
                              onBlur={(e) => validateBillingField('firstName', e.target.value)}
                              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${billingErrors.firstName ? 'border-red-500' : 'border-gray-200'}`}
                              required
                            />
                            <FormError error={billingErrors.firstName} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('checkout.lastName')} *
                            </label>
                            <input
                              type="text"
                              autoComplete="billing family-name"
                              value={billingInfo.lastName}
                              onChange={(e) => { setBillingInfo({ ...billingInfo, lastName: e.target.value }); clearBillingError('lastName'); }}
                              onBlur={(e) => validateBillingField('lastName', e.target.value)}
                              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${billingErrors.lastName ? 'border-red-500' : 'border-gray-200'}`}
                              required
                            />
                            <FormError error={billingErrors.lastName} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('checkout.address')} *
                          </label>
                          <input
                            type="text"
                            autoComplete="billing street-address"
                            value={billingInfo.address}
                            onChange={(e) => { setBillingInfo({ ...billingInfo, address: e.target.value }); clearBillingError('address'); }}
                            onBlur={(e) => validateBillingField('address', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${billingErrors.address ? 'border-red-500' : 'border-gray-200'}`}
                            required
                          />
                          <FormError error={billingErrors.address} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('checkout.apartment')}
                          </label>
                          <input
                            type="text"
                            autoComplete="billing address-line2"
                            value={billingInfo.apartment}
                            onChange={(e) => setBillingInfo({ ...billingInfo, apartment: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('checkout.city')} *
                            </label>
                            <input
                              type="text"
                              autoComplete="billing address-level2"
                              value={billingInfo.city}
                              onChange={(e) => { setBillingInfo({ ...billingInfo, city: e.target.value }); clearBillingError('city'); }}
                              onBlur={(e) => validateBillingField('city', e.target.value)}
                              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${billingErrors.city ? 'border-red-500' : 'border-gray-200'}`}
                              required
                            />
                            <FormError error={billingErrors.city} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('checkout.province')} *
                            </label>
                            <select
                              value={billingInfo.province}
                              onChange={(e) => setBillingInfo({ ...billingInfo, province: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            >
                              {provinces.map((p) => (
                                <option key={p.code} value={p.code}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('checkout.postalCode')} *
                            </label>
                            <input
                              type="text"
                              autoComplete="billing postal-code"
                              value={billingInfo.postalCode}
                              onChange={(e) => { setBillingInfo({ ...billingInfo, postalCode: e.target.value.toUpperCase() }); clearBillingError('postalCode'); }}
                              onBlur={(e) => validateBillingField('postalCode', e.target.value)}
                              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${billingErrors.postalCode ? 'border-red-500' : 'border-gray-200'}`}
                              placeholder="H2X 1Y4"
                              required
                            />
                            <FormError error={billingErrors.postalCode} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('checkout.country')} *
                            </label>
                            <select
                              value={billingInfo.country}
                              onChange={(e) => setBillingInfo({ ...billingInfo, country: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            >
                              {countries.map((c) => (
                                <option key={c.code} value={c.code}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-8 flex justify-between">
                    <button
                      onClick={() => setCurrentStep(guestCheckout ? 'info' : 'auth')}
                      className="text-orange-600 hover:underline"
                    >
                      {guestCheckout ? t('checkout.backToInfo') : t('checkout.backToSignIn')}
                    </button>
                    <button
                      onClick={() => {
                        const validation = validateForm(checkoutShippingSchema, shippingInfo);
                        if (!validation.success) {
                          setShippingErrors(validation.errors || {});
                          return;
                        }
                        setShippingErrors({});
                        setCurrentStep('payment');
                      }}
                      disabled={
                        !shippingInfo.firstName ||
                        !shippingInfo.lastName ||
                        !shippingInfo.address ||
                        !shippingInfo.city ||
                        (addressFormat.postalCodeRequired && !shippingInfo.postalCode) ||
                        (addressFormat.regionRequired && !shippingInfo.province) ||
                        (addressFormat.additionalFields?.colonia && !shippingInfo.apartment)
                      }
                      className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('checkout.continueToPayment')}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Payment */}
              {currentStep === 'payment' && (
                <div>
                  <h2 className="text-xl font-bold mb-6">{t('checkout.paymentMethod')}</h2>
                  
                  {/* Shipping Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-500">{t('checkout.shippingTo')}</p>
                        <p className="font-medium">
                          {shippingInfo.firstName} {shippingInfo.lastName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {shippingInfo.address}{shippingInfo.apartment ? `, ${shippingInfo.apartment}` : ''}
                        </p>
                        <p className="text-sm text-gray-600">
                          {shippingInfo.city}, {shippingInfo.province} {shippingInfo.postalCode}
                        </p>
                      </div>
                      <button
                        onClick={() => setCurrentStep('shipping')}
                        className="text-sm text-orange-600 hover:underline"
                      >
                        {t('common.edit')}
                      </button>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      {t('checkout.choosePaymentMethod')}
                    </p>
                    <div className="space-y-3">
                      {/* Credit Card */}
                      <button
                        onClick={() => setSelectedPaymentMethod('credit_card')}
                        className={`w-full flex items-center gap-4 px-4 py-4 rounded-lg border-2 transition-colors text-start ${
                          selectedPaymentMethod === 'credit_card'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-8 h-5" viewBox="0 0 32 20" fill="none">
                            <rect width="32" height="20" rx="3" fill="#1A1F71"/>
                            <text x="4" y="14" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">VISA</text>
                          </svg>
                          <svg className="w-8 h-5" viewBox="0 0 32 20" fill="none">
                            <rect width="32" height="20" rx="3" fill="#EB001B" fillOpacity="0.1"/>
                            <circle cx="12" cy="10" r="7" fill="#EB001B"/>
                            <circle cx="20" cy="10" r="7" fill="#F79E1B"/>
                            <path d="M16 4.4c1.8 1.3 3 3.4 3 5.6s-1.2 4.3-3 5.6c-1.8-1.3-3-3.4-3-5.6s1.2-4.3 3-5.6z" fill="#FF5F00"/>
                          </svg>
                          <svg className="w-8 h-5" viewBox="0 0 32 20" fill="none">
                            <rect width="32" height="20" rx="3" fill="#006FCF"/>
                            <text x="3" y="13" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">AMEX</text>
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{t('checkout.creditCard')}</p>
                          <p className="text-xs text-gray-500">{t('checkout.creditCardDescription')}</p>
                        </div>
                        {selectedPaymentMethod === 'credit_card' && (
                          <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>

                      {/* Interac */}
                      <button
                        onClick={() => setSelectedPaymentMethod('interac')}
                        className={`w-full flex items-center gap-4 px-4 py-4 rounded-lg border-2 transition-colors text-start ${
                          selectedPaymentMethod === 'interac'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="w-10 h-10 bg-[#FFD700] rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-black text-gray-900">INTRC</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{t('checkout.interac')}</p>
                          <p className="text-xs text-gray-500">{t('checkout.interacDescription')}</p>
                        </div>
                        {selectedPaymentMethod === 'interac' && (
                          <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>

                      {/* PayPal */}
                      <button
                        onClick={() => setSelectedPaymentMethod('paypal')}
                        className={`w-full flex items-center gap-4 px-4 py-4 rounded-lg border-2 transition-colors text-start ${
                          selectedPaymentMethod === 'paypal'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <svg className="w-10 h-10 flex-shrink-0" viewBox="0 0 24 24" fill="#003087">
                          <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/>
                        </svg>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">PayPal</p>
                          <p className="text-xs text-gray-500">{t('checkout.paypalDescription')}</p>
                        </div>
                        {selectedPaymentMethod === 'paypal' && (
                          <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>

                      {/* Apple Pay */}
                      <button
                        onClick={() => setSelectedPaymentMethod('apple_pay')}
                        className={`w-full flex items-center gap-4 px-4 py-4 rounded-lg border-2 transition-colors text-start ${
                          selectedPaymentMethod === 'apple_pay'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <svg className="w-10 h-10 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                        </svg>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Apple Pay</p>
                          <p className="text-xs text-gray-500">{t('checkout.applePayDescription')}</p>
                        </div>
                        {selectedPaymentMethod === 'apple_pay' && (
                          <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>

                      {/* Google Pay */}
                      <button
                        onClick={() => setSelectedPaymentMethod('google_pay')}
                        className={`w-full flex items-center gap-4 px-4 py-4 rounded-lg border-2 transition-colors text-start ${
                          selectedPaymentMethod === 'google_pay'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <svg className="w-10 h-10 flex-shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Google Pay</p>
                          <p className="text-xs text-gray-500">{t('checkout.googlePayDescription')}</p>
                        </div>
                        {selectedPaymentMethod === 'google_pay' && (
                          <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="flex items-center gap-2 mt-4 text-sm text-gray-500">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {t('checkout.securePayment')}
                  </div>
                  
                  {/* Research Consent Checkbox - LEGAL REQUIREMENT */}
                  <div className={`mt-6 p-4 rounded-lg border ${researchConsentError && !researchConsent ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={researchConsent}
                        onChange={(e) => {
                          setResearchConsent(e.target.checked);
                          if (e.target.checked) setResearchConsentError(false);
                        }}
                        className="mt-1 h-5 w-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-700 leading-relaxed">
                        {(() => {
                          const raw = t('checkout.researchConsentLabel');
                          // FIX: Add rel="noopener noreferrer" to target="_blank" links
                          const termsLink = `<a href="/mentions-legales/conditions" target="_blank" rel="noopener noreferrer" class="text-orange-600 underline hover:text-orange-700 font-medium">${t('checkout.researchConsentTerms')}</a>`;
                          const privacyLink = `<a href="/mentions-legales/confidentialite" target="_blank" rel="noopener noreferrer" class="text-orange-600 underline hover:text-orange-700 font-medium">${t('checkout.researchConsentPrivacy')}</a>`;
                          const html = raw.replace('{termsLink}', termsLink).replace('{privacyLink}', privacyLink);
                          return <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, { ALLOWED_TAGS: ['a', 'span'], ALLOWED_ATTR: ['href', 'target', 'rel', 'class'] }) }} />;
                        })()}
                      </span>
                    </label>
                    {researchConsentError && !researchConsent && (
                      <p className="text-red-600 text-sm mt-2 ms-8">
                        {t('checkout.researchConsentRequired')}
                      </p>
                    )}
                  </div>

                  <div className="mt-8 flex justify-between">
                    <button
                      onClick={() => setCurrentStep('shipping')}
                      className="text-orange-600 hover:underline"
                    >
                      {t('checkout.backToShipping')}
                    </button>
                    <button
                      onClick={handleSubmitOrder}
                      disabled={isProcessing || !researchConsent}
                      className="px-8 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {t('checkout.processing')}
                        </>
                      ) : (
                        <>
                          {t('checkout.placeOrder')} - {formatPrice(totalCAD)}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-8">
              <h3 className="text-lg font-bold mb-4">{t('cart.orderSummary')}</h3>
              
              {/* Cart Items */}
              <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={`${item.productId}-${item.formatId || 'default'}`} className="flex gap-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 relative">
                      {item.image && (
                        <Image src={item.image} alt={item.name} width={64} height={64} className="w-full h-full object-cover rounded-lg" unoptimized />
                      )}
                      <span className="absolute -top-2 -end-2 w-5 h-5 bg-gray-500 text-white text-xs rounded-full flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-grow">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.formatName}</p>
                    </div>
                    <p className="font-medium text-sm">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
              
              {/* Promo Code */}
              <div className="mb-4">
                {promoApplied ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-700 font-medium">{promoApplied}</span>
                      <span className="text-green-600 text-sm">(-{formatPrice(promoDiscount)})</span>
                    </div>
                    <button
                      onClick={removePromoCode}
                      aria-label="Remove promo code"
                      className="text-green-700 hover:text-green-900"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => promoActions.setCode(e.target.value.toUpperCase())}
                        placeholder={t('cart.promoCode')}
                        className="flex-grow px-4 py-2 border border-gray-200 rounded-lg text-sm uppercase"
                        onKeyDown={(e) => e.key === 'Enter' && applyPromoCode()}
                      />
                      <button
                        onClick={applyPromoCode}
                        disabled={promoLoading || !promoCode.trim()}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                      >
                        {promoLoading ? '...' : t('cart.apply')}
                      </button>
                    </div>
                    {promoError && (
                      <p className="text-red-500 text-sm mt-2">{promoError}</p>
                    )}
                  </>
                )}
              </div>

              {/* Gift Card */}
              <div className="mb-6">
                {giftCardApplied ? (
                  <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-orange-700 font-medium">{giftCardApplied}</span>
                      <span className="text-orange-600 text-sm">(-{formatPrice(giftCardDiscount)})</span>
                    </div>
                    <button
                      onClick={removeGiftCard}
                      aria-label="Remove gift card"
                      className="text-orange-700 hover:text-orange-900"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={giftCardCode}
                        onChange={(e) => giftCardActions.setCode(e.target.value.toUpperCase())}
                        placeholder={t('checkout.placeholderGiftCard')}
                        className="flex-grow px-4 py-2 border border-gray-200 rounded-lg text-sm uppercase font-mono"
                        maxLength={19}
                        onKeyDown={(e) => e.key === 'Enter' && applyGiftCard()}
                      />
                      <button
                        onClick={applyGiftCard}
                        disabled={giftCardLoading || !giftCardCode.trim()}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                      >
                        {giftCardLoading ? '...' : t('cart.apply')}
                      </button>
                    </div>
                    {giftCardError && (
                      <p className="text-red-500 text-sm mt-2">{giftCardError}</p>
                    )}
                  </>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('cart.subtotal')}</span>
                  <div className="text-end">
                    <span className="font-medium">{formatPrice(subtotal)}</span>
                    {currency.code !== 'CAD' && (
                      <span className="text-xs text-gray-500 block">
                        ≈ {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(subtotal)} CAD
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Promo Discount */}
                {promoDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {t('cart.discount')} ({promoApplied})
                    </span>
                    <span className="font-medium">-{formatPrice(promoDiscount)}</span>
                  </div>
                )}

                {/* Gift Card Discount */}
                {giftCardDiscount > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Gift Card ({giftCardApplied})
                    </span>
                    <span className="font-medium">-{formatPrice(giftCardDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-600">{t('cart.shipping')}</span>
                  <div className="text-end">
                    {shippingCalc.isFree ? (
                      <span className="text-green-600 font-medium">{t('cart.free')}</span>
                    ) : (
                      <span className="font-medium">{formatPrice(shippingCalc.shippingCAD)}</span>
                    )}
                  </div>
                </div>
                
                {/* Tax Breakdown */}
                {taxBreakdown.isExport ? (
                  <div className="flex justify-between text-green-600">
                    <span>{t('checkout.exportZeroRated')}</span>
                    <span>$0.00</span>
                  </div>
                ) : (
                  <>
                    {(taxBreakdown.gstAmount > 0 || taxBreakdown.hstAmount > 0) && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{taxBreakdown.federalTaxLabel}</span>
                        <span>{formatPrice(taxBreakdown.hstAmount > 0 ? taxBreakdown.hstAmount : taxBreakdown.gstAmount)}</span>
                      </div>
                    )}
                    {(taxBreakdown.pstAmount > 0 || taxBreakdown.qstAmount > 0 || taxBreakdown.rstAmount > 0) && taxBreakdown.provincialTaxLabel && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{taxBreakdown.provincialTaxLabel}</span>
                        <span>{formatPrice(taxBreakdown.pstAmount || taxBreakdown.qstAmount || taxBreakdown.rstAmount)}</span>
                      </div>
                    )}
                  </>
                )}
                
                <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200">
                  <span>{t('cart.total')}</span>
                  <div className="text-end">
                    <span>{formatPrice(totalCAD)}</span>
                    {currency.code !== 'CAD' && (
                      <span className="text-sm text-gray-500 font-normal block">
                        ≈ {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(totalCAD)} CAD
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Delivery Estimate */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-600">
                    {t('checkout.estimatedDelivery')}: <strong>{shippingCalc.estimatedDays} {t('checkout.businessDays')}</strong>
                  </span>
                </div>
              </div>
              
              {currency.code !== 'CAD' && (
                <p className="text-xs text-gray-500 mt-4 text-center">
                  {t('checkout.chargedInCurrency', { currency: currency.code }) ||
                   `You will be charged in ${currency.code}. Amounts shown are approximate.`}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2 text-center">
                {t('checkout.currencyNote')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step Indicator Component
function StepIndicator({ number, label, active, completed }: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean
}) {
  const stepStatus = completed ? 'completed' : active ? 'current' : 'upcoming';
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${number}: ${label} - ${stepStatus}`} aria-current={active ? 'step' : undefined}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
        completed ? 'bg-orange-500 text-white' :
        active ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
      }`} aria-hidden="true">
        {completed ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : number}
      </div>
      <span className={`text-sm ${active ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}
