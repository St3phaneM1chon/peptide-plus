'use client';

import { useState } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { useCurrency } from '@/contexts/CurrencyContext';
import { toast } from 'sonner';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

const PRESET_AMOUNTS = [25, 50, 100, 200];

export default function GiftCardsPage() {
  const { t } = useTranslations();
  const { formatPrice } = useCurrency();

  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchasedCard, setPurchasedCard] = useState<{
    code: string;
    amount: number;
  } | null>(null);

  const handleAmountChange = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 25 && numValue <= 1000) {
      setSelectedAmount(numValue);
    }
  };

  const finalAmount = customAmount ? parseFloat(customAmount) : selectedAmount;

  const handlePurchase = async () => {
    if (finalAmount < 25 || finalAmount > 1000) {
      toast.error('Amount must be between $25 and $1000');
      return;
    }

    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/gift-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalAmount,
          recipientEmail: recipientEmail || null,
          recipientName: recipientName || null,
          message: message || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create gift card');
      }

      setPurchasedCard({
        code: data.giftCard.code,
        amount: data.giftCard.amount,
      });

      toast.success('Gift card created successfully!');
    } catch (error) {
      console.error('Gift card purchase error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to purchase gift card');
    } finally {
      setIsProcessing(false);
    }
  };

  if (purchasedCard) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <Breadcrumbs
          items={[
            { label: t('nav.home') || 'Home', href: '/' },
            { label: 'Gift Cards' },
          ]}
        />

        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-3xl font-bold mb-2">Gift Card Created!</h1>
            <p className="text-gray-600 mb-8">Your gift card is ready to use</p>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-8 text-white mb-8">
              <div className="text-sm font-medium mb-2 opacity-90">GIFT CARD</div>
              <div className="text-4xl font-bold mb-6 font-mono tracking-wider">
                {purchasedCard.code}
              </div>
              <div className="text-2xl font-bold">
                {formatPrice(purchasedCard.amount)}
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(purchasedCard.code);
                  toast.success('Code copied to clipboard!');
                }}
                className="w-full px-6 py-3 bg-gray-100 text-gray-800 font-semibold rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Code
              </button>

              <button
                onClick={() => window.print()}
                className="w-full px-6 py-3 bg-gray-100 text-gray-800 font-semibold rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Gift Card
              </button>
            </div>

            <button
              onClick={() => {
                setPurchasedCard(null);
                setRecipientName('');
                setRecipientEmail('');
                setMessage('');
              }}
              className="text-orange-600 hover:underline"
            >
              Purchase Another Gift Card
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <Breadcrumbs
        items={[
          { label: t('nav.home') || 'Home', href: '/' },
          { label: 'Gift Cards' },
        ]}
      />

      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Gift Cards</h1>
          <p className="text-gray-600 text-lg">
            Give the gift of wellness. Perfect for any occasion.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Purchase Form */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-6">Purchase Gift Card</h2>

            {/* Amount Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Amount
              </label>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {PRESET_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleAmountChange(amount)}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-colors ${
                      selectedAmount === amount && !customAmount
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {formatPrice(amount)}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or enter custom amount ($25 - $1000)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    min="25"
                    max="1000"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* Recipient Information */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Recipient Information (Optional)
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Recipient Email</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Personal Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a personal message..."
                    rows={4}
                    maxLength={500}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">{message.length}/500 characters</p>
                </div>
              </div>
            </div>

            <button
              onClick={handlePurchase}
              disabled={isProcessing || finalAmount < 25 || finalAmount > 1000}
              className="w-full px-6 py-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  Purchase Gift Card - {formatPrice(finalAmount)}
                </>
              )}
            </button>
          </div>

          {/* Right: Preview */}
          <div>
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-bold mb-4">Gift Card Preview</h3>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-8 text-white">
                <div className="text-sm font-medium mb-2 opacity-90">PEPTIDE PLUS+</div>
                <div className="text-sm font-medium mb-6 opacity-90">GIFT CARD</div>

                <div className="text-3xl font-bold mb-8">
                  {formatPrice(finalAmount)}
                </div>

                {recipientName && (
                  <div className="border-t border-white/30 pt-4">
                    <div className="text-xs opacity-75 mb-1">TO:</div>
                    <div className="font-medium">{recipientName}</div>
                  </div>
                )}

                {message && (
                  <div className="border-t border-white/30 pt-4 mt-4">
                    <div className="text-xs opacity-75 mb-1">MESSAGE:</div>
                    <div className="text-sm italic opacity-90">&quot;{message}&quot;</div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Gift Card Details</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Valid for 1 year from purchase date
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Can be used for any product on our site
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Balance can be used across multiple orders
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Non-refundable and cannot be exchanged for cash
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
