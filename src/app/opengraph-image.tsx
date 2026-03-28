import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Attitudes VIP - Suite Koraline SaaS';
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
          background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0d1b2a 100%)',
          padding: '60px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Logo area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #0066CC 0%, #003366 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '-1px',
            }}
          >
            A
          </div>
          <div style={{ color: 'white', fontSize: '28px', fontWeight: 600, letterSpacing: '-0.5px' }}>
            Attitudes VIP
          </div>
        </div>

        {/* Main headline */}
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
              fontSize: '60px',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-1.5px',
            }}
          >
            Suite Koraline
          </div>
          <div
            style={{
              color: '#94a3b8',
              fontSize: '28px',
              fontWeight: 400,
              lineHeight: 1.4,
            }}
          >
            Plateforme SaaS tout-en-un : commerce, CRM, comptabilite, formation, telephonie
          </div>
        </div>

        {/* Bottom badges */}
        <div
          style={{
            display: 'flex',
            gap: '24px',
            alignItems: 'center',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: '24px',
          }}
        >
          <div
            style={{
              background: 'rgba(0,102,204,0.15)',
              border: '1px solid rgba(0,102,204,0.3)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#60a5fa',
              fontSize: '17px',
              fontWeight: 600,
            }}
          >
            E-Commerce
          </div>
          <div
            style={{
              background: 'rgba(34,211,238,0.12)',
              border: '1px solid rgba(34,211,238,0.25)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#22d3ee',
              fontSize: '17px',
              fontWeight: 600,
            }}
          >
            CRM + Telephonie
          </div>
          <div
            style={{
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#22c55e',
              fontSize: '17px',
              fontWeight: 600,
            }}
          >
            LMS Formation
          </div>
          <div
            style={{
              background: 'rgba(168,85,247,0.12)',
              border: '1px solid rgba(168,85,247,0.25)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#a855f7',
              fontSize: '17px',
              fontWeight: 600,
            }}
          >
            Comptabilite
          </div>
          <div style={{ marginLeft: 'auto', color: '#64748b', fontSize: '18px' }}>
            attitudes.vip
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
