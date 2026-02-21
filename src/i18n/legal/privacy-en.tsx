'use client';

import React from 'react';

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

export default function PrivacyEN({ siteName }: { siteName: string }) {
  return (
    <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8 }}>
      <Section title="1. Introduction">
        <p>
          {siteName} (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to protecting the privacy of its
          clients and visitors. This policy explains how we collect, use,
          disclose, and protect your personal information in accordance with:
        </p>
        <ul>
          <li>The Personal Information Protection and Electronic Documents Act (PIPEDA) - Canada</li>
          <li>Act 25 respecting the protection of personal information - Quebec</li>
          <li>The General Data Protection Regulation (GDPR) - European Union</li>
        </ul>
      </Section>

      <Section title="2. Information Collected">
        <p><strong>Information you provide to us:</strong></p>
        <ul>
          <li>Account information (name, email, password)</li>
          <li>Shipping information (address, phone number)</li>
          <li>Payment information (securely processed by Stripe/PayPal)</li>
          <li>Communications (support messages, product inquiries)</li>
        </ul>

        <p style={{ marginTop: '16px' }}><strong>Information collected automatically:</strong></p>
        <ul>
          <li>Browsing data (pages visited, products viewed)</li>
          <li>Technical information (device type, browser, operating system)</li>
          <li>IP address and approximate location data</li>
          <li>Cookies and similar technologies (see our cookie policy)</li>
        </ul>
      </Section>

      <Section title="3. Use of Information">
        <p>We use your information to:</p>
        <ul>
          <li>Process and ship your research product orders</li>
          <li>Manage your account and loyalty program</li>
          <li>Communicate about the status of your orders</li>
          <li>Respond to your questions and support requests</li>
          <li>Send information about our new products (with your consent)</li>
          <li>Improve our site and services</li>
          <li>Prevent fraud and ensure security</li>
          <li>Meet our legal and tax obligations</li>
        </ul>
      </Section>

      <Section title="4. Legal Basis for Processing">
        <p>We process your data on the following legal bases:</p>
        <ul>
          <li><strong>Performance of a contract:</strong> to process your orders and deliveries</li>
          <li><strong>Consent:</strong> for marketing communications and newsletters</li>
          <li><strong>Legitimate interests:</strong> to improve our services and prevent fraud</li>
          <li><strong>Legal obligation:</strong> for tax and regulatory compliance</li>
        </ul>
      </Section>

      <Section title="5. Sharing of Information">
        <p>We never sell your personal data. We may share it with:</p>
        <ul>
          <li><strong>Carriers:</strong> Canada Post, FedEx, UPS for delivery</li>
          <li><strong>Payment processors:</strong> Stripe, PayPal (payment data only)</li>
          <li><strong>Analytics services:</strong> Google Analytics (anonymized data)</li>
          <li><strong>Legal authorities:</strong> if required by law or court order</li>
        </ul>
        <p style={{ marginTop: '16px' }}>
          All our partners are contractually required to protect your data and use it
          only for the specified purposes.
        </p>
      </Section>

      <Section title="6. Data Security">
        <p>
          We implement rigorous security measures to protect your data:
        </p>
        <ul>
          <li>SSL/TLS encryption for all data transmissions</li>
          <li>Encryption of sensitive data at rest</li>
          <li>Two-factor authentication available for accounts</li>
          <li>Restricted data access on a need-to-know basis</li>
          <li>Continuous monitoring and regular security audits</li>
          <li>Hosting on secure servers in Canada</li>
        </ul>
      </Section>

      <Section title="7. Your Rights">
        <p>Under applicable laws, you have the right to:</p>
        <ul>
          <li><strong>Access:</strong> obtain a copy of your personal data</li>
          <li><strong>Rectification:</strong> correct your inaccurate or incomplete data</li>
          <li><strong>Erasure:</strong> request deletion of your data (&quot;right to be forgotten&quot;)</li>
          <li><strong>Portability:</strong> receive your data in a structured, readable format</li>
          <li><strong>Objection:</strong> object to the processing of your data for marketing purposes</li>
          <li><strong>Withdrawal of consent:</strong> withdraw your consent at any time</li>
          <li><strong>Complaint:</strong> file a complaint with the Quebec Commission d&apos;acces a l&apos;information</li>
        </ul>
        <p style={{ marginTop: '16px' }}>
          To exercise these rights, contact us at: <strong>privacy@biocyclepeptides.com</strong>
        </p>
      </Section>

      <Section title="8. Data Retention">
        <p>
          We retain your personal data for the following periods:
        </p>
        <ul>
          <li><strong>Account data:</strong> duration of the business relationship + 3 years</li>
          <li><strong>Order data:</strong> 7 years (Canadian tax obligations)</li>
          <li><strong>Browsing data:</strong> 13 months maximum</li>
          <li><strong>Support communications:</strong> 3 years after resolution</li>
        </ul>
      </Section>

      <Section title="9. International Transfers">
        <p>
          Your data is primarily stored in Canada. In the event of transfer to other
          countries (e.g., the United States for certain services), we ensure that appropriate
          safeguards are in place (standard contractual clauses, certifications).
        </p>
      </Section>

      <Section title="10. Cookies">
        <p>
          We use cookies and similar technologies. For more information, see our{' '}
          <a href="/mentions-legales/cookies" style={{ color: '#CC5500', fontWeight: 500 }}>
            Cookie Policy
          </a>.
        </p>
      </Section>

      <Section title="11. Data Protection Officer">
        <p>
          For any questions about the protection of your personal data, you may
          contact our Data Protection Officer:
        </p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>privacy@biocyclepeptides.com</li>
          <li>Montreal, Quebec, Canada</li>
        </ul>
      </Section>

      <Section title="12. Changes">
        <p>
          We may modify this policy at any time. Significant changes will be communicated
          by email or through our site. The current version is always available on this page
          with the date of last update.
        </p>
      </Section>
    </div>
  );
}
