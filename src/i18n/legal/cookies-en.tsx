'use client';

import React, { useState } from 'react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '40px' }} className="legal-content">
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: '#1f2937' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function CookiesEN() {
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true,
    analytics: true,
    functional: true,
    marketing: false,
  });

  const savePreferences = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('biocycle-cookie-preferences', JSON.stringify(preferences));
      setShowPreferences(false);
      alert('Your cookie preferences have been saved.');
    }
  };

  return (
    <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8 }}>
      <Section title="1. What is a Cookie?">
        <p>
          A cookie is a small text file stored on your device (computer, tablet,
          smartphone) when you visit a website. Cookies allow the site to
          recognize your device and remember certain information about your preferences
          or past actions.
        </p>
      </Section>

      <Section title="2. Types of Cookies Used">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#059669' }}>
          Essential Cookies (required)
        </h3>
        <p>
          These cookies are necessary for the BioCycle Peptides site to function:
        </p>
        <ul>
          <li>Authentication and session security</li>
          <li>Remembering your shopping cart</li>
          <li>Language and currency preferences</li>
          <li>Fraud protection</li>
        </ul>
        <p style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
          <strong>Duration:</strong> Session or up to 1 year
        </p>

        <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#3b82f6' }}>
          Analytics Cookies
        </h3>
        <p>
          These cookies help us understand how you use our site:
        </p>
        <ul>
          <li>Pages visited and products viewed</li>
          <li>Time spent on the site</li>
          <li>Errors encountered</li>
          <li>Site performance</li>
        </ul>
        <p style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
          <strong>Service:</strong> Google Analytics (anonymized)
        </p>

        <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#8b5cf6' }}>
          Functional Cookies
        </h3>
        <p>
          These cookies improve your experience on our site:
        </p>
        <ul>
          <li>Remembering your display preferences</li>
          <li>Recently viewed products</li>
          <li>Interface personalization</li>
        </ul>

        <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#CC5500' }}>
          Marketing Cookies (optional)
        </h3>
        <p>
          These cookies are used to display relevant advertisements:
        </p>
        <ul>
          <li>Targeted ads on other sites</li>
          <li>Campaign effectiveness measurement</li>
          <li>Product recommendations</li>
        </ul>
        <p style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
          <strong>Services:</strong> Meta Pixel, Google Ads (if enabled)
        </p>
      </Section>

      <Section title="3. Cookie Management">
        <p>
          On your first visit, a banner allows you to choose which cookies you
          accept. You can change your preferences at any time:
        </p>

        <div style={{ marginTop: '24px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <button
            onClick={() => setShowPreferences(!showPreferences)}
            style={{
              width: '100%',
              padding: '12px 24px',
              backgroundColor: '#CC5500',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Manage My Cookie Preferences
          </button>

          {showPreferences && (
            <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'white', borderRadius: '8px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'not-allowed' }}>
                  <input type="checkbox" checked disabled style={{ width: '18px', height: '18px' }} />
                  <span><strong>Essential</strong> - Always active (required for the site to function)</span>
                </label>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) => setPreferences({...preferences, analytics: e.target.checked})}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span><strong>Analytics</strong> - Help us improve the site</span>
                </label>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences.functional}
                    onChange={(e) => setPreferences({...preferences, functional: e.target.checked})}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span><strong>Functional</strong> - Improve your experience</span>
                </label>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences.marketing}
                    onChange={(e) => setPreferences({...preferences, marketing: e.target.checked})}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span><strong>Marketing</strong> - Personalized advertising</span>
                </label>
              </div>
              <button
                onClick={savePreferences}
                style={{
                  marginTop: '12px',
                  padding: '10px 20px',
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Save My Preferences
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section title="4. Browser Settings">
        <p>
          You can also manage cookies through your browser settings:
        </p>
        <ul>
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Chrome</a></li>
          <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer">Firefox</a></li>
          <li><a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
          <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">Edge</a></li>
        </ul>
        <p style={{ marginTop: '16px' }}>
          <strong>Note:</strong> Blocking certain cookies may affect site functionality
          (cart, login, preferences).
        </p>
      </Section>

      <Section title="5. Third-Party Cookies">
        <p>
          Some cookies are set by third-party services. These services have their own
          privacy policies:
        </p>
        <ul>
          <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Analytics</a></li>
          <li><a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe (payments)</a></li>
          <li><a href="https://www.paypal.com/ca/webapps/mpp/ua/privacy-full" target="_blank" rel="noopener noreferrer">PayPal (payments)</a></li>
        </ul>
      </Section>

      <Section title="6. Retention Period">
        <p>
          Cookie retention periods vary by type:
        </p>
        <ul>
          <li><strong>Session cookies:</strong> Deleted when the browser is closed</li>
          <li><strong>Persistent cookies:</strong> Up to 13 months maximum</li>
          <li><strong>Third-party cookies:</strong> According to the third-party service policy</li>
        </ul>
      </Section>

      <Section title="7. Contact">
        <p>For any questions about our use of cookies:</p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>privacy@biocyclepeptides.com</li>
        </ul>
      </Section>
    </div>
  );
}
