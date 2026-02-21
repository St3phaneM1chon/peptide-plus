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

export default function TermsEN({ siteName }: { siteName: string }) {
  return (
    <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8 }}>
      <Section title="1. Acceptance of Terms">
        <p>
          By accessing or using the {siteName} website (&quot;the Site&quot;), you agree to be
          bound by these terms of use. If you do not accept these terms, you must
          not use the Site or purchase our products.
        </p>
      </Section>

      <Section title="2. Product Description">
        <p>
          {siteName} is a Canadian supplier of high-purity research peptides and compounds.
          Our products include:
        </p>
        <ul>
          <li>Synthetic peptides (vials, cartridges)</li>
          <li>Research supplements (NAD+, creatine, etc.)</li>
          <li>Laboratory accessories (syringes, solvents, needles)</li>
          <li>Research kits and protocols</li>
        </ul>
        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #f59e0b' }}>
          <p style={{ fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
            WARNING - FOR RESEARCH USE ONLY
          </p>
          <p style={{ color: '#92400e', fontSize: '14px' }}>
            All our products are intended EXCLUSIVELY for scientific research and
            laboratory purposes. They are NOT intended for human or animal consumption,
            diagnosis, treatment, or prevention of diseases.
          </p>
        </div>
      </Section>

      <Section title="3. Purchase Conditions">
        <p>
          To purchase from our site, you must:
        </p>
        <ul>
          <li>Be 18 years of age or older</li>
          <li>Provide accurate and complete information</li>
          <li>Agree that products are intended solely for research purposes</li>
          <li>Not resell our products for human consumption</li>
          <li>Comply with all applicable laws and regulations in your jurisdiction</li>
        </ul>
      </Section>

      <Section title="4. User Account">
        <p>
          When creating an account, you agree to:
        </p>
        <ul>
          <li>Provide truthful and up-to-date information</li>
          <li>Maintain the confidentiality of your credentials</li>
          <li>Immediately notify us of any unauthorized access to your account</li>
          <li>Not share your account with third parties</li>
          <li>Be responsible for all activities under your account</li>
        </ul>
      </Section>

      <Section title="5. Pricing and Payment">
        <p>
          All prices are displayed in Canadian dollars (CAD) unless otherwise indicated.
          We accept the following payment methods:
        </p>
        <ul>
          <li>Credit cards (Visa, Mastercard, American Express)</li>
          <li>PayPal</li>
          <li>Apple Pay / Google Pay</li>
        </ul>
        <p style={{ marginTop: '16px' }}>
          Applicable taxes (GST/QST/HST) will be added at checkout based on your
          delivery province. International orders may be subject to customs duties
          and import taxes at the buyer&apos;s expense.
        </p>
      </Section>

      <Section title="6. Shipping">
        <p>
          We ship across Canada and internationally. Delivery times vary by
          destination:
        </p>
        <ul>
          <li>Canada: 3-7 business days</li>
          <li>United States: 5-10 business days</li>
          <li>International: 7-21 business days</li>
        </ul>
        <p style={{ marginTop: '16px' }}>
          Products are shipped with cold packs when necessary and are packaged
          securely and discreetly.
        </p>
      </Section>

      <Section title="7. Return and Refund Policy">
        <p>
          We accept returns under the following conditions:
        </p>
        <ul>
          <li>Products damaged or defective upon receipt</li>
          <li>Order errors on our part</li>
          <li>Products not conforming to specifications</li>
        </ul>
        <p style={{ marginTop: '16px' }}>
          Return requests must be made within 14 days of receipt. Opened or used
          products cannot be returned for safety and quality control reasons.
        </p>
      </Section>

      <Section title="8. Quality and Certifications">
        <p>
          All our peptides are:
        </p>
        <ul>
          <li>Synthesized according to cGMP standards</li>
          <li>Tested by independent third-party laboratories</li>
          <li>Accompanied by a Certificate of Analysis (COA)</li>
          <li>Guaranteed at a minimum purity of 99%</li>
        </ul>
      </Section>

      <Section title="9. Intellectual Property">
        <p>
          All Site content (text, images, logos, scientific data, etc.) is protected
          by copyright and belongs to {siteName}. Any unauthorized reproduction
          is prohibited.
        </p>
      </Section>

      <Section title="10. Limitation of Liability">
        <p>
          {siteName} shall not be held liable for:
        </p>
        <ul>
          <li>Any use of products contrary to these terms</li>
          <li>Any human or animal consumption of our products</li>
          <li>Research results obtained with our products</li>
          <li>Delivery delays caused by third parties</li>
          <li>Indirect or consequential damages</li>
        </ul>
      </Section>

      <Section title="11. Governing Law">
        <p>
          These terms are governed by the laws of the Province of Quebec, Canada.
          Any dispute shall be subject to the exclusive jurisdiction of the courts
          of Montreal, Quebec.
        </p>
      </Section>

      <Section title="12. Amendments">
        <p>
          We reserve the right to modify these terms at any time. Modifications
          will be posted on this page with a new update date. Your continued use
          of the Site after modification constitutes your acceptance of the new terms.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>For any questions regarding these terms:</p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>legal@biocyclepeptides.com</li>
          <li>Montreal, Quebec, Canada</li>
        </ul>
      </Section>
    </div>
  );
}
