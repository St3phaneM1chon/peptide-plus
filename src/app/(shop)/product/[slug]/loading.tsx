/**
 * Product detail page loading skeleton.
 * Mimics the two-column layout: image gallery on left, product info on right.
 * Uses inline styles with a CSS pulse animation -- no external dependencies.
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

      <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '32px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <div style={textLine('48px')} />
            <div style={textLine('12px')} />
            <div style={textLine('80px')} />
            <div style={textLine('12px')} />
            <div style={textLine('128px')} />
          </div>

          {/* Main product section: image + info */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '48px',
            }}
          >
            {/* Image gallery */}
            <div>
              <div style={skeleton('100%', '0', { paddingBottom: '100%', borderRadius: '12px' })} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={skeleton('80px', '80px')} />
                ))}
              </div>
            </div>

            {/* Product info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Category badge */}
              <div style={skeleton('96px', '24px', { borderRadius: '9999px' })} />

              {/* Title */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={textLine('75%', '32px')} />
                <div style={textLine('50%', '20px')} />
              </div>

              {/* Price */}
              <div style={textLine('112px', '32px')} />

              {/* Purity / spec badges */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={skeleton('96px', '32px')} />
                <div style={skeleton('128px', '32px')} />
              </div>

              {/* Format selector */}
              <div>
                <div style={{ ...textLine('128px', '16px'), marginBottom: '12px' }} />
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={skeleton('112px', '48px')} />
                  ))}
                </div>
              </div>

              {/* Add to cart */}
              <div style={skeleton('100%', '56px', { borderRadius: '12px' })} />

              {/* Description */}
              <div
                style={{
                  paddingTop: '16px',
                  borderTop: '1px solid #E5E7EB',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ ...textLine('144px', '20px'), marginBottom: '4px' }} />
                <div style={textLine('100%')} />
                <div style={textLine('100%')} />
                <div style={textLine('83%')} />
                <div style={textLine('66%')} />
              </div>

              {/* Specifications table */}
              <div
                style={{
                  paddingTop: '16px',
                  borderTop: '1px solid #E5E7EB',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ ...textLine('128px', '20px'), marginBottom: '4px' }} />
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={textLine('112px')} />
                    <div style={textLine('80px')} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Related products */}
          <div style={{ marginTop: '64px' }}>
            <div style={{ ...textLine('192px', '24px'), marginBottom: '24px' }} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '24px',
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden',
                  }}
                >
                  <div style={skeleton('100%', '0', { paddingBottom: '100%', borderRadius: '0' })} />
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={textLine('80%', '16px')} />
                    <div style={textLine('40%', '14px')} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
