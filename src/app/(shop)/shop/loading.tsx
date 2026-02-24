/**
 * Shop / catalog page loading skeleton.
 * Renders a grid of 8 product-card skeletons with a subtle pulse animation.
 * Uses inline styles only -- no external dependencies.
 */
export default function Loading() {
  const skeleton = (
    width: string,
    height: string,
    extra?: React.CSSProperties,
  ): React.CSSProperties => ({
    width,
    height,
    backgroundColor: '#E5E7EB',
    borderRadius: '8px',
    animation: 'skeleton-pulse 1.8s ease-in-out infinite',
    ...extra,
  });

  const textLine = (width: string, height = '12px'): React.CSSProperties =>
    skeleton(width, height, { borderRadius: '4px' });

  return (
    <>
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', padding: '32px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
          {/* Page header */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ ...textLine('224px', '32px'), marginBottom: '12px' }} />
            <div style={textLine('384px', '16px')} />
          </div>

          <div style={{ display: 'flex', gap: '32px' }}>
            {/* Sidebar filters */}
            <aside style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Category filter */}
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid #E5E7EB',
                }}
              >
                <div style={{ ...textLine('112px', '20px'), marginBottom: '16px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} style={textLine('100%', '16px')} />
                  ))}
                </div>
              </div>

              {/* Sort / price filter */}
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid #E5E7EB',
                }}
              >
                <div style={{ ...textLine('80px', '20px'), marginBottom: '16px' }} />
                <div style={skeleton('100%', '40px')} />
              </div>
            </aside>

            {/* Product grid */}
            <div style={{ flex: 1 }}>
              {/* Sort bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '24px',
                }}
              >
                <div style={textLine('128px', '16px')} />
                <div style={skeleton('160px', '40px')} />
              </div>

              {/* Product cards grid -- 8 cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '24px',
                }}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div
                    key={i}
                    style={{
                      borderRadius: '12px',
                      border: '1px solid #E5E7EB',
                      overflow: 'hidden',
                      backgroundColor: '#fff',
                    }}
                  >
                    {/* Card image placeholder */}
                    <div
                      style={skeleton('100%', '0', {
                        paddingBottom: '100%',
                        borderRadius: '0',
                      })}
                    />
                    {/* Card text */}
                    <div
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={textLine('70%', '16px')} />
                      <div style={textLine('50%', '14px')} />
                      <div style={{ ...textLine('30%', '20px'), marginTop: '4px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
