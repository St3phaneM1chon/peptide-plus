import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'BioCycle Peptides';
  const subtitle = searchParams.get('subtitle') || 'Research-Grade Peptides';
  const type = searchParams.get('type') || 'default'; // default | product | category | article

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
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: 700,
            }}
          >
            BC
          </div>
          <div style={{ color: '#94a3b8', fontSize: '22px', fontWeight: 500 }}>
            biocyclepeptides.com
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '16px',
          }}
        >
          {type === 'product' && (
            <div
              style={{
                color: '#f97316',
                fontSize: '20px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              Product
            </div>
          )}
          {type === 'category' && (
            <div
              style={{
                color: '#22d3ee',
                fontSize: '20px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              Category
            </div>
          )}
          {type === 'article' && (
            <div
              style={{
                color: '#a78bfa',
                fontSize: '20px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              Research
            </div>
          )}
          <div
            style={{
              color: 'white',
              fontSize: title.length > 40 ? '48px' : '60px',
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: '900px',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                color: '#cbd5e1',
                fontSize: '28px',
                fontWeight: 400,
                maxWidth: '800px',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: '24px',
          }}
        >
          <div style={{ color: '#64748b', fontSize: '18px' }}>
            Research-Grade Peptides &bull; Free Shipping on $150+
          </div>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#22c55e',
              }}
            />
            <div style={{ color: '#64748b', fontSize: '16px' }}>
              Lab Tested &bull; COA Available
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
