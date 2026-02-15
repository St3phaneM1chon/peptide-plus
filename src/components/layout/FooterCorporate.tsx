/**
 * FOOTER CORPORATE
 * Pied de page complet pour sites corporatifs
 */

'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n/client';
import { footerNavigation, legalLinks, socialLinks } from '@/config/navigation';

export function FooterCorporate() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const getLabel = (key: string) => {
    const label = t(`navigation.${key}`);
    if (label !== `navigation.${key}`) return label;
    const footerLabel = t(`footer.${key}`);
    if (footerLabel !== `footer.${key}`) return footerLabel;
    return key;
  };

  return (
    <footer
      style={{
        backgroundColor: 'var(--gray-500)',
        color: 'white',
      }}
    >
      {/* Newsletter */}
      <div
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
              {t('footer.subscribeNewsletter')}
            </h3>
            <p style={{ fontSize: '14px', opacity: 0.8 }}>
              Recevez nos dernières actualités et offres exclusives.
            </p>
          </div>
          <form
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="email"
              placeholder={t('auth.email')}
              style={{
                padding: '12px 20px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '14px',
                minWidth: '280px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'white',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '12px 24px',
                backgroundColor: 'white',
                color: 'var(--gray-500)',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('common.submit')}
            </button>
          </form>
        </div>
      </div>

      {/* Main footer */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '64px 24px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '48px',
          }}
        >
          {/* Logo & Description */}
          <div style={{ gridColumn: 'span 1' }}>
            <Link
              href="/"
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'white',
                textDecoration: 'none',
                display: 'block',
                marginBottom: '16px',
              }}
            >
              {process.env.NEXT_PUBLIC_SITE_NAME || 'FORMATIONS'}
            </Link>
            <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: 1.6, marginBottom: '24px' }}>
              {process.env.NEXT_PUBLIC_SITE_DESCRIPTION ||
                'Formations professionnelles de qualité pour développer vos compétences.'}
            </p>
            
            {/* Social links */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    transition: 'background 0.2s ease',
                  }}
                  aria-label={social.name}
                >
                  <SocialIcon name={social.icon} />
                </a>
              ))}
            </div>
          </div>

          {/* Navigation sections */}
          {footerNavigation.map((section) => (
            <div key={section.key}>
              <h4
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '20px',
                  opacity: 0.9,
                }}
              >
                {getLabel(section.key)}
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {section.items.map((item) => (
                  <li key={item.key} style={{ marginBottom: '12px' }}>
                    <Link
                      href={item.href}
                      style={{
                        fontSize: '14px',
                        color: 'rgba(255,255,255,0.7)',
                        textDecoration: 'none',
                        transition: 'color 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                    >
                      {getLabel(item.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact info */}
          <div>
            <h4
              style={{
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '20px',
                opacity: 0.9,
              }}
            >
              {t('nav.contact')}
            </h4>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
              <p>{process.env.NEXT_PUBLIC_ADDRESS || '123 Rue Principale'}</p>
              <p>{process.env.NEXT_PUBLIC_CITY || 'Montréal, QC H2X 1Y6'}</p>
              <p style={{ marginTop: '16px' }}>
                <a href={`tel:${process.env.NEXT_PUBLIC_PHONE || '1-800-XXX-XXXX'}`} style={{ color: 'inherit' }}>
                  📞 {process.env.NEXT_PUBLIC_PHONE || '1-800-XXX-XXXX'}
                </a>
              </p>
              <p>
                <a href={`mailto:${process.env.NEXT_PUBLIC_EMAIL || 'info@biocyclepeptides.com'}`} style={{ color: 'inherit' }}>
                  ✉️ {process.env.NEXT_PUBLIC_EMAIL || 'info@biocyclepeptides.com'}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <p style={{ fontSize: '13px', opacity: 0.7 }}>
            © {currentYear} {process.env.NEXT_PUBLIC_SITE_NAME || 'Formations Pro'}. {t('footer.allRightsReserved')}.
          </p>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
            {legalLinks.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.7)',
                  textDecoration: 'none',
                }}
              >
                {t(`footer.${link.key}`)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// Social Icons
function SocialIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    linkedin: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
      </svg>
    ),
    twitter: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    facebook: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
      </svg>
    ),
    instagram: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
    youtube: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
      </svg>
    ),
  };

  return icons[name] || null;
}

export default FooterCorporate;
