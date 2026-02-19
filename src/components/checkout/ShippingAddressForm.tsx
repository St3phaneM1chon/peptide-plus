/**
 * SHIPPING ADDRESS FORM
 * Formulaire d'adresse de livraison pour produits physiques
 */

'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/client';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';

interface ShippingAddress {
  recipientName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  saveAddress: boolean;
}

interface SavedAddress {
  id: string;
  label: string | null;
  recipientName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

interface ShippingAddressFormProps {
  savedAddresses: SavedAddress[];
  onAddressChange: (address: ShippingAddress | null) => void;
  userName: string;
}

const PROVINCE_CODES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'] as const;

export function ShippingAddressForm({
  savedAddresses,
  onAddressChange,
  userName,
}: ShippingAddressFormProps) {
  const { t } = useI18n();
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new'>(
    savedAddresses.find((a) => a.isDefault)?.id || savedAddresses[0]?.id || 'new'
  );

  const [newAddress, setNewAddress] = useState<ShippingAddress>({
    recipientName: userName,
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: 'QC',
    postalCode: '',
    country: 'CA',
    phone: '',
    saveAddress: true,
  });

  // Notifier le parent quand l'adresse change
  useEffect(() => {
    if (selectedAddressId === 'new') {
      // Vérifier si l'adresse est complète
      if (
        newAddress.recipientName &&
        newAddress.addressLine1 &&
        newAddress.city &&
        newAddress.state &&
        newAddress.postalCode
      ) {
        onAddressChange(newAddress);
      } else {
        onAddressChange(null);
      }
    } else {
      const saved = savedAddresses.find((a) => a.id === selectedAddressId);
      if (saved) {
        onAddressChange({
          recipientName: saved.recipientName,
          addressLine1: saved.addressLine1,
          addressLine2: saved.addressLine2 || '',
          city: saved.city,
          state: saved.state,
          postalCode: saved.postalCode,
          country: saved.country,
          phone: saved.phone || '',
          saveAddress: false,
        });
      }
    }
  }, [selectedAddressId, newAddress, savedAddresses, onAddressChange]);

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-500 mb-5 flex items-center gap-2">
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
            d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
          />
        </svg>
        {t('checkout.shippingAddress')}
      </h2>

