'use client';

export default function ErrorBoundary({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>
        Something went wrong
      </h2>
      <p style={{ color: '#6B7280', marginBottom: '24px' }}>
        We encountered an error loading this product. Please try again.
      </p>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
        <button
          onClick={reset}
          style={{
            padding: '10px 24px',
            backgroundColor: '#F97316',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Try again
        </button>
        <a
          href="/shop"
          style={{
            padding: '10px 24px',
            backgroundColor: 'transparent',
            color: '#374151',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Browse Catalog
        </a>
      </div>
    </div>
  );
}
