/**
 * PAGE SUCCÈS PAIEMENT
 * Confirmation + Redirection vers suivi livraison
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  
  const productId = searchParams.get('product');
  const orderId = searchParams.get('order') || `ORD-${Date.now()}`;

  // Countdown et redirection automatique
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(`/order/${orderId}/tracking`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [orderId, router]);

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        backgroundColor: 'var(--gray-100)',
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* Success Icon */}
        <div
          style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 24px',
            backgroundColor: '#4CAF50',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'scaleIn 0.5s ease',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="white"
            width="40"
            height="40"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m4.5 12.75 6 6 9-13.5"
            />
          </svg>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 600,
            color: 'var(--gray-500)',
            marginBottom: '12px',
          }}
        >
          Paiement confirmé!
        </h1>

        <p
          style={{
            fontSize: '16px',
            color: 'var(--gray-400)',
            marginBottom: '32px',
            lineHeight: 1.6,
          }}
        >
          Merci pour votre achat. Votre commande est en cours de traitement.
        </p>

        {/* Order Info Card */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '32px',
            border: '1px solid var(--gray-200)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--gray-200)',
            }}
          >
            <span style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
              Numéro de commande
            </span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--gray-500)',
                fontFamily: 'monospace',
              }}
            >
              {orderId}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: 'var(--gray-100)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="var(--gray-400)"
                width="24"
                height="24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                />
              </svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--gray-500)',
                  marginBottom: '2px',
                }}
              >
                Livraison en cours
              </p>
              <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                Accès immédiat à votre formation
              </p>
            </div>
          </div>
        </div>

        {/* Countdown */}
        <p
          style={{
            fontSize: '14px',
            color: 'var(--gray-400)',
            marginBottom: '16px',
          }}
        >
          Redirection automatique dans{' '}
          <span style={{ fontWeight: 600, color: 'var(--gray-500)' }}>
            {countdown}s
          </span>
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link
            href={`/order/${orderId}/tracking`}
            className="btn btn-primary"
            style={{ padding: '14px 28px' }}
          >
            Suivre ma commande
          </Link>
          <Link
            href="/catalogue"
            className="btn btn-secondary"
            style={{ padding: '14px 28px' }}
          >
            Continuer mes achats
          </Link>
        </div>

        {/* Email notice */}
        <p
          style={{
            fontSize: '13px',
            color: 'var(--gray-400)',
            marginTop: '32px',
          }}
        >
          Un email de confirmation a été envoyé à votre adresse.
        </p>
      </div>

      <style jsx>{`
        @keyframes scaleIn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
