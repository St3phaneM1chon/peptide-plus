/**
 * ORDER SUMMARY COMPONENT
 * Résumé de commande pour la page de suivi
 */

'use client';

interface OrderSummaryProps {
  order: {
    id: string;
    amount: number | any;
    currency: string;
    paymentMethod: string;
    createdAt: Date;
    product: {
      id: string;
      name: string;
      slug: string;
      imageUrl: string | null;
      category: {
        name: string;
      } | null;
    };
    user: {
      name: string | null;
      email: string;
    };
  };
}

export function OrderSummary({ order }: OrderSummaryProps) {
  const subtotal = Number(order.amount);
  const tps = subtotal * 0.05;
  const tvq = subtotal * 0.09975;
  const total = subtotal + tps + tvq;

  const paymentMethodLabels: Record<string, string> = {
    STRIPE_CARD: 'Carte de crédit',
    APPLE_PAY: 'Apple Pay',
    GOOGLE_PAY: 'Google Pay',
    PAYPAL: 'PayPal',
    VISA_CLICK_TO_PAY: 'Visa Click to Pay',
    MASTERCARD_CLICK_TO_PAY: 'Mastercard Click to Pay',
  };

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
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--gray-500)',
          marginBottom: '20px',
        }}
      >
        Détails de la commande
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
            height: '80px',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: 'var(--gray-100)',
            flexShrink: 0,
          }}
        >
          {order.product.imageUrl ? (
            <img
              src={order.product.imageUrl}
              alt={order.product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, var(--gray-200) 0%, var(--gray-300) 100%)',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="var(--gray-400)"
                width="32"
                height="32"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                />
              </svg>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          {order.product.category && (
            <p
              style={{
                fontSize: '12px',
                color: 'var(--gray-400)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px',
              }}
            >
              {order.product.category.name}
            </p>
          )}
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--gray-500)',
              marginBottom: '4px',
            }}
          >
            {order.product.name}
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
            Formation en ligne
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <p
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--gray-500)',
            }}
          >
            {subtotal.toFixed(2)} $
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
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--gray-500)',
            }}
          >
            {total.toFixed(2)} $ {order.currency}
          </span>
        </div>
      </div>

      {/* Informations */}
      <div
        style={{
          backgroundColor: 'var(--gray-100)',
          borderRadius: '8px',
          padding: '16px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px',
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
              Date de commande
            </p>
            <p style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
              {new Date(order.createdAt).toLocaleDateString('fr-CA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--gray-400)',
                marginBottom: '4px',
              }}
            >
              Mode de paiement
            </p>
            <p style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
              {paymentMethodLabels[order.paymentMethod] || order.paymentMethod}
            </p>
          </div>
          <div>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--gray-400)',
                marginBottom: '4px',
              }}
            >
              Client
            </p>
            <p style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
              {order.user.name || order.user.email}
            </p>
          </div>
          <div>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--gray-400)',
                marginBottom: '4px',
              }}
            >
              Email
            </p>
            <p style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
              {order.user.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderSummary;
