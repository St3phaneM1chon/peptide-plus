/**
 * CHECKOUT PAGE CLIENT
 * Gère les produits digitaux ET physiques
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CheckoutForm } from '@/components/payment/CheckoutForm';
import { ShippingAddressForm } from '@/components/checkout/ShippingAddressForm';

interface CheckoutPageClientProps {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice: number | null;
    imageUrl: string | null;
    categoryName: string | null;
    productType: string;
    duration: number | null;
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
  savedAddresses: {
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
  }[];
  isPhysical: boolean;
}

export function CheckoutPageClient({
  product,
  user,
  savedCards,
  savedAddresses,
  isPhysical,
}: CheckoutPageClientProps) {
  const [shippingAddress, setShippingAddress] = useState<{
    recipientName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
    saveAddress: boolean;
  } | null>(null);
  const [currentStep, setCurrentStep] = useState<'shipping' | 'payment'>(
    isPhysical ? 'shipping' : 'payment'
  );

  const subtotal = product.price;
  const tps = subtotal * 0.05;
  const tvq = subtotal * 0.09975;
  const shipping = isPhysical ? 9.99 : 0; // Frais de livraison fixes pour l'exemple
  const total = subtotal + tps + tvq + shipping;

  const isDigital = product.productType === 'DIGITAL';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--gray-100)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: 'var(--gray-500)',
              marginBottom: '8px',
            }}
          >
            Finaliser la commande
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
            {isDigital
              ? '📱 Produit numérique - Accès immédiat après paiement'
              : '📦 Produit physique - Livraison requise'}
          </p>
        </div>

        {/* Étapes pour produits physiques */}
        {isPhysical && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '32px',
            }}
          >
            <StepIndicator
              number={1}
              label="Livraison"
              active={currentStep === 'shipping'}
              completed={currentStep === 'payment'}
            />
            <div
              style={{
                flex: 1,
                height: '2px',
                backgroundColor:
                  currentStep === 'payment' ? 'var(--gray-500)' : 'var(--gray-200)',
              }}
            />
            <StepIndicator
              number={2}
              label="Paiement"
              active={currentStep === 'payment'}
              completed={false}
            />
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 380px',
            gap: '32px',
            alignItems: 'start',
          }}
        >
          {/* Colonne principale */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Étape Livraison (produits physiques) */}
            {isPhysical && currentStep === 'shipping' && (
              <>
                <ShippingAddressForm
                  savedAddresses={savedAddresses}
                  onAddressChange={setShippingAddress}
                  userName={user.name}
                />

                <button
                  onClick={() => setCurrentStep('payment')}
                  disabled={!shippingAddress}
                  className="btn btn-primary"
                  style={{
                    padding: '16px 32px',
                    width: '100%',
                    opacity: shippingAddress ? 1 : 0.5,
                    cursor: shippingAddress ? 'pointer' : 'not-allowed',
                  }}
                >
                  Continuer vers le paiement
                </button>
              </>
            )}

            {/* Étape Paiement */}
            {(currentStep === 'payment' || !isPhysical) && (
              <>
                {/* Récapitulatif adresse pour produits physiques */}
                {isPhysical && shippingAddress && (
                  <div
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '20px 24px',
                      border: '1px solid var(--gray-200)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: '12px',
                            color: 'var(--gray-400)',
                            marginBottom: '4px',
                          }}
                        >
                          Livraison à
                        </p>
                        <p
                          style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: 'var(--gray-500)',
                          }}
                        >
                          {shippingAddress.recipientName}
                        </p>
                        <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                          {shippingAddress.addressLine1}, {shippingAddress.city},{' '}
                          {shippingAddress.state} {shippingAddress.postalCode}
                        </p>
                      </div>
                      <button
                        onClick={() => setCurrentStep('shipping')}
                        style={{
                          fontSize: '13px',
                          color: 'var(--gray-400)',
                          textDecoration: 'underline',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Modifier
                      </button>
                    </div>
                  </div>
                )}

                <CheckoutForm
                  product={{
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    slug: product.slug,
                  }}
                  user={user}
                  savedCards={savedCards}
                />
              </>
            )}
          </div>

          {/* Sidebar - Résumé */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              border: '1px solid var(--gray-200)',
              position: 'sticky',
              top: '100px',
            }}
          >
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--gray-500)',
                marginBottom: '20px',
              }}
            >
              Résumé
            </h2>

            {/* Produit */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                paddingBottom: '20px',
                marginBottom: '20px',
                borderBottom: '1px solid var(--gray-200)',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '60px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--gray-100)',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    sizes="80px"
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background:
                        'linear-gradient(135deg, var(--gray-200) 0%, var(--gray-300) 100%)',
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1 }}>
                {product.categoryName && (
                  <p
                    style={{
                      fontSize: '11px',
                      color: 'var(--gray-400)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '2px',
                    }}
                  >
                    {product.categoryName}
                  </p>
                )}
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--gray-500)',
                    marginBottom: '4px',
                    lineHeight: 1.3,
                  }}
                >
                  {product.name}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                  {isDigital ? '📱 Accès immédiat' : '📦 Livraison'}
                </p>
              </div>
            </div>

            {/* Totaux */}
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                  Sous-total
                </span>
                <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
                  {subtotal.toFixed(2)} $
                </span>
              </div>

              {product.compareAtPrice && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                    Économie
                  </span>
                  <span style={{ fontSize: '14px', color: '#4CAF50' }}>
                    -{(product.compareAtPrice - product.price).toFixed(2)} $
                  </span>
                </div>
              )}

              {isPhysical && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                    Livraison
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
                    {shipping.toFixed(2)} $
                  </span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                  TPS (5%)
                </span>
                <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
                  {tps.toFixed(2)} $
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                  TVQ (9.975%)
                </span>
                <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
                  {tvq.toFixed(2)} $
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--gray-200)',
                }}
              >
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--gray-500)',
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'var(--gray-500)',
                  }}
                >
                  {total.toFixed(2)} $ CAD
                </span>
              </div>
            </div>

            {/* Avantages */}
            <div
              style={{
                backgroundColor: 'var(--gray-100)',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {isDigital ? (
                  <>
                    <Benefit icon="⚡" text="Accès instantané" />
                    <Benefit icon="♾️" text="Accès à vie" />
                    <Benefit icon="🏆" text="Certificat inclus" />
                  </>
                ) : (
                  <>
                    <Benefit icon="🚚" text="Livraison suivie" />
                    <Benefit icon="📦" text="Emballage sécurisé" />
                    <Benefit icon="↩️" text="Retours gratuits 30j" />
                  </>
                )}
                <Benefit icon="🔒" text="Paiement sécurisé" />
                <Benefit icon="✓" text="Garantie 30 jours" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 600,
          backgroundColor: completed
            ? '#4CAF50'
            : active
            ? 'var(--gray-500)'
            : 'var(--gray-200)',
          color: completed || active ? 'white' : 'var(--gray-400)',
        }}
      >
        {completed ? '✓' : number}
      </div>
      <span
        style={{
          fontSize: '14px',
          fontWeight: active ? 600 : 400,
          color: active ? 'var(--gray-500)' : 'var(--gray-400)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Benefit({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ fontSize: '13px', color: 'var(--gray-500)' }}>{text}</span>
    </div>
  );
}

export default CheckoutPageClient;
