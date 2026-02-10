'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { useCart } from '@/contexts/CartContext';
import { useTranslations } from '@/hooks/useTranslations';
import { useCurrency } from '@/contexts/CurrencyContext';
import { 
  calculateTaxes, 
  calculateShipping,
  getProvincesList, 
  getCountriesList,
  getAddressFormat,
  cadToUsd,
  type TaxBreakdown 
} from '@/lib/canadianTaxes';

type Step = 'auth' | 'info' | 'shipping' | 'payment';
type PaymentMethod = 'card' | 'paypal' | 'apple_pay' | 'google_pay' | 'shop_pay';

export default function CheckoutPage() {
  const { data: session } = useSession();
  const { items, subtotal } = useCart();
  const { t, locale } = useTranslations();
  const { formatPrice } = useCurrency();
  
  // Determine initial step based on auth status
  const [currentStep, setCurrentStep] = useState<Step>('auth');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('card');
  const [savePaymentInfo, setSavePaymentInfo] = useState(false);
  const [guestCheckout, setGuestCheckout] = useState(false);
  
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
  
  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: '',
  });

  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  // Apply promo code
  const applyPromoCode = async () => {
    if (!promoCode.trim()) return;
    
    setPromoLoading(true);
    setPromoError('');
    
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode, subtotal }),
      });
      
      const data = await res.json();
      
      if (data.valid) {
        setPromoDiscount(data.discount);
        setPromoApplied(data.code);
        setPromoError('');
      } else {
        setPromoError(data.error || 'Code invalide');
        setPromoDiscount(0);
        setPromoApplied(null);
      }
    } catch {
      setPromoError('Erreur de validation');
    } finally {
      setPromoLoading(false);
    }
  };

  // Remove promo code
  const removePromoCode = () => {
    setPromoCode('');
    setPromoDiscount(0);
    setPromoApplied(null);
    setPromoError('');
  };

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

  // Calculate taxes based on shipping province/state and country
  const taxBreakdown: TaxBreakdown = useMemo(() => {
    return calculateTaxes(subtotal, shippingInfo.province, shippingInfo.country);
  }, [subtotal, shippingInfo.province, shippingInfo.country]);

  // Calculate shipping based on country
  const shippingCalc = useMemo(() => {
    return calculateShipping(subtotal, shippingInfo.country);
  }, [subtotal, shippingInfo.country]);

  // Get countries and provinces/states lists
  const countries = useMemo(() => getCountriesList(locale?.startsWith('fr') ? 'fr' : 'en'), [locale]);

  // Total calculation (including promo discount)
  const subtotalAfterDiscount = subtotal - promoDiscount;
  const taxBreakdownAfterDiscount = useMemo(() => {
    return calculateTaxes(subtotalAfterDiscount, shippingInfo.province, shippingInfo.country);
  }, [subtotalAfterDiscount, shippingInfo.province, shippingInfo.country]);
  
  const totalCAD = taxBreakdownAfterDiscount.grandTotal + shippingCalc.shippingCAD;
  const totalUSD = cadToUsd(totalCAD);

  // Format USD
  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

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
    setIsProcessing(true);
    
    try {
      const orderData = {
        items: items.map(item => ({
          id: item.productId,
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
        paymentMethod: selectedPaymentMethod,
        subtotal: subtotal,
        shipping: shippingCalc.shippingCAD,
        taxes: taxBreakdown.totalTax,
        total: totalCAD,
        currency: 'CAD',
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
          throw new Error(data.error || 'Erreur PayPal');
        }
      } else {
        // Stripe (card, apple_pay, google_pay, shop_pay)
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
          throw new Error(data.error || 'Erreur de paiement');
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Erreur lors du traitement du paiement. Veuillez réessayer.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P+</span>
            </div>
            <span className="font-bold text-xl">Peptide Plus+</span>
          </Link>
          <Link href="/checkout/cart" className="text-orange-600 hover:underline">
            {t('checkout.returnToCart')}
          </Link>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center">
            {!session && !guestCheckout && (
              <>
                <StepIndicator 
                  number={1} 
                  label={t('checkout.account') || 'Compte'} 
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
                  <h2 className="text-xl font-bold mb-2">{t('checkout.welcomeBack') || 'Bienvenue'}</h2>
                  <p className="text-gray-600 mb-6">
                    {t('checkout.signInBenefits') || 'Connectez-vous pour un paiement plus rapide et accéder à votre historique de commandes'}
                  </p>
                  
                  {/* Express Checkout Options */}
                  <div className="mb-8">
                    <p className="text-sm font-medium text-gray-700 mb-4">
                      {t('checkout.expressCheckout') || 'Paiement express'}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {/* Shop Pay */}
                      <button
                        onClick={() => handleOAuthSignIn('shopify')}
                        disabled={isProcessing}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-[#5a31f4] text-white rounded-lg hover:bg-[#4c29d0] transition-colors disabled:opacity-50"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v2h-2v-2zm0-10h2v8h-2V7z"/>
                        </svg>
                        Shop Pay
                      </button>
                      
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
                        {t('checkout.orSignInWith') || 'ou connectez-vous avec'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Social Login Buttons */}
                  <div className="space-y-3 mb-8">
                    {/* Google */}
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
                      <span className="font-medium">{t('checkout.continueWithGoogle') || 'Continuer avec Google'}</span>
                    </button>
                    
                    {/* Apple */}
                    <button
                      onClick={() => handleOAuthSignIn('apple')}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      <span className="font-medium">{t('checkout.continueWithApple') || 'Continuer avec Apple'}</span>
                    </button>
                    
                    {/* Facebook */}
                    <button
                      onClick={() => handleOAuthSignIn('facebook')}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span className="font-medium">{t('checkout.continueWithFacebook') || 'Continuer avec Facebook'}</span>
                    </button>
                    
                    {/* X (Twitter) */}
                    <button
                      onClick={() => handleOAuthSignIn('twitter')}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      <span className="font-medium">{t('checkout.continueWithX') || 'Continuer avec X'}</span>
                    </button>
                  </div>
                  
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500">
                        {t('checkout.or') || 'ou'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Guest Checkout */}
                  <button
                    onClick={handleGuestCheckout}
                    className="w-full px-6 py-3 border-2 border-orange-500 text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    {t('checkout.continueAsGuest') || 'Continuer en tant qu\'invité'}
                  </button>
                  
                  {/* Benefits of signing in */}
                  <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      {t('checkout.whyCreateAccount') || 'Pourquoi créer un compte?'}
                    </h3>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('checkout.benefit1') || 'Paiement plus rapide avec informations sauvegardées'}
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('checkout.benefit2') || 'Suivi de vos commandes en temps réel'}
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('checkout.benefit3') || 'Historique de commandes et recommandations'}
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('checkout.benefit4') || 'Offres exclusives et points de fidélité'}
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.email')} *
                      </label>
                      <input
                        type="email"
                        value={contactInfo.email}
                        onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="vous@exemple.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.phone')}
                      </label>
                      <input
                        type="tel"
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
                      {t('checkout.backToSignIn') || '← Retour à la connexion'}
                    </button>
                    <button
                      onClick={() => setCurrentStep('shipping')}
                      disabled={!contactInfo.email}
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
                          <img src={session.user.image} alt="" className="w-10 h-10 rounded-full" />
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
                        <span className="ml-auto px-2 py-1 bg-green-200 text-green-800 text-xs font-medium rounded">
                          {t('checkout.loggedIn') || 'Connecté'}
                        </span>
                      </div>
                    </div>
                  )}

                  <h2 className="text-xl font-bold mb-6">{t('checkout.shippingAddress')}</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('checkout.firstName')} *
                        </label>
                        <input
                          type="text"
                          value={shippingInfo.firstName}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, firstName: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('checkout.lastName')} *
                        </label>
                        <input
                          type="text"
                          value={shippingInfo.lastName}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, lastName: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.address')} *
                      </label>
                      <input
                        type="text"
                        value={shippingInfo.address}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="123 Rue Principale"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.apartment')}
                      </label>
                      <input
                        type="text"
                        value={shippingInfo.apartment}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, apartment: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Apt, suite, etc."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('checkout.city')} *
                        </label>
                        <input
                          type="text"
                          value={shippingInfo.city}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          required
                        />
                      </div>
                    </div>
                    
                    {/* Country Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.country')} *
                      </label>
                      <select
                        value={shippingInfo.country}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                            value={shippingInfo.postalCode}
                            onChange={(e) => setShippingInfo({ ...shippingInfo, postalCode: e.target.value.toUpperCase() })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder={addressFormat.postalCodePlaceholder || ''}
                            required={addressFormat.postalCodeRequired}
                          />
                          {addressFormat.postalCodeExample && addressFormat.postalCodeExample !== 'Not required' && addressFormat.postalCodeExample !== 'Not used' && (
                            <p className="text-xs text-gray-500 mt-1">
                              {locale?.startsWith('fr') ? 'Ex:' : 'e.g.'} {addressFormat.postalCodeExample}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                            {locale?.startsWith('fr') 
                              ? 'Ce pays n\'utilise pas de code postal' 
                              : 'This country does not use postal codes'}
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
                            onChange={(e) => setShippingInfo({ ...shippingInfo, province: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            required={addressFormat.regionRequired}
                          >
                            <option value="">{locale?.startsWith('fr') ? 'Sélectionner...' : 'Select...'}</option>
                            {regionsList.map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.name} {shippingInfo.country === 'CA' ? `(${p.taxRate})` : ''}
                              </option>
                            ))}
                          </select>
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
                        <span className="font-medium">{locale?.startsWith('fr') ? 'Note:' : 'Note:'}</span> {addressFormat.notes}
                      </div>
                    )}
                    
                    {/* Additional fields for specific countries */}
                    {addressFormat.additionalFields?.colonia && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Colonia (Neighborhood) *
                        </label>
                        <input
                          type="text"
                          value={shippingInfo.apartment}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, apartment: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder={locale?.startsWith('fr') ? 'Ex: Col. Roma Norte' : 'e.g., Col. Roma Norte'}
                          required
                        />
                        <p className="text-xs text-amber-600 mt-1">
                          {locale?.startsWith('fr') 
                            ? 'La colonia (quartier) est obligatoire pour les livraisons au Mexique'
                            : 'Colonia (neighborhood) is required for Mexico deliveries'}
                        </p>
                      </div>
                    )}
                    
                    {addressFormat.additionalFields?.district && shippingInfo.country !== 'HK' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          District *
                        </label>
                        <input
                          type="text"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder={locale?.startsWith('fr') ? 'Nom du district' : 'District name'}
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
                          {t('checkout.saveAddress') || 'Sauvegarder cette adresse pour mes prochaines commandes'}
                        </span>
                      </label>
                    )}
                  </div>
                  
                  <div className="mt-8 flex justify-between">
                    <button
                      onClick={() => setCurrentStep(guestCheckout ? 'info' : 'auth')}
                      className="text-orange-600 hover:underline"
                    >
                      {guestCheckout ? t('checkout.backToInfo') : t('checkout.backToSignIn') || '← Retour'}
                    </button>
                    <button
                      onClick={() => setCurrentStep('payment')}
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

                  {/* Express Payment Methods */}
                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      {t('checkout.expressPayment') || 'Paiement express'}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <button
                        onClick={() => setSelectedPaymentMethod('apple_pay')}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                          selectedPaymentMethod === 'apple_pay' 
                            ? 'border-orange-500 bg-orange-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                        </svg>
                        <span className="text-sm font-medium">Pay</span>
                      </button>
                      
                      <button
                        onClick={() => setSelectedPaymentMethod('google_pay')}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                          selectedPaymentMethod === 'google_pay' 
                            ? 'border-orange-500 bg-orange-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span className="text-sm font-medium">Pay</span>
                      </button>
                      
                      <button
                        onClick={() => setSelectedPaymentMethod('paypal')}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                          selectedPaymentMethod === 'paypal' 
                            ? 'border-orange-500 bg-orange-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#003087">
                          <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/>
                        </svg>
                        <span className="text-sm font-medium">PayPal</span>
                      </button>
                      
                      <button
                        onClick={() => setSelectedPaymentMethod('shop_pay')}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                          selectedPaymentMethod === 'shop_pay' 
                            ? 'border-orange-500 bg-orange-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#5a31f4">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v2h-2v-2zm0-10h2v8h-2V7z"/>
                        </svg>
                        <span className="text-sm font-medium">Shop</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500">
                        {t('checkout.orPayWithCard') || 'ou payer par carte'}
                      </span>
                    </div>
                  </div>

                  {/* Credit Card Form */}
                  <button
                    onClick={() => setSelectedPaymentMethod('card')}
                    className={`w-full mb-4 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                      selectedPaymentMethod === 'card' 
                        ? 'border-orange-500 bg-orange-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex gap-2">
                      <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">VISA</div>
                      <div className="w-10 h-6 bg-gradient-to-r from-red-500 to-orange-500 rounded flex items-center justify-center">
                        <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                        <div className="w-3 h-3 bg-orange-400 rounded-full -ml-1"></div>
                      </div>
                      <div className="w-10 h-6 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">AMEX</div>
                    </div>
                    <span className="font-medium">{t('checkout.creditCard') || 'Carte de crédit'}</span>
                  </button>
                  
                  {selectedPaymentMethod === 'card' && (
                    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('checkout.cardNumber')} *
                        </label>
                        <input
                          type="text"
                          value={paymentInfo.cardNumber}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 16);
                            const formatted = value.replace(/(\d{4})/g, '$1 ').trim();
                            setPaymentInfo({ ...paymentInfo, cardNumber: formatted });
                          }}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="1234 5678 9012 3456"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('checkout.cardName')} *
                        </label>
                        <input
                          type="text"
                          value={paymentInfo.cardName}
                          onChange={(e) => setPaymentInfo({ ...paymentInfo, cardName: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="NOM SUR LA CARTE"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('checkout.expiry')} *
                          </label>
                          <input
                            type="text"
                            value={paymentInfo.expiry}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '').slice(0, 4);
                              if (value.length >= 2) {
                                value = value.slice(0, 2) + '/' + value.slice(2);
                              }
                              setPaymentInfo({ ...paymentInfo, expiry: value });
                            }}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="MM/YY"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            CVV *
                          </label>
                          <input
                            type="text"
                            value={paymentInfo.cvv}
                            onChange={(e) => setPaymentInfo({ ...paymentInfo, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="123"
                            required
                          />
                        </div>
                      </div>
                      
                      {/* Save payment for logged in users */}
                      {session && (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={savePaymentInfo}
                            onChange={(e) => setSavePaymentInfo(e.target.checked)}
                            className="w-4 h-4 text-orange-500 rounded"
                          />
                          <span className="text-sm text-gray-600">
                            {t('checkout.savePayment') || 'Sauvegarder cette carte pour mes prochains achats'}
                          </span>
                        </label>
                      )}
                    </div>
                  )}

                  {/* Security Notice */}
                  <div className="flex items-center gap-2 mt-4 text-sm text-gray-500">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {t('checkout.securePayment')}
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
                      disabled={isProcessing || (selectedPaymentMethod === 'card' && (!paymentInfo.cardNumber || !paymentInfo.cardName || !paymentInfo.expiry || !paymentInfo.cvv))}
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
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                      )}
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-gray-500 text-white text-xs rounded-full flex items-center justify-center">
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
              <div className="mb-6">
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
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        placeholder={t('cart.promoCode') || 'Code promo'}
                        className="flex-grow px-4 py-2 border border-gray-200 rounded-lg text-sm uppercase"
                        onKeyDown={(e) => e.key === 'Enter' && applyPromoCode()}
                      />
                      <button
                        onClick={applyPromoCode}
                        disabled={promoLoading || !promoCode.trim()}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                      >
                        {promoLoading ? '...' : (t('cart.apply') || 'Appliquer')}
                      </button>
                    </div>
                    {promoError && (
                      <p className="text-red-500 text-sm mt-2">{promoError}</p>
                    )}
                  </>
                )}
              </div>
              
              {/* Totals */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('cart.subtotal')}</span>
                  <div className="text-right">
                    <span className="font-medium">{formatPrice(subtotal)}</span>
                    <span className="text-xs text-gray-500 block">{formatUSD(cadToUsd(subtotal))}</span>
                  </div>
                </div>
                
                {/* Promo Discount */}
                {promoDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {t('cart.discount') || 'Réduction'} ({promoApplied})
                    </span>
                    <span className="font-medium">-{formatPrice(promoDiscount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('cart.shipping')}</span>
                  <div className="text-right">
                    {shippingCalc.isFree ? (
                      <span className="text-green-600 font-medium">{t('cart.free')}</span>
                    ) : (
                      <>
                        <span className="font-medium">{formatPrice(shippingCalc.shippingCAD)}</span>
                        <span className="text-xs text-gray-500 block">{formatUSD(shippingCalc.shippingUSD)}</span>
                      </>
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
                  <div className="text-right">
                    <span>{formatPrice(totalCAD)}</span>
                    <span className="text-sm text-gray-500 font-normal block">≈ {formatUSD(totalUSD)}</span>
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
                    {t('checkout.estimatedDelivery') || 'Livraison estimée'}: <strong>{shippingCalc.estimatedDays} {t('checkout.businessDays')}</strong>
                  </span>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 mt-4 text-center">
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
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
        completed ? 'bg-orange-500 text-white' :
        active ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
      }`}>
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