      {/* Adresses sauvegardées */}
      {savedAddresses.length > 0 && (
        <div className="mb-5">
          <p className="text-[13px] font-medium text-gray-500 mb-3">
            {t('checkout.savedAddresses')}
          </p>
          <div className="flex flex-col gap-2">
            {savedAddresses.map((address) => (
              <label
                key={address.id}
                className={`flex items-start gap-3 p-3.5 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedAddressId === address.id ? 'border-gray-500' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="shippingAddress"
                  value={address.id}
                  checked={selectedAddressId === address.id}
                  onChange={() => setSelectedAddressId(address.id)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-500">
                      {address.recipientName}
                    </span>
                    {address.label && (
                      <span className="text-[11px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-400">
                        {address.label}
                      </span>
                    )}
                    {address.isDefault && (
                      <span className="text-[11px] px-2 py-0.5 bg-green-50 rounded-full text-green-600">
                        {t('checkout.defaultAddress')}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-gray-400">
                    {address.addressLine1}
                    {address.addressLine2 && `, ${address.addressLine2}`}
                  </p>
                  <p className="text-[13px] text-gray-400">
                    {address.city}, {address.state} {address.postalCode}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Option nouvelle adresse */}
      <label
        className={`flex items-center gap-3 p-3.5 border-2 rounded-lg cursor-pointer ${
          selectedAddressId === 'new' ? 'border-gray-500 mb-5' : 'border-gray-200 mb-0'
        }`}
      >
        <input
          type="radio"
          name="shippingAddress"
          value="new"
          checked={selectedAddressId === 'new'}
          onChange={() => setSelectedAddressId('new')}
        />
        <span className="text-sm text-gray-500">
          {savedAddresses.length > 0
            ? t('checkout.useNewAddress')
            : t('checkout.enterAddress')}
        </span>
      </label>

      {/* Formulaire nouvelle adresse */}
      {selectedAddressId === 'new' && (
        <div className="grid grid-cols-2 gap-4">
          {/* Nom complet */}
          <div className="col-span-2">
            <label htmlFor="shipping-recipient" className="form-label">{t('checkout.recipientName')}</label>
            <input
              id="shipping-recipient"
              type="text"
              autoComplete="name"
              value={newAddress.recipientName}
              onChange={(e) =>
                setNewAddress({ ...newAddress, recipientName: e.target.value })
              }
              className="form-input"
              placeholder={t('checkout.namePlaceholder')}
              required
            />
          </div>

          {/* Adresse ligne 1 */}
          <div className="col-span-2">
            <label htmlFor="shipping-address1" className="form-label">{t('checkout.address')}</label>
            <AddressAutocomplete
              value={newAddress.addressLine1}
              onChange={(addressComponents) => {
                setNewAddress({
                  ...newAddress,
                  addressLine1: addressComponents.street,
                  city: addressComponents.city,
                  state: addressComponents.province || newAddress.state,
                  postalCode: addressComponents.postalCode,
                  country: addressComponents.country || newAddress.country,
                });
              }}
              onInputChange={(value) =>
                setNewAddress({ ...newAddress, addressLine1: value })
              }
              placeholder="123 Rue Principale"
              className="form-input"
              id="shipping-address1"
              required
            />
          </div>

          {/* Adresse ligne 2 */}
          <div className="col-span-2">
            <label htmlFor="shipping-address2" className="form-label">
              {t('checkout.apartment')}
            </label>
            <input
              id="shipping-address2"
              type="text"
              autoComplete="address-line2"
              value={newAddress.addressLine2}
              onChange={(e) =>
                setNewAddress({ ...newAddress, addressLine2: e.target.value })
              }
              className="form-input"
              placeholder={t('checkout.placeholderApartment')}
            />
          </div>

          {/* Ville */}
          <div>
            <label htmlFor="shipping-city" className="form-label">{t('checkout.city')}</label>
            <input
              id="shipping-city"
              type="text"
              autoComplete="address-level2"
              value={newAddress.city}
              onChange={(e) =>
                setNewAddress({ ...newAddress, city: e.target.value })
              }
              className="form-input"
              placeholder={t('checkout.cityPlaceholder')}
              required
            />
          </div>

          {/* Province */}
          <div>
            <label htmlFor="shipping-province" className="form-label">{t('checkout.province')}</label>
            <select
              id="shipping-province"
              value={newAddress.state}
              onChange={(e) =>
                setNewAddress({ ...newAddress, state: e.target.value })
              }
              className="form-input form-select"
              required
            >
              {PROVINCE_CODES.map((code) => (
                <option key={code} value={code}>
                  {t(`provinces.${code}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Code postal */}
          <div>
            <label htmlFor="shipping-postal" className="form-label">{t('checkout.postalCode')}</label>
            <input
              id="shipping-postal"
              type="text"
              autoComplete="postal-code"
              value={newAddress.postalCode}
              onChange={(e) =>
                setNewAddress({
                  ...newAddress,
                  postalCode: e.target.value.toUpperCase(),
                })
              }
              className="form-input"
              placeholder={t('checkout.placeholderPostalCode')}
              maxLength={7}
              required
            />
          </div>

          {/* Téléphone */}
          <div>
            <label htmlFor="shipping-phone" className="form-label">{t('checkout.phone')}</label>
            <input
              id="shipping-phone"
              type="tel"
              autoComplete="tel"
              value={newAddress.phone}
              onChange={(e) => {
                // Auto-format phone: (XXX) XXX-XXXX
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                let formatted = digits;
                if (digits.length > 6) {
                  formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                } else if (digits.length > 3) {
                  formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                } else if (digits.length > 0) {
                  formatted = `(${digits}`;
                }
                setNewAddress({ ...newAddress, phone: formatted });
              }}
              className="form-input"
              placeholder="(514) 555-0123"
            />
          </div>

          {/* Sauvegarder */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newAddress.saveAddress}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, saveAddress: e.target.checked })
                }
              />
              <span className="text-sm text-gray-500">
                {t('checkout.saveAddressForFuture')}
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShippingAddressForm;
