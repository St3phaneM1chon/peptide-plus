'use client';

import { useState } from 'react';

interface SubscriptionOfferModalProps {
  productId: string;
  formatId?: string | null;
  productName: string;
  formatName?: string | null;
  currentPrice: number;
  onAccept: (frequency: string, discountPercent: number) => void;
  onDecline: () => void;
}

const FREQUENCIES = [
  { id: 'WEEKLY', label: 'Hebdomadaire', discount: 20 },
  { id: 'BIWEEKLY', label: 'Aux 2 semaines', discount: 15 },
  { id: 'MONTHLY', label: 'Mensuel', discount: 10 },
  { id: 'BIMONTHLY', label: 'Aux 2 mois', discount: 5 },
];

export default function SubscriptionOfferModal({
  productName,
  formatName,
  currentPrice,
  onAccept,
  onDecline,
}: SubscriptionOfferModalProps) {
  const [selectedFrequency, setSelectedFrequency] = useState('MONTHLY');

  const selected = FREQUENCIES.find((f) => f.id === selectedFrequency)!;
  const discountedPrice = currentPrice * (1 - selected.discount / 100);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-5 text-white">
          <h2 className="text-xl font-bold">S&apos;abonner et economiser!</h2>
          <p className="text-sm text-white/80 mt-1">
            {productName}
            {formatName ? ` — ${formatName}` : ''}
          </p>
        </div>

        <div className="p-6">
          {/* Current price */}
          <div className="mb-5">
            <p className="text-sm text-gray-500">Prix actuel</p>
            <p className="text-2xl font-bold text-gray-900">${currentPrice.toFixed(2)}</p>
          </div>

          {/* Frequency options */}
          <div className="space-y-2 mb-6">
            {FREQUENCIES.map((freq) => {
              const price = currentPrice * (1 - freq.discount / 100);
              return (
                <label
                  key={freq.id}
                  className={`flex items-center justify-between p-3 border-2 rounded-xl cursor-pointer transition-all ${
                    selectedFrequency === freq.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="subscription-frequency"
                      value={freq.id}
                      checked={selectedFrequency === freq.id}
                      onChange={() => setSelectedFrequency(freq.id)}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">{freq.label}</span>
                      <span className="ml-2 text-sm text-green-600 font-medium">
                        Economisez {freq.discount}%
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900">${price.toFixed(2)}</span>
                </label>
              );
            })}
          </div>

          {/* Savings highlight */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-green-700">
              Vous economisez{' '}
              <span className="font-bold text-green-800">
                ${(currentPrice - discountedPrice).toFixed(2)}
              </span>{' '}
              par livraison ({selected.discount}%)
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onDecline}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Non merci
            </button>
            <button
              onClick={() => onAccept(selectedFrequency, selected.discount)}
              className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
            >
              S&apos;abonner
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-3">
            Annulez ou modifiez a tout moment. Sans engagement.
          </p>
        </div>
      </div>
    </div>
  );
}
