/**
 * SHIPPING ADDRESS FORM
 * Formulaire d'adresse de livraison pour produits physiques
 */

'use client';

import { useState, useEffect } from 'react';

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

const PROVINCES_CANADA = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'Colombie-Britannique' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'Nouveau-Brunswick' },
  { code: 'NL', name: 'Terre-Neuve-et-Labrador' },
  { code: 'NS', name: 'Nouvelle-Écosse' },
  { code: 'NT', name: 'Territoires du Nord-Ouest' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Île-du-Prince-Édouard' },
  { code: 'QC', name: 'Québec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

export function ShippingAddressForm({
  savedAddresses,
  onAddressChange,
  userName,
}: ShippingAddressFormProps) {
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
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid var(--gray-200)',
      }}
    >
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--gray-500)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
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
            d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
          />
        </svg>
        Adresse de livraison
      </h2>

      {/* Adresses sauvegardées */}
      {savedAddresses.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--gray-500)',
              marginBottom: '12px',
            }}
          >
            Adresses enregistrées
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {savedAddresses.map((address) => (
              <label
                key={address.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px',
                  border: `2px solid ${
                    selectedAddressId === address.id
                      ? 'var(--gray-500)'
                      : 'var(--gray-200)'
                  }`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <input
                  type="radio"
                  name="shippingAddress"
                  value={address.id}
                  checked={selectedAddressId === address.id}
                  onChange={() => setSelectedAddressId(address.id)}
                  style={{ marginTop: '2px' }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--gray-500)',
                      }}
                    >
                      {address.recipientName}
                    </span>
                    {address.label && (
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          backgroundColor: 'var(--gray-100)',
                          borderRadius: '10px',
                          color: 'var(--gray-400)',
                        }}
                      >
                        {address.label}
                      </span>
                    )}
                    {address.isDefault && (
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          backgroundColor: '#E8F5E9',
                          borderRadius: '10px',
                          color: '#4CAF50',
                        }}
                      >
                        Par défaut
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                    {address.addressLine1}
                    {address.addressLine2 && `, ${address.addressLine2}`}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
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
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px',
          border: `2px solid ${
            selectedAddressId === 'new' ? 'var(--gray-500)' : 'var(--gray-200)'
          }`,
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: selectedAddressId === 'new' ? '20px' : '0',
        }}
      >
        <input
          type="radio"
          name="shippingAddress"
          value="new"
          checked={selectedAddressId === 'new'}
          onChange={() => setSelectedAddressId('new')}
        />
        <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
          {savedAddresses.length > 0
            ? 'Utiliser une nouvelle adresse'
            : 'Entrer mon adresse'}
        </span>
      </label>

      {/* Formulaire nouvelle adresse */}
      {selectedAddressId === 'new' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px',
          }}
        >
          {/* Nom complet */}
          <div style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Nom complet du destinataire</label>
            <input
              type="text"
              value={newAddress.recipientName}
              onChange={(e) =>
                setNewAddress({ ...newAddress, recipientName: e.target.value })
              }
              className="form-input"
              placeholder="Jean Dupont"
              required
            />
          </div>

          {/* Adresse ligne 1 */}
          <div style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Adresse</label>
            <input
              type="text"
              value={newAddress.addressLine1}
              onChange={(e) =>
                setNewAddress({ ...newAddress, addressLine1: e.target.value })
              }
              className="form-input"
              placeholder="123 Rue Principale"
              required
            />
          </div>

          {/* Adresse ligne 2 */}
          <div style={{ gridColumn: 'span 2' }}>
            <label className="form-label">
              Appartement, suite, etc. (optionnel)
            </label>
            <input
              type="text"
              value={newAddress.addressLine2}
              onChange={(e) =>
                setNewAddress({ ...newAddress, addressLine2: e.target.value })
              }
              className="form-input"
              placeholder="Apt 4B"
            />
          </div>

          {/* Ville */}
          <div>
            <label className="form-label">Ville</label>
            <input
              type="text"
              value={newAddress.city}
              onChange={(e) =>
                setNewAddress({ ...newAddress, city: e.target.value })
              }
              className="form-input"
              placeholder="Montréal"
              required
            />
          </div>

          {/* Province */}
          <div>
            <label className="form-label">Province</label>
            <select
              value={newAddress.state}
              onChange={(e) =>
                setNewAddress({ ...newAddress, state: e.target.value })
              }
              className="form-input form-select"
              required
            >
              {PROVINCES_CANADA.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Code postal */}
          <div>
            <label className="form-label">Code postal</label>
            <input
              type="text"
              value={newAddress.postalCode}
              onChange={(e) =>
                setNewAddress({
                  ...newAddress,
                  postalCode: e.target.value.toUpperCase(),
                })
              }
              className="form-input"
              placeholder="H2X 1Y6"
              maxLength={7}
              required
            />
          </div>

          {/* Téléphone */}
          <div>
            <label className="form-label">Téléphone (optionnel)</label>
            <input
              type="tel"
              value={newAddress.phone}
              onChange={(e) =>
                setNewAddress({ ...newAddress, phone: e.target.value })
              }
              className="form-input"
              placeholder="(514) 555-0123"
            />
          </div>

          {/* Sauvegarder */}
          <div style={{ gridColumn: 'span 2' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={newAddress.saveAddress}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, saveAddress: e.target.checked })
                }
              />
              <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
                Sauvegarder cette adresse pour mes prochaines commandes
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShippingAddressForm;
