/**
 * LAYOUT PUBLIC - Style Shopify
 * Avec CartProvider et Header
 */

import { CartProvider } from '@/components/cart/CartDrawer';
import { HeaderShopify } from '@/components/layout/HeaderShopify';
import { SessionProvider } from 'next-auth/react';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <CartProvider>
        <HeaderShopify />
        <main>{children}</main>
        <Footer />
      </CartProvider>
    </SessionProvider>
  );
}

function Footer() {
  return (
    <footer
      style={{
        backgroundColor: '#FAFAFA',
        borderTop: '1px solid #E0E0E0',
        padding: '60px 24px 40px',
        marginTop: '80px',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '40px',
        }}
      >
        {/* About */}
        <div>
          <h4
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#424242',
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            À Propos
          </h4>
          <p style={{ fontSize: '14px', color: '#9E9E9E', lineHeight: 1.6 }}>
            Plateforme de formation professionnelle certifiée.
            Développez vos compétences avec nos experts.
          </p>
        </div>

        {/* Links */}
        <div>
          <h4
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#424242',
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Liens Rapides
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {['Catalogue', 'Mon Compte', 'Panier', 'Contact'].map((item) => (
              <li key={item} style={{ marginBottom: '8px' }}>
                <a
                  href="#"
                  style={{
                    fontSize: '14px',
                    color: '#9E9E9E',
                    textDecoration: 'none',
                  }}
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#424242',
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Légal
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {['Confidentialité', 'Conditions', 'Remboursement', 'Cookies'].map(
              (item) => (
                <li key={item} style={{ marginBottom: '8px' }}>
                  <a
                    href="#"
                    style={{
                      fontSize: '14px',
                      color: '#9E9E9E',
                      textDecoration: 'none',
                    }}
                  >
                    {item}
                  </a>
                </li>
              )
            )}
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h4
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#424242',
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Newsletter
          </h4>
          <p
            style={{
              fontSize: '14px',
              color: '#9E9E9E',
              marginBottom: '12px',
            }}
          >
            Recevez nos dernières formations
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="email"
              placeholder="Votre email"
              style={{
                flex: 1,
                padding: '10px 14px',
                fontSize: '14px',
                border: '1px solid #E0E0E0',
                borderRadius: '6px',
                outline: 'none',
              }}
            />
            <button
              className="btn btn-primary"
              style={{ padding: '10px 16px' }}
            >
              OK
            </button>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div
        style={{
          maxWidth: '1280px',
          margin: '40px auto 0',
          paddingTop: '24px',
          borderTop: '1px solid #E0E0E0',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '13px', color: '#9E9E9E' }}>
          © {new Date().getFullYear()} Formations Pro. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
