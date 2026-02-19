import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'BioCycle Peptides - Research-Grade Peptides';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          padding: '60px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '28px',
              fontWeight: 700,
            }}
          >
            BC
          </div>
          <div style={{ color: 'white', fontSize: '28px', fontWeight: 600 }}>
            BioCycle Peptides
          </div>
        </div>

        {/* Main */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          <div
            style={{
              color: 'white',
              fontSize: '64px',
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            Research-Grade
            <br />
            Peptides
          </div>
          <div
            style={{
              color: '#cbd5e1',
              fontSize: '30px',
              fontWeight: 400,
            }}
          >
            Premium quality peptides for scientific research
          </div>
        </div>

        {/* Bottom */}
        <div
          style={{
            display: 'flex',
            gap: '32px',
            alignItems: 'center',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: '24px',
          }}
        >
          <div
            style={{
              background: 'rgba(249,115,22,0.15)',
              border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#f97316',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            Lab Tested
          </div>
          <div
            style={{
              background: 'rgba(34,211,238,0.15)',
              border: '1px solid rgba(34,211,238,0.3)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#22d3ee',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            COA Available
          </div>
          <div
            style={{
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#22c55e',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            Free Shipping $150+
          </div>
          <div style={{ marginLeft: 'auto', color: '#64748b', fontSize: '18px' }}>
            biocyclepeptides.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
